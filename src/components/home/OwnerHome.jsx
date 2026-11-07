const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Pill, Wallet, Package, AlertTriangle, Receipt, ShieldCheck } from 'lucide-react';

import { HomeGreeting, TodayGrid, AttentionList, TaskChecklist, HomePanel } from '@/components/home/HomeParts';
import OwnerChangeRequestPanel from '@/components/OwnerChangeRequestPanel';

export default function OwnerHome({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const in7 = new Date(); in7.setDate(in7.getDate() + 7);
        const in7Str = in7.toISOString().split('T')[0];
        const [txns, meds, anomalies, invoices, prescriptions, cashSessions, queue] = await Promise.all([
          db.entities.Transaction.filter({ payment_status: 'Lunas' }, '-created_date', 100).catch(() => []),
          db.entities.Medicine.list().catch(() => []),
          db.entities.Anomaly.filter({ status: 'Baru' }, '-detected_at', 20).catch(() => []),
          db.entities.SupplierInvoice.filter({ status: { $ne: 'Lunas' } }, 'due_date', 50).catch(() => []),
          db.entities.Prescription.filter({ status: { $in: ['Baru', 'Diresepkan', 'Dispensing'] } }).catch(() => []),
          db.entities.CashSession.filter({ status: 'Aktif' }).catch(() => []),
          db.entities.QueueEntry.filter({ visit_date: today }).catch(() => []),
        ]);
        setData({ txns: txns || [], meds: meds || [], anomalies: anomalies || [], invoices: invoices || [], prescriptions: prescriptions || [], cashSessions: cashSessions || [], queue: queue || [] });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading || !data) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;

  const today = new Date().toISOString().split('T')[0];
  const todayTxns = data.txns.filter(t => t.transaction_date === today);
  const todayOmzet = todayTxns.reduce((s, t) => s + (t.total || 0), 0);
  const lowStock = data.meds.filter(m => (m.stock_on_hand || 0) <= (m.min_stock || 0) && (m.stock_on_hand || 0) > 0);
  const stockOut = data.meds.filter(m => (m.stock_on_hand || 0) <= 0);
  const overdueInvoices = data.invoices.filter(i => i.due_date && i.due_date < today);
  const unpaidRx = data.prescriptions.filter(p => p.status !== 'Selesai Dispensing' && p.status !== 'Billed' && p.status !== 'Paid');
  const stockAnomalies = data.anomalies.filter(a => a.type.includes('stock') || a.type.includes('opname'));
  const priceAnomalies = data.anomalies.filter(a => a.type === 'price_below_minimum' || a.type === 'price_below_target' || a.type === 'old_stock_high_hpp');

  const attention = [
    ...(overdueInvoices.length > 0 ? [{ dot: 'red', text: `${overdueInvoices.length} faktur sudah jatuh tempo`, to: '/purchasing' }] : []),
    ...(priceAnomalies.length > 0 ? [{ dot: 'red', text: `${priceAnomalies.length} harga jual di bawah batas aman`, to: '/kontrol-usaha' }] : []),
    ...(lowStock.length > 0 ? [{ dot: 'yellow', text: `${lowStock.length} obat hampir habis`, to: '/kontrol-usaha' }] : []),
    ...(unpaidRx.length > 0 ? [{ dot: 'yellow', text: `${unpaidRx.length} resep belum selesai`, to: '/audit-log' }] : []),
    ...(stockAnomalies.length > 0 ? [{ dot: 'red', text: 'Selisih stok ditemukan', to: '/kontrol-usaha' }] : []),
    ...(data.cashSessions.length > 0 ? [{ dot: 'yellow', text: 'Kas hari ini belum ditutup', to: '/audit-log' }] : []),
  ];

  const dataTasks = [
    ...(data.anomalies.slice(0, 3).map(a => ({ id: `anomaly-${a.id}`, label: a.description, to: '/kontrol-usaha' }))),
    ...(overdueInvoices.slice(0, 2).map(i => ({ id: `inv-${i.id}`, label: `Faktur ${i.invoice_number} jatuh tempo`, to: '/purchasing' }))),
  ];
  const staticTasks = [
    { id: 'cek-laporan', label: 'Tinjau laporan harian', to: '/management' },
    { id: 'tinjau-kas', label: 'Tinjau status kas hari ini', to: '/finance' },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName="Owner" />

      <div className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-[11px] text-purple-800">
        <strong>Mode monitoring Owner:</strong> Anda dapat melihat indikator strategis, laporan, anomali, dan audit trail. Perubahan operasional diajukan melalui Admin agar pemisahan tugas dan jejak audit tetap terjaga.
      </div>

      <div>
        <h2 className="text-section-title mb-2.5">Hari Ini</h2>
        <TodayGrid stats={[
          { icon: Users, label: 'Pasien', value: data.queue.length, sub: 'kunjungan hari ini' },
          { icon: Pill, label: 'Resep', value: data.prescriptions.length, sub: 'diproses' },
          { icon: Wallet, label: 'Penjualan', value: `Rp ${(todayOmzet / 1000000).toFixed(1)}jt`, sub: `${todayTxns.length} transaksi` },
          { icon: Package, label: 'Obat Hampir Habis', value: lowStock.length + stockOut.length, sub: 'perlu restok' },
        ]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HomePanel icon={AlertTriangle} title="Perlu Perhatian" subtitle="Hal yang perlu Anda periksa">
          <AttentionList items={attention} />
        </HomePanel>
        <HomePanel icon={ShieldCheck} title="Yang Perlu Dikerjakan" subtitle="Tugas hari ini">
          <TaskChecklist storageKey="owner" dataTasks={dataTasks} staticTasks={staticTasks} />
        </HomePanel>
      </div>

      <OwnerChangeRequestPanel user={user} />

      <HomePanel icon={Receipt} title="Akses Cepat" to="/kontrol-usaha" actionLabel="Kontrol Usaha">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3">
          {[
            { label: 'Kontrol Usaha', to: '/kontrol-usaha' },
            { label: 'Utang & Piutang', to: '/purchasing' },
            { label: 'Keuangan', to: '/finance' },
            { label: 'Laporan', to: '/management' },
          ].map(q => (
            <Link key={q.to} to={q.to} className="panel px-3 py-2.5 hover:bg-muted transition-colors text-center text-body font-medium">{q.label}</Link>
          ))}
        </div>
      </HomePanel>
    </div>
  );
}
