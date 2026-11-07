import React, { useState, useEffect } from 'react';
import { Package, Pill, ShieldAlert, Plus, X, Check, RefreshCw, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { generateDefectaList } from '@/lib/pharmacy';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/AuthContext';

/**
 * Panel auto-defecta: generate daftar obat yang perlu dipesan ulang.
 * Petugas farmasi review → buat SP → APJ approve.
 * SP narkotika otomatis pakai form terpisah dengan nomor urut.
 */
export default function DefectaPanel() {
  const [defecta, setDefecta] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [showSPForm, setShowSPForm] = useState(false);
  const [spSupplier, setSpSupplier] = useState('');
  const [spNotes, setSpNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const clinicRole = user?.clinic_role || user?.data?.clinic_role || '';
  const canCreateSP = ['Apoteker', 'Apoteker Penanggung Jawab', 'Admin Farmasi'].includes(clinicRole);

  const load = async () => {
    setLoading(true);
    try {
      const [defectaList, sups, pos] = await Promise.all([
        generateDefectaList(),
        base44.entities.Supplier.list(),
        base44.entities.PurchaseOrder.list(),
      ]);
      setDefecta(defectaList);
      setSuppliers(sups || []);
      setPurchaseOrders(pos || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsubscribeMedicine = base44.entities.Medicine.subscribe(() => load());
    const unsubscribePurchaseOrder = base44.entities.PurchaseOrder.subscribe(() => load());
    return () => {
      unsubscribeMedicine?.();
      unsubscribePurchaseOrder?.();
    };
  }, []);

  const activePurchaseOrders = purchaseOrders.filter((po) => ['Menunggu Approval', 'Disetujui', 'Dikirim', 'Diterima Sebagian'].includes(po.status));
  const activePOByMedicine = new Map();
  activePurchaseOrders.forEach((po) => (po.items || []).forEach((item) => {
    if (!activePOByMedicine.has(item.medicine_id)) activePOByMedicine.set(item.medicine_id, po);
  }));

  const toggleSelect = (id) => {
    if (!canCreateSP) {
      toast({ title: 'Akses pembuatan SP terbatas', description: 'SP dibuat oleh Apoteker atau Admin Farmasi; approval dilakukan APJ.', variant: 'destructive' });
      return;
    }
    if (activePOByMedicine.has(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = defecta.filter(d => selected.has(d.medicine.id) && !activePOByMedicine.has(d.medicine.id));
  const hasNarcotic = selectedItems.some(d => d.is_narcotic);
  const totalEstimate = selectedItems.reduce((s, d) => s + d.suggested_qty * (d.medicine.purchase_price || 0), 0);

  const createSP = async () => {
    if (!canCreateSP) { toast({ title: 'Tidak memiliki akses membuat SP', variant: 'destructive' }); return; }
    if (!spSupplier) { toast({ title: 'Pilih supplier', variant: 'destructive' }); return; }
    if (selectedItems.length === 0) { toast({ title: 'Pilih item defecta', variant: 'destructive' }); return; }
    setCreating(true);
    try {
      const sup = suppliers.find(s => s.id === spSupplier);
      const today = new Date().toISOString().split('T')[0];
      const isNarcoticPO = hasNarcotic;
      const poNumber = isNarcoticPO
        ? `SPN-${today.replace(/-/g, '')}-${String(Date.now()).slice(-3)}`
        : `SP-${today.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
      const createdBy = user?.full_name || user?.email || clinicRole || 'Petugas Farmasi';
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 7);

      const items = selectedItems.map(d => ({
        medicine_id: d.medicine.id,
        medicine_name: d.medicine.name,
        quantity: d.suggested_qty,
        unit: d.medicine.unit || '',
        unit_price: d.medicine.purchase_price || 0,
        subtotal: d.suggested_qty * (d.medicine.purchase_price || 0),
      }));

      await base44.entities.PurchaseOrder.create({
        po_number: poNumber,
        supplier_id: spSupplier,
        supplier_name: sup.name,
        supplier_snapshot: { name: sup.name, address: sup.address || '', phone: sup.phone || '', email: sup.email || '' },
        order_date: today,
        expected_date: expectedDate.toISOString().split('T')[0],
        status: 'Menunggu Approval',
        is_narcotic_po: isNarcoticPO,
        narcotic_form_number: isNarcoticPO ? poNumber : '',
        items,
        total_amount: items.reduce((s, i) => s + i.subtotal, 0),
        notes: spNotes || `Auto-generated dari defecta (${items.length} item)`,
        created_by: createdBy,
        created_by_role: clinicRole,
        source_type: 'Defecta',
        source_defecta_items: selectedItems.map((item) => ({
          medicine_id: item.medicine.id,
          medicine_name: item.medicine.name,
          stock_on_hand: item.medicine.stock_on_hand || 0,
          min_stock: item.medicine.min_stock || 0,
          suggested_qty: item.suggested_qty,
        })),
        document_type: 'Surat Pesanan',
        document_status: 'Menunggu Approval',
      });

      await base44.entities.AuditLog.create({
        action: 'create',
        entity: 'PurchaseOrder',
        entity_name: poNumber,
        module: 'purchasing',
        description: `SP ${poNumber} dibuat dari defecta — ${items.length} item${isNarcoticPO ? ' (NARKOTIKA)' : ''}`,
        user_name: createdBy,
        severity: isNarcoticPO ? 'Warning' : 'Info',
        timestamp: new Date().toISOString(),
      });

      toast({
        title: `SP ${poNumber} dibuat`,
        description: isNarcoticPO
          ? 'SP Narkotika menunggu approval APJ (form terpisah)'
          : 'Menunggu approval APJ',
      });
      setShowSPForm(false);
      setSelected(new Set());
      setSpSupplier('');
      setSpNotes('');
      await load();
    } catch (e) {
      toast({ title: 'Gagal membuat SP', description: e.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  const narcoticCount = defecta.filter(d => d.is_narcotic).length;
  const outOfStock = defecta.filter(d => (d.medicine.stock_on_hand || 0) <= 0).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Daftar Defecta
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Obat dengan stok ≤ minimum. Pilih item → buat Surat Pesanan (SP) → APJ menyetujui → cetak/PDF.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1 text-xs border border-border px-2 py-1.5 rounded hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="panel px-3 py-2">
          <p className="micro-label">Total Defecta</p>
          <p className="text-base font-semibold text-amber-600">{defecta.length}</p>
        </div>
        <div className="panel px-3 py-2">
          <p className="micro-label">Stok Habis</p>
          <p className="text-base font-semibold text-rose-600">{outOfStock}</p>
        </div>
        <div className="panel px-3 py-2">
          <p className="micro-label flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Narkotika</p>
          <p className="text-base font-semibold text-rose-700">{narcoticCount}</p>
        </div>
      </div>

      {/* Defecta List */}
      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-8">Memuat defecta…</p>
      ) : defecta.length === 0 ? (
        <EmptyState icon={Package} title="Tidak ada defecta" description="Semua stok obat di atas minimum" />
      ) : (
        <div className="panel divide-y divide-border max-h-[400px] overflow-y-auto">
          {defecta.map(d => {
            const m = d.medicine;
            const isOut = (m.stock_on_hand || 0) <= 0;
            const activePO = activePOByMedicine.get(m.id);
            return (
              <div key={m.id} className={`flex items-center gap-3 px-3 py-2 ${d.is_narcotic ? 'bg-rose-50/30' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggleSelect(m.id)}
                  disabled={Boolean(activePO) || !canCreateSP}
                  className="w-4 h-4 rounded border-border"
                />
                <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Pill className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{m.name}</span>
                    {d.is_narcotic && (
                      <span className="pill pill-critical flex items-center gap-0.5">
                        <ShieldAlert className="w-3 h-3" /> Narkotika
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Stok: {m.stock_on_hand || 0} {m.unit || ''} • Min: {m.min_stock || 0} • Saran pesan: {d.suggested_qty} {m.unit || ''}
                  </p>
                </div>
                {activePO ? (
                  <span className="pill pill-info">SP {activePO.status === 'Menunggu Approval' ? 'menunggu approval' : activePO.status.toLowerCase()}</span>
                ) : isOut ? (
                  <span className="pill pill-critical">Habis</span>
                ) : (
                  <span className="pill pill-warning">Menipis</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create SP Bar */}
      {selectedItems.length > 0 && canCreateSP && (
        <div className="panel-accent px-3 py-2.5 flex items-center gap-3 sticky bottom-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium">{selected.size} item dipilih</p>
            <p className="text-[11px] text-muted-foreground">
              Estimasi: Rp {totalEstimate.toLocaleString('id-ID')}
              {hasNarcotic && <span className="text-rose-600 font-medium"> • Termasuk Narkotika (SP terpisah)</span>}
            </p>
          </div>
          <button
            onClick={() => setShowSPForm(true)}
            className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Buat SP
          </button>
        </div>
      )}

      {/* SP Form Modal */}
      {showSPForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSPForm(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {hasNarcotic ? 'SP Narkotika' : 'Surat Pesanan Baru'}
              </h3>
              <button onClick={() => setShowSPForm(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              {hasNarcotic && (
                <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <p className="text-xs text-rose-700">
                    SP ini mengandung obat narkotika/psikotropika. Form terpisah dengan nomor SPN wajib ditandatangani apoteker.
                  </p>
                </div>
              )}
              <div>
                <label className="text-[11px] text-muted-foreground">Supplier</label>
                <select value={spSupplier} onChange={e => setSpSupplier(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-xs mt-1">
                  <option value="">Pilih supplier…</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Catatan</label>
                <textarea value={spNotes} onChange={e => setSpNotes(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-xs mt-1" rows={2} placeholder="Catatan untuk supplier…" />
              </div>
              <div className="panel p-2 max-h-32 overflow-y-auto">
                <p className="micro-label mb-1">Item SP ({selectedItems.length})</p>
                {selectedItems.map(d => (
                  <div key={d.medicine.id} className="flex items-center justify-between text-xs py-0.5">
                    <span className="truncate">{d.medicine.name}</span>
                    <span className="text-muted-foreground">{d.suggested_qty} {d.medicine.unit || ''}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border flex gap-2">
              <button onClick={() => setShowSPForm(false)} className="flex-1 py-2 border border-border rounded text-xs hover:bg-muted">Batal</button>
              <button onClick={createSP} disabled={creating} className="flex-1 btn-primary py-2 rounded text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> {creating ? 'Membuat…' : 'Buat SP & Minta Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
