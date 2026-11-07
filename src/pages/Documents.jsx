const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Image as ImageIcon, Link as LinkIcon, Eye, ExternalLink, AlertTriangle, Clock, CheckCircle2, Search, FileWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission } from '@/lib/roles';
import { OWNER_TYPES, OWNER_TYPE_ROUTES, OWNER_TYPE_MODULES, getDocStatus, getFileIcon } from '@/lib/documents';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import DocumentPreviewModal from '@/components/documents/DocumentPreviewModal';

export default function Documents() {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [previewDoc, setPreviewDoc] = useState(null);

  const clinicRole = user?.data?.clinic_role || user?.clinic_role || 'Staff';

  const load = useCallback(async () => {
    try {
      const all = await db.entities.Document.filter({ is_active: true }, '-added_at', 500);
      setDocs(all || []);
    } catch (e) {
      toast({ title: 'Gagal memuat dokumen', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const iconForDoc = (doc) => {
    if (doc.attachment_type === 'link') return LinkIcon;
    const fi = getFileIcon(doc.file_ext);
    if (fi === 'image') return ImageIcon;
    return FileText;
  };

  // Filter by access — only show docs whose owner_type module user can view
  const accessibleDocs = docs.filter(d => {
    const mod = OWNER_TYPE_MODULES[d.owner_type];
    if (!mod) return true;
    return hasPermission(clinicRole, mod, 'view', roles);
  });

  // Apply search + filters
  const filtered = accessibleDocs.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.name?.toLowerCase().includes(q) && !d.owner_name?.toLowerCase().includes(q) && !d.document_number?.toLowerCase().includes(q) && !d.category?.toLowerCase().includes(q)) return false;
    }
    if (filterType !== 'all' && d.owner_type !== filterType) return false;
    if (filterStatus !== 'all') {
      const st = getDocStatus(d);
      if (filterStatus === 'expiring' && st?.status !== 'expiring') return false;
      if (filterStatus === 'expired' && st?.status !== 'expired') return false;
      if (filterStatus === 'valid' && st?.status !== 'valid') return false;
      if (filterStatus === 'noexpiry' && d.valid_until) return false;
    }
    return true;
  });

  // Perlu perhatian — expiring + expired
  const perluPerhatian = accessibleDocs.filter(d => {
    const st = getDocStatus(d);
    return st?.status === 'expiring' || st?.status === 'expired';
  }).sort((a, b) => {
    const sa = getDocStatus(a), sb = getDocStatus(b);
    if (sa?.status === 'expired' && sb?.status !== 'expired') return -1;
    if (sa?.status !== 'expired' && sb?.status === 'expired') return 1;
    return (sa?.days || 0) - (sb?.days || 0);
  });

  const stats = [
    { icon: FileText, label: 'Total Dokumen', value: accessibleDocs.length, color: 'text-teal-600' },
    { icon: Clock, label: 'Akan Berakhir', value: accessibleDocs.filter(d => getDocStatus(d)?.status === 'expiring').length, color: 'text-amber-600' },
    { icon: AlertTriangle, label: 'Sudah Berakhir', value: accessibleDocs.filter(d => getDocStatus(d)?.status === 'expired').length, color: 'text-rose-600' },
    { icon: CheckCircle2, label: 'Dokumen Aktif', value: accessibleDocs.filter(d => !d.valid_until || getDocStatus(d)?.status === 'valid').length, color: 'text-emerald-600' },
  ];

  const handleJumpToOwner = (doc) => {
    const route = OWNER_TYPE_ROUTES[doc.owner_type];
    if (route) navigate(route);
  };

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div>
        <h1 className="text-page-title">Dokumen</h1>
        <p className="text-caption mt-0.5">Rekap seluruh dokumen & lampiran — kontrol kelengkapan dan masa berlaku</p>
      </div>

      <ModuleStatHeader stats={stats} />

      {/* Perlu Perhatian */}
      {perluPerhatian.length > 0 && (
        <div className="panel-accent p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-section-title">Perlu Perhatian</p>
            <span className="pill pill-warning">{perluPerhatian.length}</span>
          </div>
          <div className="space-y-1">
            {perluPerhatian.slice(0, 5).map(doc => {
              const st = getDocStatus(doc);
              return (
                <button key={doc.id} onClick={() => handleJumpToOwner(doc)} className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted rounded text-left transition-colors">
                  <FileWarning className={`w-4 h-4 shrink-0 ${st?.status === 'expired' ? 'text-rose-500' : 'text-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">{doc.owner_type}{doc.owner_name ? ' • ' + doc.owner_name : ''}{doc.valid_until ? ' • s/d ' + doc.valid_until : ''}</p>
                  </div>
                  <span className={`pill ${st?.status === 'expired' ? 'pill-critical' : 'pill-warning'} shrink-0`}>
                    {st?.status === 'expired' ? `Lewat ${st.days}h` : `${st?.days}h lagi`}
                  </span>
                </button>
              );
            })}
            {perluPerhatian.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">+ {perluPerhatian.length - 5} dokumen lainnya</p>
            )}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="panel px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, nomor, pemilik…" className="flex-1 bg-transparent outline-none text-xs" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card">
          <option value="all">Semua Jenis</option>
          {OWNER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card">
          <option value="all">Semua Status</option>
          <option value="valid">Berlaku</option>
          <option value="expiring">Akan Berakhir</option>
          <option value="expired">Sudah Berakhir</option>
          <option value="noexpiry">Tanpa Masa Berlaku</option>
        </select>
      </div>

      {/* Document list */}
      <div className="panel">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-6"><EmptyState icon={FileText} title="Tidak ada dokumen" description={search || filterType !== 'all' || filterStatus !== 'all' ? 'Coba ubah filter' : 'Dokumen akan muncul setelah ditambahkan dari halaman asalnya'} /></div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(doc => {
              const Icon = iconForDoc(doc);
              const st = getDocStatus(doc);
              return (
                <div key={doc.id} className="px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 transition-colors group">
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium truncate">{doc.name}</p>
                      {doc.category && <span className="pill pill-inactive text-[9px] px-1 py-0">{doc.category}</span>}
                      {st?.status === 'expired' && <span className="pill pill-critical text-[9px] px-1 py-0">Sudah Berakhir</span>}
                      {st?.status === 'expiring' && <span className="pill pill-warning text-[9px] px-1 py-0">{st.label}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      <button onClick={() => handleJumpToOwner(doc)} className="hover:text-primary hover:underline">{doc.owner_type}{doc.owner_name ? ': ' + doc.owner_name : ''}</button>
                      {doc.document_number ? ` • ${doc.document_number}` : ''}
                      {doc.attachment_type !== 'link' && doc.file_ext ? ` • ${(doc.file_ext).toUpperCase()}` : ''}
                      {doc.attachment_type === 'link' ? ' • Link' : ''}
                      {doc.added_by_name ? ` • ${doc.added_by_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {doc.attachment_type === 'link' ? (
                      <a href={doc.external_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Buka Link">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <button onClick={() => setPreviewDoc(doc)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Lihat">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}