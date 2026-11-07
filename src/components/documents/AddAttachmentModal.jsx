// @ts-nocheck -- Attachment form supports file, camera, and URL payloads.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useRef } from 'react';
import { X, Upload, Camera, Link as LinkIcon, FileText, Calendar, Hash, FileCheck } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { DEFAULT_CATEGORIES, formatFileSize } from '@/lib/documents';
import { logAuditAction } from '@/lib/roles';

export default function AddAttachmentModal({ open, onClose, ownerType, ownerId, ownerName, onSaved, suggestedCategories = [] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [mode, setMode] = useState(null); // 'file' | 'photo' | 'link' | null
  const [form, setForm] = useState({
    name: '',
    category: '',
    description: '',
    external_url: '',
    document_number: '',
    issued_date: '',
    valid_until: '',
    reminder_days: 30,
    hasExpiry: false,
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  const categories = [...new Set([...(suggestedCategories || []), ...(DEFAULT_CATEGORIES[ownerType] || ['Lainnya'])])];
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  const reset = () => {
    setMode(null);
    setForm({ name: '', category: '', description: '', external_url: '', document_number: '', issued_date: '', valid_until: '', reminder_days: 30, hasExpiry: false });
    setFile(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast({ title: 'File terlalu besar', description: 'Maksimal 25 MB', variant: 'destructive' });
      return;
    }
    setFile(f);
    if (!form.name) {
      const ext = f.name.split('.').pop();
      const baseName = f.name.replace(/\.[^.]+$/, '');
      setForm(prev => ({ ...prev, name: baseName }));
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast({ title: 'Nama dokumen wajib', variant: 'destructive' }); return; }
    if (mode === 'link' && !form.external_url.trim()) { toast({ title: 'Alamat link wajib', variant: 'destructive' }); return; }
    if ((mode === 'file' || mode === 'photo') && !file) { toast({ title: 'Pilih file terlebih dahulu', variant: 'destructive' }); return; }

    setUploading(true);
    try {
      let file_uri = null, file_ext = null, file_size = null;
      if (mode === 'file' || mode === 'photo') {
        const uploadRes = await db.integrations.Core.UploadPrivateFile({ file });
        file_uri = uploadRes.file_uri;
        file_ext = file.name.split('.').pop()?.toLowerCase();
        file_size = file.size;
      }

      const doc = await db.entities.Document.create({
        owner_type: ownerType,
        owner_id: ownerId,
        owner_name: ownerName || '',
        name: form.name.trim(),
        category: form.category || (categories[0] === 'Lainnya' ? '' : categories[0]),
        description: form.description || '',
        attachment_type: mode === 'link' ? 'link' : (mode === 'photo' ? 'photo' : 'file'),
        file_uri,
        file_ext,
        file_size,
        external_url: mode === 'link' ? form.external_url.trim() : '',
        document_number: form.hasExpiry ? form.document_number : '',
        issued_date: form.hasExpiry ? form.issued_date || null : null,
        valid_until: form.hasExpiry ? form.valid_until || null : null,
        reminder_days: form.hasExpiry ? Number(form.reminder_days) || 30 : 30,
        added_by_name: user?.full_name || user?.email || '',
        added_at: new Date().toISOString(),
        is_active: true,
      });

      await logAuditAction({
        action: 'create',
        entity: 'Document',
        entityId: doc.id,
        entityName: form.name,
        description: `Menambahkan dokumen "${form.name}" ke ${ownerType}${ownerName ? ' ' + ownerName : ''}`,
        module: 'management',
        severity: 'Info',
      });

      toast({ title: 'Dokumen ditambahkan' });
      reset();
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4" onClick={handleClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tambah Lampiran{ownerName ? ` — ${ownerName}` : ''}</h3>
          <button onClick={handleClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Mode selection */}
          {!mode && (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setMode('file')} className="flex flex-col items-center gap-2 p-4 border border-border rounded-md hover:border-primary hover:bg-accent/30 transition-colors">
                <Upload className="w-6 h-6 text-primary" />
                <span className="text-xs font-medium">Unggah File</span>
                <span className="text-[10px] text-muted-foreground">PDF, Word, Excel</span>
              </button>
              <button onClick={() => { setMode('photo'); setTimeout(() => fileRef.current?.click(), 100); }} className="flex flex-col items-center gap-2 p-4 border border-border rounded-md hover:border-primary hover:bg-accent/30 transition-colors">
                <Camera className="w-6 h-6 text-primary" />
                <span className="text-xs font-medium">Ambil Foto</span>
                <span className="text-[10px] text-muted-foreground">Kamera / galeri</span>
              </button>
              <button onClick={() => setMode('link')} className="flex flex-col items-center gap-2 p-4 border border-border rounded-md hover:border-primary hover:bg-accent/30 transition-colors">
                <LinkIcon className="w-6 h-6 text-primary" />
                <span className="text-xs font-medium">Tambah Link</span>
                <span className="text-[10px] text-muted-foreground">Google Drive, dll</span>
              </button>
            </div>
          )}

          {/* File input (hidden, triggered by buttons) */}
          <input
            ref={fileRef}
            type="file"
            accept={mode === 'photo' ? 'image/*' : '*/*'}
            capture={mode === 'photo' ? 'environment' : undefined}
            onChange={handleFileSelect}
            className="hidden"
          />

          {mode && (
            <>
              {/* Mode label & switch */}
              <div className="flex items-center gap-2">
                <span className="pill pill-info">
                  {mode === 'file' && <><Upload className="w-3 h-3" /> Unggah File</>}
                  {mode === 'photo' && <><Camera className="w-3 h-3" /> Ambil Foto</>}
                  {mode === 'link' && <><LinkIcon className="w-3 h-3" /> Link Eksternal</>}
                </span>
                <button onClick={() => { setMode(null); setFile(null); }} className="text-[11px] text-muted-foreground hover:text-foreground">Ganti jenis</button>
              </div>

              {/* File/photo upload area */}
              {(mode === 'file' || mode === 'photo') && (
                <div>
                  {file ? (
                    <div className="flex items-center gap-2 p-2.5 bg-accent/30 border border-primary/30 rounded">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                      <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-[11px] text-rose-500 hover:underline">Ganti</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full flex flex-col items-center gap-1.5 p-6 border-2 border-dashed border-border rounded hover:border-primary hover:bg-accent/20 transition-colors"
                    >
                      {mode === 'photo' ? <Camera className="w-7 h-7 text-muted-foreground" /> : <Upload className="w-7 h-7 text-muted-foreground" />}
                      <span className="text-xs font-medium">Klik untuk memilih {mode === 'photo' ? 'foto' : 'file'}</span>
                      <span className="text-[10px] text-muted-foreground">Maksimal 25 MB</span>
                    </button>
                  )}
                </div>
              )}

              {/* Link input */}
              {mode === 'link' && (
                <div>
                  <label className="micro-label">Alamat Link *</label>
                  <input
                    value={form.external_url}
                    onChange={e => setForm({ ...form, external_url: e.target.value })}
                    className={inputCls}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              )}

              {/* Common fields */}
              <div>
                <label className="micro-label">Nama Dokumen *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="mis. SIP Dr. Ahmad" />
              </div>

              <div>
                <label className="micro-label">Kategori</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  <option value="">— Pilih kategori —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="micro-label">Keterangan</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} rows={2} placeholder="Catatan singkat tentang dokumen ini" />
              </div>

              {/* Expiry toggle */}
              <div className="border-t border-border pt-2.5">
                <button
                  onClick={() => setForm(prev => ({ ...prev, hasExpiry: !prev.hasExpiry }))}
                  className="flex items-center gap-2 text-xs font-medium hover:text-primary"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${form.hasExpiry ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                    {form.hasExpiry && <FileCheck className="w-3 h-3" />}
                  </div>
                  Dokumen dengan masa berlaku
                </button>
              </div>

              {form.hasExpiry && (
                <div className="space-y-2 pl-6">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="micro-label flex items-center gap-1"><Hash className="w-3 h-3" /> Nomor Dokumen</label>
                      <input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} className={inputCls} placeholder="mis. 123/SIP/2026" />
                    </div>
                    <div>
                      <label className="micro-label flex items-center gap-1"><Calendar className="w-3 h-3" /> Tanggal Terbit</label>
                      <input type="date" value={form.issued_date} onChange={e => setForm({ ...form, issued_date: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="micro-label flex items-center gap-1"><Calendar className="w-3 h-3" /> Berlaku Sampai</label>
                      <input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="micro-label">Pengingat (hari)</label>
                      <input type="number" value={form.reminder_days} onChange={e => setForm({ ...form, reminder_days: e.target.value })} className={inputCls} min="1" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {mode && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
            <button onClick={handleClose} className="px-3 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted">Batal</button>
            <button
              onClick={handleSubmit}
              disabled={uploading}
              className="btn-primary px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan…</>
              ) : (
                <><Upload className="w-3.5 h-3.5" /> Simpan</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
