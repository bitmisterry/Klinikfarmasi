const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, Clock, ArrowRight, Sparkles, Package, User, FileText, HelpCircle, ChevronRight, Trash2, FolderOpen } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { getClinicRole, hasPermission, canAccess } from '@/lib/roles';
import { DEFAULT_SEARCH_GUIDES, DEFAULT_SEARCH_TERMS, DEFAULT_FREQUENT } from '@/lib/searchGuides';

const CATEGORY_META = {
  'Menu & Fitur': { icon: ChevronRight, label: 'Menu & Fitur' },
  'Cara Melakukan': { icon: FileText, label: 'Cara Melakukan' },
  'Pencarian Data': { icon: Search, label: 'Data' },
  'Pertanyaan': { icon: HelpCircle, label: 'Pertanyaan' },
};

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

// Score how well a query matches a guide's keywords
function scoreGuide(query, guide) {
  const q = normalize(query);
  if (!q) return 0;
  const kws = (guide.keywords || []).map(normalize);
  let best = 0;
  for (const kw of kws) {
    if (q === kw) { best = Math.max(best, 100); continue; }
    if (q.includes(kw) || kw.includes(q)) {
      const ratio = Math.min(q.length, kw.length) / Math.max(q.length, kw.length);
      best = Math.max(best, 60 * ratio);
    }
    // word overlap
    const qw = new Set(q.split(/\s+/));
    const kwW = new Set(kw.split(/\s+/));
    let overlap = 0;
    qw.forEach(w => { if (w.length > 2 && kwW.has(w)) overlap++; });
    if (overlap > 0) best = Math.max(best, 30 + overlap * 10);
  }
  // title match
  const title = normalize(guide.title);
  if (q.includes(title) || title.includes(q)) best = Math.max(best, 80);
  return best;
}

function scoreTerm(query, term) {
  const q = normalize(query);
  if (!q) return 0;
  let best = 0;
  for (const syn of (term.synonyms || []).map(normalize)) {
    if (q === syn) { best = Math.max(best, 100); continue; }
    if (q.includes(syn) || syn.includes(q)) {
      best = Math.max(best, 70);
    }
  }
  if (q.includes(normalize(term.canonical))) best = Math.max(best, 85);
  return best;
}

export default function SearchHelpModal({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, roles } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ guides: [], terms: [], data: [] });
  const [loading, setLoading] = useState(false);
  const [llmResults, setLlmResults] = useState([]);
  const [llmLoading, setLlmLoading] = useState(false);
  const [stepGuide, setStepGuide] = useState(null);
  const [recent, setRecent] = useState([]);
  const [guides, setGuides] = useState([]);
  const [terms, setTerms] = useState([]);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const llmAbortRef = useRef(false);

  const clinicRole = getClinicRole(user);
  const storageKey = `searchRecent_${user?.id || 'anon'}`;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      loadRecent();
      loadGuides();
    } else {
      setQuery('');
      setResults({ guides: [], terms: [], data: [] });
      setLlmResults([]);
      setLlmLoading(false);
      setStepGuide(null);
      llmAbortRef.current = true;
    }
  }, [open]);

  const loadRecent = () => {
    try {
      const r = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setRecent(r.slice(0, 5));
    } catch {}
  };

  const loadGuides = async () => {
    try {
      const [dbGuides, dbTerms] = await Promise.all([
        db.entities.SearchGuide.list().catch(() => []),
        db.entities.SearchTerm.list().catch(() => []),
      ]);
      // Merge defaults with DB (DB overrides by title)
      const dbTitles = new Set((dbGuides || []).map(g => g.title));
      const merged = [
        ...(dbGuides || []).filter(g => g.is_active),
        ...DEFAULT_SEARCH_GUIDES.filter(g => !dbTitles.has(g.title)),
      ];
      const dbTermCanon = new Set((dbTerms || []).map(t => t.canonical));
      const mergedTerms = [
        ...(dbTerms || []).filter(t => t.is_active),
        ...DEFAULT_SEARCH_TERMS.filter(t => !dbTermCanon.has(t.canonical)),
      ];
      setGuides(merged);
      setTerms(mergedTerms);
    } catch {
      setGuides(DEFAULT_SEARCH_GUIDES);
      setTerms(DEFAULT_SEARCH_TERMS);
    }
  };

  const addRecent = (q) => {
    if (!q || q.length < 2) return;
    try {
      const r = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = r.filter(x => x !== q);
      filtered.unshift(q);
      localStorage.setItem(storageKey, JSON.stringify(filtered.slice(0, 8)));
      setRecent(filtered.slice(0, 5));
    } catch {}
  };

  const clearRecent = () => {
    localStorage.removeItem(storageKey);
    setRecent([]);
  };

  const logSearch = useCallback(async (q, found, source, resultTitle) => {
    try {
      await db.entities.SearchLog.create({
        query: q,
        user_id: user?.id,
        user_name: user?.full_name,
        role: clinicRole,
        current_route: location.pathname,
        found,
        source,
        result_title: resultTitle,
        searched_at: new Date().toISOString(),
      });
    } catch {}
  }, [user, clinicRole, location.pathname]);

  // Local matching (synonyms + guides) — fast, no credits
  const runLocalSearch = useCallback((q) => {
    if (!q || q.length < 2) return { guides: [], terms: [] };
    // Check access for each guide
    const accessibleGuides = guides.filter(g => {
      if (!g.required_permission) return true;
      return hasPermission(clinicRole, g.required_permission, 'view', roles);
    });
    // Score guides
    const scoredGuides = accessibleGuides
      .map(g => ({ guide: g, score: scoreGuide(q, g) }))
      .filter(x => x.score >= 25)
      .sort((a, b) => {
        // Boost by role priority
        const aBoost = (a.guide.priority_roles || []).includes(clinicRole) ? 15 : 0;
        const bBoost = (b.guide.priority_roles || []).includes(clinicRole) ? 15 : 0;
        return (b.score + bBoost) - (a.score + aBoost);
      })
      .slice(0, 6)
      .map(x => x.guide);

    // Score terms
    const scoredTerms = terms
      .map(t => ({ term: t, score: scoreTerm(q, t) }))
      .filter(x => x.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(x => x.term);

    return { guides: scoredGuides, terms: scoredTerms };
  }, [guides, terms, clinicRole, roles]);

  // Data search (medicines, patients, invoices)
  const runDataSearch = useCallback(async (q) => {
    if (!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    const dataResults = [];
    try {
      // Medicines — accessible to most roles
      if (canAccess('/master-obat', clinicRole, roles) || canAccess('/pharmacy', clinicRole, roles)) {
        const meds = await db.entities.Medicine.list();
        const matched = (meds || []).filter(m =>
          m.name?.toLowerCase().includes(ql) ||
          m.generic_name?.toLowerCase().includes(ql) ||
          m.active_substance?.toLowerCase().includes(ql) ||
          m.barcode?.includes(ql)
        ).slice(0, 5);
        matched.forEach(m => {
          dataResults.push({
            type: 'medicine',
            title: `${m.name}${m.strength ? ' ' + m.strength : ''}`,
            subtitle: m.generic_name || m.active_substance || '',
            meta: `Stok: ${m.stock_on_hand || 0} ${m.unit || ''}${m.shelf_location ? ' • Rak ' + m.shelf_location : ''}`,
            outOfStock: (m.stock_on_hand || 0) <= 0,
            action: () => navigate('/master-obat'),
            actionLabel: 'Lihat Obat',
            id: m.id,
          });
        });
      }
      // Patients
      if (canAccess('/patients', clinicRole, roles)) {
        const pats = await db.entities.Patient.list();
        const matched = (pats || []).filter(p =>
          p.full_name?.toLowerCase().includes(ql) ||
          p.mr_number?.toLowerCase().includes(ql) ||
          p.phone?.includes(ql)
        ).slice(0, 4);
        matched.forEach(p => {
          dataResults.push({
            type: 'patient',
            title: p.full_name,
            subtitle: `${p.gender === 'L' ? 'Laki-laki' : 'Perempian'}${p.birth_date ? ' • ' + calcAge(p.birth_date) : ''}`,
            meta: p.mr_number || '',
            action: () => navigate('/patients'),
            actionLabel: 'Buka Pasien',
            id: p.id,
          });
        });
      }
      // Invoices
      if (canAccess('/finance', clinicRole, roles)) {
        const invs = await db.entities.SupplierInvoice.list();
        const matched = (invs || []).filter(i =>
          i.invoice_number?.toLowerCase().includes(ql) ||
          i.supplier_name?.toLowerCase().includes(ql)
        ).slice(0, 3);
        matched.forEach(i => {
          dataResults.push({
            type: 'invoice',
            title: `Faktur ${i.invoice_number}`,
            subtitle: `Supplier: ${i.supplier_name || '-'}`,
            meta: `Nilai: Rp ${formatRp(i.total_amount)}${i.due_date ? ' • Jatuh tempo: ' + i.due_date : ''}`,
            action: () => navigate('/finance'),
            actionLabel: 'Buka Faktur',
            id: i.id,
          });
        });
      }
      // Documents — search by name, owner_name, document_number, category
      if (canAccess('/documents', clinicRole, roles)) {
        try {
          const docs = await db.entities.Document.list();
          const matched = (docs || []).filter(d =>
            d.is_active && (
              d.name?.toLowerCase().includes(ql) ||
              d.owner_name?.toLowerCase().includes(ql) ||
              d.document_number?.toLowerCase().includes(ql) ||
              d.category?.toLowerCase().includes(ql)
            )
          ).slice(0, 5);
          matched.forEach(d => {
            dataResults.push({
              type: 'document',
              title: d.name,
              subtitle: `${d.owner_type}${d.owner_name ? ': ' + d.owner_name : ''}${d.category ? ' • ' + d.category : ''}`,
              meta: d.document_number ? `No: ${d.document_number}` : '',
              action: () => navigate('/documents'),
              actionLabel: 'Lihat Dokumen',
              id: d.id,
            });
          });
        } catch {}
      }
    } catch {}
    return dataResults;
  }, [clinicRole, roles, navigate]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (llmAbortRef.current) llmAbortRef.current = true;
    setLlmResults([]);
    setLlmLoading(false);

    if (!query.trim() || query.trim().length < 2) {
      setResults({ guides: [], terms: [], data: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const local = runLocalSearch(query);
      const data = await runDataSearch(query);
      setResults({ guides: local.guides, terms: local.terms, data });

      // If local found nothing strong, fallback to LLM
      const hasLocal = local.guides.length > 0 || local.terms.length > 0;
      if (!hasLocal && data.length === 0) {
        llmAbortRef.current = false;
        setLlmLoading(true);
        try {
          const res = await db.functions.invoke('searchHelp', {
            query,
            currentRoute: location.pathname,
            role: clinicRole,
          });
          if (llmAbortRef.current) return;
          const llmData = res?.data?.results || res?.results || [];
          // Filter by access
          const filtered = llmData.filter(r => {
            const base = (r.page_path || '').split('?')[0];
            if (!base) return false;
            return canAccess(base, clinicRole, roles);
          });
          setLlmResults(filtered);
        } catch {}
        if (!llmAbortRef.current) setLlmLoading(false);
      }
      setLoading(false);
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  const hasResults = results.guides.length > 0 || results.terms.length > 0 || results.data.length > 0 || llmResults.length > 0;
  const showEmpty = query.trim().length >= 2 && !loading && !llmLoading && !hasResults;

  const handleAction = (item) => {
    addRecent(query);
    logSearch(query, true, item.source || 'guide', item.title);
    if (item.steps && item.steps.length > 0) {
      setStepGuide(item);
      return;
    }
    let path = item.page_path || item.action_path;
    if (item.action_type === 'navigate_with_param' && item.action_param) {
      path += (path.includes('?') ? '&' : '?') + item.action_param;
    }
    if (path) {
      navigate(path);
    }
    onClose();
  };

  const handleDataAction = (d) => {
    addRecent(query);
    logSearch(query, true, 'data', d.title);
    d.action();
    onClose();
  };

  const handleFrequent = (f) => {
    setQuery(f.query);
  };

  const handleRecent = (q) => {
    setQuery(q);
  };

  const frequent = DEFAULT_FREQUENT.filter(f => f.roles.length === 0 || f.roles.includes(clinicRole)).slice(0, 8);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[8vh] px-4 bg-black/40" onClick={onClose}>
          <div className="w-full max-w-2xl bg-card border border-border rounded-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                  placeholder="Cari menu, pasien, obat, atau tanyakan cara..."
                  className="flex-1 bg-transparent outline-none text-base"
                />
                <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-caption mt-1.5 ml-7.5">Apa yang ingin Anda cari atau lakukan?</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {stepGuide ? (
                <StepGuideView guide={stepGuide} onOpen={(path) => { navigate(path); onClose(); }} onBack={() => setStepGuide(null)} />
              ) : !query.trim() || query.trim().length < 2 ? (
                <div className="p-4 space-y-4">
                  {/* Sering Dicari */}
                  {recent.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="micro-label">Terakhir Dicari</p>
                        <button onClick={clearRecent} className="text-caption text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Hapus Riwayat
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recent.map((r, i) => (
                          <button key={i} onClick={() => handleRecent(r)} className="px-2.5 py-1 text-xs bg-muted hover:bg-accent rounded border border-border flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground" /> {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="micro-label mb-2">Sering Dicari</p>
                    <div className="flex flex-wrap gap-1.5">
                      {frequent.map((f, i) => (
                        <button key={i} onClick={() => handleFrequent(f)} className="px-2.5 py-1 text-xs bg-accent/40 hover:bg-accent rounded border border-border text-accent-foreground">
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-1">
                  {loading && (
                    <div className="flex items-center gap-2 px-4 py-6 text-caption text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                      Mencari...
                    </div>
                  )}

                  {!loading && hasResults && (
                    <>
                      {/* Terms (synonym matches) */}
                      {results.terms.length > 0 && (
                        <ResultSection label="Istilah">
                          {results.terms.map((t, i) => (
                            <ResultRow
                              key={`term-${i}`}
                              icon={Search}
                              title={t.canonical}
                              subtitle={`Sinonim: ${(t.synonyms || []).slice(0, 4).join(', ')}`}
                              location={t.page_label}
                              actionLabel="Buka"
                              onClick={() => { addRecent(query); logSearch(query, true, 'synonym', t.canonical); navigate(t.page_path); onClose(); }}
                            />
                          ))}
                        </ResultSection>
                      )}

                      {/* Guides — grouped by category */}
                      {['Menu & Fitur', 'Cara Melakukan', 'Pertanyaan'].map(cat => {
                        const items = results.guides.filter(g => g.category === cat);
                        if (items.length === 0) return null;
                        const meta = CATEGORY_META[cat];
                        return (
                          <ResultSection key={cat} label={meta.label}>
                            {items.map((g, i) => (
                              <ResultRow
                                key={`guide-${cat}-${i}`}
                                icon={meta.icon}
                                title={g.title}
                                subtitle={g.description}
                                location={g.page_label}
                                actionLabel={g.action_label || 'Buka'}
                                hasSteps={g.steps && g.steps.length > 0}
                                onClick={() => handleAction(g)}
                              />
                            ))}
                          </ResultSection>
                        );
                      })}

                      {/* LLM results */}
                      {llmResults.length > 0 && (
                        <ResultSection label="Saran">
                          {llmResults.map((r, i) => (
                            <ResultRow
                              key={`llm-${i}`}
                              icon={Sparkles}
                              title={r.title}
                              subtitle={r.description}
                              location={r.page_label}
                              actionLabel={r.action_label || 'Buka'}
                              hasSteps={r.steps && r.steps.length > 0}
                              onClick={() => handleAction({ ...r, page_path: r.page_path, action_label: r.action_label, steps: r.steps })}
                            />
                          ))}
                        </ResultSection>
                      )}

                      {/* Data results */}
                      {results.data.length > 0 && (
                        <ResultSection label="Data">
                          {results.data.map((d, i) => (
                            <ResultRow
                              key={`data-${i}`}
                              icon={d.type === 'medicine' ? Package : d.type === 'patient' ? User : d.type === 'document' ? FolderOpen : FileText}
                              title={d.title}
                              subtitle={d.subtitle}
                              meta={d.meta}
                              outOfStock={d.outOfStock}
                              actionLabel={d.actionLabel}
                              onClick={() => handleDataAction(d)}
                            />
                          ))}
                        </ResultSection>
                      )}
                    </>
                  )}

                  {llmLoading && (
                    <div className="flex items-center gap-2 px-4 py-3 text-caption text-muted-foreground border-t border-border">
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                      Mencari saran tambahan...
                    </div>
                  )}

                  {showEmpty && (
                    <div className="p-6 text-center space-y-3">
                      <p className="text-body font-medium">Belum menemukan yang Anda cari</p>
                      <p className="text-caption text-muted-foreground">Coba gunakan kata lain.</p>
                      <p className="text-caption text-muted-foreground">
                        Contoh: <button onClick={() => setQuery('harga beli')} className="text-primary hover:underline">"harga modal"</button> → coba "HPP" atau "harga beli".
                      </p>
                      <button
                        onClick={() => { logSearch(query, false, 'not_found', ''); addRecent(query); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted"
                      >
                        <HelpCircle className="w-3.5 h-3.5" /> Minta Bantuan
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Cari & Bantuan</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span><kbd className="px-1 py-0.5 bg-card border border-border rounded">Esc</kbd> tutup</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultSection({ label, children }) {
  return (
    <div>
      <p className="micro-label px-4 pt-2.5 pb-1">{label}</p>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function ResultRow({ icon: Icon, title, subtitle, location, meta, outOfStock, actionLabel, hasSteps, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-3">
      {Icon && <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${outOfStock ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${outOfStock ? 'text-muted-foreground/60' : ''}`}>{title}</p>
          {outOfStock && <span className="pill pill-critical shrink-0">STOK HABIS</span>}
        </div>
        {subtitle && <p className="text-caption mt-0.5 line-clamp-1">{subtitle}</p>}
        {meta && <p className="text-caption mt-0.5">{meta}</p>}
        {location && <p className="text-[11px] text-muted-foreground mt-0.5">{location}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {hasSteps && <span className="text-[11px] text-primary">Tunjukkan Caranya</span>}
        {actionLabel && (
          <span className="text-[11px] text-primary flex items-center gap-0.5 font-medium">
            {actionLabel} <ArrowRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </button>
  );
}

function StepGuideView({ guide, onOpen, onBack }) {
  const path = guide.page_path || guide.action_path;
  return (
    <div className="p-4 space-y-3">
      <button onClick={onBack} className="text-caption text-muted-foreground hover:text-foreground flex items-center gap-1">
        ← Kembali ke hasil
      </button>
      <div>
        <p className="micro-label mb-1">Tunjukkan Caranya</p>
        <h3 className="text-section-title">{guide.title}</h3>
        {guide.description && <p className="text-caption mt-1">{guide.description}</p>}
      </div>
      <div className="space-y-2">
        {(guide.steps || []).map((step, i) => (
          <div key={i} className="flex items-start gap-2.5 px-3 py-2 bg-muted/30 rounded">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5">
              {i + 1}
            </span>
            <p className="text-body flex-1 pt-0.5">{step}</p>
          </div>
        ))}
      </div>
      {path && (
        <button
          onClick={() => onOpen(path)}
          className="flex items-center gap-1.5 px-3 py-2 btn-primary rounded text-sm font-medium"
        >
          {guide.action_label || 'Buka'} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function calcAge(birthDate) {
  if (!birthDate) return '';
  try {
    const diff = Date.now() - new Date(birthDate).getTime();
    const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    return years + ' tahun';
  } catch { return ''; }
}

function formatRp(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('id-ID');
}