const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, Trash2, Save, X, Stethoscope, Clock, MapPin, Activity, AlertCircle, Check, XCircle } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const POLI_COLORS = {
  'Poli Umum': 'bg-blue-50 border-blue-200 text-blue-700',
  'Poli Anak': 'bg-emerald-50 border-emerald-200 text-emerald-700',
  'Poli Kandungan': 'bg-pink-50 border-pink-200 text-pink-700',
  'Poli Gigi': 'bg-amber-50 border-amber-200 text-amber-700',
  'Poli Mata': 'bg-purple-50 border-purple-200 text-purple-700',
  'Poli Saraf': 'bg-cyan-50 border-cyan-200 text-cyan-700',
};
const POLI_OPTIONS = ['Poli Umum', 'Poli Anak', 'Poli Kandungan', 'Poli Gigi', 'Poli Mata', 'Poli Saraf'];

export default function DoctorScheduleMgmt() {
  const [doctors, setDoctors] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rescheduleActions, setRescheduleActions] = useState({});
  const { toast } = useToast();
  const { user } = useAuth();
  const clinicRole = getClinicRole(user);
  const isOwner = clinicRole === 'Owner';
  const canApprove = ['Owner', 'Manajer Operasional'].includes(clinicRole);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [staff, scheds, reqs] = await Promise.all([
        db.entities.Staff.filter({ role: 'Dokter', is_active: true }) || [],
        db.entities.DoctorSchedule.list() || [],
        db.entities.ScheduleChangeRequest.filter({ status: 'Diajukan' }, '-submitted_at', 20).catch(() => []),
      ]);
      setDoctors(staff);
      setSchedules(scheds);
      setChangeRequests(reqs || []);
    } catch {} finally { setLoading(false); }
  };

  const reviewRequest = async (req, action) => {
    try {
      await db.functions.invoke('approveScheduleChange', {
        request_id: req.id,
        action,
        review_notes: '',
        reschedule_action: rescheduleActions[req.id] || 'Notifikasi Pasien',
      });
      toast({ title: action === 'approve' ? 'Pengajuan disetujui' : 'Pengajuan ditolak' });
      load();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const getSchedulesForCell = (doctorId, day) => {
    return schedules.filter(s => s.doctor_id === doctorId && s.day_of_week === day && s.is_active !== false);
  };

  const handleSave = async (data) => {
    try {
      if (editing?.id) {
        await db.entities.DoctorSchedule.update(editing.id, data);
        toast({ title: 'Jadwal diperbarui' });
      } else {
        await db.entities.DoctorSchedule.create({
          ...data,
          is_active: true,
          status: 'Dijadwalkan',
        });
        toast({ title: 'Jadwal ditambahkan' });
      }
      setShowAdd(false);
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.entities.DoctorSchedule.delete(id);
      toast({ title: 'Jadwal dihapus' });
      load();
    } catch (e) {
      toast({ title: 'Gagal menghapus', description: e.message, variant: 'destructive' });
    }
  };

  const toggleStatus = async (sched) => {
    const newStatus = sched.status === 'Hadir' ? 'Dijadwalkan' : 'Hadir';
    try {
      await db.entities.DoctorSchedule.update(sched.id, { status: newStatus });
      load();
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" /> Jadwal Praktek Dokter
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Template mingguan berulang — ditampilkan di layar TV ruang tunggu & portal pasien.
          </p>
        </div>
        {!isOwner && <button
          onClick={() => { setEditing(null); setShowAdd(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-md text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Jadwal
        </button>}
      </div>

      <ModuleStatHeader stats={[
        { icon: Stethoscope, label: 'Dokter Aktif', value: doctors.length, color: 'text-blue-600' },
        { icon: CalendarDays, label: 'Total Jadwal', value: schedules.filter(s => s.is_active !== false).length, color: 'text-teal-600' },
        { icon: Activity, label: 'Poli Aktif', value: new Set(schedules.map(s => s.poli)).size, color: 'text-purple-600' },
        { icon: AlertCircle, label: 'Pengajuan Pending', value: changeRequests.length, color: 'text-amber-600' },
      ]} />

      {/* Weekly Grid */}
      <div className="panel overflow-x-auto">
        <table className="w-full text-xs min-w-[800px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left micro-label sticky left-0 bg-muted/50 z-10">Dokter</th>
              {DAYS.map(d => (
                <th key={d} className="px-2 py-2 text-center micro-label min-w-[120px]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {doctors.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Belum ada dokter terdaftar. Tambah dokter di Manajemen Staff.</td></tr>
            )}
            {doctors.map(doc => (
              <tr key={doc.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-2.5 sticky left-0 bg-card z-10 border-r border-border">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Stethoscope className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{doc.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.license_number || '-'}</p>
                    </div>
                  </div>
                </td>
                {DAYS.map(day => {
                  const cellSchedules = getSchedulesForCell(doc.id, day);
                  return (
                    <td key={day} className="px-1.5 py-1.5 align-top">
                      <div className="space-y-1">
                        {cellSchedules.map(s => {
                          const colorClass = POLI_COLORS[s.poli] || 'bg-slate-50 border-slate-200 text-slate-700';
                          return (
                            <div
                              key={s.id}
                              className={`rounded border px-1.5 py-1 cursor-pointer ${colorClass} ${s.status === 'Hadir' ? 'ring-1 ring-emerald-400' : ''}`}
                              onClick={() => { if (!isOwner) { setEditing(s); setShowAdd(true); } }}
                            >
                              <div className="flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                <span className="text-[10px] font-medium">{s.start_time}-{s.end_time}</span>
                              </div>
                              <p className="text-[10px] truncate flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />{s.poli}
                              </p>
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {!isOwner && <button
                                  onClick={(e) => { e.stopPropagation(); toggleStatus(s); }}
                                  className={`text-[9px] px-1 rounded ${s.status === 'Hadir' ? 'bg-emerald-500 text-white' : 'bg-white/60 text-slate-600'}`}
                                >
                                  {s.status === 'Hadir' ? '✓ Hadir' : 'Tandai Hadir'}
                                </button>}
                                {!isOwner && <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                                  className="text-[9px] px-1 text-rose-500 hover:bg-rose-100 rounded ml-auto"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>}
                              </div>
                            </div>
                          );
                        })}
                        {!isOwner && cellSchedules.length === 0 && (
                          <button
                            onClick={() => {
                              setEditing({ doctor_id: doc.id, doctor_name: doc.full_name, day_of_week: day });
                              setShowAdd(true);
                            }}
                            className="w-full text-[10px] text-muted-foreground hover:text-primary border border-dashed border-border rounded py-1 hover:border-primary/40 transition-colors"
                          >
                            + Slot
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Schedule Change Requests */}
      {changeRequests.length > 0 && (
        <div className="panel border-l-2 border-l-amber-400">
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Pengajuan Perubahan Jadwal</h3>
            <span className="pill pill-warning ml-auto">{changeRequests.length} menunggu review</span>
          </div>
          <div className="divide-y divide-border">
            {changeRequests.map(req => (
              <div key={req.id} className="px-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{req.doctor_name}</p>
                      <span className="pill pill-warning">{req.request_type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(req.affected_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {req.affected_date_end && ` s/d ${new Date(req.affected_date_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                    </p>
                    {req.reason && <p className="text-xs text-muted-foreground mt-0.5">Alasan: {req.reason}</p>}
                    {req.impacted_count > 0 && (
                      <>
                        <p className="text-xs text-amber-600 font-medium mt-1">⚠ {req.impacted_count} pasien terdampak</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase">Aksi Reschedule:</span>
                          <select
                            value={rescheduleActions[req.id] || 'Notifikasi Pasien'}
                            onChange={e => setRescheduleActions(s => ({ ...s, [req.id]: e.target.value }))}
                            className="px-1.5 py-1 border border-border rounded text-[11px] bg-card"
                          >
                            <option>Notifikasi Pasien</option>
                            <option>Reschedule Otomatis</option>
                            <option>Tidak Ada Aksi</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                  {canApprove && <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => reviewRequest(req, 'approve')} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs hover:bg-emerald-100">
                      <Check className="w-3.5 h-3.5" /> Setujui
                    </button>
                    <button onClick={() => reviewRequest(req, 'reject')} className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs hover:bg-rose-100">
                      <XCircle className="w-3.5 h-3.5" /> Tolak
                    </button>
                  </div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <ScheduleFormModal
          editing={editing}
          doctors={doctors}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ScheduleFormModal({ editing, doctors, onClose, onSave }) {
  const [form, setForm] = useState({
    doctor_id: editing?.doctor_id || '',
    doctor_name: editing?.doctor_name || '',
    day_of_week: editing?.day_of_week || 'Senin',
    start_time: editing?.start_time || '08:00',
    end_time: editing?.end_time || '12:00',
    poli: editing?.poli || 'Poli Umum',
  });

  const submit = (e) => {
    e.preventDefault();
    const doctor = doctors.find(d => d.id === form.doctor_id);
    onSave({
      ...form,
      doctor_name: doctor?.full_name || form.doctor_name,
    });
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">{editing?.id ? 'Edit Jadwal' : 'Tambah Jadwal Praktek'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-3 space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Dokter</label>
            <select value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))} className={inputCls} required>
              <option value="">Pilih dokter…</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Hari</label>
            <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))} className={inputCls}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Jam Mulai</label>
              <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Jam Selesai</label>
              <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputCls} required />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Poli</label>
            <select value={form.poli} onChange={e => setForm(f => ({ ...f, poli: e.target.value }))} className={inputCls}>
              {POLI_OPTIONS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full btn-primary py-2 rounded text-xs font-medium flex items-center justify-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Simpan Jadwal
          </button>
        </form>
      </div>
    </div>
  );
}
