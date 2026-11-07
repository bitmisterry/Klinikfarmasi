const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import {
  Stethoscope, Users, CheckCircle2, AlertCircle, Plus, X, Save,
  Calendar, Wallet, Activity,
  User, Briefcase, Shield, ClipboardList
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import ExamTemplateEditor from '@/components/doctor/ExamTemplateEditor';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function DoctorManagement() {
  const [doctors, setDoctors] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = getClinicRole(user) === 'Owner';

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [docs, scheds, q] = await Promise.all([
        db.entities.DoctorProfile.list() || [],
        db.entities.DoctorSchedule.filter({ is_active: true }).catch(() => []),
        db.entities.QueueEntry.filter({ status: { $in: ['Menunggu', 'Pemeriksaan', 'Selesai Periksa', 'Di Apotek', 'Kasir', 'Selesai'] } }).catch(() => []),
      ]);
      setDoctors(docs);
      setSchedules(scheds || []);
      setQueue(q || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const todayDay = dayNames[new Date().getDay()];
  const todayDate = new Date().toISOString().split('T')[0];

  const getDoctorStatus = (doc) => {
    const todayScheds = schedules.filter(s => s.doctor_id === doc.id || s.doctor_name === doc.full_name);
    const hasToday = todayScheds.some(s => s.day_of_week === todayDay);
    if (!hasToday) return { label: 'Tidak Praktik', color: 'pill-inactive', dot: 'bg-slate-400' };
    const todaySchedule = todayScheds.find(s => s.day_of_week === todayDay);
    if (todaySchedule?.status === 'Hadir') return { label: 'Praktik', color: 'pill-success', dot: 'bg-emerald-500' };
    if (todaySchedule?.status === 'Tidak Praktik' || todaySchedule?.status === 'Cuti') return { label: todaySchedule.status, color: 'pill-critical', dot: 'bg-rose-500' };
    return { label: 'Dijadwalkan', color: 'pill-info', dot: 'bg-blue-500' };
  };

  const getPatientsToday = (doc) => {
    return queue.filter(q => q.doctor_id === doc.user_id || q.doctor_name === doc.full_name).length;
  };

  const getExpiryWarnings = () => {
    const now = new Date();
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    return doctors.filter(d =>
      (d.sip_expiry && new Date(d.sip_expiry) <= soon) ||
      (d.str_expiry && new Date(d.str_expiry) <= soon)
    );
  };

  const expiryWarnings = getExpiryWarnings();

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium flex items-center gap-2"><Stethoscope className="w-5 h-5 text-primary" /> Manajemen Dokter</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Kelola profil, jadwal, legalitas, dan jasa dokter</p>
        </div>
        {!isOwner && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-md text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Tambah Dokter
        </button>}
      </div>

      <ModuleStatHeader stats={[
        { icon: Stethoscope, label: 'Total Dokter', value: doctors.length, color: 'text-blue-600' },
        { icon: CheckCircle2, label: 'Praktik Hari Ini', value: doctors.filter(d => getDoctorStatus(d).label === 'Praktik').length, color: 'text-emerald-600' },
        { icon: Users, label: 'Pasien Hari Ini', value: queue.length, color: 'text-teal-600' },
        { icon: AlertCircle, label: 'SIP/STR Expiring', value: expiryWarnings.length, color: 'text-amber-600' },
      ]} />

      {/* Expiry Warnings */}
      {expiryWarnings.length > 0 && (
        <div className="panel border-l-2 border-l-amber-400">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-xs font-semibold flex items-center gap-1.5 text-amber-700">
              <AlertCircle className="w-3.5 h-3.5" /> Need Your Attention — SIP/STR akan berakhir
            </h3>
          </div>
          <div className="divide-y divide-border">
            {expiryWarnings.map(d => (
              <div key={d.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                <span className="font-medium">{d.full_name}</span>
                {d.sip_expiry && new Date(d.sip_expiry) <= new Date(Date.now() + 30 * 86400000) && (
                  <span className="pill pill-warning">SIP berakhir {new Date(d.sip_expiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                )}
                {d.str_expiry && new Date(d.str_expiry) <= new Date(Date.now() + 30 * 86400000) && (
                  <span className="pill pill-warning">STR berakhir {new Date(d.str_expiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                )}
                <button onClick={() => setSelected(d)} className="ml-auto text-primary hover:text-primary-hover">Lihat profil</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doctor Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left micro-label">Dokter</th>
              <th className="px-3 py-2 text-left micro-label">Spesialisasi</th>
              <th className="px-3 py-2 text-left micro-label">Praktik</th>
              <th className="px-3 py-2 text-center micro-label">Pasien Hari Ini</th>
              <th className="px-3 py-2 text-left micro-label">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {doctors.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8">
                <EmptyState icon={Stethoscope} title="Belum ada dokter" description="Tambahkan profil dokter untuk mulai mengelola" />
              </td></tr>
            )}
            {doctors.map(doc => {
              const status = getDoctorStatus(doc);
              const todayScheds = schedules.filter(s => (s.doctor_id === doc.id || s.doctor_name === doc.full_name) && s.day_of_week === todayDay);
              const patientsToday = getPatientsToday(doc);
              return (
                <tr key={doc.id} onClick={() => setSelected(doc)} className="hover:bg-slate-50/50 cursor-pointer">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0">
                        {doc.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.display_name || doc.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{doc.internal_code || doc.phone || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{doc.specialization || '-'}</td>
                  <td className="px-3 py-2.5">
                    {todayScheds.length > 0 ? todayScheds.map(s => `${s.start_time}-${s.end_time}`).join(', ') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center font-medium">{patientsToday}</td>
                  <td className="px-3 py-2.5">
                    <span className={`pill ${status.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <DoctorProfileDrawer doctor={selected} schedules={schedules} queue={queue} readOnly={isOwner} onClose={() => setSelected(null)} onSaved={load} />
      )}
      {showAdd && (
        <DoctorAddForm onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}

function DoctorProfileDrawer({ doctor, schedules, queue, readOnly = false, onClose, onSaved }) {
  const [tab, setTab] = useState('profil');
  const [form, setForm] = useState(doctor);
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const [assistants, setAssistants] = useState([]);
  const [assistantForm, setAssistantForm] = useState({ email: '', name: '' });
  const [assistantLoading, setAssistantLoading] = useState(false);

  useEffect(() => {
    if (tab === 'asisten') loadAssistants();
  }, [tab]);

  const loadAssistants = async () => {
    try {
      const list = await db.entities.DoctorAssistant.filter({ doctor_profile_id: doctor.id }).catch(() => []);
      setAssistants(list || []);
    } catch {}
  };

  const addAssistant = async () => {
    if (!assistantForm.email) { toast({ title: 'Email wajib', variant: 'destructive' }); return; }
    setAssistantLoading(true);
    try {
      await db.users.inviteUser(assistantForm.email, 'user');
      await db.entities.DoctorAssistant.create({
        assistant_email: assistantForm.email,
        assistant_name: assistantForm.name || assistantForm.email.split('@')[0],
        doctor_user_id: doctor.user_id,
        doctor_profile_id: doctor.id,
        doctor_name: doctor.display_name || doctor.full_name,
        doctor_specialization: doctor.specialization,
        is_active: true,
      });
      toast({ title: 'Asisten ditambahkan', description: 'Undangan dikirim ke email asisten' });
      setAssistantForm({ email: '', name: '' });
      loadAssistants();
    } catch (e) {
      toast({ title: 'Gagal menambahkan asisten', description: e.message, variant: 'destructive' });
    }
    setAssistantLoading(false);
  };

  const toggleAssistant = async (a) => {
    try {
      await db.entities.DoctorAssistant.update(a.id, { is_active: !a.is_active });
      loadAssistants();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const tabs = [
    { k: 'profil', l: 'Profil', icon: User },
    { k: 'praktik', l: 'Praktik', icon: Calendar },
    { k: 'legal', l: 'Legal & Dokumen', icon: Shield },
    { k: 'keuangan', l: 'Keuangan', icon: Wallet },
    { k: 'aktivitas', l: 'Aktivitas', icon: Activity },
    ...(!readOnly ? [{ k: 'asisten', l: 'Asisten', icon: Briefcase }, { k: 'template', l: 'Template', icon: ClipboardList }] : []),
  ];

  const save = async () => {
    try {
      await db.entities.DoctorProfile.update(doctor.id, form);
      // Sync to Staff
      if (form.staff_id) {
        await db.entities.Staff.update(form.staff_id, {
          full_name: form.full_name,
          role: 'Dokter',
          license_number: form.str_number || '',
          phone: form.phone || '',
          email: form.email || '',
          is_active: form.is_active !== false,
        }).catch(() => {});
      }
      toast({ title: 'Profil dokter tersimpan' });
      setEditing(false);
      onSaved();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";
  const mySchedules = schedules.filter(s => s.doctor_id === doctor.id || s.doctor_name === doctor.full_name);
  const myQueue = queue.filter(q => q.doctor_id === doctor.user_id || q.doctor_name === doctor.full_name);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border-l border-border h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {doctor.full_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-semibold">{doctor.display_name || doctor.full_name}</h2>
                <p className="text-xs text-muted-foreground">{doctor.specialization} • {doctor.employment_status || 'Tetap'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!readOnly && (editing ? (
                <button onClick={save} className="flex items-center gap-1 px-2.5 py-1.5 btn-primary rounded text-xs font-medium">
                  <Save className="w-3.5 h-3.5" /> Simpan
                </button>
              ) : (
                <button onClick={() => setEditing(true)} className="px-2.5 py-1.5 border border-border rounded text-xs hover:bg-muted">Edit</button>
              ))}
              <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto sticky top-[65px] bg-card z-10">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <Icon className="w-3.5 h-3.5" /> {t.l}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {tab === 'profil' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-muted-foreground uppercase">Nama Lengkap</label>
                  {editing ? <input value={form.full_name || ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm font-medium">{doctor.full_name}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Gelar</label>
                  {editing ? <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.title || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Nama Tampilan</label>
                  {editing ? <input value={form.display_name || ''} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.display_name || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Spesialisasi</label>
                  {editing ? <input value={form.specialization || ''} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.specialization || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Telepon</label>
                  {editing ? <input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.phone || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Email</label>
                  {editing ? <input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.email || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Kode Internal</label>
                  {editing ? <input value={form.internal_code || ''} onChange={e => setForm(f => ({ ...f, internal_code: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.internal_code || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Status</label>
                   {editing ? (
                     <select value={form.is_active === false ? 'false' : 'true'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))} className={inputCls}>
                       <option value="true">Aktif</option>
                       <option value="false">Nonaktif</option>
                     </select>
                   ) : <span className={`pill ${doctor.is_active !== false ? 'pill-success' : 'pill-inactive'}`}>{doctor.is_active !== false ? 'Aktif' : 'Nonaktif'}</span>}</div>
                </div>
                {/* Management Roles */}
                <div>
                <label className="text-[10px] text-muted-foreground uppercase">Peran Manajemen (Switch Workspace)</label>
                {editing ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {['Medical Director', 'PIC Klinik', 'Koordinator Dokter', 'Kepala Medis'].map(r => {
                      const sel = (form.management_roles || []).includes(r);
                      return (
                        <button key={r} onClick={() => setForm(f => ({ ...f, management_roles: sel ? (f.management_roles || []).filter(x => x !== r) : [...(f.management_roles || []), r] }))} className={`px-2 py-1 rounded text-xs ${sel ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{r}</button>
                      );
                    })}
                    <input value={(form.management_roles || []).filter(r => !['Medical Director', 'PIC Klinik', 'Koordinator Dokter', 'Kepala Medis'].includes(r)).join(', ')} onChange={e => {
                      const preset = ['Medical Director', 'PIC Klinik', 'Koordinator Dokter', 'Kepala Medis'];
                      const custom = e.target.value.split(',').map(s => s.trim()).filter(s => s && !preset.includes(s));
                      setForm(f => ({ ...f, management_roles: [...(f.management_roles || []).filter(r => preset.includes(r)), ...custom] }));
                    }} className={inputCls + ' mt-1'} placeholder="Peran lain (pisah dengan koma)…" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(doctor.management_roles || []).length === 0 ? <span className="text-xs text-muted-foreground">Tidak ada peran manajemen</span> :
                      doctor.management_roles.map(r => <span key={r} className="pill pill-info">{r}</span>)}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">Dokter dengan peran manajemen dapat Switch Workspace di Doctor Portal untuk mengakses menu manajemen.</p>
                </div>
                </div>
                )}

          {tab === 'praktik' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-muted-foreground uppercase">Jam Mulai Default</label>
                  {editing ? <input type="time" value={form.default_start_time || '08:00'} onChange={e => setForm(f => ({ ...f, default_start_time: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.default_start_time || '08:00'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Jam Selesai Default</label>
                  {editing ? <input type="time" value={form.default_end_time || '12:00'} onChange={e => setForm(f => ({ ...f, default_end_time: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.default_end_time || '12:00'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Durasi Slot</label>
                  {editing ? <input type="number" value={form.slot_duration || 15} onChange={e => setForm(f => ({ ...f, slot_duration: +e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.slot_duration || 15} menit</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Kuota Harian</label>
                  {editing ? <input type="number" value={form.daily_quota || 20} onChange={e => setForm(f => ({ ...f, daily_quota: +e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.daily_quota || 20} pasien</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Ruang Praktik</label>
                  {editing ? <input value={form.practice_room || ''} onChange={e => setForm(f => ({ ...f, practice_room: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.practice_room || '-'}</p>}</div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Hari Praktik</label>
                {editing ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {DAYS.map(d => {
                      const sel = (form.practice_days || []).includes(d);
                      return <button key={d} onClick={() => setForm(f => ({ ...f, practice_days: sel ? (f.practice_days || []).filter(x => x !== d) : [...(f.practice_days || []), d] }))} className={`px-2 py-1 rounded text-xs ${sel ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{d}</button>;
                    })}
                  </div>
                ) : <p className="text-sm">{(doctor.practice_days || []).join(', ') || '-'}</p>}
              </div>
              {/* Current schedules */}
              <div>
                <p className="text-xs font-semibold mb-1">Jadwal Aktif</p>
                <div className="space-y-1">
                  {mySchedules.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                      <span className="font-medium w-16">{s.day_of_week}</span>
                      <span>{s.start_time}-{s.end_time}</span>
                      <span className="text-muted-foreground">{s.poli}</span>
                      <span className={`pill ml-auto ${s.status === 'Hadir' ? 'pill-success' : 'pill-inactive'}`}>{s.status}</span>
                    </div>
                  ))}
                  {mySchedules.length === 0 && <p className="text-xs text-muted-foreground">Belum ada jadwal</p>}
                </div>
              </div>
            </div>
          )}

          {tab === 'legal' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-muted-foreground uppercase">No. STR</label>
                  {editing ? <input value={form.str_number || ''} onChange={e => setForm(f => ({ ...f, str_number: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.str_number || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Masa Berlaku STR</label>
                  {editing ? <input type="date" value={form.str_expiry || ''} onChange={e => setForm(f => ({ ...f, str_expiry: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.str_expiry ? new Date(doctor.str_expiry).toLocaleDateString('id-ID') : '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">No. SIP</label>
                  {editing ? <input value={form.sip_number || ''} onChange={e => setForm(f => ({ ...f, sip_number: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.sip_number || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Masa Berlaku SIP</label>
                  {editing ? <input type="date" value={form.sip_expiry || ''} onChange={e => setForm(f => ({ ...f, sip_expiry: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.sip_expiry ? new Date(doctor.sip_expiry).toLocaleDateString('id-ID') : '-'}</p>}</div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Kompetensi/Layanan</label>
                {editing ? <input value={(form.competencies || []).join(', ')} onChange={e => setForm(f => ({ ...f, competencies: e.target.value.split(',').map(s => s.trim()) }))} className={inputCls} placeholder="Konsultasi Anak, Imunisasi…" /> :
                <p className="text-sm">{(doctor.competencies || []).join(', ') || '-'}</p>}
              </div>
              {(doctor.sip_expiry && new Date(doctor.sip_expiry) <= new Date(Date.now() + 30 * 86400000)) && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" /> SIP akan berakhir {new Date(doctor.sip_expiry).toLocaleDateString('id-ID')}
                </div>
              )}
            </div>
          )}

          {tab === 'keuangan' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-muted-foreground uppercase">Status Kepegawaian</label>
                  {editing ? (
                    <select value={form.employment_status || 'Tetap'} onChange={e => setForm(f => ({ ...f, employment_status: e.target.value }))} className={inputCls}>
                      <option>Tetap</option><option>Kontrak</option><option>Kerja Sama</option><option>Part-time</option><option>Guest</option>
                    </select>
                  ) : <p className="text-sm">{doctor.employment_status || 'Tetap'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Tanggal Bergabung</label>
                  {editing ? <input type="date" value={form.join_date || ''} onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.join_date ? new Date(doctor.join_date).toLocaleDateString('id-ID') : '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Akhir Kontrak</label>
                  {editing ? <input type="date" value={form.contract_end || ''} onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.contract_end ? new Date(doctor.contract_end).toLocaleDateString('id-ID') : '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Skema Jasa</label>
                  {editing ? (
                    <select value={form.remuneration_scheme || 'Nominal per Konsultasi'} onChange={e => setForm(f => ({ ...f, remuneration_scheme: e.target.value }))} className={inputCls}>
                      <option>Nominal per Konsultasi</option><option>Persentase</option><option>Per Tindakan</option><option>Kombinasi</option><option>Manual</option>
                    </select>
                  ) : <p className="text-sm">{doctor.remuneration_scheme || '-'}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Nominal per Konsultasi</label>
                  {editing ? <input type="number" value={form.remuneration_nominal || 0} onChange={e => setForm(f => ({ ...f, remuneration_nominal: +e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">Rp {(doctor.remuneration_nominal || 0).toLocaleString('id-ID')}</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Persentase</label>
                  {editing ? <input type="number" value={form.remuneration_percent || 0} onChange={e => setForm(f => ({ ...f, remuneration_percent: +e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">{doctor.remuneration_percent || 0}%</p>}</div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Nominal per Tindakan</label>
                  {editing ? <input type="number" value={form.remuneration_per_tindakan || 0} onChange={e => setForm(f => ({ ...f, remuneration_per_tindakan: +e.target.value }))} className={inputCls} /> :
                  <p className="text-sm">Rp {(doctor.remuneration_per_tindakan || 0).toLocaleString('id-ID')}</p>}</div>
              </div>
            </div>
          )}

          {tab === 'aktivitas' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="panel px-3 py-2">
                  <p className="micro-label">Pasien Hari Ini</p>
                  <p className="text-lg font-bold text-blue-600">{myQueue.length}</p>
                </div>
                <div className="panel px-3 py-2">
                  <p className="micro-label">Selesai</p>
                  <p className="text-lg font-bold text-emerald-600">{myQueue.filter(q => ['Selesai Periksa', 'Di Apotek', 'Kasir', 'Selesai'].includes(q.status)).length}</p>
                </div>
                <div className="panel px-3 py-2">
                  <p className="micro-label">Menunggu</p>
                  <p className="text-lg font-bold text-amber-600">{myQueue.filter(q => q.status === 'Menunggu').length}</p>
                </div>
              </div>
              <div className="panel">
                <div className="px-3 py-2 border-b border-border">
                  <h3 className="text-xs font-semibold">Antrean Dokter Hari Ini</h3>
                </div>
                <div className="divide-y divide-border max-h-60 overflow-y-auto">
                  {myQueue.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Tidak ada pasien</p>}
                  {myQueue.map(q => (
                    <div key={q.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="font-mono text-primary w-10">{q.queue_number}</span>
                      <span className="flex-1 truncate">{q.patient_name}</span>
                      <span className={`pill ${q.status === 'Pemeriksaan' ? 'pill-info' : q.status === 'Selesai' ? 'pill-success' : 'pill-inactive'}`}>{q.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'asisten' && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-primary" /> Tambah Asisten Dokter</p>
                <p className="text-[11px] text-muted-foreground mb-2">Asisten akan mendapat akses terbatas ke portal dokter ini (pasien, jadwal, notifikasi) tanpa akses pemeriksaan atau resep.</p>
                {!readOnly && <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Email Asisten *</label>
                    <input value={assistantForm.email} onChange={e => setAssistantForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="asisten@email.com" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Nama Asisten</label>
                    <input value={assistantForm.name} onChange={e => setAssistantForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Nama lengkap" />
                  </div>
                </div>}
                {!readOnly && <button onClick={addAssistant} disabled={assistantLoading} className="w-full btn-primary py-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50">
                  {assistantLoading ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <><Plus className="w-3.5 h-3.5" /> Tambah & Kirim Undangan</>}
                </button>}
              </div>
              <div>
                <p className="text-xs font-semibold mb-1">Daftar Asisten</p>
                <div className="space-y-1.5">
                  {assistants.length === 0 && <p className="text-xs text-muted-foreground">Belum ada asisten</p>}
                  {assistants.map(a => (
                    <div key={a.id} className="flex items-center gap-2 bg-muted/30 rounded px-2.5 py-2 text-xs">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-medium shrink-0">
                        {(a.assistant_name || a.assistant_email)?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{a.assistant_name || a.assistant_email}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.assistant_email}</p>
                      </div>
                      <span className={`pill ${a.is_active !== false ? 'pill-success' : 'pill-inactive'}`}>{a.is_active !== false ? 'Aktif' : 'Nonaktif'}</span>
                      {!readOnly && <button onClick={() => toggleAssistant(a)} className="text-[10px] text-primary hover:text-primary-hover">
                        {a.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'template' && (
            <ExamTemplateEditor form={form} setForm={setForm} editing={editing} doctor={doctor} />
          )}
        </div>
      </div>
    </div>
  );
}

function DoctorAddForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: '', title: '', specialization: '', phone: '', email: '',
    str_number: '', sip_number: '', employment_status: 'Tetap',
    remuneration_scheme: 'Nominal per Konsultasi', remuneration_nominal: 50000,
    default_start_time: '08:00', default_end_time: '12:00', slot_duration: 15, daily_quota: 20,
    practice_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'], is_active: true,
  });
  const { toast } = useToast();
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  const save = async () => {
    if (!form.full_name) { toast({ title: 'Nama wajib', variant: 'destructive' }); return; }
    try {
      const profile = await db.entities.DoctorProfile.create({
        ...form,
        display_name: form.title ? `${form.title} ${form.full_name}` : form.full_name,
      });
      // Sync to Staff
      try {
        const staff = await db.entities.Staff.create({
          full_name: form.full_name, role: 'Dokter',
          license_number: form.str_number, phone: form.phone, email: form.email,
          is_active: true, shift: 'Lengkap',
        });
        await db.entities.DoctorProfile.update(profile.id, { staff_id: staff.id });
      } catch (e) { console.error('Staff sync failed:', e); }
      toast({ title: 'Dokter ditambahkan' });
      onSaved();
    } catch (e) {
      toast({ title: 'Gagal menambahkan', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Tambah Dokter</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-muted-foreground uppercase">Nama Lengkap *</label><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} required /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Gelar</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="dr., Sp.A" /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Spesialisasi</label><input value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} className={inputCls} placeholder="Umum, Anak" /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Telepon</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">No. STR</label><input value={form.str_number} onChange={e => setForm(f => ({ ...f, str_number: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">No. SIP</label><input value={form.sip_number} onChange={e => setForm(f => ({ ...f, sip_number: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Status Kepegawaian</label>
              <select value={form.employment_status} onChange={e => setForm(f => ({ ...f, employment_status: e.target.value }))} className={inputCls}>
                <option>Tetap</option><option>Kontrak</option><option>Kerja Sama</option><option>Part-time</option><option>Guest</option>
              </select>
            </div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Skema Jasa</label>
              <select value={form.remuneration_scheme} onChange={e => setForm(f => ({ ...f, remuneration_scheme: e.target.value }))} className={inputCls}>
                <option>Nominal per Konsultasi</option><option>Persentase</option><option>Per Tindakan</option><option>Kombinasi</option><option>Manual</option>
              </select>
            </div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Nominal/Konsultasi</label><input type="number" value={form.remuneration_nominal} onChange={e => setForm(f => ({ ...f, remuneration_nominal: +e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Kuota Harian</label><input type="number" value={form.daily_quota} onChange={e => setForm(f => ({ ...f, daily_quota: +e.target.value }))} className={inputCls} /></div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Hari Praktik</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {DAYS.map(d => {
                const sel = (form.practice_days || []).includes(d);
                return <button key={d} onClick={() => setForm(f => ({ ...f, practice_days: sel ? (f.practice_days || []).filter(x => x !== d) : [...(f.practice_days || []), d] }))} className={`px-2 py-1 rounded text-xs ${sel ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{d}</button>;
              })}
            </div>
          </div>
          <button onClick={save} className="w-full btn-primary py-2 rounded text-xs font-medium flex items-center justify-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Simpan Dokter
          </button>
        </div>
      </div>
    </div>
  );
}
