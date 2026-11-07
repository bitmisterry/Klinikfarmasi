const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Wallet, CreditCard, AlertTriangle, ClipboardList } from 'lucide-react';

import { HomeGreeting, TodayGrid, AttentionList, TaskChecklist, HomePanel } from '@/components/home/HomeParts';

export default function KasirHome({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [txns, cashSessions, queue] = await Promise.all([
          db.entities.Transaction.filter({ transaction_date: today }, '-created_date', 100).catch(() => []),
          db.entities.CashSession.filter({ status: 'Aktif' }).catch(() => []),
          db.entities.QueueEntry.filter({ status: 'Kasir' }).catch(() => []),
        ]);
        const sessions = cashSessions || [];
        const ownSession = sessions.find((session) => session.opened_by === user?.id)
          || (user?.id?.startsWith('demo-') ? sessions[0] : null);
        setData({ txns: txns || [], cashSessions: ownSession ? [ownSession] : [], queue: queue || [] });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  if (loading || !data) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;

  const unpaid = data.txns.filter(t => t.payment_status === 'Belum Bayar');
  const paid = data.txns.filter(t => t.payment_status === 'Lunas');
  const refund = data.txns.filter(t => t.payment_status === 'Refund' || t.payment_status === 'Void');
  const todayOmzet = paid.reduce((s, t) => s + (t.total || 0), 0);
  const activeSession = data.cashSessions[0] || null;
  const cashSales = data.txns
    .filter((t) => activeSession && (t.cash_session_id === activeSession.id || (!t.cash_session_id && t.paid_at && activeSession.opened_at && new Date(t.paid_at) >= new Date(activeSession.opened_at))) && t.payment_status === 'Lunas' && t.payment_method === 'Tunai')
    .reduce((s, t) => s + Number(t.total || 0), 0);
  const expectedCash = activeSession ? Number(activeSession.opening_cash || 0) + cashSales : 0;

  const attention = [
    ...(activeSession ? [{ dot: 'yellow', text: 'Kas hari ini belum ditutup', to: '/kasir' }] : []),
    ...(refund.length > 0 ? [{ dot: 'red', text: `${refund.length} transaksi void/refund`, to: '/kasir' }] : []),
    ...(data.queue.length > 0 ? [{ dot: 'yellow', text: `${data.queue.length} pasien menunggu di kasir`, to: '/kasir' }] : []),
  ];

  const dataTasks = unpaid.slice(0, 4).map(t => ({ id: `tx-${t.id}`, label: `Tagih ${t.invoice_number} — ${t.patient_name || 'Walk-in'}`, to: '/kasir' }));
  const staticTasks = [
    { id: 'tutup-kas', label: 'Tutup kas hari ini' },
    { id: 'rekonsiliasi', label: 'Rekonsiliasi transaksi' },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName="Kasir" />

      <div>
        <h2 className="text-section-title mb-2.5">Tagihan Hari Ini</h2>
        <TodayGrid stats={[
          { icon: Receipt, label: 'Belum Bayar', value: unpaid.length },
          { icon: Wallet, label: 'Lunas', value: paid.length },
          { icon: CreditCard, label: 'Penerimaan Hari Ini', value: `Rp ${(todayOmzet / 1000000).toFixed(1)}jt` },
          { icon: Wallet, label: 'Saldo Kas Ekspektasi', value: activeSession ? `Rp ${(expectedCash / 1000000).toFixed(1)}jt` : 'Belum dibuka' },
        ]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HomePanel icon={AlertTriangle} title="Perlu Perhatian">
          <AttentionList items={attention} />
        </HomePanel>
        <HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas hari ini">
          <TaskChecklist storageKey="kasir" dataTasks={dataTasks} staticTasks={staticTasks} />
        </HomePanel>
      </div>

      <HomePanel icon={Receipt} title="Akses Cepat" to="/kasir" actionLabel="Buka Kasir">
        <div className="grid grid-cols-1 gap-2 p-3">
          {[
            { label: 'Kasir', to: '/kasir' },
          ].map(q => (
            <Link key={q.to} to={q.to} className="panel px-3 py-2.5 hover:bg-muted transition-colors text-center text-body font-medium">{q.label}</Link>
          ))}
        </div>
      </HomePanel>
    </div>
  );
}
