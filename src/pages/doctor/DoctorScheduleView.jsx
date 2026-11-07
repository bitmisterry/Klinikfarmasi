const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, Users, CheckCircle2, AlertCircle, Plus, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/doctorContext';
import ModuleStatHeader from '@/components/ModuleStatHeader';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function DoctorScheduleView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState('hari');
  const [schedules, setSchedules] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const { doctorUserId, doctorProfile } = useDoctorContext();
  const doctorId = doctorUserId;
  const doctorName = doctorProfile?.display_name || doctorProfile?.full_name || user?.full_name || 'Dokter';

  useEffect(() => { if (doctorId) load(); }, [weekOffset, doctorId, doctorProfile?.id]);

  const load = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() + weekOffset * 7 - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const [scheds, appts, reqs] = await Promise.all([
        db.entities.DoctorSchedule.filter({ is_active: true }).catch(() => []),
        db.entities.Appointment.filter({ doctor_id: doctorId, appointment_date: { $gte: weekStart.toISOString().split('T')[0], $lte: weekEnd.toISOString().split('T')[0] } }).catch(() => []),
        db.entities.ScheduleChangeRequest.filter({ doctor_id: doctorId }, '-submitted_at', 10).catch(() => []),
      ]);
      const profileId = doctorProfile?.id;
      const profileName = doctorProfile?.full_name;
      setSchedules((scheds || []).filter(s =>
        (profileId && s.doctor_id === profileId) || (profileName && s.doctor_name === profileName)
      ));
      setAppointments(appts || []);
      setChangeRequests(reqs || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const todayDay = dayNames[new Date().getDay()];
  const todaySchedules = schedules.filter(s => s.day_of_week === todayDay);
  const todayDate = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.appointment_date === todayDate);
  const toMinutes = (time) => {
    const [hour, minute] = String(time || '').split(':').map(Number);
    return Number.isFinite(hour) && Number.isFinite(minute) ? (hour * 60) + minute : null;
  };

  const submitChange = async (data) => {
    try {
      const res = await db.functions.invoke('submitScheduleChange', {
        doctor_id: doctorId,
        doctor_name: doctorName,
        ...data,
      });
      const result = res.data || res;
      toast({
        title: 'Pengajuan terkirim',
        description: result.impacted_count > 0 ? `${result.impacted_count} pasien terdampak — Owner atau Manajer Operasional akan meninjau` : 'Pengajuan terkirim ke Owner dan Manajer Operasional',
      });
      setShowChangeForm(false);
      load();
    } catch (e) {
      toast({ title: 'Gagal mengajukan', description: e.message, variant: 'destructive' });
    }
  };

  const weekDates = [];
  const ws = new Date();
  ws.setDate(ws.getDate() + weekOffset * 7 - ws.getDay());
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    weekDates.push(d);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-3 lg:p-5 space-y-3 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" /> Jadwal Praktik</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{doctorName}</p>
        </div>
        <button onClick={() => setShowChangeForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-md text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Ajukan Perubahan
        </button>
      </div>

      {/* View tabs */}
      <div className="flex border border-border rounded-md overflow-hidden text-xs">
        {[
          { k: 'hari', l: 'Hari Ini' },
          { k: 'minggu', l: 'Mingguan' },
          { k: 'kalender', l: 'Kalender' },
        ].map(t => (
          <button key={t.k} onClick={() => setView(t.k)}
            className={`flex-1 px-3 py-2 font-medium ${view === t.k ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {view === 'hari' && (
        <div className="space-y-3">
          <ModuleStatHeader stats={[
            { icon: Clock, label: 'Sesi Praktik', value: todaySchedules.length, color: 'text-teal-600' },
            { icon: Users, label: 'Booking', value: todayAppts.length, color: 'text-blue-600' },
            { icon: CheckCircle2, label: 'Selesai', value: todayAppts.filter(a => a.status === 'Selesai').length, color: 'text-emerald-600' },
            { icon: AlertCircle, label: 'Menunggu', value: todayAppts.filter(a => a.status === 'Terjadwalkan' || a.status === 'Dikonfirmasi').length, color: 'text-amber-600' },
          ]} />

          <div className="panel">
            <div className="px-3 py-2.5 border-b border-border">
              <h3 className="text-sm font-semibold">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            </div>
            <div className="divide-y divide-border">
              {todaySchedules.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">Tidak ada jadwal praktik hari ini</p>
              )}
              {todaySchedules.map(s => {
                const sessionStart = toMinutes(s.start_time);
                const sessionEnd = toMinutes(s.end_time);
                const appts = todayAppts.filter(a => {
                  if (a.doctor_id && a.doctor_id !== doctorId) return false;
                  const slot = toMinutes(a.time_slot);
                  // A booking with no precise hour can only be assigned unambiguously
                  // when the doctor has one session on that day.
                  if (slot === null || sessionStart === null || sessionEnd === null) return todaySchedules.length === 1;
                  return slot >= sessionStart && slot < sessionEnd;
                });
                const done = appts.filter(a => a.status === 'Selesai').length;
                const waiting = appts.filter(a => a.status === 'Terjadwalkan' || a.status === 'Dikonfirmasi').length;
                const quota = s.daily_quota || 20;
                return (
                  <div key={s.id} className="px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{s.start_time}–{s.end_time}</p>
                        <p className="text-xs text-muted-foreground">{s.poli} {s.practice_room ? `• ${s.practice_room}` : ''}</p>
                      </div>
                      <span className={`pill ${s.status === 'Hadir' ? 'pill-success' : s.status === 'Tidak Praktik' || s.status === 'Cuti' ? 'pill-critical' : 'pill-inactive'}`}>
                        {s.status || 'Dijadwalkan'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-muted/40 rounded p-1.5">
                        <p className="font-bold text-slate-700">{quota}</p>
                        <p className="text-[9px] text-muted-foreground">Kapasitas</p>
                      </div>
                      <div className="bg-muted/40 rounded p-1.5">
                        <p className="font-bold text-blue-600">{appts.length}</p>
                        <p className="text-[9px] text-muted-foreground">Terisi</p>
                      </div>
                      <div className="bg-muted/40 rounded p-1.5">
                        <p className="font-bold text-purple-600">{Math.max(0, quota - appts.length)}</p>
                        <p className="text-[9px] text-muted-foreground">Tersedia</p>
                      </div>
                      <div className="bg-muted/40 rounded p-1.5">
                        <p className="font-bold text-emerald-600">{done}</p>
                        <p className="text-[9px] text-muted-foreground">Selesai</p>
                      </div>
                    </div>
                    <div className="mt-2 rounded border border-border bg-muted/20 px-2.5 py-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>Daftar booking hari ini</span><span>{waiting} menunggu konfirmasi/layanan</span></div>
                      {appts.length === 0 ? <p className="text-[11px] text-muted-foreground">Belum ada booking pada sesi ini.</p> : (
                        <div className="space-y-1">
                          {appts.map((appointment) => <div key={appointment.id} className="flex items-center justify-between gap-2 text-[11px]"><span className="min-w-0 truncate">{appointment.time_slot || '-'} · {appointment.patient_name || 'Pasien'}</span><span className="pill pill-info text-[9px]">{appointment.status || 'Terjadwalkan'}</span></div>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'minggu' && (
        <div className="panel overflow-x-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-1 hover:bg-muted rounded"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-medium">
              {weekOffset === 0 ? 'Minggu Ini' : weekOffset > 0 ? `+${weekOffset} Minggu` : `${Math.abs(weekOffset)} Minggu lalu`}
            </span>
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-1 hover:bg-muted rounded"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <table className="w-full text-xs min-w-[700px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-2 py-2 text-left micro-label">Hari</th>
                <th className="px-2 py-2 text-left micro-label">Jadwal</th>
                <th className="px-2 py-2 text-center micro-label">Booking</th>
                <th className="px-2 py-2 text-center micro-label">Selesai</th>
                <th className="px-2 py-2 text-center micro-label">Slot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {weekDates.map(d => {
                const dayName = dayNames[d.getDay()];
                const dateStr = d.toISOString().split('T')[0];
                const dayScheds = schedules.filter(s => s.day_of_week === dayName);
                const dayAppts = appointments.filter(a => a.appointment_date === dateStr);
                return (
                  <tr key={dateStr} className={`hover:bg-slate-50/50 ${dateStr === todayDate ? 'bg-primary/5' : ''}`}>
                    <td className="px-2 py-2">
                      <p className="font-medium">{dayName}</p>
                      <p className="text-[10px] text-muted-foreground">{d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                    </td>
                    <td className="px-2 py-2">
                      {dayScheds.length > 0 ? dayScheds.map(s => (
                        <div key={s.id} className="text-[11px]">
                          {s.start_time}–{s.end_time} <span className="text-muted-foreground">{s.poli}</span>
                        </div>
                      )) : <span className="text-muted-foreground text-[11px]">Libur</span>}
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-blue-600">{dayAppts.length}</td>
                    <td className="px-2 py-2 text-center font-medium text-emerald-600">{dayAppts.filter(a => a.status === 'Selesai').length}</td>
                    <td className="px-2 py-2 text-center font-medium text-purple-600">{Math.max(0, (dayScheds[0]?.daily_quota || 20) - dayAppts.length)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'kalender' && (
        <div className="panel p-4">
          <p className="text-xs text-muted-foreground text-center">Tampilan kalender bulanan — gunakan tab Mingguan untuk detail per hari</p>
          <div className="grid grid-cols-7 gap-1 mt-3">
            {DAYS.map(d => <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d.slice(0, 3)}</div>)}
            {weekDates.map(d => {
              const dayName = dayNames[d.getDay()];
              const hasSchedule = schedules.some(s => s.day_of_week === dayName);
              const dateStr = d.toISOString().split('T')[0];
              const apptCount = appointments.filter(a => a.appointment_date === dateStr).length;
              return (
                <div key={dateStr} className={`panel min-h-[72px] p-1.5 ${dateStr === todayDate ? 'border-primary ring-1 ring-primary/20' : ''}`}>
                  <p className="text-[10px] font-medium text-muted-foreground">{d.getDate()}</p>
                  {hasSchedule ? <p className="mt-1 rounded bg-primary/10 px-1 py-0.5 text-center text-[8px] font-medium text-primary">Praktik</p> : <p className="mt-1 text-center text-[8px] text-muted-foreground">Libur</p>}
                  {apptCount > 0 && <p className="mt-1 text-center text-[9px] font-medium text-blue-600">{apptCount} booking</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Change Requests */}
      {changeRequests.length > 0 && (
        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /> Pengajuan Perubahan</h3>
          </div>
          <div className="divide-y divide-border">
            {changeRequests.map(r => (
              <div key={r.id} className="px-3 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{r.request_type} — {new Date(r.affected_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.reason || 'Tanpa alasan'}</p>
                  {r.impacted_count > 0 && <p className="text-[10px] text-amber-600">{r.impacted_count} pasien terdampak</p>}
                </div>
                <span className={`pill ${r.status === 'Disetujui' ? 'pill-success' : r.status === 'Ditolak' ? 'pill-critical' : 'pill-warning'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showChangeForm && (
        <ScheduleChangeForm doctorName={doctorName} doctorId={doctorId} onClose={() => setShowChangeForm(false)} onSubmit={submitChange} />
      )}
    </div>
  );
}

function ScheduleChangeForm({ doctorName, doctorId, onClose, onSubmit }) {
  const [form, setForm] = useState({
    request_type: 'Tidak Praktik',
    affected_date: new Date().toISOString().split('T')[0],
    affected_date_end: '',
    reason: '',
    new_start_time: '',
    new_end_time: '',
  });
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  // Auto-preview when date changes
  useEffect(() => {
    if (!form.affected_date) { setPreviewResult(null); return; }
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await db.functions.invoke('submitScheduleChange', {
          doctor_id: doctorId,
          doctor_name: doctorName,
          request_type: form.request_type,
          affected_date: form.affected_date,
          affected_date_end: form.affected_date_end || undefined,
          preview: true,
        });
        setPreviewResult(res.data || res);
      } catch { setPreviewResult(null); }
      setPreviewLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.affected_date, form.affected_date_end, form.request_type, doctorId, doctorName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="text-sm font-semibold">Ajukan Perubahan Jadwal</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Jenis Pengajuan</label>
            <select value={form.request_type} onChange={e => setForm(f => ({ ...f, request_type: e.target.value }))} className={inputCls}>
              <option>Tidak Praktik</option>
              <option>Ubah Jadwal</option>
              <option>Tambah Jadwal</option>
              <option>Cuti/Izin</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tanggal</label>
              <input type="date" value={form.affected_date} onChange={e => setForm(f => ({ ...f, affected_date: e.target.value }))} className={inputCls} required />
            </div>
            {(form.request_type === 'Cuti/Izin') && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Sampai</label>
                <input type="date" value={form.affected_date_end} onChange={e => setForm(f => ({ ...f, affected_date_end: e.target.value }))} className={inputCls} />
              </div>
            )}
          </div>
          {form.request_type === 'Ubah Jadwal' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Jam Baru Mulai</label>
                <input type="time" value={form.new_start_time} onChange={e => setForm(f => ({ ...f, new_start_time: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Jam Baru Selesai</label>
                <input type="time" value={form.new_end_time} onChange={e => setForm(f => ({ ...f, new_end_time: e.target.value }))} className={inputCls} />
              </div>
            </div>
          )}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Alasan</label>
            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inputCls} rows={3} placeholder="Alasan pengajuan…" />
          </div>

          {/* Impact Preview */}
          {previewLoading && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-1">
              <div className="w-3 h-3 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /> Mengecek pasien terjadwal…
            </div>
          )}
          {!previewLoading && previewResult && (
            <div className={`rounded border p-2.5 ${previewResult.impacted_count > 0 ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-200'}`}>
              {previewResult.impacted_count > 0 ? (
                <>
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> {previewResult.impacted_count} pasien terjadwal pada tanggal ini
                  </p>
                  <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                    {previewResult.impacted_appointments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-amber-800">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">{a.time_slot || '-'}</span>
                        <span className="truncate">{a.patient_name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1.5">Admin akan dinotifikasi & pasien akan dihubungi untuk reschedule.</p>
                </>
              ) : (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tidak ada pasien terjadwal pada tanggal ini
                </p>
              )}
            </div>
          )}

          <button onClick={() => onSubmit(form)} className="w-full btn-primary py-2 rounded text-xs font-medium flex items-center justify-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Kirim Pengajuan
          </button>
        </div>
      </div>
    </div>
  );
}
