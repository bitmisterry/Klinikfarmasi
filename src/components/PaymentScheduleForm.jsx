import React, { useState, useEffect } from 'react';
import { X, Calendar, Save } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { schedulePayment } from '@/lib/procurement';
import { logAuditAction } from '@/lib/roles';

export default function PaymentScheduleForm({ invoices, userName, onClose, onSaved }) {
  const [form, setForm] = useState({
    invoice_id: '',
    planned_date: '',
    amount: 0,
    payment_method: 'Transfer',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-fill from selected invoice
  useEffect(() => {
    if (form.invoice_id) {
      const inv = invoices.find((i) => i.id === form.invoice_id);
      if (inv) {
        const remaining = (inv.total_amount || 0) - (inv.paid_amount || 0);
        set('amount', remaining);
        if (inv.due_date && !form.planned_date) set('planned_date', inv.due_date);
      }
    }
  }, [form.invoice_id]);

  const unpaidInvoices = invoices.filter((i) => i.status !== 'Lunas');
  const selectedInv = invoices.find((i) => i.id === form.invoice_id);
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  const submit = async () => {
    if (!form.invoice_id || !form.planned_date || !form.amount) {
      toast({ title: 'Faktur, tanggal, & jumlah wajib', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const sched = await schedulePayment({
        schedule_number: `JB${new Date().toISOString().split('T')[0].replace(/-/g, '')}${String(Date.now()).slice(-3)}`,
        supplier_id: selectedInv.supplier_id,
        supplier_name: selectedInv.supplier_name,
        invoice_id: selectedInv.id,
        invoice_number: selectedInv.invoice_number,
        po_number: selectedInv.po_number,
        planned_date: form.planned_date,
        amount: form.amount,
        payment_method: form.payment_method,
        notes: form.notes,
        created_by: userName,
      }, userName);
      await logAuditAction({
        action: 'create', entity: 'PaymentSchedule', entityId: sched.id, entityName: sched.schedule_number,
        module: 'finance',
        description: `Jadwal bayar ${sched.schedule_number} ke ${selectedInv.supplier_name} — Rp ${form.amount.toLocaleString('id-ID')}`,
        severity: 'Info',
      });
      toast({ title: 'Jadwal pembayaran dibuat', description: `Rp ${form.amount.toLocaleString('id-ID')} — ${form.planned_date}` });
      onSaved();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Jadwal Pembayaran</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground">Faktur Belum Lunas *</label>
            <select value={form.invoice_id} onChange={(e) => set('invoice_id', e.target.value)} className={inputCls}>
              <option value="">Pilih faktur…</option>
              {unpaidInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {inv.supplier_name} — Rp {((inv.total_amount || 0) - (inv.paid_amount || 0)).toLocaleString('id-ID')}
                </option>
              ))}
            </select>
          </div>
          {selectedInv && (
            <div className="bg-muted/30 border border-border rounded p-2 text-[11px] space-y-0.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="font-medium">{selectedInv.supplier_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Faktur</span><span>Rp {(selectedInv.total_amount || 0).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sudah Dibayar</span><span className="text-emerald-600">Rp {(selectedInv.paid_amount || 0).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between border-t border-border pt-0.5"><span className="text-muted-foreground">Sisa</span><span className="font-semibold text-rose-600">Rp {((selectedInv.total_amount || 0) - (selectedInv.paid_amount || 0)).toLocaleString('id-ID')}</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-muted-foreground">Tgl Rencana Bayar</label><input type="date" value={form.planned_date} onChange={(e) => set('planned_date', e.target.value)} className={inputCls} /></div>
            <div><label className="text-[11px] text-muted-foreground">Metode</label><select value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)} className={inputCls}>{['Tunai','Transfer','Debit','Cek','BG'].map((m) => <option key={m}>{m}</option>)}</select></div>
          </div>
          <div><label className="text-[11px] text-muted-foreground">Jumlah (Rp)</label><input type="number" value={form.amount} onChange={(e) => set('amount', +e.target.value)} className={inputCls} /></div>
          <div><label className="text-[11px] text-muted-foreground">Catatan</label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} rows={2} /></div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Jadwalkan'}
          </button>
        </div>
      </div>
    </div>
  );
}