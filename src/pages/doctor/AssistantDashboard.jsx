// @ts-nocheck -- Intake dashboard consumes migrated queue/visit variants.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Home, Save, AlertCircle, ArrowLeft, CheckCircle,
  HeartPulse, ClipboardList, CheckCircle2
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/doctorContext';
import { getClinicRole } from '@/lib/roles';
import { getExamTemplate } from '@/lib/examTemplates';
import { HomeGreeting, TaskChecklist, HomePanel } from '@/components/home/HomeParts';
import RoleWorkflowGuide from '@/components/RoleWorkflowGuide';

const VITAL_FIELDS = [
  { key: 'bp', label: 'Tekanan Darah', type: 'text', placeholder: '120/80' },
  { key: 'temp', label: 'Suhu (°C)', type: 'number', step: '0.1' },
  { key: 'pulse', label: 'Nadi', type: 'number' },
  { key: 'rr', label: 'Frekuensi Napas', type: 'number' },
  { key: 'spo2', label: 'SpO₂ (%)', type: 'number' },
  { key: 'weight', label: 'Berat Badan (kg)', type: 'number', step: '0.1' },
  { key: 'height', label: 'Tinggi Badan (cm)', type: 'number' },
  { key: 'head_circumference', label: 'Lingkar Kepala', type: 'number', step: '0.1' },
];

const hasRecordedVitals = (queueEntry) => Boolean(
  queueEntry?.vital_signs_recorded_at
  || queueEntry?.vital_signs_recorded_by
  || queueEntry?.vital_signs_bp
  || queueEntry?.vital_signs_temp
  || queueEntry?.vital_signs_pulse
  || queueEntry?.vital_signs_weight,
);

const queueTimestamp = (queueEntry) => {
  const values = [queueEntry?.created_date, queueEntry?.arrival_time, queueEntry?.check_in_time, queueEntry?.called_time, queueEntry?.visit_date];
  return values.map((value) => Date.parse(value || '')).find(Number.isFinite) ?? 0;
};

const sortQueueNewestFirst = (entries) => [...(entries || [])].sort((left, right) => {
  const timeDiff = queueTimestamp(right) - queueTimestamp(left);
  if (timeDiff !== 0) return timeDiff;
  return String(right?.queue_number || right?.id || '').localeCompare(
    String(left?.queue_number || left?.id || ''),
    'id',
    { numeric: true },
  );
});

export default function AssistantDashboard() {
  const [searchParams] = useSearchParams();
  const requestedQueueId = searchParams.get('queue');
  const { user } = useAuth();
  const { toast } = useToast();
  const { doctorUserId, doctorProfile, isAssistant } = useDoctorContext();
  const doctorName = doctorProfile?.display_name || doctorProfile?.full_name || 'Dokter';
  const specialization = doctorProfile?.specialization;
  const doctorId = doctorUserId;
  const clinicRole = getClinicRole(user);
  const isNurse = clinicRole === 'Perawat';

  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState(null);
  const [examTemplate, setExamTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [followups, setFollowups] = useState([]);

  useEffect(() => {
    if (doctorId || isNurse) loadQueue();
  }, [doctorId, isNurse, requestedQueueId]);

  useEffect(() => {
    if (doctorId) {
      db.entities.DoctorProfile.filter({ user_id: doctorId })
        .then(profiles => { const profile = (profiles || [])[0]; if (profile) setExamTemplate(getExamTemplate(profile)); })
        .catch(() => {});
    }
  }, [doctorId]);

  const visibleVitals = examTemplate?.visible_vital_fields || ['bp', 'temp', 'pulse', 'rr', 'spo2', 'weight', 'height', 'head_circumference'];

  const loadQueue = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const queueFilter = isNurse
        ? { status: { $in: ['Menunggu Intake', 'Siap Dokter'] } }
        : { doctor_id: doctorId, status: { $in: ['Menunggu Intake', 'Siap Dokter'] } };
      const [q, fbs] = await Promise.all([
        db.entities.QueueEntry.filter(queueFilter, 'created_date', 50),
        db.entities.MedicalRecord.filter({ doctor_id: doctorId, follow_up_date: { $gte: todayStr } }, 'follow_up_date', 10).catch(() => []),
      ]);
      let queueRows = q || [];
      // A task can be opened directly from the dashboard. If the first filtered
      // request does not contain that row (for example during a status refresh),
      // reload the requested entry so the click still opens the intended patient.
      if (requestedQueueId && !queueRows.some((item) => item.id === requestedQueueId)) {
        const requested = await db.entities.QueueEntry.get(requestedQueueId).catch(() => null);
        const canOpenRequested = requested
          && ['Menunggu Intake', 'Siap Dokter'].includes(requested.status)
          && (isNurse || requested.doctor_id === doctorId);
        if (canOpenRequested) queueRows = [requested, ...queueRows];
      }
      const orderedQueue = sortQueueNewestFirst(queueRows);
      setQueue(orderedQueue);
      setFollowups(fbs || []);
      const requestedQueue = orderedQueue.find((item) => item.id === requestedQueueId);
      if (requestedQueue) await selectPatient(requestedQueue);
    } catch (e) { console.error(e); }
  };

  const selectPatient = async (q) => {
    setSelected(q);
    setVitals({
      vital_signs_bp: q.vital_signs_bp || '', vital_signs_temp: q.vital_signs_temp || '',
      vital_signs_pulse: q.vital_signs_pulse || '', vital_signs_rr: q.vital_signs_rr || '',
      vital_signs_spo2: q.vital_signs_spo2 || '',
      vital_signs_weight: q.vital_signs_weight || '', vital_signs_height: q.vital_signs_height || '',
      vital_signs_head_circumference: q.vital_signs_head_circumference || '',
      complaint: q.complaint || '', priority: q.priority || false,
      allergy: q.allergy || '', allergy_verified: Boolean(q.allergy_verified),
      sterile_equipment_ready: Boolean(q.sterile_equipment_ready), room_ready: Boolean(q.room_ready),
    });
    if (q.patient_id) {
      try {
        const p = await db.entities.Patient.get(q.patient_id);
        setPatient(p);
        setVitals(current => ({ ...current, allergy: current.allergy || p?.allergies || '' }));
      } catch { setPatient(null); }
    } else { setPatient(null); }
  };

  const setV = (k, v) => setVitals(s => ({ ...s, [k]: v }));

  const saveVitals = async () => {
    if (!selected) return;
    if (!vitals.complaint?.trim()) {
      toast({ title: 'Keluhan awal wajib diisi', variant: 'destructive' });
      return;
    }
    if (!vitals.vital_signs_bp && !vitals.vital_signs_temp) {
      toast({ title: 'Isi minimal tekanan darah atau suhu pasien', variant: 'destructive' });
      return;
    }
    if (!vitals.allergy_verified || !vitals.sterile_equipment_ready || !vitals.room_ready) {
      toast({ title: 'Verifikasi alergi, alat steril, dan kesiapan ruang terlebih dahulu', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await db.functions.invoke('saveIntake', { queue_entry_id: selected.id, ...vitals });
      // Kirim pemberitahuan ke dokter
      await db.entities.Notification.create({
        target_user_id: selected.doctor_id || doctorId,
        target_role: 'Dokter',
        from_user_id: user?.id,
        from_user_name: user?.full_name || 'Asisten',
        from_role: isNurse ? 'Perawat' : 'Asisten Dokter',
        type: 'persiapan_pasien',
        title: `Pasien siap diperiksa: ${selected.patient_name}`,
        body: `Vital sign & keluhan sudah diinput oleh asisten. ${selected.queue_number} — ${vitals.complaint || 'tidak ada keluhan'}.`,
        priority: 'Normal',
        related_entity: 'QueueEntry',
        related_id: selected.id,
        status: 'Baru',
      }).catch(() => {});
      toast({ title: 'Pasien siap diperiksa', description: `Pemberitahuan terkirim ke ${selected.doctor_name || doctorName}` });
      await loadQueue();
      setSelected(null); setVitals(null);
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const inputCls = "w-full px-3 py-2 border border-border rounded text-body outline-none focus:border-primary";
  const age = patient?.birth_date ? Math.floor((new Date() - new Date(patient.birth_date)) / (365 * 24 * 60 * 60 * 1000)) : null;
  const pendingIntake = queue.filter((q) => !hasRecordedVitals(q));

  const dataTasks = pendingIntake.slice(0, 4).map(q => ({
    id: `prep-${q.id}`,
    label: `Siapkan pasien ${q.patient_name}`,
    to: `${isNurse ? '/nurse/intake' : '/doctor/assistant'}?queue=${encodeURIComponent(q.id)}`,
  }));
  const staticTasks = [
    ...followups.slice(0, 2).map(f => ({ id: `fu-${f.id}`, label: `Hubungi ${f.patient_name} untuk kontrol ${f.follow_up_date}` })),
    { id: 'konfirmasi-jadwal', label: 'Konfirmasi jadwal dokter' },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName={isNurse ? 'Perawat / Intake' : `Asisten ${doctorName}`} />
      <RoleWorkflowGuide role="Perawat" visit={selected} />

      {!selected ? (
        <>
          <HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas hari ini">
            <TaskChecklist storageKey={`assistant_${doctorId}`} dataTasks={dataTasks} staticTasks={staticTasks} />
          </HomePanel>

          <HomePanel icon={Home} title="Pasien untuk Persiapan" subtitle={`${pendingIntake.length} pasien perlu disiapkan`}>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {pendingIntake.length === 0 && <div className="px-3 py-8 text-center"><CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-caption">Tidak ada pasien yang perlu disiapkan</p></div>}
              {pendingIntake.map(q => (
                <button key={q.id} onClick={() => selectPatient(q)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors">
                  <span className="text-caption font-mono font-semibold text-primary w-12">{q.queue_number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-medium truncate">{q.patient_name}</p>
                    <p className="text-caption truncate">{q.complaint || q.visit_type}</p>
                  </div>
                  <span className="pill pill-warning">Perlu Disiapkan</span>
                </button>
              ))}
            </div>
          </HomePanel>
        </>
      ) : (
        <div className="panel max-w-2xl mx-auto">
          {/* Patient Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelected(null); setVitals(null); }} className="p-1.5 hover:bg-muted rounded">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                {selected.patient_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-section-title truncate">{selected.patient_name}</h2>
                <p className="text-caption">{selected.queue_number} • {age !== null ? `${age} th` : ''} {patient?.gender === 'L' ? 'L' : patient?.gender === 'P' ? 'P' : ''}</p>
              </div>
              {patient?.allergies && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-md text-rose-700">
                  <AlertCircle className="w-3.5 h-3.5" /><span className="text-caption font-medium">{patient.allergies}</span>
                </div>
              )}
            </div>
            {selected.vital_signs_recorded_by && (
              <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded text-caption text-emerald-700">
                <CheckCircle className="w-3 h-3" /> Vital sign sudah diinput oleh: {selected.vital_signs_recorded_by}
              </div>
            )}
          </div>

          {/* Form: Persiapan Pasien */}
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-section-title mb-2">Persiapan Pasien</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-caption block mb-1">Keluhan Awal</label>
                  <input value={vitals.complaint || ''} onChange={e => setV('complaint', e.target.value)} className={inputCls} placeholder="Keluhan pasien..." />
                </div>
                <div>
                  <label className="text-caption block mb-1">Alergi yang Dilaporkan Pasien</label>
                  <input value={vitals.allergy || ''} onChange={e => setV('allergy', e.target.value)} className={inputCls} placeholder="Tidak ada / nama obat atau bahan" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={vitals.priority || false} onChange={e => setV('priority', e.target.checked)} className="rounded" />
                  <span className="text-body">Pasien prioritas (lansia / difabel / urgensi)</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded border border-border p-2.5 bg-muted/20">
                  <label className="flex items-center gap-2 cursor-pointer text-caption"><input type="checkbox" checked={vitals.allergy_verified || false} onChange={e => setV('allergy_verified', e.target.checked)} /> Alergi diverifikasi</label>
                  <label className="flex items-center gap-2 cursor-pointer text-caption"><input type="checkbox" checked={vitals.sterile_equipment_ready || false} onChange={e => setV('sterile_equipment_ready', e.target.checked)} /> Alat steril siap</label>
                  <label className="flex items-center gap-2 cursor-pointer text-caption"><input type="checkbox" checked={vitals.room_ready || false} onChange={e => setV('room_ready', e.target.checked)} /> Ruang siap</label>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-section-title mb-2 flex items-center gap-1.5"><HeartPulse className="w-4 h-4 text-rose-500" /> Tanda Vital</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {VITAL_FIELDS.filter(f => visibleVitals.includes(f.key)).map(f => (
                  <div key={f.key}>
                    <label className="text-caption block mb-1">{f.label}</label>
                    <input
                      type={f.type} step={f.step}
                      value={vitals[`vital_signs_${f.key}`] ?? ''}
                      onChange={e => setV(`vital_signs_${f.key}`, f.type === 'number' ? +e.target.value : e.target.value)}
                      className={inputCls} placeholder={f.placeholder || ''}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="px-4 py-3 border-t border-border">
            <button onClick={saveVitals} disabled={saving} className="w-full btn-primary py-3 rounded-md text-body font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4" /> Siap Diperiksa Dokter</>}
            </button>
            <p className="text-caption text-center mt-1.5">Pemberitahuan akan dikirim ke {doctorName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
