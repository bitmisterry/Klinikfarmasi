// @ts-nocheck -- Medicine data supports legacy and batch-pricing schemas.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Pill, Edit2, Trash2, X, Save, ChevronDown, Package, MapPin, DollarSign, FileText, Layers, AlertCircle } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import { hasPermission, hasAdvancedPermission, getClinicRole, logAuditAction } from '@/lib/roles';

const FORM_SECTIONS = [
  { key: 'identitas', label: 'Identitas Obat', icon: Pill, fields: ['name', 'generic_name', 'active_substance', 'strength', 'form', 'administration_route', 'category'] },
  { key: 'kemasan', label: 'Kemasan & Konversi', icon: Package, fields: ['unit', 'conversion_box', 'conversion_strip', 'conversion_tablet'] },
  { key: 'harga', label: 'Harga & Margin', icon: DollarSign, fields: ['purchase_price', 'selling_price', 'margin_percent'] },
  { key: 'stok', label: 'Stok & Lokasi', icon: MapPin, fields: ['shelf_location', 'min_stock', 'stock_on_hand', 'is_active'] },
  { key: 'substitusi', label: 'Substitusi', icon: Layers, fields: ['substitution_group', 'alternative_active_substances', 'barcode', 'manufacturer'] },
  { key: 'klinis', label: 'Klinis / PIO', icon: FileText, fields: ['indication', 'contraindication', 'side_effects', 'interactions', 'precautions', 'pregnancy_category', 'reference_url'] },
];

const FORM_OPTIONS = {
  form: ['Tablet', 'Kapsul', 'Sirup', 'Salep', 'Krim', 'Gel', 'Lotion', 'Injeksi', 'Tetes', 'Suspensi', 'Serbuk', 'Lainnya'],
  administration_route: ['internal', 'external'],
  category: ['Obat Bebas', 'Obat Bebas Terbatas', 'Obat Keras', 'Narkotika/Psikotropika', 'Bebas Bebas', 'Suplemen'],
  product_type: ['Obat', 'OTC', 'Alkes', 'Produk Umum'],
};

function emptyMed() {
  return {
    name: '', generic_name: '', active_substance: '', strength: '', form: 'Tablet', administration_route: 'internal', category: 'Obat Bebas',
    product_type: 'Obat', unit: '', conversion_box: 0, conversion_strip: 0, conversion_tablet: 0,
    purchase_price: 0, selling_price: 0, margin_percent: 0,
    stock_on_hand: 0, min_stock: 0, shelf_location: '', is_active: true,
    barcode: '', manufacturer: '', substitution_group: '', alternative_active_substances: '',
    indication: '', contraindication: '', side_effects: '', interactions: '', precautions: '',
    pregnancy_category: '', reference_url: '', code: '',
  };
}

export default function MasterObat() {
  const { user, roles } = useAuth();
  const clinicRole = getClinicRole(user);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [priceOverride, setPriceOverride] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const canCreate = hasPermission(clinicRole, 'master_obat', 'create', roles);
  const canEdit = hasPermission(clinicRole, 'master_obat', 'edit', roles);
  const canDelete = hasPermission(clinicRole, 'master_obat', 'delete', roles);
  const canViewHpp = hasAdvancedPermission(clinicRole, 'view_hpp', roles);
  const canOverridePrice = ['Owner', 'Admin'].includes(clinicRole);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await db.entities.Medicine.list();
      setMedicines(data || []);
    } catch (e) {
      toast({ title: 'Gagal memuat obat', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    return medicines.filter(m => {
      if (search) {
        const q = search.toLowerCase();
        const match = (m.name || '').toLowerCase().includes(q) ||
          (m.generic_name || '').toLowerCase().includes(q) ||
          (m.active_substance || '').toLowerCase().includes(q) ||
          (m.barcode || '').includes(q);
        if (!match) return false;
      }
      if (filterStock === 'low' && (m.stock_on_hand > (m.min_stock || 0) || m.stock_on_hand <= 0)) return false;
      if (filterStock === 'out' && m.stock_on_hand > 0) return false;
      if (filterStock === 'active' && !m.is_active) return false;
      return true;
    });
  }, [medicines, search, filterStock]);

  const stats = useMemo(() => ({
    total: medicines.length,
    active: medicines.filter(m => m.is_active).length,
    lowStock: medicines.filter(m => m.stock_on_hand > 0 && m.stock_on_hand <= (m.min_stock || 0)).length,
    outStock: medicines.filter(m => m.stock_on_hand <= 0).length,
  }), [medicines]);

  const startCreate = () => { setEditing(emptyMed()); setShowForm(true); };
  const startEdit = (m) => { setEditing({ ...m }); setShowForm(true); };

  const saveMed = async (data) => {
    setSaving(true);
    try {
      if (data.id) {
        const oldMed = medicines.find(m => m.id === data.id);
        const priceChanged = Number(data.selling_price) !== Number(oldMed?.selling_price);
        if (priceChanged && !canOverridePrice) {
          throw new Error('Harga jual hanya dapat diubah oleh Owner atau Admin melalui Kelola Harga Jual.');
        }
        // Harga jual selalu lewat satu fungsi terotorisasi agar histori harga,
        // HPP, margin, dan audit tidak terpecah dari perubahan master obat.
        const payload = priceChanged
          ? { ...data, selling_price: oldMed.selling_price, margin_percent: oldMed.margin_percent }
          : { ...data };
        await db.entities.Medicine.update(data.id, payload);
        if (priceChanged) {
          await db.functions.invoke('changeSellingPrice', {
            medicine_id: data.id,
            new_price: Number(data.selling_price),
            reason: 'Perubahan melalui formulir master obat',
          });
        }
        await logAuditAction({
          action: 'update', entity: 'Medicine', entityId: data.id, entityName: data.name,
          description: `Mengubah master obat ${data.name}`,
          oldValue: JSON.stringify({ name: oldMed?.name, selling_price: oldMed?.selling_price, purchase_price: oldMed?.purchase_price }),
          newValue: JSON.stringify({ name: data.name, selling_price: data.selling_price, purchase_price: data.purchase_price }),
          module: 'master_obat', severity: data.selling_price !== oldMed?.selling_price ? 'Warning' : 'Info',
        });
        toast({ title: 'Obat diperbarui' });
      } else {
        const margin = data.purchase_price > 0
          ? Math.round(((data.selling_price - data.purchase_price) / data.purchase_price) * 100 * 10) / 10
          : 0;
        const payload = { ...data, margin_percent: margin };
        const created = await db.entities.Medicine.create(payload);
        await logAuditAction({
          action: 'create', entity: 'Medicine', entityId: created.id, entityName: data.name,
          description: `Menambah master obat ${data.name}`, module: 'master_obat', severity: 'Info',
        });
        toast({ title: 'Obat ditambahkan' });
      }
      setShowForm(false); setEditing(null); load();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const deleteMed = async (m) => {
    if (!confirm(`Hapus obat "${m.name}"?`)) return;
    try {
      await db.entities.Medicine.delete(m.id);
      await logAuditAction({
        action: 'delete', entity: 'Medicine', entityId: m.id, entityName: m.name,
        description: `Menghapus master obat ${m.name}`, module: 'master_obat', severity: 'Critical',
      });
      toast({ title: 'Obat dihapus' }); load();
    } catch (e) { toast({ title: 'Gagal menghapus', description: e.message, variant: 'destructive' }); }
  };

  const savePriceOverride = async ({ medicine, newPrice, reason }) => {
    try {
      await db.functions.invoke('changeSellingPrice', { medicine_id: medicine.id, new_price: newPrice, reason });
      toast({ title: 'Harga jual diperbarui', description: 'Perubahan, batas minimum, dan otoritas pencatat tersimpan di histori harga.' });
      setPriceOverride(null);
      load();
    } catch (error) {
      toast({ title: 'Gagal mengubah harga', description: error.message, variant: 'destructive' });
    }
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Master Obat & Barang</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Single source untuk Smart Search, Racikan, Inventory, Pembelian & POS</p>
        </div>
        {canCreate && (
          <button onClick={startCreate} className="btn-primary px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Tambah Obat
          </button>
        )}
      </div>

      <ModuleStatHeader stats={[
        { icon: Pill, label: 'Total Obat', value: stats.total, color: 'text-teal-600' },
        { icon: Package, label: 'Aktif', value: stats.active, color: 'text-emerald-600' },
        { icon: AlertCircle, label: 'Stok Rendah', value: stats.lowStock, color: 'text-amber-600' },
        { icon: AlertCircle, label: 'Stok Habis', value: stats.outStock, color: 'text-rose-600' },
      ]} />

      {/* Search & Filter */}
      <div className="panel px-3 py-2 flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, generik, zat aktif, barcode…" className="flex-1 bg-transparent outline-none text-xs" />
        </div>
        <select value={filterStock} onChange={e => setFilterStock(e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card">
          <option value="">Semua Stok</option>
          <option value="low">Stok Rendah</option>
          <option value="out">Stok Habis</option>
          <option value="active">Aktif</option>
        </select>
      </div>

      {/* Table */}
      <div className="panel">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-4"><EmptyState icon={Pill} title="Tidak ada obat" description="Tambah obat baru atau ubah filter pencarian" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-left">
                  <th className="px-3 py-2 micro-label">Nama</th>
                  <th className="px-3 py-2 micro-label hidden md:table-cell">Zat Aktif</th>
                  <th className="px-3 py-2 micro-label hidden lg:table-cell">Form</th>
                  {canViewHpp && <th className="px-3 py-2 micro-label text-right hidden xl:table-cell">HPP</th>}
                  <th className="px-3 py-2 micro-label text-right">Harga Jual</th>
                  <th className="px-3 py-2 micro-label text-right">Stok</th>
                  <th className="px-3 py-2 micro-label">Status</th>
                  <th className="px-3 py-2 micro-label text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(m => {
                  const outOfStock = (m.stock_on_hand || 0) <= 0;
                  const lowStock = (m.stock_on_hand || 0) > 0 && (m.stock_on_hand || 0) <= (m.min_stock || 0);
                  return (
                    <tr key={m.id} className="row-hover">
                      <td className="px-3 py-2">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.generic_name || '-'}</p>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{m.active_substance} {m.strength}</td>
                      <td className="px-3 py-2 hidden lg:table-cell"><span className="pill pill-inactive">{m.form}</span></td>
                      {canViewHpp && <td className="px-3 py-2 text-right hidden xl:table-cell text-muted-foreground">Rp {(m.purchase_price || 0).toLocaleString('id-ID')}</td>}
                      <td className="px-3 py-2 text-right font-medium">Rp {(m.selling_price || 0).toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 text-right">{m.stock_on_hand || 0} {m.unit}</td>
                      <td className="px-3 py-2">
                        {outOfStock ? <span className="pill pill-critical">Habis</span>
                          : lowStock ? <span className="pill pill-warning">Rendah</span>
                          : m.is_active ? <span className="pill pill-success">Aktif</span>
                          : <span className="pill pill-inactive">Nonaktif</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && <button onClick={() => startEdit(m)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>}
                          {canOverridePrice && <button onClick={() => setPriceOverride(m)} title="Kelola harga jual terlacak" className="p-1 hover:bg-amber-50 rounded text-amber-700"><DollarSign className="w-3.5 h-3.5" /></button>}
                          {canDelete && <button onClick={() => deleteMed(m)} className="p-1 hover:bg-rose-50 rounded text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && editing && (
        <MedicineForm
          medicine={editing}
          onSave={saveMed}
          onClose={() => { setShowForm(false); setEditing(null); }}
          saving={saving}
          canViewHpp={canViewHpp}
          canOverridePrice={canOverridePrice}
        />
      )}
      {priceOverride && <PriceOverrideModal medicine={priceOverride} role={clinicRole} onClose={() => setPriceOverride(null)} onSave={savePriceOverride} />}
    </div>
  );
}

function PriceOverrideModal({ medicine, role, onClose, onSave }) {
  const [price, setPrice] = useState(String(medicine.selling_price || 0));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const newPrice = Number(price);
    if (!Number.isFinite(newPrice) || newPrice <= 0) return;
    setSaving(true);
    await onSave({ medicine, newPrice, reason });
    setSaving(false);
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
      <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">Kelola Harga Jual</h3><p className="mt-0.5 text-[11px] text-muted-foreground">{medicine.name} • otoritas: {role}</p></div>
      <div className="space-y-3 p-4 text-xs"><div className="rounded border border-blue-200 bg-blue-50 p-2.5 text-blue-800">Harga minimum aman dihitung dari HPP dan target margin saat disimpan. Harga di bawah batas wajib disertai alasan dan seluruh perubahan tercatat.</div><div><label className="micro-label">Harga jual baru *</label><input autoFocus type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded border border-border px-2 py-1.5 outline-none focus:border-primary" /></div><div><label className="micro-label">Alasan / otorisasi</label><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Wajib bila harga berada di bawah harga minimum aman" className="mt-1 w-full rounded border border-border px-2 py-1.5 outline-none focus:border-primary" /></div></div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3"><button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Batal</button><button onClick={submit} disabled={saving || Number(price) <= 0} className="btn-primary rounded px-3 py-1.5 text-xs disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan Harga'}</button></div>
    </div>
  </div>;
}

function MedicineForm({ medicine, onSave, onClose, saving, canViewHpp, canOverridePrice }) {
  const [data, setData] = useState(medicine);
  const [openSection, setOpenSection] = useState('identitas');
  const [errors, setErrors] = useState({});

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const margin = data.purchase_price > 0
    ? Math.round(((data.selling_price - data.purchase_price) / data.purchase_price) * 100 * 10) / 10
    : 0;

  const validateSection = (sectionKey) => {
    const errs = {};
    if (sectionKey === 'identitas') {
      if (!data.name?.trim()) errs.name = 'Nama wajib';
      if (!data.selling_price || data.selling_price <= 0) errs.selling_price = 'Harga jual wajib';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validateSection('identitas')) {
      setOpenSection('identitas');
      return;
    }
    onSave(data);
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";
  const labelCls = "micro-label";

  const renderField = (field) => {
    switch (field) {
      case 'name': return (
        <div>
          <label className={labelCls}>Nama Obat / Brand *</label>
          <input value={data.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="mis. Sanmol Drop" />
          {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
        </div>
      );
      case 'generic_name': return (
        <div><label className={labelCls}>Nama Generik</label><input value={data.generic_name} onChange={e => set('generic_name', e.target.value)} className={inputCls} placeholder="mis. Paracetamol" /></div>
      );
      case 'active_substance': return (
        <div><label className={labelCls}>Kandungan Zat Aktif</label><input value={data.active_substance} onChange={e => set('active_substance', e.target.value)} className={inputCls} placeholder="mis. Paracetamol" /></div>
      );
      case 'strength': return (
        <div><label className={labelCls}>Kekuatan</label><input value={data.strength} onChange={e => set('strength', e.target.value)} className={inputCls} placeholder="mis. 500mg" /></div>
      );
      case 'form': return (
        <div><label className={labelCls}>Bentuk Sediaan</label><select value={data.form} onChange={e => set('form', e.target.value)} className={inputCls}>{FORM_OPTIONS.form.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
      );
      case 'administration_route': return (
        <div><label className={labelCls}>Rute Pemakaian Etiket *</label><select value={data.administration_route || 'internal'} onChange={e => set('administration_route', e.target.value)} className={inputCls}><option value="internal">Obat Dalam — Etiket Putih</option><option value="external">Obat Luar — Etiket Biru</option></select><p className="mt-1 text-[10px] text-muted-foreground">Menentukan warna etiket saat dispensing.</p></div>
      );
      case 'category': return (
        <div><label className={labelCls}>Golongan</label><select value={data.category} onChange={e => set('category', e.target.value)} className={inputCls}>{FORM_OPTIONS.category.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      );
      case 'unit': return (
        <div><label className={labelCls}>Satuan Terkecil</label><input value={data.unit} onChange={e => set('unit', e.target.value)} className={inputCls} placeholder="mis. tablet, botol, tube" /></div>
      );
      case 'conversion_box': return (
        <div><label className={labelCls}>Konversi per Box</label><input type="number" value={data.conversion_box} onChange={e => set('conversion_box', +e.target.value)} className={inputCls} placeholder="mis. 100" /></div>
      );
      case 'conversion_strip': return (
        <div><label className={labelCls}>Konversi per Strip</label><input type="number" value={data.conversion_strip} onChange={e => set('conversion_strip', +e.target.value)} className={inputCls} placeholder="mis. 10" /></div>
      );
      case 'conversion_tablet': return (
        <div><label className={labelCls}>Konversi per Kemasan</label><input type="number" value={data.conversion_tablet} onChange={e => set('conversion_tablet', +e.target.value)} className={inputCls} placeholder="mis. 1" /></div>
      );
      case 'purchase_price': return canViewHpp ? (
        <div><label className={labelCls}>Harga Beli (HPP)</label><input type="number" value={data.purchase_price} onChange={e => set('purchase_price', +e.target.value)} className={inputCls} /></div>
      ) : (
        <div><label className={labelCls}>Harga Beli (HPP)</label><div className="px-2 py-1.5 border border-border rounded text-xs text-muted-foreground bg-muted/30">🔒 Tidak ada akses</div></div>
      );
      case 'selling_price': return (
        <div>
          <label className={labelCls}>Harga Jual *</label>
          {data.id && !canOverridePrice ? (
            <div className="rounded border border-border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">Rp {Number(data.selling_price || 0).toLocaleString('id-ID')} — ubah melalui Owner/Admin</div>
          ) : (
            <input type="number" value={data.selling_price} onChange={e => set('selling_price', +e.target.value)} className={inputCls} />
          )}
          {errors.selling_price && <p className="text-[10px] text-rose-500 mt-0.5">{errors.selling_price}</p>}
        </div>
      );
      case 'margin_percent': return (
        <div>
          <label className={labelCls}>Margin (auto-calc)</label>
          <div className="px-2 py-1.5 border border-border rounded text-xs text-center font-medium">
            <span className={margin > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>{margin}%</span>
          </div>
        </div>
      );
      case 'shelf_location': return (
        <div><label className={labelCls}>Lokasi Rak</label><input value={data.shelf_location} onChange={e => set('shelf_location', e.target.value)} className={inputCls} placeholder="mis. A1-03" /></div>
      );
      case 'min_stock': return (
        <div><label className={labelCls}>Minimum Stock</label><input type="number" value={data.min_stock} onChange={e => set('min_stock', +e.target.value)} className={inputCls} /></div>
      );
      case 'stock_on_hand': return (
        <div><label className={labelCls}>Stok Saat Ini</label><input type="number" value={data.stock_on_hand} onChange={e => set('stock_on_hand', +e.target.value)} className={inputCls} /></div>
      );
      case 'is_active': return (
        <div>
          <label className={labelCls}>Status</label>
          <button onClick={() => set('is_active', !data.is_active)} className={`w-full flex items-center justify-between px-2 py-1.5 border rounded text-xs ${data.is_active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-border bg-muted/30 text-muted-foreground'}`}>
            <span>{data.is_active ? 'Aktif' : 'Nonaktif'}</span>
            <div className={`w-8 h-4 rounded-full transition-colors ${data.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`w-3 h-3 bg-white rounded-full transition-transform mt-0.5 ${data.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>
      );
      case 'substitution_group': return (
        <div><label className={labelCls}>Group Substitusi</label><input value={data.substitution_group} onChange={e => set('substitution_group', e.target.value)} className={inputCls} placeholder="mis. Paracetamol-Group" /></div>
      );
      case 'alternative_active_substances': return (
        <div><label className={labelCls}>Zat Aktif Alternatif</label><input value={data.alternative_active_substances} onChange={e => set('alternative_active_substances', e.target.value)} className={inputCls} placeholder="mis. Ibuprofen, Diclofenac" /></div>
      );
      case 'barcode': return (
        <div><label className={labelCls}>Barcode</label><input value={data.barcode} onChange={e => set('barcode', e.target.value)} className={inputCls} placeholder="mis. 8990001234567" /></div>
      );
      case 'manufacturer': return (
        <div><label className={labelCls}>Produsen</label><input value={data.manufacturer} onChange={e => set('manufacturer', e.target.value)} className={inputCls} placeholder="mis. Sanbe Farma" /></div>
      );
      case 'indication': return (
        <div><label className={labelCls}>Indikasi</label><textarea value={data.indication} onChange={e => set('indication', e.target.value)} className={inputCls} rows={2} /></div>
      );
      case 'contraindication': return (
        <div><label className={labelCls}>Kontraindikasi</label><textarea value={data.contraindication} onChange={e => set('contraindication', e.target.value)} className={inputCls} rows={2} /></div>
      );
      case 'side_effects': return (
        <div><label className={labelCls}>Efek Samping</label><textarea value={data.side_effects} onChange={e => set('side_effects', e.target.value)} className={inputCls} rows={2} /></div>
      );
      case 'interactions': return (
        <div><label className={labelCls}>Interaksi Obat</label><textarea value={data.interactions} onChange={e => set('interactions', e.target.value)} className={inputCls} rows={2} /></div>
      );
      case 'precautions': return (
        <div><label className={labelCls}>Peringatan & Precautions</label><textarea value={data.precautions} onChange={e => set('precautions', e.target.value)} className={inputCls} rows={2} /></div>
      );
      case 'pregnancy_category': return (
        <div><label className={labelCls}>Kategori Kehamilan</label><input value={data.pregnancy_category} onChange={e => set('pregnancy_category', e.target.value)} className={inputCls} placeholder="mis. A, B, C, D, X" /></div>
      );
      case 'reference_url': return (
        <div><label className={labelCls}>URL Referensi PIO</label><input value={data.reference_url} onChange={e => set('reference_url', e.target.value)} className={inputCls} placeholder="https://…" /></div>
      );
      default: return null;
    }
  };

  const sectionFields = (section) => {
    const layout = {
      identitas: 'grid-cols-2',
      kemasan: 'grid-cols-2',
      harga: 'grid-cols-3',
      stok: 'grid-cols-2',
      substitusi: 'grid-cols-2',
      klinis: 'grid-cols-1',
    };
    return layout[section] || 'grid-cols-2';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-md shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">{data.id ? 'Edit Obat' : 'Tambah Obat'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {FORM_SECTIONS.map((section, idx) => {
            const isOpen = openSection === section.key;
            const Icon = section.icon;
            const isComplete = section.fields.every(f => data[f] != null && data[f] !== '' && data[f] !== 0);
            return (
              <div key={section.key} className={`border rounded-md transition-colors ${isOpen ? 'border-primary' : 'border-border'}`}>
                <button
                  onClick={() => setOpenSection(isOpen ? '' : section.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left ${isOpen ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="flex-1 text-xs font-medium">{section.label}</span>
                  {isComplete && <span className="pill pill-success text-[9px]">Lengkap</span>}
                  <span className="text-[10px] text-muted-foreground">{idx + 1}/6</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className={`px-3 pb-3 pt-1 grid ${sectionFields(section.key)} gap-2`}>
                    {section.fields.map(f => <div key={f}>{renderField(f)}</div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2.5 border-t border-border flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {data.name && <span className="font-medium text-foreground">{data.name}</span>}
            {data.selling_price > 0 && <span className="ml-2">• Rp {data.selling_price.toLocaleString('id-ID')}</span>}
            {margin > 0 && <span className="ml-2 text-emerald-600">• Margin {margin}%</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
