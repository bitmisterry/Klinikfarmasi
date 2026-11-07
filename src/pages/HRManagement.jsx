const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Users, UserCheck, X, Save, BadgeCheck, User } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import StaffProfileDrawer from '@/components/StaffProfileDrawer';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { canPerform, getClinicRole } from '@/lib/roles';

const ROLES = ['Dokter', 'Apoteker', 'Kasir', 'Perawat', 'Admin', 'Owner', 'Staff'];
const SHIFTS = ['Pagi', 'Siang', 'Malam', 'Lengkap'];

function emptyForm() {
  return { full_name: '', role: 'Staff', license_number: '', phone: '', email: '', shift: 'Pagi', hire_date: '', salary: 0, is_active: true };
}

export default function HRManagement() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const { toast } = useToast();
  const { user, roles } = useAuth();
  const clinicRole = getClinicRole(user);
  const canViewSalary = clinicRole === 'Owner' || clinicRole === 'Finance';
  const canManage = canPerform('/hr', clinicRole, 'edit', roles) || canPerform('/hr', clinicRole, 'create', roles);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setStaff(await db.entities.Staff.list() || []); } catch {}
    setLoading(false);
  };

  const filtered = staff.filter(s => {
    if (search && !s.full_name?.toLowerCase().includes(search.toLowerCase()) && !s.phone?.includes(search)) return false;
    if (filterRole && s.role !== filterRole) return false;
    if (filterActive === 'active' && !s.is_active) return false;
    if (filterActive === 'inactive' && s.is_active) return false;
    return true;
  });

  const activeCount = staff.filter(s => s.is_active).length;
  const totalSalary = staff.filter(s => s.is_active).reduce((sum, x) => sum + (x.salary || 0), 0);
  const byRole = ROLES.map(r => ({ role: r, count: staff.filter(s => s.role === r && s.is_active).length })).filter(r => r.count > 0);

  const startEdit = (s) => { setEditing(s); setForm({ ...s }); setShowForm(true); };
  const startNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); };

  const save = async () => {
    if (!form.full_name) { toast({ title: 'Nama wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editing) {
        const payload = canViewSalary ? form : Object.fromEntries(Object.entries(form).filter(([key]) => key !== 'salary'));
        await db.entities.Staff.update(editing.id, payload);
        await db.entities.AuditLog.create({ action: 'update', entity: 'Staff', entity_id: editing.id, description: `Update staff ${form.full_name}`, user_name: 'Admin', timestamp: new Date().toISOString() });
        toast({ title: 'Staff diperbarui' });
      } else {
        const payload = canViewSalary ? form : Object.fromEntries(Object.entries(form).filter(([key]) => key !== 'salary'));
        await db.entities.Staff.create(payload);
        await db.entities.AuditLog.create({ action: 'create', entity: 'Staff', description: `Tambah staff ${form.full_name}`, user_name: 'Admin', timestamp: new Date().toISOString() });
        toast({ title: 'Staff ditambahkan' });
      }
      setShowForm(false); load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const remove = async (s) => {
    if (!confirm(`Hapus staff "${s.full_name}"?`)) return;
    try {
      await db.entities.Staff.delete(s.id);
      await db.entities.AuditLog.create({ action: 'delete', entity: 'Staff', entity_id: s.id, description: `Hapus staff ${s.full_name}`, user_name: 'Admin', timestamp: new Date().toISOString() });
      toast({ title: 'Staff dihapus' }); load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Manajemen SDM (HR)</h1>
        {canManage && <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-md text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Tambah Staff
        </button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-blue-600" /><p className="micro-label">Total Staff</p></div>
          <p className="text-base font-semibold text-blue-600">{staff.length}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><UserCheck className="w-3.5 h-3.5 text-emerald-600" /><p className="micro-label">Aktif</p></div>
          <p className="text-base font-semibold text-emerald-600">{activeCount}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><BadgeCheck className="w-3.5 h-3.5 text-amber-600" /><p className="micro-label">{canViewSalary ? 'Total Gaji/Bln' : 'Staff Non-Medis'}</p></div>
          <p className="text-base font-semibold text-amber-600">{canViewSalary ? `Rp ${totalSalary.toLocaleString('id-ID')}` : staff.filter(s => s.role !== 'Dokter' && s.is_active).length}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <p className="micro-label mb-1">Per Role (Aktif)</p>
          <div className="flex flex-wrap gap-1">
            {byRole.length === 0 && <span className="text-[11px] text-muted-foreground">-</span>}
            {byRole.map(r => <span key={r.role} className="pill pill-info">{r.role}: {r.count}</span>)}
          </div>
        </div>
      </div>

      <div className="panel px-3 py-2 flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau telepon…" className="flex-1 bg-transparent outline-none text-xs" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card">
          <option value="">Semua Role</option>
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card">
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Non-Aktif</option>
        </select>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left">
              <th className="px-3 py-2 micro-label">Nama</th>
              <th className="px-3 py-2 micro-label">Role</th>
              <th className="px-3 py-2 micro-label">No. Izin</th>
              <th className="px-3 py-2 micro-label">Kontak</th>
              <th className="px-3 py-2 micro-label">Shift</th>
              <th className="px-3 py-2 micro-label">Bergabung</th>
              {canViewSalary && <th className="px-3 py-2 micro-label text-right">Gaji</th>}
              <th className="px-3 py-2 micro-label">Status</th>
              <th className="px-3 py-2 micro-label text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(s => (
              <tr key={s.id} className="row-hover">
                <td className="px-3 py-2 font-medium">
                  <button onClick={() => setSelectedStaff(s)} className="hover:text-primary text-left">{s.full_name}</button>
                </td>
                <td className="px-3 py-2"><span className="pill pill-info">{s.role}</span></td>
                <td className="px-3 py-2 text-muted-foreground">{s.license_number || '-'}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.phone || s.email || '-'}</td>
                <td className="px-3 py-2">{s.shift || '-'}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.hire_date || '-'}</td>
                {canViewSalary && <td className="px-3 py-2 text-right">Rp {(s.salary || 0).toLocaleString('id-ID')}</td>}
                <td className="px-3 py-2"><span className={`pill ${s.is_active ? 'pill-success' : 'pill-inactive'}`}>{s.is_active ? 'Aktif' : 'Non-Aktif'}</span></td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setSelectedStaff(s)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Lihat Profil"><User className="w-3.5 h-3.5" /></button>
                    {canManage && <button onClick={() => startEdit(s)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>}
                    {canManage && <button onClick={() => remove(s)} className="p-1 hover:bg-rose-50 rounded text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Memuat…</p>}
        {!loading && filtered.length === 0 && <div className="py-4"><EmptyState icon={Users} title="Tidak ada staff" description="Tambah staff baru atau ubah filter pencarian" /></div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between sticky top-0 bg-card">
              <h2 className="text-sm font-semibold">{editing ? 'Edit Staff' : 'Tambah Staff'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nama Lengkap *</label>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls + ' bg-card'}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Shift</label>
                <select value={form.shift} onChange={e => set('shift', e.target.value)} className={inputCls + ' bg-card'}>
                  {SHIFTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">No. Izin (STR/SIP)</label>
                <input value={form.license_number} onChange={e => set('license_number', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Telepon</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tgl Bergabung</label>
                <input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} className={inputCls} />
              </div>
              {canViewSalary && <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Gaji/Bulan (Rp)</label>
                <input type="number" value={form.salary} onChange={e => set('salary', +e.target.value)} className={inputCls} />
              </div>}
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4" />
                <label htmlFor="is_active" className="text-xs">Staff aktif</label>
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

      {selectedStaff && (
        <StaffProfileDrawer
          staff={selectedStaff}
          hideFinancial={!canViewSalary}
          onClose={() => setSelectedStaff(null)}
          onEdit={canManage ? (s) => { setSelectedStaff(null); startEdit(s); } : undefined}
        />
      )}
    </div>
  );
}
