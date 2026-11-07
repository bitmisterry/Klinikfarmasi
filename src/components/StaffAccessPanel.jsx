const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { Users, Shield, Mail, Save } from 'lucide-react';

import { CLINIC_ROLES, ROLE_DESCRIPTIONS, getClinicRole } from '@/lib/roles';

export default function StaffAccessPanel({ users, onSaved, toast }) {
  const [editing, setEditing] = useState({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Staff');
  const [inviting, setInviting] = useState(false);

  const updateRole = async (userId, role) => {
    try {
      const roles = await db.entities.Role.list();
      const targetRole = roles.find((item) => item.name === role && item.is_active !== false);
      if (!targetRole) throw new Error(`Role ${role} tidak aktif atau belum tersedia`);
      const memberIds = [...new Set([...(targetRole.user_ids || []), userId])];
      await db.functions.invoke('syncRoleAssignments', { role_id: targetRole.id, user_ids: memberIds });
      toast({ title: `Role diubah menjadi ${role}` });
      setEditing(e => ({ ...e, [userId]: undefined }));
      onSaved();
    } catch (e) {
      toast({ title: 'Gagal mengubah role', description: e.message, variant: 'destructive' });
    }
  };

  const invite = async () => {
    if (!inviteEmail) { toast({ title: 'Email wajib', variant: 'destructive' }); return; }
    setInviting(true);
    try {
      const platformRole = (inviteRole === 'Owner' || inviteRole === 'Admin') ? 'admin' : 'user';
      await db.users.inviteUser(inviteEmail, platformRole);
      toast({ title: `Undangan terkirim ke ${inviteEmail}`, description: `Setelah akun terdaftar, atur role ke ${inviteRole} di panel ini` });
      setInviteEmail('');
    } catch (e) {
      toast({ title: 'Gagal mengundang', description: e.message, variant: 'destructive' });
    }
    setInviting(false);
  };

  return (
    <div className="space-y-3">
      {/* Invite */}
      <div className="panel">
        <div className="px-3 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Undang Staff Baru</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Kirim undangan — atur role setelah akun terdaftar</p>
        </div>
        <div className="p-3 flex flex-col sm:flex-row gap-2">
          <input
            type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="email@staff.com"
            className="flex-1 px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary"
          />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            className="px-2 py-1.5 border border-border rounded text-xs bg-card">
            {CLINIC_ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
          <button onClick={invite} disabled={inviting}
            className="btn-primary px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> {inviting ? 'Mengirim…' : 'Undang'}
          </button>
        </div>
      </div>

      {/* Role descriptions */}
      <div className="panel">
        <div className="px-3 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Daftar Role & Hak Akses</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
          {CLINIC_ROLES.map(role => (
            <div key={role} className="border border-border rounded p-2">
              <p className="text-xs font-semibold text-primary">{role}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="panel">
        <div className="px-3 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Staff Terdaftar</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{users.length} pengguna — ubah role per pengguna</p>
        </div>
        <div className="divide-y divide-border">
          {users.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Belum ada pengguna terdaftar</p>}
          {users.map(u => {
            const currentRole = getClinicRole(u);
            const pendingRole = editing[u.id] ?? currentRole;
            const changed = pendingRole !== currentRole;
            return (
              <div key={u.id} className="px-3 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                  {u.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{u.full_name || 'Tanpa nama'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className={`pill ${currentRole === 'Owner' || currentRole === 'Admin' ? 'pill-success' : 'pill-info'} shrink-0`}>
                  {currentRole}
                </span>
                <select
                  value={pendingRole}
                  onChange={e => setEditing(ed => ({ ...ed, [u.id]: e.target.value }))}
                  className="px-2 py-1 border border-border rounded text-xs bg-card"
                >
                  {CLINIC_ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
                {changed && (
                  <button
                    onClick={() => updateRole(u.id, pendingRole)}
                    className="btn-primary px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" /> Simpan
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
