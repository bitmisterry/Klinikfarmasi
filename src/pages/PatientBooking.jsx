const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Calendar, Stethoscope, Clock, MapPin, Check } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function PatientBooking() {
  const [patient, setPatient] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedSched, setSelectedSched] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const user = await db.auth.me();
        const patients = await db.entities.Patient.filter({ user_id: user.id }) || [];
        if (patients.length > 0) {
          setPatient(patients[0]);
          const [scheds, appts] = await Promise.all([
            db.entities.DoctorSchedule.filter({ is_active: true }) || [],
            db.entities.Appointment.filter({ patient_id: patients[0].id, status: 'Terjadwalkan' }) || [],
          ]);
          setSchedules(scheds); setAppointments(appts);
        }
      } catch {}
    };
    load();
  }, []);

  const handleBook = async () => {
    if (!patient || !selectedSched) return;
    setBooking(true);
    try {
      const dayIdx = DAYS.indexOf(selectedSched.day_of_week);
      const today = new Date();
      const todayIdx = (today.getDay() + 6) % 7;
      let daysUntil = (dayIdx - todayIdx + 7) % 7;
      if (daysUntil === 0) {
        const [hh, mm] = selectedSched.start_time.split(':').map(Number);
        const slotTime = new Date(); slotTime.setHours(hh, mm, 0, 0);
        if (slotTime <= today) daysUntil = 7;
      }
      const apptDate = new Date(today);
      apptDate.setDate(today.getDate() + daysUntil);
      const dateStr = apptDate.toISOString().split('T')[0];

      await db.entities.Appointment.create({
        patient_id: patient.id,
        patient_name: patient.full_name,
        patient_user_id: patient.user_id,
        doctor_id: selectedSched.doctor_id,
        doctor_name: selectedSched.doctor_name,
        appointment_date: dateStr,
        time_slot: selectedSched.start_time,
        poli: selectedSched.poli,
        status: 'Terjadwalkan',
        source: 'Portal',
        notes,
      });
      toast({ title: 'Janji temu berhasil dibuat', description: `${selectedSched.doctor_name} • ${dateStr} ${selectedSched.start_time}` });
      setShowConfirm(false); setSelectedSched(null); setNotes('');
      const appts = await db.entities.Appointment.filter({ patient_id: patient.id, status: 'Terjadwalkan' }) || [];
      setAppointments(appts);
    } catch (e) {
      toast({ title: 'Gagal membuat janji', description: e.message, variant: 'destructive' });
    }
    setBooking(false);
  };

  const cancelAppt = async (id) => {
    try {
      await db.entities.Appointment.update(id, { status: 'Dibatalkan' });
      setAppointments(prev => prev.filter(a => a.id !== id));
      toast({ title: 'Janji temu dibatalkan' });
    } catch {}
  };

  if (!patient) return <div className="max-w-md mx-auto mt-20 p-6 panel text-center"><p className="text-sm">Akun belum terhubung ke rekam medis. Hubungi admin.</p></div>;

  const byDay = DAYS.map(day => ({
    day,
    slots: schedules.filter(s => s.day_of_week === day && s.status !== 'Izin' && s.status !== 'Sakit'),
  }));

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Booking Janji Temu</h1>
      <p className="text-xs text-muted-foreground">Pilih jadwal praktek dokter yang tersedia untuk membuat janji temu.</p>

      {appointments.length > 0 && (
        <div className="space-y-2">
          <p className="micro-label">Janji Temu Saya</p>
          {appointments.map(a => (
            <div key={a.id} className="panel p-3 flex items-center gap-3">
              <div className="text-center px-2">
                <p className="text-sm font-bold text-primary">{new Date(a.appointment_date).getDate()}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(a.appointment_date).toLocaleDateString('id-ID', { month: 'short' })}</p>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium">{a.doctor_name}</p>
                <p className="text-[11px] text-muted-foreground">{a.poli} • {a.time_slot}</p>
              </div>
              <span className="pill pill-success">{a.status}</span>
              <button onClick={() => cancelAppt(a.id)} className="text-[11px] text-rose-600 hover:bg-rose-50 px-2 py-1 rounded">Batalkan</button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {byDay.map(({ day, slots }) => (
          <div key={day}>
            <p className="micro-label mb-1.5">{day}</p>
            {slots.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1.5">Tidak ada dokter praktek</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {slots.map(s => (
                  <button key={s.id} onClick={() => { setSelectedSched(s); setShowConfirm(true); setNotes(''); }}
                    className="panel p-3 text-left hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded bg-primary/10 text-primary flex items-center justify-center">
                        <Stethoscope className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs font-medium">{s.doctor_name}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {s.start_time}-{s.end_time}</span>
                      <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {s.poli}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showConfirm && selectedSched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowConfirm(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold mb-2">Konfirmasi Janji Temu</h2>
            <div className="space-y-1.5 text-xs mb-3">
              <p><span className="text-muted-foreground">Dokter:</span> {selectedSched.doctor_name}</p>
              <p><span className="text-muted-foreground">Poli:</span> {selectedSched.poli}</p>
              <p><span className="text-muted-foreground">Hari:</span> {selectedSched.day_of_week}, {selectedSched.start_time}-{selectedSched.end_time}</p>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Keluhan singkat (opsional)…" className="w-full px-2 py-1.5 border border-border rounded text-xs mb-3 outline-none focus:border-primary" rows={2} />
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-3 py-2 border border-border rounded text-xs font-medium hover:bg-muted">Batal</button>
              <button onClick={handleBook} disabled={booking} className="flex-1 btn-primary py-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> {booking ? 'Memproses…' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}