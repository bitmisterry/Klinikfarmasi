import React, { useMemo, useState } from 'react';
import { CheckCircle, FileCheck2, RotateCcw, ShieldCheck, X, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const ACTION_CONFIG = {
  detail: { title: 'Detail & Timeline Retur', submit: '', icon: RotateCcw },
  approve: { title: 'Setujui Retur Supplier', submit: 'Setujui Retur', icon: ShieldCheck },
  reject: { title: 'Tolak Retur Supplier', submit: 'Tolak Retur', icon: XCircle },
  process: { title: 'Proses Pengeluaran Stok', submit: 'Proses Stok Retur', icon: RotateCcw },
  cancel: { title: 'Batalkan Retur Supplier', submit: 'Batalkan Retur', icon: XCircle },
  credit: { title: 'Catat Nota Kredit Supplier', submit: 'Simpan Nota Kredit', icon: FileCheck2 },
  reconcile: { title: 'Rekonsiliasi Retur & Faktur', submit: 'Simpan Rekonsiliasi', icon: CheckCircle },
  close: { title: 'Tutup Retur Supplier', submit: 'Tandai Selesai', icon: CheckCircle },
};

export default function SupplierReturnActionModal({ supplierReturn, action = 'detail', onClose, onSaved }) {
  const [notes, setNotes] = useState('');
  const [creditNumber, setCreditNumber] = useState('');
  const [creditDate, setCreditDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(String(supplierReturn.total_amount || ''));
  const [settlementMethod, setSettlementMethod] = useState('Potong Utang Berjalan');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const config = ACTION_CONFIG[action] || ACTION_CONFIG.detail;
  const Icon = config.icon;
  const requiresNotes = ['reject', 'cancel'].includes(action);
  const history = useMemo(() => supplierReturn.status_history || [], [supplierReturn.status_history]);

  const submit = async () => {
    if (requiresNotes && !notes.trim()) {
      toast({ title: 'Alasan wajib diisi', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (action === 'approve' || action === 'reject') {
        await base44.functions.invoke('approveSupplierReturn', { return_id: supplierReturn.id, action, notes });
      } else if (action === 'process') {
        await base44.functions.invoke('processSupplierReturn', { return_id: supplierReturn.id });
      } else if (action === 'cancel') {
        await base44.functions.invoke('cancelSupplierReturn', { return_id: supplierReturn.id, reason: notes });
      } else if (action === 'credit') {
        await base44.functions.invoke('recordSupplierCreditNote', {
          return_id: supplierReturn.id,
          credit_note_number: creditNumber,
          credit_note_date: creditDate,
          amount: Number(amount),
          settlement_method: settlementMethod,
          notes,
        });
      } else if (action === 'reconcile') {
        await base44.functions.invoke('reconcileSupplierReturn', { return_id: supplierReturn.id, reconciliation_reference: reference, notes });
      } else if (action === 'close') {
        await base44.functions.invoke('closeSupplierReturn', { return_id: supplierReturn.id, notes });
      }
      toast({ title: 'Status retur diperbarui', description: `${supplierReturn.return_number} • ${config.submit}` });
      onSaved?.();
    } catch (error) {
      toast({ title: 'Proses retur gagal', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" /> {config.title}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{supplierReturn.return_number} • {supplierReturn.invoice_number} • {supplierReturn.supplier_name}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5 text-xs">
          <div className="grid gap-3 rounded border border-border bg-muted/20 p-3 sm:grid-cols-3">
            <div><p className="micro-label">Status</p><p className="mt-1 font-medium text-primary">{supplierReturn.status}</p></div>
            <div><p className="micro-label">Nilai retur</p><p className="mt-1 font-semibold">{money(supplierReturn.total_amount)}</p></div>
            <div><p className="micro-label">Diajukan oleh</p><p className="mt-1 font-medium">{supplierReturn.created_by || '-'}</p></div>
          </div>

          <div>
            <p className="micro-label mb-1">Alasan retur</p>
            <p className="rounded border border-border p-2.5">{supplierReturn.reason || '-'}</p>
          </div>

          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full min-w-[600px]">
              <thead className="bg-muted/50"><tr className="text-left"><th className="px-3 py-2">Obat / Batch</th><th className="px-3 py-2 text-right">Jumlah</th><th className="px-3 py-2 text-right">Harga</th><th className="px-3 py-2 text-right">Subtotal</th></tr></thead>
              <tbody className="divide-y divide-border">{(supplierReturn.items || []).map((item) => <tr key={item.batch_id}><td className="px-3 py-2"><p className="font-medium">{item.medicine_name}</p><p className="font-mono text-[10px] text-muted-foreground">{item.batch_number}</p></td><td className="px-3 py-2 text-right">{item.return_quantity}</td><td className="px-3 py-2 text-right">{money(item.unit_price)}</td><td className="px-3 py-2 text-right font-medium">{money(item.subtotal)}</td></tr>)}</tbody>
            </table>
          </div>

          {action === 'process' && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">Stok hanya dikurangi pada batch di atas. Setelah proses ini, Finance menerima tugas untuk mencatat nota kredit supplier.</div>}

          {action === 'credit' && (
            <div className="grid gap-3 rounded border border-blue-200 bg-blue-50/50 p-3 md:grid-cols-2">
              <label><span className="micro-label">Nomor nota kredit *</span><input value={creditNumber} onChange={(event) => setCreditNumber(event.target.value)} className="mt-1 w-full rounded border border-border bg-card px-2 py-2" placeholder="CN-2026-..." /></label>
              <label><span className="micro-label">Tanggal nota kredit *</span><input type="date" value={creditDate} onChange={(event) => setCreditDate(event.target.value)} className="mt-1 w-full rounded border border-border bg-card px-2 py-2" /></label>
              <label><span className="micro-label">Nilai nota kredit *</span><input type="number" min="1" max={supplierReturn.total_amount || 0} value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded border border-border bg-card px-2 py-2" /></label>
              <label><span className="micro-label">Penyelesaian *</span><select value={settlementMethod} onChange={(event) => setSettlementMethod(event.target.value)} className="mt-1 w-full rounded border border-border bg-card px-2 py-2"><option>Potong Utang Berjalan</option><option>Kredit Faktur Berikutnya</option><option>Refund Supplier</option></select></label>
            </div>
          )}

          {action === 'reconcile' && <label className="block"><span className="micro-label">Referensi rekonsiliasi *</span><input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 w-full rounded border border-border px-2 py-2" placeholder="Nomor jurnal / bukti refund / referensi potong utang" /></label>}

          {!['detail', 'process'].includes(action) && <label className="block"><span className="micro-label">{requiresNotes ? 'Alasan *' : 'Catatan'}</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded border border-border px-2 py-2" placeholder={requiresNotes ? 'Jelaskan alasan keputusan…' : 'Catatan proses (opsional)…'} /></label>}

          <div>
            <p className="micro-label mb-2">Timeline lintas-role</p>
            <div className="space-y-2 border-l-2 border-primary/20 pl-4">
              {history.map((entry, index) => <div key={`${entry.status}-${entry.at}-${index}`} className="relative rounded border border-border p-2.5 before:absolute before:-left-[21px] before:top-3 before:h-2 before:w-2 before:rounded-full before:bg-primary"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{entry.status}</strong><span className="text-[10px] text-muted-foreground">{entry.at ? new Date(entry.at).toLocaleString('id-ID') : '-'}</span></div><p className="mt-0.5 text-muted-foreground">{entry.by || '-'}{entry.role ? ` • ${entry.role}` : ''}</p>{entry.notes && <p className="mt-1">{entry.notes}</p>}</div>)}
              {!history.length && <p className="text-muted-foreground">Belum ada timeline pada data lama.</p>}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <button onClick={onClose} className="rounded border border-border px-3 py-1.5 font-medium hover:bg-muted">{action === 'detail' ? 'Tutup' : 'Batal'}</button>
          {action !== 'detail' && <button onClick={submit} disabled={saving} className="btn-primary rounded px-4 py-1.5 font-medium disabled:opacity-50">{saving ? 'Menyimpan…' : config.submit}</button>}
        </div>
      </div>
    </div>
  );
}
