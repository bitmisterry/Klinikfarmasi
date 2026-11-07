const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, ExternalLink, Download, ZoomIn, ZoomOut, FileWarning } from 'lucide-react';

import { formatFileSize } from '@/lib/documents';

export default function DocumentPreviewModal({ doc, onClose }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!doc || !doc.file_uri) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await db.integrations.Core.CreateFileSignedUrl({ file_uri: doc.file_uri, expires_in: 3600 });
        if (!cancelled) setSignedUrl(res.signed_url);
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [doc]);

  if (!doc) return null;

  const ext = (doc.file_ext || '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  const isPdf = ext === 'pdf';
  const canPreview = isImage || isPdf;

  const handleDownload = () => {
    if (signedUrl) {
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = doc.name + '.' + ext;
      a.click();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/80" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded flex items-center gap-1 text-xs font-medium">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{doc.name}</p>
            {doc.owner_name && <p className="text-[11px] text-muted-foreground truncate">{doc.owner_type} • {doc.owner_name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isImage && canPreview && signedUrl && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-muted rounded" title="Perkecil"><ZoomOut className="w-4 h-4" /></button>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1.5 hover:bg-muted rounded" title="Perbesar"><ZoomIn className="w-4 h-4" /></button>
              <div className="h-4 w-px bg-border mx-1" />
            </>
          )}
          {doc.attachment_type === 'link' && doc.external_url && (
            <a href={doc.external_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded flex items-center gap-1 text-xs font-medium text-primary">
              <ExternalLink className="w-4 h-4" /> Buka Link
            </a>
          )}
          {doc.file_uri && signedUrl && (
            <>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded" title="Buka Asli"><ExternalLink className="w-4 h-4" /></a>
              <button onClick={handleDownload} className="p-1.5 hover:bg-muted rounded" title="Unduh"><Download className="w-4 h-4" /></button>
            </>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-xs">Memuat pratinjau…</p>
          </div>
        ) : doc.attachment_type === 'link' ? (
          <div className="text-center text-white/80 space-y-3">
            <ExternalLink className="w-12 h-12 mx-auto opacity-50" />
            <p className="text-sm">Link eksternal</p>
            <p className="text-xs text-white/60 break-all max-w-md">{doc.external_url}</p>
            <a href={doc.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium">
              <ExternalLink className="w-4 h-4" /> Buka Link
            </a>
          </div>
        ) : !canPreview ? (
          <div className="text-center text-white/80 space-y-3">
            <FileWarning className="w-12 h-12 mx-auto opacity-50" />
            <p className="text-sm font-medium">Pratinjau tidak tersedia untuk jenis file ini</p>
            <p className="text-xs text-white/60">{(doc.file_ext || '').toUpperCase()}{doc.file_size ? ` • ${formatFileSize(doc.file_size)}` : ''}</p>
            {signedUrl && (
              <div className="flex items-center gap-2 justify-center">
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium">
                  <ExternalLink className="w-3.5 h-3.5" /> Buka
                </a>
                <button onClick={handleDownload} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium">
                  <Download className="w-3.5 h-3.5" /> Unduh
                </button>
              </div>
            )}
          </div>
        ) : isPdf && signedUrl ? (
          <iframe src={signedUrl} className="w-full h-full bg-white rounded" title={doc.name} />
        ) : isImage && signedUrl ? (
          <div className="overflow-auto max-w-full max-h-full">
            <img
              src={signedUrl}
              alt={doc.name}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="max-w-none transition-transform"
            />
          </div>
        ) : (
          <p className="text-white/60 text-sm">Gagal memuat file</p>
        )}
      </div>

      {/* Footer info */}
      {(doc.document_number || doc.valid_until) && (
        <div className="px-4 py-2 bg-card border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground" onClick={e => e.stopPropagation()}>
          {doc.document_number && <span>Nomor: <strong className="text-foreground">{doc.document_number}</strong></span>}
          {doc.issued_date && <span>Terbit: <strong className="text-foreground">{doc.issued_date}</strong></span>}
          {doc.valid_until && <span>Berlaku sampai: <strong className="text-foreground">{doc.valid_until}</strong></span>}
          {doc.added_by_name && <span>Ditambah oleh: <strong className="text-foreground">{doc.added_by_name}</strong></span>}
        </div>
      )}
    </div>
  );
}