// @ts-nocheck -- Inventory rows are composed from heterogeneous batch records.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, AlertTriangle, MapPin, Edit, Trash2, X, Info, ClipboardList, Wallet, TrendingDown, CalendarClock, Layers } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import DrugInfoDrawer from '@/components/DrugInfoDrawer';
import StockCardDrawer from '@/components/StockCardDrawer';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

export default function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [infoMed, setInfoMed] = useState(null);
  const [stockCardMed, setStockCardMed] = useState(null);
  const [showBatches, setShowBatches] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const clinicRole = getClinicRole(user);
  const isPharmacyRole = ['Apoteker', 'Apoteker Penanggung Jawab', 'Apoteker Pendamping', 'Admin Farmasi', 'TTK/Asisten Farmasi'].includes(clinicRole);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [meds, bats] = await Promise.all([
        db.entities.Medicine.list(),
        db.entities.StockBatch.filter({ status: 'Aktif' }),
      ]);
      setMedicines(meds || []);
      setBatches(bats || []);
    } catch {}
    setLoading(false);
  };

  // Batch expiry helpers
  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  const batchExpiryStatus = (b) => {
    const d = daysUntil(b.expiry_date);
    if (d === null) return 'unknown';
    if (d < 0) return 'expired';
    if (d <= 30) return 'critical';
    if (d <= 90) return 'warning';
    return 'ok';
  };
  const EXPIRY_STYLES = {
    expired: 'pill-critical', critical: 'pill-critical', warning: 'pill-warning', ok: 'pill-success', unknown: 'pill-inactive'
  };
  const EXPIRY_LABELS = {
    expired: 'Kadaluarsa', critical: '≤30 hari', warning: '≤90 hari', ok: 'Aman', unknown: '-'
  };
  const nearExpiryCount = batches.filter(b => {
    const d = daysUntil(b.expiry_date);
    return d !== null && d <= 90 && d >= 0;
  }).length;
  const expiredCount = batches.filter(b => {
    const d = daysUntil(b.expiry_date);
    return d !== null && d < 0;
  }).length;
  // FEFO sort: earliest expiry first
  const sortedBatches = [...batches].sort((a, b) => {
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return new Date(a.expiry_date) - new Date(b.expiry_date);
  });

  const filtered = medicines.filter(m => {
    const q = search.toLowerCase();
    const match = !search || m.name?.toLowerCase().includes(q) || m.active_substance?.toLowerCase().includes(q) || m.barcode?.includes(q);
    if (!match) return false;
    if (filter === 'out') return (m.stock_on_hand || 0) <= 0;
    if (filter === 'low') return (m.stock_on_hand || 0) > 0 && (m.stock_on_hand || 0) <= (m.min_stock || 0);
    if (filter === 'ok') return (m.stock_on_hand || 0) > (m.min_stock || 0);
    return true;
  });

  const deleteMed = async (m) => {
    if (!confirm(`Hapus ${m.name}?`)) return;
    await db.entities.Medicine.delete(m.id);
    await db.entities.AuditLog.create({
      action: 'delete', entity: 'Medicine', description: `Hapus obat: ${m.name}`,
      user_name: 'Sistem', severity: 'Warning', timestamp: new Date().toISOString()
    });
    toast({ title: 'Obat dihapus' });
    load();
  };

  const totalItems = medicines.length;
  const outOfStock = medicines.filter(m => (m.stock_on_hand || 0) <= 0).length;
  const lowStock = medicines.filter(m => (m.stock_on_hand || 0) > 0 && (m.stock_on_hand || 0) <= (m.min_stock || 0)).length;
  // Nilai persediaan harus menggunakan harga per batch (HPP), bukan harga jual
  // master. Ini menjaga nilai stok benar saat satu obat memiliki beberapa batch
  // dengan harga faktur dan expiry berbeda.
  const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]));
  const inventoryCostValue = batches.reduce((sum, batch) => sum + Number(batch.quantity || 0) * Number(batch.hpp_per_unit ?? batch.purchase_price ?? 0), 0);
  const inventoryRetailValue = batches.reduce((sum, batch) => {
    const medicine = medicineById.get(batch.medicine_id);
    return sum + Number(batch.quantity || 0) * Number(batch.selling_price ?? medicine?.selling_price ?? 0);
  }, 0);

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Inventory Obat</h1>
        {!isPharmacyRole && <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded-md text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Obat Baru
        </button>}
      </div>

      <ModuleStatHeader stats={[
        { icon: Package, label: 'Total Item', value: totalItems, color: 'text-blue-600' },
        { icon: AlertTriangle, label: 'Stok Habis', value: outOfStock, color: 'text-rose-600' },
        { icon: TrendingDown, label: 'Stok Rendah', value: lowStock, color: 'text-amber-600' },
        { icon: CalendarClock, label: 'Mendekati Kadaluarsa', value: nearExpiryCount, color: nearExpiryCount > 0 ? 'text-amber-600' : 'text-teal-600', subtitle: expiredCount > 0 ? `${expiredCount} sudah lewat` : 'Aman' },
        { icon: Wallet, label: 'Nilai Persediaan (HPP)', value: `Rp ${inventoryCostValue.toLocaleString('id-ID')}`, color: 'text-teal-600' },
        { icon: Wallet, label: 'Nilai Jual FEFO', value: `Rp ${inventoryRetailValue.toLocaleString('id-ID')}`, color: 'text-primary' },
      ]} />

      {/* Batch & Expiry tracking — FEFO */}
      <div className="panel">
        <button onClick={() => setShowBatches(!showBatches)} className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border">
          <h2 className="text-section-title flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Batch & Kadaluarsa
            {nearExpiryCount > 0 && <span className="pill pill-warning">{nearExpiryCount} segera</span>}
            {expiredCount > 0 && <span className="pill pill-critical">{expiredCount} lewat</span>}
          </h2>
          <span className="text-caption text-muted-foreground">{showBatches ? 'Sembunyikan' : 'Tampilkan'} ({batches.length} batch aktif)</span>
        </button>
        {showBatches && (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 micro-label">Obat</th>
                  <th className="px-3 py-2 micro-label">No. Batch</th>
                  <th className="px-3 py-2 micro-label text-right">Sisa Stok</th>
                  <th className="px-3 py-2 micro-label">Expired</th>
                  <th className="px-3 py-2 micro-label text-right hidden lg:table-cell">HPP / Jual</th>
                  <th className="px-3 py-2 micro-label">Status</th>
                  <th className="px-3 py-2 micro-label hidden md:table-cell">Faktur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedBatches.map((b) => {
                  const st = batchExpiryStatus(b);
                  return (
                    <tr key={b.id} className={`row-hover ${st === 'expired' ? 'bg-rose-50/50' : st === 'critical' ? 'bg-rose-50/30' : st === 'warning' ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-3 py-2 font-medium">{b.medicine_name}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{b.batch_number}</td>
                      <td className="px-3 py-2 text-right">{b.quantity || 0}</td>
                      <td className="px-3 py-2">{b.expiry_date || '-'}</td>
                      <td className="px-3 py-2 text-right hidden lg:table-cell"><p>Rp {Number(b.hpp_per_unit ?? b.purchase_price ?? 0).toLocaleString('id-ID')}</p><p className="text-[10px] text-primary">Rp {Number(b.selling_price || 0).toLocaleString('id-ID')}</p></td>
                      <td className="px-3 py-2"><span className={`pill ${EXPIRY_STYLES[st]}`}>{EXPIRY_LABELS[st]}</span></td>
                      <td className="px-3 py-2 hidden md:table-cell font-mono text-[11px] text-muted-foreground">{b.invoice_number || '-'}</td>
                    </tr>
                  );
                })}
                {batches.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-caption text-muted-foreground">Belum ada batch aktif</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 panel flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari obat…"
            className="flex-1 bg-transparent outline-none text-xs" />
        </div>
        <div className="flex gap-1">
          {[
            { k: 'all', l: 'Semua' }, { k: 'ok', l: 'Tersedia' },
            { k: 'low', l: 'Stok Rendah' }, { k: 'out', l: 'Habis' }
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)}
              className={`px-2.5 py-1.5 rounded text-xs border transition-colors ${
                filter === f.k ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}>{f.l}</button>
          ))}
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left">
              <th className="px-3 py-2 micro-label">Nama Obat</th>
              <th className="px-3 py-2 micro-label hidden sm:table-cell">Tipe</th>
              <th className="px-3 py-2 micro-label hidden md:table-cell">Zat Aktif</th>
              <th className="px-3 py-2 micro-label hidden lg:table-cell">Bentuk</th>
              <th className="px-3 py-2 micro-label">Stok</th>
              <th className="px-3 py-2 micro-label hidden sm:table-cell">Min</th>
              <th className="px-3 py-2 micro-label hidden md:table-cell">Rak</th>
                  <th className="px-3 py-2 micro-label">Harga Jual / HPP</th>
              <th className="px-3 py-2 micro-label">Status</th>
              <th className="px-3 py-2 micro-label text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(m => {
              const out = (m.stock_on_hand || 0) <= 0;
              const low = (m.stock_on_hand || 0) > 0 && (m.stock_on_hand || 0) <= (m.min_stock || 0);
              return (
                <tr key={m.id} className={`row-hover ${out ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{m.strength} • {m.manufacturer}</p>
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <span className={`pill ${m.product_type === 'Obat' ? 'pill-info' : m.product_type === 'OTC' ? 'pill-success' : 'pill-inactive'}`}>{m.product_type || 'Obat'}</span>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{m.active_substance || '-'}</td>
                  <td className="px-3 py-2 hidden lg:table-cell">{m.form}</td>
                  <td className="px-3 py-2 font-medium">{m.stock_on_hand || 0} <span className="text-muted-foreground font-normal">{m.unit}</span></td>
                  <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{m.min_stock || 0}</td>
                  <td className="px-3 py-2 hidden md:table-cell"><span className="flex items-center gap-0.5 text-muted-foreground"><MapPin className="w-3 h-3" />{m.shelf_location || '-'}</span></td>
                  <td className="px-3 py-2"><p>Rp {(m.selling_price || 0).toLocaleString('id-ID')}</p><p className="text-[10px] text-muted-foreground">HPP Rp {(m.hpp_per_unit ?? m.purchase_price ?? 0).toLocaleString('id-ID')}</p></td>
                  <td className="px-3 py-2">
                    {out ? <span className="pill pill-critical">Habis</span>
                      : low ? <span className="pill pill-warning">Rendah</span>
                      : <span className="pill pill-success">Tersedia</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setStockCardMed(m)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Kartu Stok"><ClipboardList className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setInfoMed(m)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="PIO"><Info className="w-3.5 h-3.5" /></button>
                      {!isPharmacyRole && <>
                        <button onClick={() => { setEditing(m); setShowForm(true); }} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteMed(m)} className="p-1 hover:bg-rose-50 rounded text-muted-foreground hover:text-rose-600" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && !loading && <div className="py-4"><EmptyState icon={Package} title="Tidak ada obat" description="Tambah obat baru atau ubah filter pencarian" /></div>}
      </div>

      {showForm && <MedicineForm medicine={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); load(); }} />}
      {infoMed && <DrugInfoDrawer medicine={infoMed} onClose={() => setInfoMed(null)} />}
      {stockCardMed && <StockCardDrawer medicine={stockCardMed} onClose={() => setStockCardMed(null)} />}
    </div>
  );
}

function MedicineForm({ medicine, onClose, onSaved }) {
  const [form, setForm] = useState(medicine || {
    name: '', product_type: 'Obat', generic_name: '', active_substance: '', strength: '', form: 'Tablet', administration_route: 'internal',
    category: 'Obat Bebas', barcode: '', manufacturer: '', shelf_location: '',
    unit: 'tablet', selling_price: 0, purchase_price: 0, stock_on_hand: 0, min_stock: 0,
    indication: '', contraindication: '', side_effects: '', interactions: '', precautions: '', pregnancy_category: ''
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name) { toast({ title: 'Nama produk wajib', variant: 'destructive' }); return; }
    if (form.product_type === 'Obat' && !form.active_substance) { toast({ title: 'Zat aktif wajib untuk obat', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (medicine?.id) {
        await db.entities.Medicine.update(medicine.id, form);
        await db.entities.AuditLog.create({ action: 'update', entity: 'Medicine', description: `Edit obat: ${form.name}`, user_name: 'Sistem', severity: 'Info', timestamp: new Date().toISOString() });
      } else {
        await db.entities.Medicine.create({ ...form, code: `MDX${Date.now().toString().slice(-5)}` });
        await db.entities.AuditLog.create({ action: 'create', entity: 'Medicine', description: `Tambah obat baru: ${form.name}`, user_name: 'Sistem', severity: 'Info', timestamp: new Date().toISOString() });
      }
      toast({ title: 'Obat disimpan' });
      onSaved();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{medicine ? 'Edit Obat' : 'Obat Baru'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="micro-label mb-2">Informasi Dasar</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-[11px] text-muted-foreground">Nama Produk *</label><input value={form.name} onChange={e=>set('name',e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Tipe Produk</label><select value={form.product_type} onChange={e=>set('product_type',e.target.value)} className={inputCls}>{['Obat','OTC','Alkes','Produk Umum'].map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className="text-[11px] text-muted-foreground">Nama Generik</label><input value={form.generic_name} onChange={e=>set('generic_name',e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Zat Aktif {form.product_type === 'Obat' ? '*' : ''}</label><input value={form.active_substance} onChange={e=>set('active_substance',e.target.value)} className={inputCls} disabled={form.product_type !== 'Obat'} /></div>
              <div><label className="text-[11px] text-muted-foreground">Strength</label><input value={form.strength} onChange={e=>set('strength',e.target.value)} className={inputCls} placeholder="500mg" /></div>
              <div><label className="text-[11px] text-muted-foreground">Bentuk</label><select value={form.form} onChange={e=>set('form',e.target.value)} className={inputCls}>{['Tablet','Kapsul','Sirup','Salep','Krim','Gel','Lotion','Injeksi','Tetes','Suspensi','Serbuk','Lainnya'].map(f=><option key={f}>{f}</option>)}</select></div>
              <div><label className="text-[11px] text-muted-foreground">Rute Etiket</label><select value={form.administration_route || 'internal'} onChange={e=>set('administration_route', e.target.value)} className={inputCls}><option value="internal">Obat Dalam — Putih</option><option value="external">Obat Luar — Biru</option></select></div>
              <div><label className="text-[11px] text-muted-foreground">Kategori</label><select value={form.category} onChange={e=>set('category',e.target.value)} className={inputCls}>{['Obat Bebas','Obat Bebas Terbatas','Obat Keras','Narkotika/Psikotropika','Suplemen'].map(f=><option key={f}>{f}</option>)}</select></div>
              <div><label className="text-[11px] text-muted-foreground">Barcode</label><input value={form.barcode} onChange={e=>set('barcode',e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Pabrik</label><input value={form.manufacturer} onChange={e=>set('manufacturer',e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Lokasi Rak</label><input value={form.shelf_location} onChange={e=>set('shelf_location',e.target.value)} className={inputCls} placeholder="A-12" /></div>
              <div><label className="text-[11px] text-muted-foreground">Satuan</label><input value={form.unit} onChange={e=>set('unit',e.target.value)} className={inputCls} /></div>
            </div>
          </div>
          <div>
            <p className="micro-label mb-2">Harga & Stok</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11px] text-muted-foreground">Harga Jual</label><input type="number" value={form.selling_price} onChange={e=>set('selling_price',+e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Harga Beli (HPP)</label><input type="number" value={form.purchase_price} onChange={e=>set('purchase_price',+e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Stok</label><input type="number" value={form.stock_on_hand} onChange={e=>set('stock_on_hand',+e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Min. Stok</label><input type="number" value={form.min_stock} onChange={e=>set('min_stock',+e.target.value)} className={inputCls} /></div>
            </div>
          </div>
          <div>
            <p className="micro-label mb-2">Informasi Obat (PIO)</p>
            <div className="space-y-2">
              <div><label className="text-[11px] text-muted-foreground">Indikasi</label><textarea value={form.indication} onChange={e=>set('indication',e.target.value)} className={inputCls} rows={2} /></div>
              <div><label className="text-[11px] text-muted-foreground">Kontraindikasi</label><textarea value={form.contraindication} onChange={e=>set('contraindication',e.target.value)} className={inputCls} rows={2} /></div>
              <div><label className="text-[11px] text-muted-foreground">Efek Samping</label><textarea value={form.side_effects} onChange={e=>set('side_effects',e.target.value)} className={inputCls} rows={2} /></div>
              <div><label className="text-[11px] text-muted-foreground">Interaksi</label><input value={form.interactions} onChange={e=>set('interactions',e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Perhatian Khusus</label><input value={form.precautions} onChange={e=>set('precautions',e.target.value)} className={inputCls} /></div>
              <div><label className="text-[11px] text-muted-foreground">Kategori Kehamilan</label><input value={form.pregnancy_category} onChange={e=>set('pregnancy_category',e.target.value)} className={inputCls} placeholder="A/B/C/D/X" /></div>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}
