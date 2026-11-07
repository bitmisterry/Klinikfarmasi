const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function SupplierReturnModal({ invoice, onClose, onSaved }) {
  const [batches, setBatches] = useState([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    db.entities.StockBatch.list().then((rows) => {
      if (!active) return;
      setBatches((rows || []).filter((batch) => batch.invoice_id === invoice.id || batch.invoice_number === invoice.invoice_number));
    }).catch((error) => toast({ title: 'Gagal memuat batch faktur', description: error.message, variant: 'destructive' }));
    return () => { active = false; };
  }, [invoice.id, invoice.invoice_number, toast]);

  const selected = useMemo(() => batches.map((batch) => ({
    ...batch,
    return_quantity: Math.min(Number(quantities[batch.id] || 0), Number(batch.quantity || 0)),
  })).filter((batch) => batch.return_quantity > 0), [batches, quantities]);
  const total = selected.reduce((sum, batch) => sum + (Number(batch.hpp_per_unit ?? batch.purchase_price ?? 0) * batch.return_quantity), 0);

  const submit = async () => {
    if (!reason.trim()) { toast({ title: 'Alasan retur wajib diisi', variant: 'destructive' }); return; }
    if (!selected.length) { toast({ title: 'Pilih batch dan jumlah retur', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await db.functions.invoke('createSupplierReturn', {
        invoice_id: invoice.id,
        reason,
        notes,
        items: selected.map((batch) => ({ batch_id: batch.id, return_quantity: batch.return_quantity })),
      });
      toast({ title: 'Retur diajukan ke APJ', description: 'Stok belum berubah hingga retur disetujui dan diproses.' });
      onSaved();
    } catch (error) {
      toast({ title: 'Gagal mengajukan retur', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><RotateCcw className="h-4 w-4 text-amber-600" /> Ajukan Retur Supplier</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Faktur {invoice.invoice_number} • {invoice.supplier_name}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5 text-xs">
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
            Retur memerlukan persetujuan APJ. Setelah disetujui, Farmasi memproses pengurangan pada batch yang dipilih; Finance kemudian mencatat nota kredit supplier.
          </div>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full min-w-[680px] text-xs">
              <thead className="bg-muted/50"><tr className="text-left"><th className="px-3 py-2">Obat / Batch</th><th className="px-3 py-2">Kedaluwarsa</th><th className="px-3 py-2 text-right">Tersedia</th><th className="px-3 py-2 text-right">HPP</th><th className="px-3 py-2">Jumlah Retur</th></tr></thead>
              <tbody className="divide-y divide-border">
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-3 py-2"><p className="font-medium">{batch.medicine_name}</p><p className="font-mono text-[10px] text-muted-foreground">{batch.batch_number}</p></td>
                    <td className="px-3 py-2 text-muted-foreground">{batch.expiry_date || '-'}</td>
                    <td className="px-3 py-2 text-right">{batch.quantity || 0}</td>
                    <td className="px-3 py-2 text-right">{money(batch.hpp_per_unit ?? batch.purchase_price)}</td>
                    <td className="px-3 py-2"><input type="number" min="0" max={batch.quantity || 0} value={quantities[batch.id] ?? ''} onChange={(event) => setQuantities((current) => ({ ...current, [batch.id]: event.target.value }))} className="w-24 rounded border border-border px-2 py-1.5 text-right outline-none focus:border-primary" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!batches.length && <p className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-700">Tidak ada batch aktif yang terhubung ke faktur ini. Retur tidak dapat diajukan.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="micro-label">Alasan retur *</label><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Mis. barang rusak, salah kirim, mendekati kedaluwarsa…" className="mt-1 w-full rounded border border-border px-2 py-1.5 outline-none focus:border-primary" /></div>
            <div><label className="micro-label">Catatan tambahan</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Nomor surat jalan, kondisi kemasan, atau catatan supplier" className="mt-1 w-full rounded border border-border px-2 py-1.5 outline-none focus:border-primary" /></div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3"><span className="text-muted-foreground">Estimasi nota kredit</span><strong className="text-primary">{money(total)}</strong></div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving || !batches.length} className="btn-primary flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> {saving ? 'Mengajukan…' : 'Ajukan Retur ke APJ'}</button>
        </div>
      </div>
    </div>
  );
}
