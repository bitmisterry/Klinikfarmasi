const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, Pill, AlertTriangle, ClipboardList } from 'lucide-react';

import { HomeGreeting, TodayGrid, AttentionList, TaskChecklist, HomePanel } from '@/components/home/HomeParts';

export default function DefaultHome({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [queue, meds, prescriptions, anomalies] = await Promise.all([
          db.entities.QueueEntry.filter({ visit_date: today }, 'created_date', 50).catch(() => []),
          db.entities.Medicine.list().catch(() => []),
          db.entities.Prescription.filter({ prescription_date: today }).catch(() => []),
          db.entities.Anomaly.filter({ status: 'Baru' }, '-detected_at', 10).catch(() => []),
        ]);
        setData({ queue: queue || [], meds: meds || [], prescriptions: prescriptions || [], anomalies: anomalies || [] });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading || !data) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;

  const waiting = data.queue.filter(q => q.status === 'Menunggu');
  const done = data.queue.filter(q => q.status === 'Selesai');
  const lowStock = data.meds.filter(m => (m.stock_on_hand || 0) <= (m.min_stock || 0) && (m.stock_on_hand || 0) > 0);
  const stockOut = data.meds.filter(m => (m.stock_on_hand || 0) <= 0);

  const attention = [
    ...(stockOut.length > 0 ? [{ dot: 'red', text: `${stockOut.length} obat stok habis`, to: '/inventory' }] : []),
    ...(lowStock.length > 0 ? [{ dot: 'yellow', text: `${lowStock.length} obat hampir habis`, to: '/inventory' }] : []),
    ...(data.anomalies.length > 0 ? [{ dot: 'red', text: `${data.anomalies.length} hal perlu diperiksa`, to: '/kontrol-usaha' }] : []),
  ];

  const dataTasks = waiting.slice(0, 4).map(q => ({ id: `q-${q.id}`, label: `Bantu pasien ${q.patient_name}`, to: '/queue' }));
  const staticTasks = [{ id: 'cek-antrean', label: 'Cek antrean harian' }];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName={user?.data?.clinic_role || 'Staff'} />

      <div>
        <h2 className="text-section-title mb-2.5">Hari Ini</h2>
        <TodayGrid stats={[
          { icon: Clock, label: 'Menunggu', value: waiting.length },
          { icon: Users, label: 'Selesai', value: done.length },
          { icon: Pill, label: 'Resep', value: data.prescriptions.length },
          { icon: AlertTriangle, label: 'Obat Hampir Habis', value: lowStock.length + stockOut.length },
        ]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HomePanel icon={AlertTriangle} title="Perlu Perhatian">
          <AttentionList items={attention} />
        </HomePanel>
        <HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas hari ini">
          <TaskChecklist storageKey="staff" dataTasks={dataTasks} staticTasks={staticTasks} />
        </HomePanel>
      </div>

      <HomePanel icon={ClipboardList} title="Akses Cepat">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3">
          {[
            { label: 'Antrean', to: '/queue' },
            { label: 'Pasien', to: '/patients' },
            { label: 'Farmasi', to: '/pharmacy' },
            { label: 'Komunikasi', to: '/comms' },
          ].map(q => (
            <Link key={q.to} to={q.to} className="panel px-3 py-2.5 hover:bg-muted transition-colors text-center text-body font-medium">{q.label}</Link>
          ))}
        </div>
      </HomePanel>
    </div>
  );
}