const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle2, ClipboardList, AlertTriangle, UserPlus, ClipboardPlus, HeartPulse, Stethoscope, CalendarClock, UsersRound } from 'lucide-react';

import { HomeGreeting, TodayGrid, AttentionList, TaskChecklist, HomePanel } from '@/components/home/HomeParts';

export default function FrontDeskHome({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [queue, appointments] = await Promise.all([
          db.entities.QueueEntry.filter({ visit_date: today }, 'created_date', 50).catch(() => []),
          db.entities.Appointment.filter({ appointment_date: today }, 'time_slot', 50).catch(() => []),
        ]);
        setData({ queue: queue || [], appointments: appointments || [] });
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
    const unsubscribeQueue = db.entities.QueueEntry.subscribe(load);
    const unsubscribeAppointments = db.entities.Appointment.subscribe(load);
    return () => { unsubscribeQueue(); unsubscribeAppointments(); };
  }, []);

  if (loading || !data) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;

  const waiting = data.queue.filter(q => q.status === 'Menunggu');
  const called = data.queue.filter(q => q.status === 'Dipanggil');
  const waitingIntake = data.queue.filter(q => q.status === 'Menunggu Intake' || q.status === 'Siap Dokter');
  const inService = data.queue.filter(q => q.status === 'Pemeriksaan');
  const priority = waiting.filter(q => q.priority);
  const pendingAppointments = data.appointments.filter(a => ['Terjadwalkan', 'Dijadwalkan', 'Pending'].includes(a.status || 'Pending'));
  const doctorVisits = data.queue.reduce((groups, queue) => {
    const key = queue.doctor_id || queue.doctor_name || 'unassigned';
    const group = groups[key] || { doctor_name: queue.doctor_name || 'Dokter belum ditentukan', poli: queue.loket || '-', total: 0 };
    group.total += 1;
    groups[key] = group;
    return groups;
  }, {});

  const attention = [
    ...(priority.length > 0 ? [{ dot: 'red', text: `${priority.length} pasien prioritas menunggu`, to: '/queue' }] : []),
    ...(waiting.length > 5 ? [{ dot: 'yellow', text: `${waiting.length} pasien menunggu — antrean panjang`, to: '/queue' }] : []),
  ];

  const dataTasks = waiting.slice(0, 4).map(q => ({ id: `q-${q.id}`, label: `Panggil ${q.patient_name} (${q.queue_number})`, to: '/queue' }));
  const staticTasks = [
    { id: 'konfirmasi-janji', label: `Tinjau ${pendingAppointments.length} janji temu`, to: '/front-desk' },
    { id: 'cetak-kartu', label: 'Cetak kartu antrean', to: '/queue' },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <HomeGreeting user={user} roleName="Front Office" />
        <div className="flex items-center gap-2">
          <a href="/patients?action=new" className="px-3 py-2 border border-border rounded-md text-xs font-medium hover:bg-muted flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" /> Pasien Baru</a>
          <a href="/queue?action=new" className="btn-primary px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1.5"><ClipboardPlus className="w-3.5 h-3.5" /> Daftar Kunjungan</a>
        </div>
      </div>

      <div>
        <h2 className="text-section-title mb-2.5">Antrean & Pendaftaran</h2>
        <TodayGrid stats={[
          { icon: Clock, label: 'Menunggu', value: waiting.length },
          { icon: Users, label: 'Dipanggil', value: called.length },
          { icon: HeartPulse, label: 'Intake / Siap', value: waitingIntake.length },
          { icon: Stethoscope, label: 'Diperiksa', value: inService.length },
        ]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HomePanel icon={Clock} title="Pasien Menunggu" to="/queue" actionLabel="Kelola">
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {waiting.length === 0 && <div className="px-3 py-8 text-center"><CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-caption">Tidak ada yang menunggu</p></div>}
            {waiting.map(q => (
              <div key={q.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-caption font-mono font-semibold text-primary w-12">{q.queue_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate">{q.patient_name}</p>
                  <p className="text-caption truncate">{q.loket || '-'} • {q.doctor_name || 'Dokter belum ditentukan'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{q.complaint || q.visit_type}</p>
                </div>
                {q.priority && <span className="pill pill-critical">Prioritas</span>}
              </div>
            ))}
          </div>
        </HomePanel>

        <div className="space-y-4">
          <HomePanel icon={AlertTriangle} title="Perlu Perhatian">
            <AttentionList items={attention} />
          </HomePanel>
          <HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas hari ini">
            <TaskChecklist storageKey="frontdesk" dataTasks={dataTasks} staticTasks={staticTasks} />
          </HomePanel>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HomePanel icon={CalendarClock} title="Janji Temu Hari Ini" to="/front-desk" actionLabel="Konfirmasi">
          <div className="divide-y divide-border max-h-56 overflow-y-auto">
            {data.appointments.length === 0 && <div className="px-3 py-8 text-center"><CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-caption">Belum ada janji temu</p></div>}
            {data.appointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center gap-2 px-3 py-2.5 text-xs">
                <CalendarClock className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{appointment.patient_name || 'Pasien'}</p><p className="text-[10px] text-muted-foreground truncate">{appointment.time_slot || '-'} • {appointment.poli || '-'} • {appointment.doctor_name || '-'}</p></div>
                <span className={`pill ${['Dikonfirmasi', 'Hadir'].includes(appointment.status) ? 'pill-success' : 'pill-warning'}`}>{appointment.status || 'Pending'}</span>
              </div>
            ))}
          </div>
        </HomePanel>

        <HomePanel icon={UsersRound} title="Kunjungan per Dokter" to="/front-desk" actionLabel="Lihat detail">
          <div className="divide-y divide-border max-h-56 overflow-y-auto">
            {Object.keys(doctorVisits).length === 0 && <div className="px-3 py-8 text-center"><p className="text-caption">Belum ada kunjungan hari ini</p></div>}
            {Object.values(doctorVisits).map((group) => <div key={`${group.doctor_name}-${group.poli}`} className="flex items-center gap-2 px-3 py-2.5 text-xs"><div className="flex-1 min-w-0"><p className="font-medium truncate">{group.doctor_name}</p><p className="text-[10px] text-muted-foreground truncate">{group.poli}</p></div><span className="pill pill-info">{group.total} pasien</span></div>)}
          </div>
        </HomePanel>
      </div>

      <div className="panel p-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div><p className="text-sm font-semibold">Alur serah-terima kunjungan</p><p className="text-[11px] text-muted-foreground">Satu Visit dan Patient ID yang sama dipakai di setiap role.</p></div>
          <a href="/front-desk" className="text-xs text-primary font-medium">Buka Front Desk →</a>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {[
            ['1', 'Front Office', 'Cari pasien, pilih poli & dokter terjadwal'],
            ['2', 'Pemanggilan', 'Konfirmasi hadir, serahkan ke intake'],
            ['3', 'Perawat', 'Keluhan, alergi, vital & kesiapan ruang'],
            ['4', 'Dokter tujuan', 'Terima pasien lalu mulai pemeriksaan'],
          ].map(([step, title, detail]) => <div key={step} className="rounded-md border border-border p-2.5"><span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">{step}</span><p className="font-semibold mt-1.5">{title}</p><p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{detail}</p></div>)}
        </div>
      </div>
    </div>
  );
}
