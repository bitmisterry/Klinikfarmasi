// @ts-nocheck -- Permission matrix keys are dynamically configured by Owner.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Search, Plus, Copy, Trash2, Save, X, Users, Shield, Power, Check } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import PermissionMatrix from '@/components/PermissionMatrix';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import {
  ADVANCED_PERMISSIONS,
  DEFAULT_ADVANCED_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  MODULE_LABELS,
  ROLE_DESCRIPTIONS,
  logAuditAction,
} from '@/lib/roles';

function emptyPermissions() {
  const r = {};
  Object.keys(MODULE_LABELS).forEach(m => {
    r[m] = { view: false, create: false, edit: false, delete: false, approve: false };
  });
  return r;
}

const effectivePermissions = (role) => {
  const configured = role?.permissions;
  if (configured && Object.keys(configured).length > 0) return configured;
  return DEFAULT_ROLE_PERMISSIONS[role?.name] || emptyPermissions();
};

const effectiveAdvanced = (role) => {
  const configured = role?.advanced_permissions;
  if (Array.isArray(configured) && configured.length > 0) return configured;
  return DEFAULT_ADVANCED_PERMISSIONS[role?.name] || [];
};

const clampToBuiltInCeiling = (role) => {
  const ceiling = DEFAULT_ROLE_PERMISSIONS[role?.name];
  if (!role?.is_system || !ceiling) return role;
  const permissions = {};
  Object.keys(MODULE_LABELS).forEach((module) => {
    permissions[module] = {};
    ['view', 'create', 'edit', 'delete', 'approve'].forEach((action) => {
      permissions[module][action] = ceiling?.[module]?.[action] === true && role.permissions?.[module]?.[action] === true;
    });
  });
  const advancedCeiling = DEFAULT_ADVANCED_PERMISSIONS[role.name] || [];
  return { ...role, permissions, advanced_permissions: (role.advanced_permissions || []).filter((key) => advancedCeiling.includes(key)) };
};

export default function RoleManagement() {
  const { user, refreshRoles } = useAuth();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [r, u] = await Promise.all([
        db.entities.Role.list(),
        db.entities.User.list().catch(() => []),
      ]);
      setRoles(r || []);
      setUsers(u || []);
      if (r && r.length > 0 && !selectedId) setSelectedId(r[0].id);
    } catch (e) {
      toast({ title: 'Gagal memuat role', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selected = roles.find(r => r.id === selectedId);

  const filtered = roles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const startCreate = () => {
    setEditing({ name: '', description: '', permissions: emptyPermissions(), advanced_permissions: [], is_active: true, color: 'slate' });
    setShowForm(true);
  };

  const startDuplicate = (role) => {
    setEditing({
      name: `${role.name} (Copy)`,
      description: role.description || ROLE_DESCRIPTIONS[role.name] || '',
      permissions: JSON.parse(JSON.stringify(effectivePermissions(role))),
      advanced_permissions: [...effectiveAdvanced(role)],
      is_active: true,
      color: role.color || 'slate',
    });
    setShowForm(true);
  };

  const saveRole = async () => {
    if (!editing.name.trim()) { toast({ title: 'Nama role wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const roleToSave = clampToBuiltInCeiling(editing);
      const { user_ids: requestedUserIds, ...roleFields } = roleToSave;
      let savedRole;
      if (editing.id) {
        const { id, created_date, updated_date, created_by_id, ...data } = roleFields;
        savedRole = await db.entities.Role.update(id, data);
        await logAuditAction({
          action: 'role_change', entity: 'Role', entityId: id, entityName: editing.name,
          description: `Mengubah role ${editing.name}`, module: 'user_role', severity: 'Warning',
        });
        toast({ title: 'Role diperbarui' });
      } else {
        const created = await db.entities.Role.create({ ...roleFields, created_by: user?.id });
        savedRole = created;
        await logAuditAction({
          action: 'create', entity: 'Role', entityId: created.id, entityName: editing.name,
          description: `Membuat role baru ${editing.name}`, module: 'user_role', severity: 'Warning',
        });
        toast({ title: 'Role dibuat' });
        setSelectedId(created.id);
      }
      // Role.user_ids bukan sekadar tampilan. Fungsi lokal ini juga menulis
      // User.clinic_role, active_role, sesi aktif, dan menghapus keanggotaan
      // lama agar seluruh aplikasi membaca satu jabatan yang sama.
      if (Array.isArray(requestedUserIds)) {
        await db.functions.invoke('syncRoleAssignments', {
          role_id: savedRole.id,
          user_ids: requestedUserIds,
        });
      }
      await refreshRoles?.();
      setShowForm(false);
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role) => {
    if (role.is_system) { toast({ title: 'Role sistem tidak dapat dihapus', variant: 'destructive' }); return; }
    if (!confirm(`Hapus role "${role.name}"? User pada role ini akan kehilangan akses.`)) return;
    try {
      await db.entities.Role.delete(role.id);
      await logAuditAction({
        action: 'delete', entity: 'Role', entityId: role.id, entityName: role.name,
        description: `Menghapus role ${role.name}`, module: 'user_role', severity: 'Critical',
      });
      toast({ title: 'Role dihapus' });
      await refreshRoles?.();
      if (selectedId === role.id) setSelectedId(null);
      load();
    } catch (e) {
      toast({ title: 'Gagal menghapus', description: e.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (role) => {
    try {
      await db.entities.Role.update(role.id, { is_active: !role.is_active });
      await logAuditAction({
        action: 'role_change', entity: 'Role', entityId: role.id, entityName: role.name,
        description: `${role.is_active ? 'Menonaktifkan' : 'Mengaktifkan'} role ${role.name}`,
        module: 'user_role', severity: 'Warning',
      });
      toast({ title: `Role ${role.is_active ? 'dinonaktifkan' : 'diaktifkan'}` });
      await refreshRoles?.();
      load();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const toggleAdvanced = (key) => {
    if (!editing) return;
    const current = editing.advanced_permissions || [];
    setEditing({
      ...editing,
      advanced_permissions: current.includes(key) ? current.filter(k => k !== key) : [...current, key],
    });
  };

  const colorClasses = {
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Kelola Role & Permission</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Buat role custom, atur permission matrix, tetapkan user</p>
        </div>
        <button onClick={startCreate} className="btn-primary px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Role Baru
        </button>
      </div>

      <ModuleStatHeader stats={[
        { icon: Shield, label: 'Total Role', value: roles.length, color: 'text-teal-600' },
        { icon: Check, label: 'Role Aktif', value: roles.filter(r => r.is_active).length, color: 'text-emerald-600' },
        { icon: Users, label: 'Total User', value: users.length, color: 'text-blue-600' },
        { icon: Plus, label: 'Role Custom', value: roles.filter(r => !r.is_system).length, color: 'text-purple-600' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
        {/* Role List */}
        <div className="panel">
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari role…" className="flex-1 bg-transparent outline-none text-xs" />
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="py-4"><EmptyState icon={Shield} title="Tidak ada role" description="Buat role baru untuk mulai" /></div>
            )}
            {filtered.map(r => {
              const userCount = (r.user_ids || []).length;
              return (
                <button
                  key={r.id}
                  onClick={() => { setSelectedId(r.id); setEditing(null); setShowForm(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                    selectedId === r.id && !showForm ? 'bg-primary/5 border-l-[3px] border-l-[hsl(var(--primary))]' : ''
                  } ${!r.is_active ? 'opacity-50' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${colorClasses[r.color] || colorClasses.slate}`}>
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{r.name}</span>
                      {r.is_system && <span className="pill pill-inactive text-[9px] px-1 py-0">Sistem</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{r.description || ROLE_DESCRIPTIONS[r.name] || 'Tanpa deskripsi'}</p>
                  </div>
                  {userCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Users className="w-3 h-3" /> {userCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor */}
        <div className="panel">
          {showForm && editing ? (
            <RoleEditor
              editing={editing}
              setEditing={setEditing}
              users={users}
              roles={roles}
              onSave={saveRole}
              onCancel={() => { setShowForm(false); setEditing(null); }}
              saving={saving}
              onToggleAdvanced={toggleAdvanced}
            />
          ) : selected ? (
            <RoleDetail
              role={selected}
              users={users}
              onEdit={() => { setEditing({ ...selected, description: selected.description || ROLE_DESCRIPTIONS[selected.name] || '', permissions: JSON.parse(JSON.stringify(effectivePermissions(selected))), advanced_permissions: [...effectiveAdvanced(selected)] }); setShowForm(true); }}
              onDuplicate={() => startDuplicate(selected)}
              onDelete={() => deleteRole(selected)}
              onToggleActive={() => toggleActive(selected)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Pilih role untuk melihat detail atau buat role baru</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleDetail({ role, users, onEdit, onDuplicate, onDelete, onToggleActive }) {
  const assignedUsers = users.filter(u => (role.user_ids || []).includes(u.id));
  const displayedPermissions = effectivePermissions(role);
  const displayedAdvanced = effectiveAdvanced(role);
  const permCount = Object.values(displayedPermissions).reduce((s, m) => s + Object.values(m || {}).filter(Boolean).length, 0);

  return (
    <div>
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{role.name}</h2>
            {role.is_system && <span className="pill pill-info">Sistem</span>}
            {!role.is_active && <span className="pill pill-critical">Nonaktif</span>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{role.description || ROLE_DESCRIPTIONS[role.name] || 'Tanpa deskripsi'}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Edit"><Save className="w-3.5 h-3.5" /></button>
          <button onClick={onDuplicate} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
          {!role.is_system && (
            <button onClick={onToggleActive} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-amber-600" title={role.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
          {!role.is_system && (
            <button onClick={onDelete} className="p-1.5 hover:bg-rose-50 rounded text-rose-500" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="panel px-3 py-2">
            <p className="micro-label">Permission Aktif</p>
            <p className="text-base font-semibold text-primary">{permCount}</p>
          </div>
          <div className="panel px-3 py-2">
            <p className="micro-label">Advanced Permission</p>
            <p className="text-base font-semibold text-amber-600">{displayedAdvanced.length}</p>
          </div>
          <div className="panel px-3 py-2">
            <p className="micro-label">User Assigned</p>
            <p className="text-base font-semibold text-blue-600">{assignedUsers.length}</p>
          </div>
        </div>

        {/* Advanced Permissions */}
        <div>
          <p className="micro-label mb-1.5">Advanced Permission</p>
          <div className="flex flex-wrap gap-1.5">
            {ADVANCED_PERMISSIONS.map(p => {
              const has = displayedAdvanced.includes(p.key);
              return (
                <span key={p.key} className={`pill ${has ? 'pill-warning' : 'pill-inactive'}`}>
                  {has && <Check className="w-3 h-3" />} {p.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Permission Matrix (read-only) */}
        <div>
          <p className="micro-label mb-1.5">Permission Matrix</p>
          <PermissionMatrix permissions={displayedPermissions} disabled={true} />
        </div>

        {/* Assigned Users */}
        <div>
          <p className="micro-label mb-1.5">User pada Role Ini</p>
          {assignedUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Belum ada user ditetapkan</p>
          ) : (
            <div className="space-y-1">
              {assignedUsers.map(u => (
                <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 bg-muted/30 rounded text-xs">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                    {u.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="font-medium">{u.full_name}</span>
                  <span className="text-muted-foreground">{u.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleEditor({ editing, setEditing, users, roles, onSave, onCancel, saving, onToggleAdvanced }) {
  const [tab, setTab] = useState('detail');
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";
  const builtInCeiling = editing.is_system ? DEFAULT_ROLE_PERMISSIONS[editing.name] : null;
  const advancedCeiling = editing.is_system ? (DEFAULT_ADVANCED_PERMISSIONS[editing.name] || []) : null;

  const toggleUser = (userId) => {
    const current = editing.user_ids || [];
    setEditing({
      ...editing,
      user_ids: current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId],
    });
  };

  return (
    <div>
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">{editing.id ? 'Edit Role' : 'Role Baru'}</h2>
        <button onClick={onCancel} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex border-b border-border">
        {[
          { k: 'detail', l: 'Detail' },
          { k: 'matrix', l: 'Permission Matrix' },
          { k: 'advanced', l: 'Advanced' },
          { k: 'users', l: 'User' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.l}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3">
        {tab === 'detail' && (
          <div className="space-y-2">
            <div>
              <label className="micro-label">Nama Role *</label>
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className={inputCls} placeholder="mis. Apoteker Senior" />
            </div>
            <div>
              <label className="micro-label">Deskripsi</label>
              <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} className={inputCls} rows={2} placeholder="Tugas & tanggung jawab role ini" />
            </div>
            <div>
              <label className="micro-label">Warna Badge</label>
              <div className="flex gap-1.5 mt-1">
                {[
                  { c: 'teal', cls: 'bg-teal-50 text-teal-700' },
                  { c: 'blue', cls: 'bg-blue-50 text-blue-700' },
                  { c: 'purple', cls: 'bg-purple-50 text-purple-700' },
                  { c: 'emerald', cls: 'bg-emerald-50 text-emerald-700' },
                  { c: 'amber', cls: 'bg-amber-50 text-amber-700' },
                  { c: 'rose', cls: 'bg-rose-50 text-rose-700' },
                  { c: 'slate', cls: 'bg-slate-50 text-slate-700' },
                ].map(({ c, cls }) => (
                  <button key={c} onClick={() => setEditing({ ...editing, color: c })}
                    className={`w-7 h-7 rounded-md border-2 transition-colors ${
                      editing.color === c ? 'border-primary ring-1 ring-primary' : 'border-border'
                    } ${cls}`}>
                    <Shield className="w-3.5 h-3.5 mx-auto" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'matrix' && (
          <div className="space-y-2">
            {builtInCeiling && <p className="rounded border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] text-blue-800">Role sistem memiliki batas maksimum wajib. Kotak redup tidak dapat diaktifkan; hak yang diizinkan masih dapat dipersempit.</p>}
            <PermissionMatrix
            permissions={editing.permissions || {}}
            maxPermissions={builtInCeiling}
            onChange={(perms) => setEditing({ ...editing, permissions: perms })}
          />
          </div>
        )}

        {tab === 'advanced' && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground mb-2">Aktifkan permission khusus untuk aksi sensitif</p>
            {ADVANCED_PERMISSIONS.map(p => {
              const has = (editing.advanced_permissions || []).includes(p.key);
              const blocked = advancedCeiling && !advancedCeiling.includes(p.key);
              return (
                <button
                  key={p.key}
                  onClick={() => !blocked && onToggleAdvanced(p.key)}
                  disabled={blocked}
                  title={blocked ? 'Dibatasi oleh requirement role bawaan' : undefined}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-xs font-medium transition-colors ${
                    has ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-card border-border text-muted-foreground hover:border-amber-300'
                  } ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${has ? 'bg-amber-500 border-amber-500 text-white' : 'border-border'}`}>
                    {has && <Check className="w-3 h-3" />}
                  </div>
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        {tab === 'users' && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Pilih user untuk role ini</p>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {users.map(u => {
                const assigned = (editing.user_ids || []).includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                      assigned ? 'bg-primary/5 border border-primary/30' : 'hover:bg-muted'
                    }`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${assigned ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                      {assigned && <Check className="w-3 h-3" />}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                      {u.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="font-medium">{u.full_name}</span>
                    <span className="text-muted-foreground truncate">{u.email}</span>
                  </button>
                );
              })}
              {users.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Belum ada user terdaftar</p>}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 border-t border-border flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted">Batal</button>
        <button onClick={onSave} disabled={saving} className="btn-primary px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
