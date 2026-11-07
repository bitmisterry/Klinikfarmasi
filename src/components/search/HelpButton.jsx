import React, { useState } from 'react';
import { HelpCircle, X, ArrowRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CONTEXT_HELP, DEFAULT_SEARCH_GUIDES } from '@/lib/searchGuides';
import { getClinicRole, hasPermission } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';

// Tombol ? Bantuan — menampilkan panduan kontekstual sesuai halaman aktif
export default function HelpButton({ onOpenSearch }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const clinicRole = getClinicRole(user);

  const ctx = CONTEXT_HELP[location.pathname];
  if (!ctx) return null;

  const handleQuestion = (q) => {
    // Cari guide yang cocok dengan pertanyaan
    const matched = DEFAULT_SEARCH_GUIDES.find(g =>
      (g.keywords || []).some(k => q.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(q.toLowerCase().split(' ').slice(-1)[0]))
    );
    if (matched) {
      const accessible = !matched.required_permission || hasPermission(clinicRole, matched.required_permission, 'view', roles);
      if (!accessible) return;
      let path = matched.page_path;
      if (matched.action_type === 'navigate_with_param' && matched.action_param) {
        path += (path.includes('?') ? '&' : '?') + matched.action_param;
      }
      setOpen(false);
      if (matched.steps && matched.steps.length > 0) {
        // Open search modal with this query so user sees the step guide
        onOpenSearch?.(q);
      } else {
        navigate(path);
      }
    } else {
      // Fallback: open search with the question as query
      setOpen(false);
      onOpenSearch?.(q);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 h-8 px-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
        title="Bantuan"
      >
        <HelpCircle className="w-4 h-4" />
        <span className="text-xs hidden sm:inline">Bantuan</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4 bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" /> {ctx.title}
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-1 divide-y divide-border">
              {ctx.questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuestion(q)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-2.5"
                >
                  <span className="text-body flex-1">{q}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-border bg-muted/20">
              <button
                onClick={() => { setOpen(false); onOpenSearch?.(); }}
                className="text-caption text-primary hover:text-primary-hover flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Buka Cari & Bantuan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}