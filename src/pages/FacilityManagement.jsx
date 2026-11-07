const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Building2, Wrench, AlertTriangle, X, Save, MapPin } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

const CATEGORIES = ['Medis', 'Kantor', 'IT', 'Fasilitas', 'Lainnya'];
const CONDITIONS = ['Baik', 'Perlu Servis', 'Rusak', 'Pensiun'];
const CONDITION_PILLS = { Baik: 'pill-success', 'Perlu Servis': 'pill-warning', Rusak: 'pill-critical', Pensiun: 'pill-inactive' };

function emptyForm() {
  return { asset_code: '', name: '', category: 'Kantor', location: '', purchase_date: '', purchase_value: 0, condition: 'Baik', last_maintenance: '', next_maintenance: '', notes: '' };
}

export default function FacilityManagement() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = getClinicRole(user) === 'Owner';

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setAssets(await db.entities.Asset.list() || []); } catch {}
    setLoading(false);
  };

  const today = new Date().toISOString().split('T')[0];
  const filtered = assets.filter(a => {
    if (search && !a.name?.toLowerCase().includes(search.toLowerCase()) && !a.asset_code?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && a.category !== filterCategory) return false;
    if (filterCondition && a.condition !== filterCondition) return false;
    return true;
  });

  const totalValue = assets.reduce((s, a) => s + (a.purchase_value || 0), 0);
  const needMaintenance = assets.filter(a => a.next_maintenance && a.next_maintenance <= today && a.condition !== 'Pensiun');
  const perluServis = assets.filter(a => a.condition === 'Perlu Servis').length;

  const startEdit = (a) => { setEditing(a); setForm({ ...a }); setShowForm(true); };
  const startNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); };

  const save = async () => {
    if (!form.name) { toast({ title: 'Nama wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editing) {
        await db.entities.Asset.update(editing.id, form);
        await db.entities.AuditLog.create({ action: 'update', entity: 'Asset', entity_id: editing.id, description: `Update aset ${form.name}`, user_name: 'Admin', timestamp: new Date().toISOString() });
        toast({ title: 'Aset diperbarui' });
      } else {
        const code = form.asset_code || `AST${String(Date.now()).slice(-6)}`;
        await db.entities.Asset.create({ ...form, asset_code: code });
        await db.entities.AuditLog.create({ action: 'create', entity: 'Asset', description: `Tambah aset ${form.name}`, user_name: 'Admin', timestamp: new Date().toISOString() });
        toast({ title: 'Aset ditambahkan' });
      }
      setShowForm(false); load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const remove = async (a) => {
    if (!confirm(`Hapus aset "${a.name}"?`)) return;
    try {
      await db.entities.Asset.delete(a.id);
      await db.entities.AuditLog.create({ action: 'delete', entity: 'Asset', entity_id: a.id, description: `Hapus aset ${a.name}`, user_name: 'Admin', timestamp: new Date().toISOString() });
      toast({ title: 'Aset dihapus' }); load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Manajemen Fasilitas & Aset</h1>
        {!isOwner && <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-md text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Tambah Aset
        </button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3.5 h-3.5 text-blue-600" /><p className="micro-label">Total Aset</p></div>
          <p className="text-base font-semibold text-blue-600">{assets.length}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><MapPin className="w-3.5 h-3.5 text-teal-600" /><p className="micro-label">Nilai Total</p></div>
          <p className="text-base font-semibold text-teal-600">Rp {totalValue.toLocaleString('id-ID')}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><Wrench className="w-3.5 h-3.5 text-amber-600" /><p className="micro-label">Perlu Servis</p></div>
          <p className="text-base font-semibold text-amber-600">{perluServis}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5 text-rose-600" /><p className="micro-label">Maintenance Jatuh Tempo</p></div>
          <p className="text-base font-semibold text-rose-600">{needMaintenance.length}</p>
        </div>
      </div>

      {needMaintenance.length > 0 && (
        <div className="panel border-l-2 border-l-amber-400">
          <div className="px-3 py-2 bg-amber-50/50 border-b border-border">
            <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> {needMaintenance.length} aset perlu maintenance</p>
          </div>
          <div className="divide-y divide-border">
            {needMaintenance.slice(0, 5).map(a => (
              <div key={a.id} className="px-3 py-2 flex items-center gap-2 text-xs">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{a.location || ''}</span>
                <span className="pill pill-warning ml-auto">Jatuh tempo: {a.next_maintenance}</span>
                {!isOwner && <button onClick={() => startEdit(a)} className="text-primary hover:text-primary-hover font-medium">Update</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel px-3 py-2 flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau kode aset…" className="flex-1 bg-transparent outline-none text-xs" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card">
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterCondition} onChange={e => setFilterCondition(e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card">
          <option value="">Semua Kondisi</option>
          {CONDITIONS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left">
              <th className="px-3 py-2 micro-label">Kode</th>
              <th className="px-3 py-2 micro-label">Nama</th>
              <th className="px-3 py-2 micro-label">Kategori</th>
              <th className="px-3 py-2 micro-label">Lokasi</th>
              <th className="px-3 py-2 micro-label text-right">Nilai</th>
              <th className="px-3 py-2 micro-label">Kondisi</th>
              <th className="px-3 py-2 micro-label">Maintenance</th>
              <th className="px-3 py-2 micro-label text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(a => (
              <tr key={a.id} className="row-hover">
                <td className="px-3 py-2 font-mono text-muted-foreground">{a.asset_code || '-'}</td>
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-2"><span className="pill pill-info">{a.category}</span></td>
                <td className="px-3 py-2 text-muted-foreground">{a.location || '-'}</td>
                <td className="px-3 py-2 text-right">Rp {(a.purchase_value || 0).toLocaleString('id-ID')}</td>
                <td className="px-3 py-2"><span className={`pill ${CONDITION_PILLS[a.condition] || 'pill-inactive'}`}>{a.condition}</span></td>
                <td className="px-3 py-2 text-muted-foreground">
                  {a.next_maintenance ? (
                    <span className={a.next_maintenance <= today ? 'text-rose-600 font-medium' : ''}>{a.next_maintenance}</span>
                  ) : '-'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {!isOwner && <>
                      <button onClick={() => startEdit(a)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(a)} className="p-1 hover:bg-rose-50 rounded text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Memuat…</p>}
        {!loading && filtered.length === 0 && <div className="py-4"><EmptyState icon={Building2} title="Tidak ada aset" description="Tambah aset baru atau ubah filter pencarian" /></div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between sticky top-0 bg-card">
              <h2 className="text-sm font-semibold">{editing ? 'Edit Aset' : 'Tambah Aset'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kode Aset</label>
                <input value={form.asset_code} onChange={e => set('asset_code', e.target.value)} placeholder="Auto" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nama *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kategori</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls + ' bg-card'}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Lokasi</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tgl Beli</label>
                <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nilai Beli (Rp)</label>
                <input type="number" value={form.purchase_value} onChange={e => set('purchase_value', +e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kondisi</label>
                <select value={form.condition} onChange={e => set('condition', e.target.value)} className={inputCls + ' bg-card'}>
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Maintenance Terakhir</label>
                <input type="date" value={form.last_maintenance} onChange={e => set('last_maintenance', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Maintenance Berikutnya</label>
                <input type="date" value={form.next_maintenance} onChange={e => set('next_maintenance', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Catatan</label>
                <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="px-3 py-2.5 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-border rounded text-xs hover:bg-muted">Batal</button>
              <button onClick={save} disabled={saving} className="btn-primary px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
