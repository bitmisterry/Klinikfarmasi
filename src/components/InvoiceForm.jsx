const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { X, FileText, Save, Calendar, Trash2, Search, Package, AlertCircle, ShieldAlert, Paperclip, Gift } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { logAuditAction } from '@/lib/roles';
import { loadPricingSettings, calculateInvoiceFinancials, calcProtectedMinSafePrice, PRICING_DEFINITION } from '@/lib/pricing';
import PriceInfoPopover from '@/components/PriceInfoPopover';
import DocumentAttachments from '@/components/documents/DocumentAttachments';

const DISC_TYPES = ['Tidak Ada', 'Persen', 'Nominal'];

export default function InvoiceForm({ suppliers, pos, userName, onClose, onSaved }) {
  const [form, setForm] = useState({
    invoice_number: '',
    supplier_id: '',
    po_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    other_charges: 0,
    notes: '',
  });
  const [items, setItems] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [medSearch, setMedSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [pricing, setPricing] = useState({ default_target_margin: 30, price_rounding: 500, ppn_in_hpp: 'true', bonus_treatment_default: 'Per Faktur', margin_method: 'Gross Margin' });
  const [showDocs, setShowDocs] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);
  const { toast } = useToast();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    db.entities.Medicine.list().then(setMedicines).catch(() => {});
    loadPricingSettings().then(setPricing).catch(() => {});
  }, []);

  // Load active batches for old-stock protection check (per medicine)
  const [batchCache, setBatchCache] = useState({});
  const loadBatchesForItem = async (medicineId) => {
    if (batchCache[medicineId]) return batchCache[medicineId];
    try {
      const batches = await db.entities.StockBatch.filter({ medicine_id: medicineId, status: 'Aktif' });
      setBatchCache((c) => ({ ...c, [medicineId]: batches || [] }));
      return batches || [];
    } catch { return []; }
  };
  useEffect(() => {
    items.forEach((it) => {
      if (it.medicine_id && !it._activeBatches) {
        loadBatchesForItem(it.medicine_id).then((batches) => {
          updateItem(items.indexOf(it), { _activeBatches: batches });
        });
      }
    });
  }, [items.length]);

  // Auto-fill supplier + items from PO (load StockBatch for batch/expiry)
  useEffect(() => {
    if (form.po_id) {
      const po = pos.find((p) => p.id === form.po_id);
      if (po) {
        set('supplier_id', po.supplier_id);
        loadPOItems(po);
      }
    }
  }, [form.po_id]);

  // Auto-calc due date from supplier payment terms
  useEffect(() => {
    if (form.supplier_id && form.invoice_date) {
      const sup = suppliers.find((s) => s.id === form.supplier_id);
      const terms = sup?.payment_terms || 'COD';
      const invDate = new Date(form.invoice_date);
      if (terms === 'COD') {
        set('due_date', form.invoice_date);
      } else {
        const days = parseInt(terms.replace(/\D/g, '')) || 0;
        if (days > 0) {
          invDate.setDate(invDate.getDate() + days);
          set('due_date', invDate.toISOString().split('T')[0]);
        }
      }
    }
  }, [form.supplier_id, form.invoice_date]);

  const loadPOItems = async (po) => {
    try {
      // A PO invoice reconciles batches already received for that PO; it must
      // never choose an arbitrary batch from the same supplier.
      const batches = await db.entities.StockBatch.filter({ purchase_order_id: po.id });
      const poItems = (po.items || []).map((it) => {
        const matching = (batches || []).filter((b) => b.medicine_id === it.medicine_id);
        const batch = matching[0];
        const med = medicines.find((m) => m.id === it.medicine_id);
        const unit_price = it.unit_price || batch?.purchase_price || 0;
        const targetMargin = med?.target_margin_default || pricing.default_target_margin || 30;
        return {
          medicine_id: it.medicine_id,
          medicine_name: it.medicine_name,
          quantity: matching.reduce((sum, current) => sum + (current.initial_quantity || current.quantity || 0), 0) || it.received_quantity || it.quantity || 0,
          bonus_quantity: 0,
          batch_number: batch?.batch_number || '',
          expiry_date: batch?.expiry_date || '',
          unit_price,
          discount_type: 'Tidak Ada',
          discount_value: 0,
          discount_amount: 0,
          net_unit_price: unit_price,
          ppn_percent: 0,
          ppn_amount: 0,
          target_margin: targetMargin,
          selling_price: 0,
          selling_price_auto: true,
          receipt_batch_ids: matching.map((current) => current.id),
          line_total: unit_price * (it.quantity || 0),
        };
      });
      setItems(poItems);
    } catch {
      setItems([]);
    }
  };

  const filteredMeds = medSearch
    ? medicines.filter((m) =>
        m.name?.toLowerCase().includes(medSearch.toLowerCase()) ||
        m.active_substance?.toLowerCase().includes(medSearch.toLowerCase()) ||
        m.barcode?.includes(medSearch)
      )
    : [];

  const addManualItem = (m) => {
    const targetMargin = m.target_margin_default || pricing.default_target_margin || 30;
    const unit_price = m.purchase_price || 0;
    setItems((prev) => [...prev, {
      medicine_id: m.id,
      medicine_name: m.name,
      quantity: 1,
      bonus_quantity: 0,
      batch_number: '',
      expiry_date: '',
      unit_price,
      discount_type: 'Tidak Ada',
      discount_value: 0,
      discount_amount: 0,
      net_unit_price: unit_price,
      ppn_percent: 0,
      ppn_amount: 0,
      target_margin: targetMargin,
      selling_price: 0,
      selling_price_auto: true,
      line_total: unit_price,
    }]);
    setMedSearch('');
  };

  const updateItem = (i, patch) => {
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, ...patch };

      // Recalc discount
      if (patch.discount_type !== undefined || patch.discount_value !== undefined || patch.unit_price !== undefined) {
        const up = updated.unit_price || 0;
        if (updated.discount_type === 'Persen') {
          updated.discount_amount = Math.round(up * (updated.discount_value || 0) / 100);
        } else if (updated.discount_type === 'Nominal') {
          updated.discount_amount = updated.discount_value || 0;
        } else {
          updated.discount_amount = 0;
          updated.discount_value = 0;
        }
        updated.net_unit_price = Math.max(0, up - updated.discount_amount);
      }

      // Recalc PPN
      if (patch.ppn_percent !== undefined || updated.net_unit_price !== it.net_unit_price || patch.quantity !== undefined) {
        updated.ppn_amount = Math.round(updated.net_unit_price * (updated.quantity || 0) * (updated.ppn_percent || 0) / 100);
      }

      return updated;
    }));
  };

  const setSellingPriceManual = (i, val) => {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, selling_price: +val, selling_price_auto: false } : it));
  };

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const financials = calculateInvoiceFinancials(items, form.other_charges, pricing);
  const pricedItems = financials.items.map((item) => {
    const protection = calcProtectedMinSafePrice(item.hpp_per_unit, item.target_margin, pricing.price_rounding, item._activeBatches || []);
    const sellingPrice = item.selling_price_auto === false
      ? Math.max(Number(item.selling_price || 0), protection.minSafePrice)
      : Math.max(item.selling_price || 0, protection.minSafePrice);
    return { ...item, selling_price: sellingPrice, hna_baru: sellingPrice, _hpp: item.hpp_per_unit, _minSafePrice: protection.minSafePrice, _protected: protection.protected, _highestOldHpp: protection.highestOldHpp, _oldStockValue: protection.oldStockValue };
  });
  const { subtotal, total_discount: totalDiscount, tax_ppn: totalPpn, total_amount: total } = financials;

  const availablePOs = pos.filter((p) => p.status === 'Diterima' || p.status === 'Diterima Sebagian');
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";
  const cellInput = "w-full px-1.5 py-1 border border-border rounded text-[11px] outline-none focus:border-primary";

  const submit = async () => {
    if (!form.invoice_number || !form.supplier_id) {
      toast({ title: 'Nomor faktur & supplier wajib', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'Tambahkan minimal 1 item', variant: 'destructive' });
      return;
    }
    const missingBatch = pricedItems.find((it) => !it.batch_number || !it.expiry_date);
    if (missingBatch) {
      toast({ title: `No batch & expired wajib untuk ${missingBatch.medicine_name}`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const sup = suppliers.find((s) => s.id === form.supplier_id);
      const po = pos.find((p) => p.id === form.po_id);
      const res = await db.functions.invoke('processInvoice', {
        invoice: {
          invoice_number: form.invoice_number,
          supplier_id: form.supplier_id,
          supplier_name: sup?.name || '',
          po_id: form.po_id || null,
          po_number: po?.po_number || '',
          invoice_date: form.invoice_date,
          due_date: form.due_date,
          other_charges: form.other_charges || 0,
          notes: form.notes,
          bonus_treatment: pricing.bonus_treatment_default === 'Prorata' ? 'Prorata' : 'Gratis',
        },
        items: pricedItems,
        pricing_config: pricing,
        userName: userName || 'Sistem',
      });
      await logAuditAction({
        action: 'create', entity: 'SupplierInvoice', entityId: res.data?.invoice?.id, entityName: form.invoice_number,
        module: 'purchasing',
        description: `Faktur ${form.invoice_number} dari ${sup?.name} — Rp ${total.toLocaleString('id-ID')} (${pricedItems.length} item)`,
        newValue: JSON.stringify({ total, items: pricedItems.length, price_changes: res.data?.priceChanges || 0 }),
        severity: 'Warning',
      });
      setSavedInvoiceId(res.data?.invoice?.id || null);
      const warnings = res.data?.warnings || [];
      if (warnings.length > 0) {
        toast({
          title: 'Faktur disimpan dengan peringatan',
          description: `${pricedItems.length} item • ${warnings.length} peringatan harga. Lampirkan faktur asli di bawah.`,
          duration: 6000,
        });
      } else {
        toast({ title: 'Faktur disimpan', description: `${pricedItems.length} item • HPP, harga jual, dan batch direkonsiliasi. Lampirkan faktur asli di bawah.` });
      }
      // Jangan onClose langsung — biarkan user lampirkan dokumen. Reload parent data.
      onSaved();
    } catch (e) {
      toast({ title: 'Gagal menyimpan faktur', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-4xl bg-card h-full overflow-y-auto border-l border-border" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Catat Faktur Supplier</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Header fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="col-span-2"><label className="text-[11px] text-muted-foreground">Nomor Faktur *</label><input value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} className={inputCls} placeholder="FK-2026-001" /></div>
            <div>
              <label className="text-[11px] text-muted-foreground">Purchase Order</label>
              <select value={form.po_id} onChange={(e) => set('po_id', e.target.value)} className={inputCls}>
                <option value="">— Tanpa PO (manual) —</option>
                {availablePOs.map((p) => <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Supplier *</label>
              <select value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)} className={inputCls} disabled={!!form.po_id}>
                <option value="">Pilih supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="text-[11px] text-muted-foreground">Tgl Faktur</label><input type="date" value={form.invoice_date} onChange={(e) => set('invoice_date', e.target.value)} className={inputCls} /></div>
            <div><label className="text-[11px] text-muted-foreground flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> Jatuh Tempo</label><input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} className={inputCls} /></div>
            <div><label className="text-[11px] text-muted-foreground">Biaya Lain (Ongkir)</label><input type="number" value={form.other_charges} onChange={(e) => set('other_charges', +e.target.value)} className={inputCls} /></div>
          </div>

          {/* Manual item search */}
          {!form.po_id && (
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Cari & Tambah Obat</label>
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <input value={medSearch} onChange={(e) => setMedSearch(e.target.value)} className="flex-1 bg-transparent outline-none text-xs" placeholder="Nama obat / zat aktif / barcode…" />
                </div>
                {medSearch && filteredMeds.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredMeds.slice(0, 8).map((m) => (
                      <button key={m.id} onClick={() => addManualItem(m)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-xs">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        <span className="flex-1">{m.name}</span>
                        <span className="text-muted-foreground">HPP: Rp {(m.purchase_price || 0).toLocaleString('id-ID')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info banner */}
          <div className="bg-teal-50 border border-teal-200 rounded p-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-teal-800">{PRICING_DEFINITION.hna} {PRICING_DEFINITION.hpp} Margin memakai metode <strong>{pricing.margin_method}</strong>. Untuk PO yang sudah diterima, faktur hanya merekonsiliasi harga dan batch—stok tidak ditambah lagi.</p>
          </div>

          {/* Item table */}
          <div className="border border-border rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 micro-label">Nama Barang</th>
                    <th className="px-1 py-1.5 micro-label text-center w-14">Qty</th>
                    <th className="px-1 py-1.5 micro-label text-center w-14">Bonus</th>
                    <th className="px-1 py-1.5 micro-label w-24">No. Batch</th>
                    <th className="px-1 py-1.5 micro-label w-28">Expired</th>
                    <th className="px-1 py-1.5 micro-label text-right w-20">Harga</th>
                    <th className="px-1 py-1.5 micro-label w-20">Diskon</th>
                    <th className="px-1 py-1.5 micro-label text-right w-20">HNA/unit</th>
                    <th className="px-1 py-1.5 micro-label text-center w-14">PPN%</th>
                    <th className="px-1 py-1.5 micro-label text-center w-14">Margin%</th>
                    <th className="px-1 py-1.5 micro-label text-right w-20">HPP/unit</th>
                    <th className="px-1 py-1.5 micro-label text-right w-24">Harga Jual</th>
                    <th className="px-1 py-1.5 micro-label text-right w-24">Min. Aman</th>
                    <th className="px-1 py-1.5 micro-label text-right w-24">Total</th>
                    <th className="px-1 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pricedItems.map((it, i) => {
                    const belowMin = it.selling_price > 0 && it._minSafePrice > 0 && it.selling_price < it._minSafePrice;
                    return (
                    <tr key={i} className={`hover:bg-slate-50 ${belowMin ? 'bg-rose-50/40' : ''}`}>
                      <td className="px-2 py-1">
                        <p className="text-[11px] font-medium truncate max-w-[140px]">{it.medicine_name}</p>
                        {it._protected && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-700 mt-0.5">
                            <ShieldAlert className="w-2.5 h-2.5" /> Stok lama terlindungi
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(i, { quantity: +e.target.value })} className={cellInput + " text-center"} />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" min="0" value={it.bonus_quantity || 0} onChange={(e) => updateItem(i, { bonus_quantity: +e.target.value })} className={cellInput + " text-center"} title="Jumlah unit bonus (gratis)" />
                      </td>
                      <td className="px-1 py-1">
                        <input value={it.batch_number} onChange={(e) => updateItem(i, { batch_number: e.target.value })} className={cellInput} placeholder="BATCH" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="date" value={it.expiry_date || ''} onChange={(e) => updateItem(i, { expiry_date: e.target.value })} className={cellInput} />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: +e.target.value })} className={cellInput + " text-right"} />
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex gap-0.5">
                          <select value={it.discount_type} onChange={(e) => updateItem(i, { discount_type: e.target.value })} className="px-0.5 py-1 border border-border rounded text-[10px] outline-none focus:border-primary w-14">
                            {DISC_TYPES.map((t) => <option key={t} value={t}>{t === 'Tidak Ada' ? '—' : t === 'Persen' ? '%' : 'Rp'}</option>)}
                          </select>
                          {it.discount_type !== 'Tidak Ada' && (
                            <input type="number" value={it.discount_value} onChange={(e) => updateItem(i, { discount_value: +e.target.value })} className="w-12 px-1 py-1 border border-border rounded text-[10px] outline-none focus:border-primary" />
                          )}
                        </div>
                      </td>
                      <td className="px-1 py-1 text-right text-[11px] font-medium text-teal-700">
                        Rp {(it.net_unit_price || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={it.ppn_percent} onChange={(e) => updateItem(i, { ppn_percent: +e.target.value })} className={cellInput + " text-center"} />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={it.target_margin || pricing.default_target_margin || 30} onChange={(e) => updateItem(i, { target_margin: +e.target.value })} className={cellInput + " text-center"} title="Target margin %" />
                      </td>
                      <td className="px-1 py-1 text-right text-[11px] text-muted-foreground">
                        Rp {Math.round((it._hpp || 0)).toLocaleString('id-ID')}
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-0.5">
                            <input type="number" value={it.selling_price} onChange={(e) => setSellingPriceManual(i, e.target.value)} className={cellInput + " text-right"} />
                            <PriceInfoPopover
                              hpp={it._hpp || 0}
                              minSafePrice={it._minSafePrice || 0}
                              targetMargin={it.target_margin || pricing.default_target_margin || 30}
                              sellingPrice={it.selling_price || 0}
                              protected={it._protected}
                              highestOldHpp={it._highestOldHpp}
                              oldStockValue={it._oldStockValue}
                              rounding={pricing.price_rounding || 500}
                            />
                          </div>
                          <span className={`text-[9px] text-center ${it.selling_price_auto ? 'text-muted-foreground' : 'text-amber-600 font-medium'}`}>
                            {it.selling_price_auto ? 'Otomatis' : 'Disesuaikan'}
                          </span>
                        </div>
                      </td>
                      <td className="px-1 py-1 text-right">
                        <span className={`text-[11px] font-medium ${belowMin ? 'text-rose-600' : 'text-muted-foreground'}`}>
                          Rp {(it._minSafePrice || 0).toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="px-1 py-1 text-right text-[11px] font-semibold">
                        Rp {(it.line_total || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => removeItem(i)} className="text-rose-500 hover:bg-rose-50 p-0.5 rounded"><Trash2 className="w-3 h-3" /></button>
                      </td>
                    </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={15} className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                      {form.po_id ? 'Pilih PO untuk mengisi item otomatis' : 'Cari & tambah obat di atas untuk mulai'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bonus treatment info */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Gift className="w-3 h-3" />
            <span>Perlakuan bonus: <strong className="text-foreground">{pricing.bonus_treatment_default === 'Prorata' ? 'Prorata (HPP dibagi ke semua unit)' : 'Gratis (HPP hanya dari unit berbayar)'}</strong>. PPN {pricing.ppn_in_hpp === 'true' ? 'termasuk' : 'tidak termasuk'} dalam HPP.</span>
          </div>

          <div><label className="text-[11px] text-muted-foreground">Catatan</label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} rows={2} /></div>

          {/* Lampiran dokumen (faktur asli, surat jalan) — muncul setelah faktur disimpan */}
          {savedInvoiceId && (
            <div className="border border-border rounded p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5 text-primary" /> Dokumen & Lampiran Faktur</p>
                <button onClick={() => setShowDocs((v) => !v)} className="text-[11px] text-primary hover:underline">
                  {showDocs ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              {showDocs && (
                <DocumentAttachments
                  ownerType="Faktur"
                  ownerId={savedInvoiceId}
                  ownerName={form.invoice_number}
                  suggestedCategories={['Faktur Asli', 'Surat Jalan', 'Bukti Bayar', 'Lainnya']}
                />
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Faktur asli & surat jalan disimpan **privately** — no public URL, so access follows your app's permissions.</p>
            </div>
          )}
        </div>

        {/* Footer — sticky totals */}
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3">
          <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
            <div><p className="micro-label">Subtotal</p><p className="font-medium">Rp {subtotal.toLocaleString('id-ID')}</p></div>
            <div><p className="micro-label">Total Diskon</p><p className="font-medium text-amber-600">- Rp {totalDiscount.toLocaleString('id-ID')}</p></div>
            <div><p className="micro-label">Total PPN</p><p className="font-medium">Rp {totalPpn.toLocaleString('id-ID')}</p></div>
            <div><p className="micro-label">Biaya Lain</p><p className="font-medium">Rp {(form.other_charges || 0).toLocaleString('id-ID')}</p></div>
          </div>
          <div className="flex justify-between mb-3 text-sm font-semibold">
            <span>Total Faktur</span><span className="text-primary">Rp {total.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">{savedInvoiceId ? 'Selesai' : 'Batal'}</button>
            {!savedInvoiceId && (
              <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Memproses…' : 'Simpan Faktur'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
