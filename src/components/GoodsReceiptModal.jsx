const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { X, Package, Save, AlertCircle, Calendar, Layers } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { receiveGoods } from '@/lib/procurement';
import { logAuditAction } from '@/lib/roles';

export default function GoodsReceiptModal({ po, supplier, userName, onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (po?.items) {
      setItems(po.items.map((it) => ({
        medicine_id: it.medicine_id,
        medicine_name: it.medicine_name,
        ordered: it.quantity || 0,
        received: it.received_quantity || 0,
        toReceive: Math.max(0, (it.quantity || 0) - (it.received_quantity || 0)),
        batch_number: '',
        expiry_date: '',
        unit_price: it.unit_price || 0,
        selling_price: 0,
      })));
    }
  }, [po]);

  const updateItem = (i, k, v) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const totalToReceive = items.reduce((s, it) => s + (it.toReceive > 0 ? 1 : 0), 0);
  const canSave = items.some((it) => it.toReceive > 0 && it.batch_number && it.expiry_date);

  const submit = async () => {
    // Form memakai `toReceive` untuk membedakan dari qty pesanan; service
    // penerimaan memakai kontrak `quantity`. Normalisasi di satu tempat agar
    // batch, mutasi stok, dan received_quantity PO tidak pernah menerima qty kosong.
    const toReceive = items
      .filter((it) => Number(it.toReceive) > 0 && it.batch_number && it.expiry_date)
      .map((it) => ({ ...it, quantity: Number(it.toReceive) }));
    if (toReceive.length === 0) {
      toast({ title: 'Isi qty, batch, dan expiry untuk minimal 1 item', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Fetch selling prices from Medicine
      for (const it of toReceive) {
        if (!it.selling_price) {
          const med = await db.entities.Medicine.get(it.medicine_id);
          it.selling_price = med.selling_price || 0;
        }
      }
      const result = await receiveGoods(po, toReceive, supplier, userName);
      await logAuditAction({
        action: 'update', entity: 'PurchaseOrder', entityId: po.id, entityName: po.po_number,
        module: 'purchasing',
        description: `Penerimaan barang PO ${po.po_number}: ${result.movements.length} item, ${result.totalReceivedQty} unit. Status: ${result.poStatus}`,
        newValue: JSON.stringify(result.movements),
        severity: 'Warning',
      });
      toast({ title: 'Penerimaan barang tersimpan', description: `${result.movements.length} item / ${result.totalReceivedQty} unit diterima, stok diperbarui` });
      onSaved();
    } catch (e) {
      toast({ title: 'Gagal menerima barang', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card h-full overflow-y-auto border-l border-border" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Penerimaan Barang</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{po?.po_number} • {po?.supplier_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded p-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-800">Setiap item yang diterima akan membuat batch stok baru (FEFO), mencatat mutasi stok masuk, dan memperbarui stok obat. Pastikan nomor batch & tanggal kadaluarsa sesuai fisik.</p>
          </div>

          <div className="space-y-2">
            {items.map((it, i) => {
              const remaining = it.ordered - it.received;
              const willReceive = it.toReceive > 0;
              return (
                <div key={i} className={`border rounded p-2.5 ${willReceive ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium flex-1 truncate">{it.medicine_name}</span>
                    <span className="text-[11px] text-muted-foreground">Pesanan: {it.ordered}</span>
                    <span className="text-[11px] text-emerald-600">Diterima: {it.received}</span>
                    <span className="text-[11px] text-amber-600">Sisa: {remaining}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Qty Terima</label>
                      <input type="number" min="0" max={remaining} value={it.toReceive}
                        onChange={(e) => updateItem(i, 'toReceive', Math.min(+e.target.value, remaining))}
                        className={inputCls} disabled={remaining <= 0} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">No. Batch</label>
                      <input value={it.batch_number} onChange={(e) => updateItem(i, 'batch_number', e.target.value)}
                        className={inputCls} placeholder="BATCH-001" disabled={!willReceive} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> Expired</label>
                      <input type="date" value={it.expiry_date} onChange={(e) => updateItem(i, 'expiry_date', e.target.value)}
                        className={inputCls} disabled={!willReceive} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Hrg Beli/unit</label>
                      <input type="number" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', +e.target.value)}
                        className={inputCls} disabled={!willReceive} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving || !canSave} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Memproses…' : `Terima ${totalToReceive} Item`}
          </button>
        </div>
      </div>
    </div>
  );
}
