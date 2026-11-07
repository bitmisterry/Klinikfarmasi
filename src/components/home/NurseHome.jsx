const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock, Home, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/lib/AuthContext';
import { HomeGreeting, HomePanel, TodayGrid } from '@/components/home/HomeParts';
import RoleWorkflowGuide from '@/components/RoleWorkflowGuide';

const hasVitals = (queue) => Boolean(
  queue?.vital_signs_recorded_at
  || queue?.vital_signs_recorded_by
  || queue?.vital_signs_bp
  || queue?.vital_signs_temp
  || queue?.vital_signs_pulse
  || queue?.vital_signs_weight
);

const queueTimestamp = (queue) => {
  const values = [queue?.created_date, queue?.arrival_time, queue?.check_in_time, queue?.called_time, queue?.visit_date];
  return values.map((value) => Date.parse(value || '')).find(Number.isFinite) ?? 0;
};

const sortNewestFirst = (entries) => [...(entries || [])].sort((left, right) => {
  const timeDiff = queueTimestamp(right) - queueTimestamp(left);
  if (timeDiff !== 0) return timeDiff;
  return String(right?.queue_number || right?.id || '').localeCompare(
    String(left?.queue_number || left?.id || ''),
    'id',
    { numeric: true },
  );
});

export default function NurseHome() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const records = await db.entities.QueueEntry.filter(
          { visit_date: today, status: { $in: ['Menunggu Intake', 'Siap Dokter'] } },
          'created_date', 50,
        );
        setQueue(sortNewestFirst(records));
      } catch {
        setQueue([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const waiting = queue.filter((item) => !hasVitals(item));
  const ready = queue.filter((item) => hasVitals(item));

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName="Perawat / Intake" />
      <RoleWorkflowGuide role="Perawat" />

      <div>
        <h2 className="text-section-title mb-2.5">Ringkasan Persiapan Pasien</h2>
        <TodayGrid stats={[
          { icon: Clock, label: 'Menunggu Intake', value: waiting.length },
          { icon: CheckCircle2, label: 'Siap ke Dokter', value: ready.length },
          { icon: Users, label: 'Pasien Dipantau', value: queue.length },
          { icon: ClipboardCheck, label: 'Akses Rekam Medis', value: 'Read-only' },
        ]} />
      </div>

      <HomePanel icon={ClipboardCheck} title="Antrean Persiapan" subtitle={`${waiting.length} pasien perlu disiapkan`}>
        {loading ? (
          <div className="px-3 py-8 text-center text-caption">Memuat antrean persiapan…</div>
        ) : queue.length === 0 ? (
          <div className="px-3 py-8 text-center"><CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" /><p className="text-body text-emerald-700">Tidak ada pasien yang perlu dipersiapkan.</p></div>
        ) : (
          <div className="divide-y divide-border">
            {waiting.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-14 text-caption font-mono font-semibold text-primary">{item.queue_number || '-'}</span>
                <div className="flex-1 min-w-0"><p className="text-body font-medium truncate">{item.patient_name}</p><p className="text-caption truncate">{item.complaint || item.visit_type || 'Kunjungan klinik'}</p></div>
                <span className={`pill ${hasVitals(item) ? 'pill-success' : 'pill-warning'}`}>{hasVitals(item) ? 'Siap' : 'Perlu Intake'}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-border px-3 py-2.5 flex justify-end"><Link to="/nurse/intake" className="text-caption text-primary flex items-center gap-1 font-medium">Buka Intake Perawat <ArrowRight className="w-3 h-3" /></Link></div>
      </HomePanel>

      <HomePanel icon={Home} title="Batasan Akses Perawat" subtitle="Data dan tindakan yang tersedia pada role ini">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 text-caption">
          <div className="rounded border border-border p-2.5"><p className="font-medium">Boleh input</p><p className="text-muted-foreground mt-0.5">Keluhan, alergi, vital sign, dan kesiapan ruang/alat steril.</p></div>
          <div className="rounded border border-border p-2.5"><p className="font-medium">Diteruskan</p><p className="text-muted-foreground mt-0.5">Data intake masuk ke antrean dokter pada Visit yang sama.</p></div>
          <div className="rounded border border-border p-2.5"><p className="font-medium">Tidak boleh</p><p className="text-muted-foreground mt-0.5">Diagnosis, resep, dan perubahan catatan dokter.</p></div>
        </div>
      </HomePanel>
    </div>
  );
}
