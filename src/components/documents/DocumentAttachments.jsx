const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Image as ImageIcon, Link as LinkIcon, Trash2, Eye, ExternalLink, AlertTriangle, CheckCircle2, Circle, Clock } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission } from '@/lib/roles';
import { getDocStatus, formatFileSize, getFileIcon } from '@/lib/documents';
import { logAuditAction } from '@/lib/roles';
import AddAttachmentModal from './AddAttachmentModal';
import DocumentPreviewModal from './DocumentPreviewModal';

export default function DocumentAttachments({ ownerType, ownerId, ownerName, canEdit = true, showCompleteness = false, requiredDocs = [], suggestedCategories = [] }) {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const clinicRole = user?.data?.clinic_role || user?.clinic_role || 'Staff';
  // Owner may inspect documents, but document changes are executed by Admin or
  // the responsible operational role so segregation of duties remains visible.
  const canManage = canEdit && clinicRole !== 'Owner' && (clinicRole === 'Admin' || hasPermission(clinicRole, 'management', 'create', roles));

  const load = useCallback(async () => {
    if (!ownerId) { setLoading(false); return; }
    try {
      const all = await db.entities.Document.filter({
        owner_type: ownerType,
        owner_id: ownerId,
        is_active: true,
      }, '-added_at', 100);
      setDocs(all || []);
    } catch (e) {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (doc) => {
    if (!confirm(`Hapus dokumen "${doc.name}"?`)) return;
    try {
      await db.entities.Document.update(doc.id, { is_active: false });
      await logAuditAction({
        action: 'delete',
        entity: 'Document',
        entityId: doc.id,
        entityName: doc.name,
        description: `Menghapus dokumen "${doc.name}" dari ${ownerType}${ownerName ? ' ' + ownerName : ''}`,
        module: 'management',
        severity: 'Warning',
      });
      toast({ title: 'Dokumen dihapus' });
      load();
    } catch (e) {
      toast({ title: 'Gagal menghapus', description: e.message, variant: 'destructive' });
    }
  };

  // Completeness calculation
  const completeness = showCompleteness && requiredDocs.length > 0 ? (() => {
    const docCats = new Set(docs.map(d => d.category || d.name));
    const matched = requiredDocs.map(req => {
      const found = docs.some(d => (d.category && d.category === req.document_name) || d.name.toLowerCase().includes(req.document_name.toLowerCase()));
      const expiring = found ? docs.find(d => ((d.category && d.category === req.document_name) || d.name.toLowerCase().includes(req.document_name.toLowerCase())) && getDocStatus(d)?.status === 'expiring') : null;
      const expired = found ? docs.find(d => ((d.category && d.category === req.document_name) || d.name.toLowerCase().includes(req.document_name.toLowerCase())) && getDocStatus(d)?.status === 'expired') : null;
      return { ...req, found, status: !found ? 'missing' : expired ? 'expired' : expiring ? 'expiring' : 'complete' };
    });
    const completeCount = matched.filter(m => m.status === 'complete').length;
    return { items: matched, completeCount, total: requiredDocs.length };
  })() : null;

  const iconForDoc = (doc) => {
    if (doc.attachment_type === 'link') return LinkIcon;
    const fi = getFileIcon(doc.file_ext);
    if (fi === 'image') return ImageIcon;
    return FileText;
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-section-title">Dokumen & Lampiran</p>
          {docs.length > 0 && <span className="pill pill-inactive">{docs.length} file</span>}
        </div>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="btn-primary px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Tambah Lampiran
          </button>
        )}
      </div>

      {/* Completeness bar */}
      {completeness && (
        <div className="panel p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="micro-label">Kelengkapan Dokumen</p>
            <p className="text-xs font-medium">{completeness.completeCount} dari {completeness.total} lengkap</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {completeness.items.map((req, i) => (
              <span key={i} className={`pill ${req.status === 'complete' ? 'pill-success' : req.status === 'expiring' ? 'pill-warning' : req.status === 'expired' ? 'pill-critical' : 'pill-inactive'}`}>
                {req.status === 'complete' && <CheckCircle2 className="w-3 h-3" />}
                {req.status === 'expiring' && <Clock className="w-3 h-3" />}
                {req.status === 'expired' && <AlertTriangle className="w-3 h-3" />}
                {req.status === 'missing' && <Circle className="w-3 h-3" />}
                {req.document_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="panel p-4 text-center">
          <FileText className="w-7 h-7 mx-auto text-muted-foreground/40 mb-1.5" />
          <p className="text-xs text-muted-foreground">Belum ada dokumen. {canManage && 'Klik Tambah Lampiran untuk mulai.'}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map(doc => {
            const Icon = iconForDoc(doc);
            const status = getDocStatus(doc);
            return (
              <div key={doc.id} className="panel px-2.5 py-2 flex items-center gap-2.5 hover:shadow-sm transition-shadow group">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    {doc.category && <span className="pill pill-inactive text-[9px] px-1 py-0">{doc.category}</span>}
                    {status?.status === 'expired' && <span className="pill pill-critical text-[9px] px-1 py-0">Sudah Berakhir</span>}
                    {status?.status === 'expiring' && <span className="pill pill-warning text-[9px] px-1 py-0">{status.label}</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {doc.attachment_type === 'link' ? 'Link eksternal' : (doc.file_ext || '').toUpperCase()}
                    {doc.file_size ? ` • ${formatFileSize(doc.file_size)}` : ''}
                    {doc.document_number ? ` • ${doc.document_number}` : ''}
                    {doc.valid_until ? ` • Berlaku s/d ${doc.valid_until}` : ''}
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
                  {canManage && (
                    <button onClick={() => handleDelete(doc)} className="p-1.5 hover:bg-rose-50 rounded text-rose-500" title="Hapus">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddAttachmentModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          ownerType={ownerType}
          ownerId={ownerId}
          ownerName={ownerName}
          suggestedCategories={suggestedCategories}
          onSaved={load}
        />
      )}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
}
