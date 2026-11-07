const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Clock, Users, CheckCircle2, CalendarDays, ClipboardList, AlertTriangle, Bell, RotateCcw } from 'lucide-react';

import { useDoctorContext } from '@/lib/doctorContext';
import { TodayGrid, TaskChecklist, HomePanel } from '@/components/home/HomeParts';

export default function DoctorHome({ user }) {
  const { doctorUserId, doctorProfile, isAssistant } = useDoctorContext();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [allToday, setAllToday] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [patientDetails, setPatientDetails] = useState({});
  const [recentRecords, setRecentRecords] = useState([]);
  const [scheduleAlerts, setScheduleAlerts] = useState([]);
  const [returnedRxList, setReturnedRxList] = useState([]);
  const [loading, setLoading] = useState(true);

  const doctorName = doctorProfile?.display_name || doctorProfile?.full_name || user?.full_name || 'Dokter';
  const doctorId = doctorUserId;

  useEffect(() => {
    if (!doctorId) return;
    (async () => {
      try {
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const todayDay = dayNames[new Date().getDay()];
        const todayStr = new Date().toISOString().split('T')[0];
        const [qRaw, todayAll, scheds, ownRecords, notifications, allReturnedRx] = await Promise.all([
          // Only today's assigned episode may enter the doctor's active queue.
          // Without visit_date here, old visits in "Pemeriksaan" inflate the
          // dashboard count and can appear as if they still need service.
          db.entities.QueueEntry.filter({ doctor_id: doctorId, visit_date: todayStr, status: { $in: ['Siap Dokter', 'Pemeriksaan', 'Perlu Revisi Dokter', 'Dikembalikan ke Dokter'] } }, 'created_date', 50),
          db.entities.QueueEntry.filter({ doctor_id: doctorId, visit_date: todayStr }, 'created_date', 100).catch(() => []),
          db.entities.DoctorSchedule.filter({ doctor_id: doctorId, is_active: true }).catch(() => []),
          db.entities.MedicalRecord.filter({ doctor_id: doctorId }, '-visit_date', 100).catch(() => []),
          db.entities.Notification.filter({ target_role: 'Dokter', is_read: false }, '-created_date', 20).catch(() => []),
          db.entities.Prescription.filter({ returned_to_doctor: true }).catch(() => []),
        ]);
        const returnedPrescriptions = (allReturnedRx || []).filter((rx) =>
          !rx.doctor_id || rx.doctor_id === doctorId || rx.doctor_name === doctorName || (user?.id && rx.doctor_id === user.id)
        );
        let q = qRaw || [];
        // Ensure any returned prescription queue entries are present
        for (const rx of returnedPrescriptions) {
          let entry = null;
          if (rx.queue_entry_id) {
            entry = await db.entities.QueueEntry.get(rx.queue_entry_id).catch(() => null);
          }
          if (!entry && rx.visit_id) {
            const vQueues = await db.entities.QueueEntry.filter({ visit_id: rx.visit_id }).catch(() => []);
            entry = vQueues[0] || null;
          }
          if (!entry && rx.patient_id) {
            const pQueues = await db.entities.QueueEntry.filter({ patient_id: rx.patient_id }).catch(() => []);
            entry = pQueues[0] || null;
          }
          if (entry) {
            if (!entry.return_reason && rx.return_reason) {
              entry.return_reason = rx.return_reason;
            }
            if (entry.status !== 'Perlu Revisi Dokter' && entry.status !== 'Dikembalikan ke Dokter') {
              entry.status = 'Perlu Revisi Dokter';
            }
            if (!q.some((item) => item.id === entry.id)) {
              q.push(entry);
            }
          }
        }
        const detailRows = await Promise.all((q || []).map((item) => item.patient_id ? db.entities.Patient.get(item.patient_id).catch(() => null) : null));
        setQueue(q || []);
        setReturnedRxList(returnedPrescriptions);
        setAllToday(todayAll || []);
        setSchedule((scheds || []).filter(s => s.day_of_week === todayDay));
        setPatientDetails(Object.fromEntries(detailRows.filter(Boolean).map((patient) => [patient.id, patient])));
        setRecentRecords(ownRecords || []);
        setScheduleAlerts((notifications || []).filter((item) => item.type === 'schedule_change' || /jadwal|batal|reschedule/i.test(`${item.title || ''} ${item.body || ''}`)));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [doctorId, doctorName, user?.id]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;

  const needsRevision = queue.filter(q =>
    q.status === 'Perlu Revisi Dokter' ||
    q.status === 'Dikembalikan ke Dokter' ||
    returnedRxList.some(rx => rx.queue_entry_id === q.id || (rx.visit_id && rx.visit_id === q.visit_id) || (rx.patient_id && rx.patient_id === q.patient_id))
  );
  const unlinkedReturnedRx = (returnedRxList || []).filter(rx =>
    !needsRevision.some(q => q.id === rx.queue_entry_id || (rx.visit_id && q.visit_id === rx.visit_id) || (rx.patient_id && q.patient_id === rx.patient_id))
  );
  const waiting = queue.filter(q => q.status === 'Siap Dokter' && !needsRevision.some(nr => nr.id === q.id));
  const inExam = queue.filter(q => q.status === 'Pemeriksaan' && !needsRevision.some(nr => nr.id === q.id));
  const done = allToday.filter(q => ['Selesai Periksa', 'Di Apotek', 'Kasir', 'Selesai'].includes(q.status));
  const nextPatient = needsRevision[0] || waiting[0] || inExam[0];
  const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const minutesNow = new Date().getHours() * 60 + new Date().getMinutes();
  const toMinutes = (time) => { const [hour = 0, minute = 0] = String(time || '00:00').split(':').map(Number); return hour * 60 + minute; };
  const nextPatientProfile = patientDetails[nextPatient?.patient_id];
  const nextPatientHistory = recentRecords.find((record) => record.patient_id === nextPatient?.patient_id);
  const activeAllergy = String(nextPatientProfile?.allergies || '').trim();
  const hasRecordedAllergy = activeAllergy && !/^(tidak ada|none|-|n\/?a)$/i.test(activeAllergy);
  const explicitArrivalAt = nextPatient?.check_in_time || nextPatient?.arrival_time || nextPatient?.called_time || null;
  const waitStartedAt = explicitArrivalAt || nextPatient?.created_date;
  const waitStartLabel = explicitArrivalAt ? 'Datang' : 'Masuk antrean';
  const waitMinutes = waitStartedAt ? Math.max(0, Math.floor((Date.now() - new Date(waitStartedAt).getTime()) / 60000)) : null;

  // Dashboard tasks must represent real workflow work. Static localStorage
  // checkboxes were misleading because they did not create or update any
  // clinical status, order, or notification.
  const dataTasks = [
    ...needsRevision.map(q => ({
      id: `rev-${q.id}`,
      label: `Revisi resep dokter: ${q.patient_name}`,
      subtitle: q.return_reason || 'Resep dikembalikan oleh apoteker untuk disesuaikan',
      badge: 'Perlu Revisi',
      to: `/doctor/exam?queue=${q.id}&tab=resep`,
    })),
    ...unlinkedReturnedRx.map(rx => ({
      id: `rev-rx-${rx.id}`,
      label: `Revisi resep dokter: ${rx.patient_name}`,
      subtitle: rx.return_reason || 'Resep dikembalikan oleh apoteker untuk disesuaikan',
      badge: 'Perlu Revisi',
      to: `/doctor/exam?rx=${rx.id}&tab=resep`,
    })),
    ...waiting.slice(0, 4).map(q => ({ id: `q-${q.id}`, label: `Periksa ${q.patient_name}`, to: `/doctor/exam?queue=${q.id}` })),
    ...inExam.slice(0, 4).map(q => ({ id: `exam-${q.id}`, label: `Lanjutkan pemeriksaan ${q.patient_name}`, to: `/doctor/exam?queue=${q.id}` })),
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-page-title">Ringkasan praktik hari ini</h1>
        <p className="text-caption mt-0.5">{dateStr}</p>
      </div>

      <div>
        <h2 className="text-section-title mb-2.5">Pasien Saya Hari Ini</h2>
        <TodayGrid stats={[
          ...(needsRevision.length ? [{ icon: RotateCcw, label: 'Perlu Revisi', value: needsRevision.length }] : []),
          { icon: Clock, label: 'Menunggu', value: waiting.length },
          { icon: Stethoscope, label: 'Diperiksa', value: inExam.length },
          { icon: CheckCircle2, label: 'Selesai', value: done.length },
          ...(!needsRevision.length ? [{ icon: Users, label: 'Total', value: allToday.length }] : []),
        ]} />
      </div>

      {nextPatient && (
        <div className={`panel border-l-4 p-4 ${(nextPatient.status === 'Perlu Revisi Dokter' || nextPatient.status === 'Dikembalikan ke Dokter') ? 'border-l-amber-500 bg-amber-50/20' : 'border-l-primary'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold shrink-0 ${(nextPatient.status === 'Perlu Revisi Dokter' || nextPatient.status === 'Dikembalikan ke Dokter') ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
              {nextPatient.patient_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-section-title">{nextPatient.patient_name}</p>
                {(nextPatient.status === 'Perlu Revisi Dokter' || nextPatient.status === 'Dikembalikan ke Dokter') && (
                  <span className="pill pill-warning font-semibold text-[10px]">Perlu Revisi Resep</span>
                )}
              </div>
              <p className="text-caption mt-0.5">{nextPatient.queue_number} • {nextPatient.complaint || nextPatient.visit_type}</p>
              {waitStartedAt && <p className="mt-1 text-[11px] text-amber-700">{waitStartLabel} {new Date(waitStartedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · menunggu {waitMinutes} menit</p>}
            </div>
              <button onClick={() => navigate(`/doctor/exam?queue=${nextPatient.id}&tab=${(nextPatient.status === 'Perlu Revisi Dokter' || nextPatient.status === 'Dikembalikan ke Dokter') ? 'resep' : 'tindakan'}`)} className="btn-primary px-5 py-2.5 rounded-md text-body font-medium flex items-center gap-2 shrink-0">
              <Stethoscope className="w-4 h-4" /> {(nextPatient.status === 'Perlu Revisi Dokter' || nextPatient.status === 'Dikembalikan ke Dokter') ? 'Revisi Resep Pasien' : nextPatient.status === 'Pemeriksaan' ? 'Lanjutkan Pemeriksaan' : 'Mulai Pemeriksaan'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HomePanel icon={Clock} title="Antrean Saya" to="/doctor/exam" actionLabel="Buka">
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {queue.length === 0 && <div className="px-3 py-8 text-center"><CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-caption">Tidak ada antrean</p></div>}
            {queue.map(q => (
              <button key={q.id} onClick={() => navigate(`/doctor/exam?queue=${q.id}&tab=${(q.status === 'Perlu Revisi Dokter' || q.status === 'Dikembalikan ke Dokter') ? 'resep' : 'tindakan'}`)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors">
                <span className="text-caption font-mono font-semibold text-primary w-12">{q.queue_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate">{q.patient_name}</p>
                  <p className="text-caption truncate">{q.complaint || q.visit_type}</p>
                  {(q.called_time || q.check_in_time || q.arrival_time || q.created_date) && <p className="text-[10px] text-amber-700">{q.check_in_time || q.arrival_time || q.called_time ? 'Datang' : 'Masuk antrean'} {new Date(q.check_in_time || q.arrival_time || q.called_time || q.created_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
                <span className={`pill ${
                  (q.status === 'Perlu Revisi Dokter' || q.status === 'Dikembalikan ke Dokter')
                    ? 'pill-warning font-semibold'
                    : q.status === 'Pemeriksaan'
                      ? 'pill-info'
                      : 'pill-inactive'
                }`}>
                  {(q.status === 'Perlu Revisi Dokter' || q.status === 'Dikembalikan ke Dokter')
                    ? 'Perlu Revisi'
                    : q.status}
                </span>
              </button>
            ))}
          </div>
        </HomePanel>

        <HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas hari ini">
          <TaskChecklist storageKey={`doctor_${doctorId}`} dataTasks={dataTasks} />
        </HomePanel>
      </div>

      {nextPatient && (nextPatientHistory || nextPatientProfile) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HomePanel icon={ClipboardList} title="Konteks kunjungan sebelumnya">
            <div className="p-3 text-xs">
              {nextPatientHistory ? <><p className="font-medium">{nextPatientHistory.diagnosis || 'Diagnosis belum dicatat'}</p><p className="mt-1 text-muted-foreground">{nextPatientHistory.chief_complaint ? `Keluhan sebelumnya: ${nextPatientHistory.chief_complaint}` : 'Keluhan sebelumnya tidak tersedia'}</p><p className="mt-1 text-muted-foreground">{nextPatientHistory.treatment_plan || nextPatientHistory.physical_exam || 'Tidak ada ringkasan tambahan.'}</p></> : <p className="text-muted-foreground">Belum ada riwayat pemeriksaan oleh dokter ini.</p>}
            </div>
          </HomePanel>
          <HomePanel icon={AlertTriangle} title="Alergi & peringatan medis">
            <div className="p-3 text-xs">{hasRecordedAllergy ? <p className="font-medium text-rose-700">Alergi tercatat: {activeAllergy}</p> : <p className="text-muted-foreground">Tidak ada alergi yang tercatat. Tetap verifikasi saat pemeriksaan awal.</p>}</div>
          </HomePanel>
        </div>
      )}

      {schedule.length > 0 && (
        <HomePanel icon={CalendarDays} title="Jadwal Hari Ini" to="/doctor/schedule" actionLabel="Jadwal">
          <div className="divide-y divide-border">
            {schedule.map(s => {
              const active = minutesNow >= toMinutes(s.start_time) && minutesNow < toMinutes(s.end_time);
              const remaining = Math.max(0, toMinutes(s.end_time) - minutesNow);
              return <div key={s.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-body font-medium">{s.start_time}–{s.end_time}</p>
                  <p className="text-caption">{s.poli}{active ? ` · berlangsung, sisa ${Math.floor(remaining / 60)}j ${remaining % 60}m` : minutesNow < toMinutes(s.start_time) ? ' · akan datang' : ' · sesi berakhir'}</p>
                </div>
                <span className={`pill ${active || s.status === 'Hadir' ? 'pill-success' : 'pill-inactive'}`}>{active ? 'Berlangsung' : s.status || 'Dijadwalkan'}</span>
              </div>
            })}
          </div>
        </HomePanel>
      )}

      {scheduleAlerts.length > 0 && (
        <HomePanel icon={Bell} title="Perubahan jadwal & pembatalan" to="/doctor/requests" actionLabel="Buka notifikasi">
          <div className="divide-y divide-border">{scheduleAlerts.slice(0, 3).map((alert) => <div key={alert.id} className="px-3 py-2.5 text-xs"><p className="font-medium">{alert.title}</p><p className="mt-0.5 text-muted-foreground">{alert.body}</p></div>)}</div>
        </HomePanel>
      )}
    </div>
  );
}
