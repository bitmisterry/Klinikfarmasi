const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Wallet, TrendingDown, Receipt, AlertTriangle, ClipboardList } from 'lucide-react';

import { HomeGreeting, TodayGrid, AttentionList, TaskChecklist, HomePanel } from '@/components/home/HomeParts';

export default function FinanceHome({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const in7 = new Date(); in7.setDate(in7.getDate() + 7);
        const in7Str = in7.toISOString().split('T')[0];
        const [txns, invoices, expenses, priceAnomalies] = await Promise.all([
          db.entities.Transaction.filter({ transaction_date: today, payment_status: 'Lunas' }).catch(() => []),
          db.entities.SupplierInvoice.filter({ status: { $ne: 'Lunas' } }, 'due_date', 50).catch(() => []),
          db.entities.Expense.filter({ expense_date: today }).catch(() => []),
          db.entities.Anomaly.filter({ status: 'Baru', type: { $in: ['price_below_minimum', 'price_below_target', 'old_stock_high_hpp', 'supplier_price_change_significant'] } }, '-detected_at', 20).catch(() => []),
        ]);
        setData({ txns: txns || [], invoices: invoices || [], expenses: expenses || [], priceAnomalies: priceAnomalies || [] });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading || !data) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;

  const today = new Date().toISOString().split('T')[0];
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().split('T')[0];
  const todayIn = data.txns.reduce((s, t) => s + (t.total || 0), 0);
  const todayOut = data.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const overdueInvoices = data.invoices.filter(i => i.due_date && i.due_date < today);
  const dueSoon = data.invoices.filter(i => i.due_date && i.due_date >= today && i.due_date <= in7Str);
  const totalPayable = data.invoices.reduce((s, i) => s + ((i.total_amount || 0) - (i.paid_amount || 0)), 0);

  const attention = [
    ...(overdueInvoices.length > 0 ? [{ dot: 'red', text: `${overdueInvoices.length} faktur sudah jatuh tempo`, to: '/purchasing' }] : []),
    ...((data.priceAnomalies || []).length > 0 ? [{ dot: 'red', text: `${(data.priceAnomalies || []).length} harga jual di bawah batas aman`, to: '/kontrol-usaha' }] : []),
    ...(dueSoon.length > 0 ? [{ dot: 'yellow', text: `${dueSoon.length} faktur jatuh tempo ≤7 hari`, to: '/purchasing' }] : []),
  ];

  const dataTasks = overdueInvoices.slice(0, 3).map(i => ({ id: `inv-${i.id}`, label: `Bayar faktur ${i.invoice_number}`, to: '/purchasing' }));
  const staticTasks = [
    { id: 'rekonsiliasi-bulanan', label: 'Rekonsiliasi bulanan' },
    { id: 'laporan-arus-kas', label: 'Buat laporan arus kas' },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName="Finance" />

      <div>
        <h2 className="text-section-title mb-2.5">Hari Ini</h2>
        <TodayGrid stats={[
          { icon: Wallet, label: 'Uang Masuk', value: `Rp ${(todayIn / 1000000).toFixed(1)}jt` },
          { icon: TrendingDown, label: 'Uang Keluar', value: `Rp ${(todayOut / 1000000).toFixed(1)}jt` },
          { icon: Receipt, label: 'Utang Belum Bayar', value: `Rp ${(totalPayable / 1000000).toFixed(1)}jt` },
          { icon: AlertTriangle, label: 'Faktur Jatuh Tempo', value: overdueInvoices.length + dueSoon.length },
        ]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HomePanel icon={Receipt} title="Utang & Piutang" to="/purchasing" actionLabel="Kelola">
          <div className="p-3 space-y-2">
            {data.invoices.length === 0 && <p className="text-caption text-center py-4">Tidak ada utang outstanding</p>}
            {data.invoices.slice(0, 5).map(i => (
              <div key={i.id} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-md">
                <div className="min-w-0">
                  <p className="text-body font-medium truncate">{i.supplier_name}</p>
                  <p className="text-caption">{i.invoice_number} • jatuh tempo {i.due_date || '-'}</p>
                </div>
                <span className="text-body font-medium shrink-0 ml-2">Rp {((i.total_amount || 0) - (i.paid_amount || 0)).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </HomePanel>

        <div className="space-y-4">
          <HomePanel icon={AlertTriangle} title="Perlu Perhatian">
            <AttentionList items={attention} />
          </HomePanel>
          <HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas hari ini">
            <TaskChecklist storageKey="finance" dataTasks={dataTasks} staticTasks={staticTasks} />
          </HomePanel>
        </div>
      </div>
    </div>
  );
}