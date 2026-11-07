const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useRef } from 'react';
import { X, Upload, FileText, ShieldAlert, CheckCircle2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

/**
 * Upload foto/scan resep fisik (untuk resep eksternal).
 * Tandai kategori retensi otomatis berdasarkan golongan obat.
 */
export default function PrescriptionScanUpload({ rx, medicines = [], onClose, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [scanUrl, setScanUrl] = useState(rx?.physical_scan_url || '');
  const [retention, setRetention] = useState(rx?.retention_category || 'Standar');
  const fileRef = useRef(null);
  const { toast } = useToast();

  // Auto-detect retention category from prescription items
  React.useEffect(() => {
    if (!rx?.retention_category && rx?.items) {
      const hasNarcotic = (rx.items || []).some(it => {
        const med = medicines.find(m => m.id === it.medicine_id);
        return med?.category === 'Narkotika/Psikotropika';
      });
      setRetention(hasNarcotic ? 'Narkotika' : 'Standar');
    }
  }, [rx]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      setScanUrl(file_url);
      toast({ title: 'Scan resep diunggah' });
    } catch (e) {
      toast({ title: 'Gagal mengunggah', description: e.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!scanUrl) { toast({ title: 'Unggah scan dulu', variant: 'destructive' }); return; }
    try {
      await db.entities.Prescription.update(rx.id, {
        physical_scan_url: scanUrl,
        retention_category: retention,
      });
      toast({ title: 'Scan resep tersimpan' });
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Scan Resep Fisik
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Upload area */}
          {!scanUrl ? (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 hover:bg-muted/30 disabled:opacity-50"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-xs font-medium">{uploading ? 'Mengunggah…' : 'Klik untuk unggah foto/scan resep'}</p>
              <p className="text-[11px] text-muted-foreground">JPG, PNG, PDF — maks 5MB</p>
            </button>
          ) : (
            <div className="panel p-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">Scan terunggah</p>
                <a href={scanUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Lihat file</a>
              </div>
              <button onClick={() => fileRef.current?.click()} className="text-[11px] text-primary hover:underline">Ganti</button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={e => handleUpload(e.target.files?.[0])}
            className="hidden"
          />

          {/* Retention category */}
          <div>
            <p className="micro-label mb-1">Kategori Retensi Arsip</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setRetention('Standar')}
                className={`py-1.5 rounded text-[11px] font-medium border ${retention === 'Standar' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
              >
                Standar (2 tahun)
              </button>
              <button
                onClick={() => setRetention('Narkotika')}
                className={`py-1.5 rounded text-[11px] font-medium border flex items-center justify-center gap-1 ${retention === 'Narkotika' ? 'bg-rose-600 text-white border-rose-600' : 'border-border hover:bg-muted'}`}
              >
                <ShieldAlert className="w-3 h-3" /> Narkotika (5 tahun)
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Auto-terdeteksi dari golongan obat dalam resep. Narkotika/psikotropika wajib retensi 5 tahun.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded text-xs hover:bg-muted">Batal</button>
          <button onClick={handleSave} className="flex-1 btn-primary py-2 rounded text-xs font-medium">Simpan</button>
        </div>
      </div>
    </div>
  );
}