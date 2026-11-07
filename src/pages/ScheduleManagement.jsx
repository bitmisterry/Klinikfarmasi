const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Save, Calendar, Clock, Users } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

const SHIFTS = ['Pagi', 'Siang', 'Malam', 'Lengkap'];
const STATUSES = ['Dijadwalkan', 'Hadir', 'Izin', 'Sakit', 'Cuti', 'Seminar', 'Alpa'];
const SHIFT_COLORS = {
  Pagi: 'bg-amber-50 text-amber-700 border-amber-200',
  Siang: 'bg-blue-50 text-blue-700 border-blue-200',
  Malam: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Lengkap: 'bg-teal-50 text-teal-700 border-teal-200',
};
const STATUS_COLORS = {
  Dijadwalkan: 'pill-inactive', Hadir: 'pill-success',
  Izin: 'pill-warning', Sakit: 'pill-warning', Cuti: 'pill-warning',
  Seminar: 'pill-info', Alpa: 'pill-critical',
};

function getWeekStart(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
}

function emptyForm() {
  return { staff_id: '', staff_name: '', role: '', shift_date: '', shift: 'Pagi', start_time: '08:00', end_time: '16:00', status: 'Dijadwalkan', notes: '' };
}

export default function ScheduleManagement() {
  const [staff, setStaff] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = getClinicRole(user) === 'Owner';

  useEffect(() => { load(); }, [weekStart]);

  const load = async () => {
    try {
      const [st, sc] = await Promise.all([
        db.entities.Staff.filter({ is_active: true }),
        db.entities.Schedule.list(),
      ]);
      setStaff(st || []);
      setSchedules(sc || []);
    } catch {}
    setLoading(false);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
  const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const getSchedulesFor = (staffId, date) => schedules.filter(s => s.staff_id === staffId && s.shift_date === date);

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d.toISOString().split('T')[0]); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d.toISOString().split('T')[0]); };
  const thisWeek = () => setWeekStart(getWeekStart(new Date()));

  const startAdd = (staffId, staffName, role, date) => {
    setEditing(null);
    setForm({ ...emptyForm(), staff_id: staffId, staff_name: staffName, role, shift_date: date });
    setShowForm(true);
  };
  const startEdit = (s) => { setEditing(s); setForm({ ...s }); setShowForm(true); };

  const save = async () => {
    if (!form.staff_id || !form.shift_date) { toast({ title: 'Staff & tanggal wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editing) { await db.entities.Schedule.update(editing.id, form); toast({ title: 'Jadwal diperbarui' }); }
      else { await db.entities.Schedule.create(form); toast({ title: 'Jadwal ditambahkan' }); }
      setShowForm(false); load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const quickStatus = async (s, status) => {
    try { await db.entities.Schedule.update(s.id, { status }); toast({ title: `Status: ${status}` }); load(); }
    catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const remove = async (s) => {
    try { await db.entities.Schedule.delete(s.id); toast({ title: 'Jadwal dihapus' }); load(); }
    catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  const weekSchedules = schedules.filter(s => weekDays.includes(s.shift_date));
  const totalShifts = weekSchedules.length;
  const hadirCount = weekSchedules.filter(s => s.status === 'Hadir').length;
  const attendanceRate = totalShifts > 0 ? Math.round((hadirCount / totalShifts) * 100) : 0;

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Manajemen Jadwal Shift</h1>
        <div className="flex items-center gap-1">
          <button onClick={prevWeek} className="p-1.5 hover:bg-muted rounded border border-border"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={thisWeek} className="px-3 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted">Hari Ini</button>
          <button onClick={nextWeek} className="p-1.5 hover:bg-muted rounded border border-border"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5 text-blue-600" /><p className="micro-label">Total Shift Minggu Ini</p></div>
          <p className="text-base font-semibold text-blue-600">{totalShifts}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-emerald-600" /><p className="micro-label">Hadir</p></div>
          <p className="text-base font-semibold text-emerald-600">{hadirCount} / {totalShifts}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-amber-600" /><p className="micro-label">Tingkat Kehadiran</p></div>
          <p className="text-base font-semibold text-amber-600">{attendanceRate}%</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {new Date(weekStart).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} — {new Date(weekDays[6]).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <div className="panel overflow-x-auto">
        <table className="w-full text-xs min-w-[800px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left">
              <th className="px-3 py-2 micro-label sticky left-0 bg-muted/50 z-10">Staff</th>
              {weekDays.map((d, i) => (
                <th key={d} className="px-2 py-2 micro-label text-center min-w-[110px]">
                  {dayLabels[i]}<br />
                  <span className="text-[10px] font-normal text-muted-foreground">{new Date(d).getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {staff.map(s => (
              <tr key={s.id} className="row-hover">
                <td className="px-3 py-2 font-medium sticky left-0 bg-card z-10">
                  <div>{s.full_name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.role}</div>
                </td>
                {weekDays.map(d => {
                  const cellSchedules = getSchedulesFor(s.id, d);
                  return (
                    <td key={d} className="px-1.5 py-1.5 align-top">
                      <div className="space-y-1">
                        {cellSchedules.map(sc => (
                          <div key={sc.id} className="group relative">
                            <button onClick={() => !isOwner && startEdit(sc)} className={`w-full text-left px-1.5 py-1 rounded border text-[10px] ${SHIFT_COLORS[sc.shift] || 'border-border'} ${isOwner ? 'cursor-default' : ''}`}>
                              <div className="font-medium">{sc.shift}</div>
                              <div className="text-[9px] opacity-70">{sc.start_time}–{sc.end_time}</div>
                              <span className={`pill ${STATUS_COLORS[sc.status] || 'pill-inactive'} text-[8px] px-1 py-0`}>{sc.status}</span>
                              {sc.notes && <div title={sc.notes} className="mt-1 text-[9px] leading-tight opacity-80 line-clamp-2">📝 {sc.notes}</div>}
                            </button>
                            {!isOwner && <div className="flex gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => quickStatus(sc, 'Hadir')} className="text-[8px] px-1 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded" title="Hadir">✓</button>
                              <button onClick={() => quickStatus(sc, 'Izin')} className="text-[8px] px-1 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded" title="Izin">I</button>
                              <button onClick={() => quickStatus(sc, 'Alpa')} className="text-[8px] px-1 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded" title="Alpa">✗</button>
                              <button onClick={() => remove(sc)} className="text-[8px] px-1 py-0.5 bg-muted text-rose-500 border border-border rounded" title="Hapus"><X className="w-2 h-2" /></button>
                            </div>}
                          </div>
                        ))}
                        {!isOwner && <button onClick={() => startAdd(s.id, s.full_name, s.role, d)} className="w-full text-[10px] text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary rounded py-0.5">
                          + Shift
                        </button>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Memuat…</p>}
        {!loading && staff.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Belum ada staff aktif. Tambahkan staff di Manajemen SDM.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">{editing ? 'Edit Jadwal' : 'Tambah Jadwal'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Staff</label>
                <input value={form.staff_name} disabled className={inputCls + ' bg-muted'} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tanggal</label>
                  <input type="date" value={form.shift_date} onChange={e => set('shift_date', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Shift</label>
                  <select value={form.shift} onChange={e => set('shift', e.target.value)} className={inputCls + ' bg-card'}>
                    {SHIFTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Jam Mulai</label>
                  <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Jam Selesai</label>
                  <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls + ' bg-card'}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Catatan jadwal (mis. seminar, cuti, pengganti)</label>
                <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="px-3 py-2.5 border-t border-border flex justify-end gap-2">
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
