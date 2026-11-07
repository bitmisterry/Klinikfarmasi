// @ts-nocheck -- Legacy local records have heterogeneous optional fields.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { User, Calendar, FileText, Save, AlertCircle, Phone } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function DoctorSelfProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  const doctorId = user?.id;
  const doctorName = user?.full_name || 'Dokter';

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const profiles = await db.entities.DoctorProfile.filter({ user_id: doctorId }).catch(() => []);
      const p = (profiles || [])[0];
      setProfile(p);
      setForm(p || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const save = async () => {
    try {
      if (profile) {
        await db.entities.DoctorProfile.update(profile.id, form);
      } else {
        await db.entities.DoctorProfile.create({ ...form, user_id: doctorId, full_name: doctorName });
      }
      toast({ title: 'Profil tersimpan' });
      setEditing(false);
      load();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  return (
    <div className="p-3 lg:p-5 space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Profil Saya</h1>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 border border-border rounded text-xs hover:bg-muted">Edit</button>
        ) : (
          <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded text-xs font-medium">
            <Save className="w-3.5 h-3.5" /> Simpan
          </button>
        )}
      </div>

      {/* Identity */}
      <div className="panel">
        <div className="px-3 py-2.5 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Identitas</h3>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold">
              {doctorName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{doctorName}</p>
              <p className="text-xs text-muted-foreground">{profile?.specialization || 'Spesialisasi belum diisi'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          {editing && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div><label className="text-[10px] text-muted-foreground">Gelar</label><input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="dr., Sp.A" /></div>
              <div><label className="text-[10px] text-muted-foreground">Spesialisasi</label><input value={form.specialization || ''} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} className={inputCls} placeholder="Anak, Umum" /></div>
              <div><label className="text-[10px] text-muted-foreground">Telepon</label><input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground">Kode Internal</label><input value={form.internal_code || ''} onChange={e => setForm(f => ({ ...f, internal_code: e.target.value }))} className={inputCls} /></div>
            </div>
          )}
          {!editing && (
            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              {profile?.title && <div><span className="text-muted-foreground">Gelar: </span>{profile.title}</div>}
              {profile?.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" /> {profile.phone}</div>}
              {profile?.internal_code && <div><span className="text-muted-foreground">Kode: </span>{profile.internal_code}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Legal */}
      <div className="panel">
        <div className="px-3 py-2.5 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Legalitas (STR/SIP)</h3>
        </div>
        <div className="p-3 space-y-2">
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-muted-foreground">No. STR</label><input value={form.str_number || ''} onChange={e => setForm(f => ({ ...f, str_number: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground">Masa Berlaku STR</label><input type="date" value={form.str_expiry || ''} onChange={e => setForm(f => ({ ...f, str_expiry: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground">No. SIP</label><input value={form.sip_number || ''} onChange={e => setForm(f => ({ ...f, sip_number: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground">Masa Berlaku SIP</label><input type="date" value={form.sip_expiry || ''} onChange={e => setForm(f => ({ ...f, sip_expiry: e.target.value }))} className={inputCls} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">STR: </span>{profile?.str_number || '-'}</div>
              <div><span className="text-muted-foreground">Berlaku: </span>{profile?.str_expiry || '-'}</div>
              <div><span className="text-muted-foreground">SIP: </span>{profile?.sip_number || '-'}</div>
              <div><span className="text-muted-foreground">Berlaku: </span>{profile?.sip_expiry || '-'}</div>
            </div>
          )}
          {profile?.sip_expiry && new Date(profile.sip_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs">
              <AlertCircle className="w-3.5 h-3.5" /> SIP akan berakhir segera — mohon perpanjang
            </div>
          )}
        </div>
      </div>

      {/* Practice */}
      <div className="panel">
        <div className="px-3 py-2.5 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Praktik</h3>
        </div>
        <div className="p-3 space-y-2">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted-foreground">Jam Mulai Default</label><input type="time" value={form.default_start_time || '08:00'} onChange={e => setForm(f => ({ ...f, default_start_time: e.target.value }))} className={inputCls} /></div>
                <div><label className="text-[10px] text-muted-foreground">Jam Selesai Default</label><input type="time" value={form.default_end_time || '12:00'} onChange={e => setForm(f => ({ ...f, default_end_time: e.target.value }))} className={inputCls} /></div>
                <div><label className="text-[10px] text-muted-foreground">Durasi Slot (menit)</label><input type="number" value={form.slot_duration || 15} onChange={e => setForm(f => ({ ...f, slot_duration: +e.target.value }))} className={inputCls} /></div>
                <div><label className="text-[10px] text-muted-foreground">Kuota Harian</label><input type="number" value={form.daily_quota || 20} onChange={e => setForm(f => ({ ...f, daily_quota: +e.target.value }))} className={inputCls} /></div>
                <div><label className="text-[10px] text-muted-foreground">Ruang Praktik</label><input value={form.practice_room || ''} onChange={e => setForm(f => ({ ...f, practice_room: e.target.value }))} className={inputCls} /></div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Hari Praktik</label>
                <div className="flex flex-wrap gap-1">
                  {days.map(d => {
                    const selected = (form.practice_days || []).includes(d);
                    return (
                      <button key={d} onClick={() => {
                        const days = form.practice_days || [];
                        setForm(f => ({ ...f, practice_days: selected ? days.filter(x => x !== d) : [...days, d] }));
                      }} className={`px-2 py-1 rounded text-xs ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Jam Praktik</span><span>{profile?.default_start_time || '08:00'}–{profile?.default_end_time || '12:00'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Durasi Slot</span><span>{profile?.slot_duration || 15} menit</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Kuota Harian</span><span>{profile?.daily_quota || 20} pasien</span></div>
              {profile?.practice_room && <div className="flex justify-between"><span className="text-muted-foreground">Ruang</span><span>{profile.practice_room}</span></div>}
              {profile?.practice_days && <div className="flex justify-between"><span className="text-muted-foreground">Hari</span><span>{profile.practice_days.join(', ')}</span></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
