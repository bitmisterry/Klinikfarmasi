// @ts-nocheck -- Management dashboards aggregate heterogeneous entities.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Wallet, CreditCard, Users, FileText, Pill, RefreshCw, Shield, Activity, ScrollText, CheckCircle2, ArrowRight, Banknote, FlaskConical, Save, Receipt, Calendar } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import AnomalyDetailDrawer from '@/components/AnomalyDetailDrawer';
import StaffAccessPanel from '@/components/StaffAccessPanel';
import EmptyState from '@/components/EmptyState';
import DoctorPerformanceReport from '@/components/DoctorPerformanceReport';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

export default function Management() {
  const [tab, setTab] = useState('owner');
  const [data, setData] = useState({ txns: [], meds: [], logs: [], expenses: [], prescriptions: [], queues: [], anomalies: [], users: [] });
  const [scanning, setScanning] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [racikanConfigs, setRacikanConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = getClinicRole(user) === 'Owner';

  const load = async () => {
    try {
      const [txns, meds, logs, expenses, prescriptions, queues, anomalies, racikanCfg, users] = await Promise.all([
        db.entities.Transaction.list(),
        db.entities.Medicine.list(),
        db.entities.AuditLog.list(),
        db.entities.Expense.list(),
        db.entities.Prescription.list(),
        db.entities.QueueEntry.list(),
        db.entities.Anomaly.filter({ status: 'Baru' }, '-detected_at', 50),
        db.entities.RacikanConfig.list(),
        db.entities.User.list().catch(() => []),
      ]);
      setData({
        txns: txns || [], meds: meds || [], logs: (logs || []).slice(0, 50),
        expenses: expenses || [], prescriptions: prescriptions || [],
        queues: queues || [], anomalies: anomalies || [], users: users || [],
      });
      setRacikanConfigs(racikanCfg || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayTxns = data.txns.filter(t => t.transaction_date === today && t.payment_status === 'Lunas');
  const todayRevenue = todayTxns.reduce((s, t) => s + (t.total || 0), 0);
  const todayCash = todayTxns.filter(t => t.payment_method === 'Tunai').reduce((s, t) => s + (t.total || 0), 0);
  const todayQris = todayTxns.filter(t => t.payment_method === 'QRIS' || t.payment_method === 'Debit' || t.payment_method === 'Transfer').reduce((s, t) => s + (t.total || 0), 0);
  const todayPatients = new Set(data.queues.filter(q => q.visit_date === today).map(q => q.patient_id)).size;
  const todayRx = data.prescriptions.filter(r => r.prescription_date === today).length;
  const todayMedsSold = todayTxns.reduce((s, t) => s + (t.items || []).reduce((ss, i) => ss + (i.quantity || 0), 0), 0);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await db.functions.invoke('runAnomalyScan', {});
      toast({ title: `Scan selesai: ${res.data?.created || 0} anomali baru terdeteksi` });
      load();
    } catch (e) {
      toast({ title: 'Gagal scan', description: e.message, variant: 'destructive' });
    }
    setScanning(false);
  };

  const resolveAnomaly = async (anomaly, status) => {
    try {
      await db.entities.Anomaly.update(anomaly.id, {
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: 'Owner',
      });
      toast({ title: `Anomali ${status === 'Diselesaikan' ? 'diselesaikan' : 'dielangkan'}` });
      load();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Owner Control & Anti-Blind-Spot</h1>
        {!isOwner && <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary-hover disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} /> {scanning ? 'Memindai…' : 'Scan Anomali'}
        </button>}
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {[
          { k: 'owner', l: 'Kontrol Hari Ini', icon: Shield },
          { k: 'reports', l: 'Laporan', icon: TrendingUp },
          { k: 'audit', l: 'Audit Trail', icon: ScrollText },
          ...(!isOwner ? [{ k: 'racikan', l: 'Konfigurasi Racikan', icon: FlaskConical }, { k: 'staff', l: 'Staff & Akses', icon: Users }] : []),
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.l}
          </button>
        ))}
      </div>

      {tab === 'owner' && (
        <div className="space-y-3">
          {/* Today's Summary */}
          <div>
            <p className="micro-label mb-2">Hari Ini — {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
              <MetricCard icon={Wallet} label="Omzet" value={`Rp ${todayRevenue.toLocaleString('id-ID')}`} color="text-emerald-600" />
              <MetricCard icon={Banknote} label="Cash" value={`Rp ${todayCash.toLocaleString('id-ID')}`} color="text-teal-600" />
              <MetricCard icon={CreditCard} label="QRIS/Transfer" value={`Rp ${todayQris.toLocaleString('id-ID')}`} color="text-blue-600" />
              <MetricCard icon={Users} label="Pasien" value={todayPatients} color="text-purple-600" />
              <MetricCard icon={FileText} label="Resep" value={todayRx} color="text-amber-600" />
              <MetricCard icon={Pill} label="Obat Terjual" value={`${todayMedsSold} unit`} color="text-rose-600" />
            </div>
          </div>

          {/* Anomalies — Need Your Attention */}
          <div className="panel border-l-2 border-l-rose-400">
            <div className="px-3 py-2.5 border-b border-border bg-rose-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2 text-rose-700">
                  <AlertTriangle className="w-4 h-4" /> {data.anomalies.length} Hal Perlu Diperiksa
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Klik untuk detail & bukti silang</p>
              </div>
              {data.anomalies.length > 0 && (
                <span className="pill pill-critical">{data.anomalies.filter(a => a.severity === 'critical').length} critical</span>
              )}
            </div>
            <div className="divide-y divide-border">
              {data.anomalies.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-emerald-600">Tidak ada anomali</p>
                  <p className="text-[11px] text-muted-foreground">Uang, transaksi & stok masuk akal</p>
                </div>
              )}
              {data.anomalies.map(a => {
                const Icon = ANOMALY_ICONS[a.type] || AlertTriangle;
                return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAnomaly(a)}
                  className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left"
                >
                  <div className={`w-7 h-7 rounded shrink-0 flex items-center justify-center ${
                    a.severity === 'critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.description}</p>
                    <p className="text-[11px] text-muted-foreground">{a.detected_at?.slice(0, 16).replace('T', ' ')}</p>
                  </div>
                  <span className={`pill ${a.severity === 'critical' ? 'pill-critical' : 'pill-warning'}`}>{a.severity}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-3">
          {/* Daily doctor performance report */}
          <DoctorPerformanceReport mode="all" />

          {/* Revenue breakdown by category */}
          <div className="panel">
            <div className="px-3 py-2.5 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Pendapatan per Kategori</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pemisahan penjualan obat, jasa dokter, dan pendapatan lain — semua transaksi lunas</p>
            </div>
            {(() => {
              const paid = data.txns.filter(t => t.payment_status === 'Lunas');
              const obatTypes = ['Apotek/POS', 'Resep', 'Bebas'];
              const obatRev = paid.filter(t => obatTypes.includes(t.type)).reduce((s, t) => s + ((t.subtotal || 0) - (t.discount || 0)), 0);
              const jasaRev = paid.reduce((s, t) => s + (t.consultation_fee || 0), 0);
              const lainRev = paid.filter(t => t.type === 'Pendapatan Lain').reduce((s, t) => s + (t.total || 0), 0) + paid.reduce((s, t) => s + (t.other_fees || 0), 0);
              const totalRev = obatRev + jasaRev + lainRev;
              const rows = [
                { label: 'Penjualan Obat', value: obatRev, color: 'text-teal-600', bg: 'bg-teal-50', icon: Pill },
                { label: 'Jasa Dokter', value: jasaRev, color: 'text-blue-600', bg: 'bg-blue-50', icon: Wallet },
                { label: 'Pendapatan Lain', value: lainRev, color: 'text-amber-600', bg: 'bg-amber-50', icon: CreditCard },
              ];
              return (
                <div className="divide-y divide-border">
                  {rows.map(r => {
                    const pct = totalRev > 0 ? Math.round((r.value / totalRev) * 100) : 0;
                    return (
                      <div key={r.label} className="px-3 py-3 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${r.bg} ${r.color} shrink-0`}><r.icon className="w-4 h-4" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">{r.label}</p>
                            <p className={`text-sm font-semibold ${r.color}`}>Rp {r.value.toLocaleString('id-ID')}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full ${r.color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="px-3 py-2.5 bg-muted/30 flex items-center justify-between">
                    <p className="text-xs font-semibold">Total Pendapatan</p>
                    <p className="text-sm font-bold text-emerald-600">Rp {totalRev.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Daily Consolidated Revenue Table */}
          <div className="panel">
            <div className="px-3 py-2.5 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Omzet Harian Konsolidasi</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Gabungan jasa dokter + penjualan obat + pendapatan lain per hari — semua transaksi lunas</p>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-muted/50 border-b border-border sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 micro-label">Tanggal</th>
                    <th className="px-3 py-2 micro-label text-right">Jasa Dokter</th>
                    <th className="px-3 py-2 micro-label text-right">Penjualan Obat</th>
                    <th className="px-3 py-2 micro-label text-right">Pendapatan Lain</th>
                    <th className="px-3 py-2 micro-label text-right">Total Omzet</th>
                    <th className="px-3 py-2 micro-label text-center">Trx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    const paid = data.txns.filter(t => t.payment_status === 'Lunas');
                    const byDate = {};
                    paid.forEach(t => {
                      const d = t.transaction_date || 'N/A';
                      if (!byDate[d]) byDate[d] = { date: d, jasa: 0, obat: 0, lain: 0, total: 0, count: 0 };
                      byDate[d].jasa += t.consultation_fee || 0;
                      byDate[d].obat += (t.subtotal || 0) - (t.discount || 0);
                      byDate[d].lain += (t.other_fees || 0) + (t.type === 'Pendapatan Lain' ? (t.total || 0) : 0);
                      byDate[d].total += t.total || 0;
                      byDate[d].count += 1;
                    });
                    const rows = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
                    const totals = rows.reduce((acc, r) => ({
                      jasa: acc.jasa + r.jasa, obat: acc.obat + r.obat, lain: acc.lain + r.lain, total: acc.total + r.total, count: acc.count + r.count
                    }), { jasa: 0, obat: 0, lain: 0, total: 0, count: 0 });
                    if (rows.length === 0) return <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Belum ada transaksi lunas</td></tr>;
                    return (
                      <>
                        {rows.map(r => (
                          <tr key={r.date} className="row-hover">
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{r.date !== 'N/A' ? new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</td>
                            <td className="px-3 py-2 text-right text-blue-600">{r.jasa > 0 ? `Rp ${r.jasa.toLocaleString('id-ID')}` : '-'}</td>
                            <td className="px-3 py-2 text-right text-teal-600">{r.obat > 0 ? `Rp ${r.obat.toLocaleString('id-ID')}` : '-'}</td>
                            <td className="px-3 py-2 text-right text-amber-600">{r.lain > 0 ? `Rp ${r.lain.toLocaleString('id-ID')}` : '-'}</td>
                            <td className="px-3 py-2 text-right font-semibold">Rp {r.total.toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2 text-center text-muted-foreground">{r.count}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted/40 border-t-2 border-border">
                          <td className="px-3 py-2.5 font-semibold">Total</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-blue-600">Rp {totals.jasa.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-teal-600">Rp {totals.obat.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-amber-600">Rp {totals.lain.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600">Rp {totals.total.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2.5 text-center font-semibold">{totals.count}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Consolidated transaction breakdown table */}
          <div className="panel">
            <div className="px-3 py-2.5 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" /> Rincian Transaksi Konsolidasi</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Breakdown jasa dokter vs obat per transaksi — transparansi untuk pemilik</p>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead className="bg-muted/50 border-b border-border sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 micro-label">Invoice</th>
                    <th className="px-3 py-2 micro-label">Pasien</th>
                    <th className="px-3 py-2 micro-label text-right">Jasa Dokter</th>
                    <th className="px-3 py-2 micro-label text-right">Obat</th>
                    <th className="px-3 py-2 micro-label text-right">Lain</th>
                    <th className="px-3 py-2 micro-label text-right">Total</th>
                    <th className="px-3 py-2 micro-label">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.txns.filter(t => t.payment_status === 'Lunas' && (t.consultation_fee > 0 || (t.items && t.items.length > 0))).slice(0, 30).map(t => (
                    <tr key={t.id} className="row-hover">
                      <td className="px-3 py-2 font-medium">{t.invoice_number}</td>
                      <td className="px-3 py-2 truncate max-w-[120px]">{t.patient_name || 'Walk-in'}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{t.consultation_fee > 0 ? `Rp ${(t.consultation_fee || 0).toLocaleString('id-ID')}` : '-'}</td>
                      <td className="px-3 py-2 text-right text-teal-600">{t.items && t.items.length > 0 ? `Rp ${((t.subtotal || 0) - (t.discount || 0)).toLocaleString('id-ID')}` : '-'}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{t.other_fees > 0 ? `Rp ${(t.other_fees || 0).toLocaleString('id-ID')}` : '-'}</td>
                      <td className="px-3 py-2 text-right font-semibold">Rp {(t.total || 0).toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{t.transaction_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.txns.filter(t => t.consultation_fee > 0 || (t.items && t.items.length > 0)).length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">Belum ada transaksi konsolidasi</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <ReportCard label="Total Pendapatan" value={`Rp ${(data.txns.filter(t=>t.payment_status==='Lunas').reduce((s,t)=>s+((t.subtotal||0)-(t.discount||0))+(t.consultation_fee||0)+(t.other_fees||0)+(t.type==='Pendapatan Lain'?(t.total||0):0),0)).toLocaleString('id-ID')}`} color="text-emerald-600" />
            <ReportCard label="Total Pengeluaran" value={`Rp ${data.expenses.reduce((s,e)=>s+(e.amount||0),0).toLocaleString('id-ID')}`} color="text-rose-600" />
            <ReportCard label="Nilai Inventory (Jual)" value={`Rp ${data.meds.reduce((s,m)=>s+(m.stock_on_hand||0)*(m.selling_price||0),0).toLocaleString('id-ID')}`} color="text-teal-600" />
            <ReportCard label="Item Obat Aktif" value={data.meds.filter(m=>m.is_active).length} color="text-blue-600" />
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="panel overflow-x-auto">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Audit Trail</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Log aktivitas sensitif (create/update/delete/void/price change)</p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="px-3 py-2 micro-label">Waktu</th>
                <th className="px-3 py-2 micro-label">Aksi</th>
                <th className="px-3 py-2 micro-label">Entitas</th>
                <th className="px-3 py-2 micro-label">Deskripsi</th>
                <th className="px-3 py-2 micro-label hidden md:table-cell">User</th>
                <th className="px-3 py-2 micro-label">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.logs.map(l => (
                <tr key={l.id} className="row-hover">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{l.timestamp?.slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-3 py-2 font-medium">{l.action}</td>
                  <td className="px-3 py-2">{l.entity}</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.description}</td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{l.user_name}</td>
                  <td className="px-3 py-2">
                    <span className={`pill ${l.severity === 'Critical' ? 'pill-critical' : l.severity === 'Warning' ? 'pill-warning' : 'pill-inactive'}`}>{l.severity}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.logs.length === 0 && <div className="py-4"><EmptyState icon={ScrollText} title="Belum ada log aktivitas" description="Log akan muncul saat ada aksi sensitif" /></div>}
        </div>
      )}

      {tab === 'racikan' && (
        <RacikanConfigPanel configs={racikanConfigs} onSaved={load} toast={toast} />
      )}

      {tab === 'staff' && (
        <StaffAccessPanel users={data.users} onSaved={load} toast={toast} />
      )}

      {selectedAnomaly && (
        <AnomalyDetailDrawer
          anomaly={selectedAnomaly}
          onClose={() => setSelectedAnomaly(null)}
          onResolved={load}
          canResolve={!isOwner}
        />
      )}
    </div>
  );
}

const ANOMALY_ICONS = {
  stock_out_no_transaction: AlertTriangle,
  unpaid_prescription: FileText,
  void_after_dispensing: AlertTriangle,
  frequent_adjustment: Activity,
  price_change: Shield,
  abnormal_discount: AlertTriangle,
  transaction_deleted: AlertTriangle,
  cash_difference: Wallet,
};

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div className="panel px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <p className="micro-label">{label}</p>
      </div>
      <p className={`text-base font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ReportCard({ label, value, color }) {
  return (
    <div className="panel px-3 py-2.5">
      <p className="micro-label truncate">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

const BENTUK_RACIKAN = ['Puyer', 'Kapsul', 'Cair', 'Krim', 'Lainnya'];
const PEMBULATAN_LABELS = {
  ceil: 'Bulat ke atas (ceil)',
  floor: 'Bulat ke bawah (floor)',
  round: 'Bulat terdekat (round)',
  precision1: 'Presisi 1 desimal',
};

function RacikanConfigPanel({ configs, onSaved, toast }) {
  const [local, setLocal] = useState({});
  const [saving, setSaving] = useState(false);
  const [facilityName, setFacilityName] = useState('');
  const [labelTemplate, setLabelTemplate] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);

  useEffect(() => {
    // Build default config map
    const map = {};
    BENTUK_RACIKAN.forEach((b, i) => {
      const existing = configs.find(c => c.bentuk_racikan === b);
      map[b] = existing || {
        bentuk_racikan: b,
        pembulatan_rule: b === 'Cair' ? 'precision1' : 'ceil',
        default_kemasan_fee: 3000,
        default_jasa_racik_fee: 10000,
        is_active: true,
        _new: !existing,
      };
    });
    setLocal(map);
    // Load label settings from first config
    const firstWithFacility = configs.find(c => c.facility_name);
    if (firstWithFacility) setFacilityName(firstWithFacility.facility_name);
    const firstWithLabel = configs.find(c => c.label_template);
    if (firstWithLabel) setLabelTemplate(firstWithLabel.label_template);
  }, [configs]);

  const saveLabelSettings = async () => {
    setSavingLabel(true);
    try {
      for (const cfg of configs) {
        await db.entities.RacikanConfig.update(cfg.id, {
          facility_name: facilityName,
          label_template: labelTemplate,
        });
      }
      toast({ title: 'Pengaturan label tersimpan' });
      onSaved();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
    setSavingLabel(false);
  };

  const update = (bentuk, field, value) => {
    setLocal(m => ({ ...m, [bentuk]: { ...m[bentuk], [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const bentuk of BENTUK_RACIKAN) {
        const cfg = local[bentuk];
        const existing = configs.find(c => c.bentuk_racikan === bentuk);
        if (existing) {
          await db.entities.RacikanConfig.update(existing.id, {
            pembulatan_rule: cfg.pembulatan_rule,
            default_kemasan_fee: cfg.default_kemasan_fee,
            default_jasa_racik_fee: cfg.default_jasa_racik_fee,
          });
        } else {
          await db.entities.RacikanConfig.create({
            bentuk_racikan: bentuk,
            pembulatan_rule: cfg.pembulatan_rule,
            default_kemasan_fee: cfg.default_kemasan_fee,
            default_jasa_racik_fee: cfg.default_jasa_racik_fee,
            is_active: true,
          });
        }
      }
      toast({ title: 'Konfigurasi racikan tersimpan' });
      onSaved();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="panel">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" /> Konfigurasi Racikan per Bentuk</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Atur pembulatan pengambilan stok + default kemasan & jasa racik per bentuk racikan</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-md text-xs font-medium disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">Bentuk Racikan</th>
              <th className="px-3 py-2 font-medium">Pembulatan Pengambilan</th>
              <th className="px-3 py-2 font-medium text-right">Default Kemasan (Rp)</th>
              <th className="px-3 py-2 font-medium text-right">Default Jasa Racik (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {BENTUK_RACIKAN.map(b => {
              const cfg = local[b];
              if (!cfg) return null;
              return (
                <tr key={b} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{b}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={cfg.pembulatan_rule}
                      onChange={e => update(b, 'pembulatan_rule', e.target.value)}
                      className="px-2 py-1 border border-border rounded text-xs bg-card w-full"
                    >
                      {Object.entries(PEMBULATAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <input
                      type="number" value={cfg.default_kemasan_fee}
                      onChange={e => update(b, 'default_kemasan_fee', +e.target.value)}
                      className="w-24 px-2 py-1 border border-border rounded text-xs text-right bg-card"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <input
                      type="number" value={cfg.default_jasa_racik_fee}
                      onChange={e => update(b, 'default_jasa_racik_fee', +e.target.value)}
                      className="w-24 px-2 py-1 border border-border rounded text-xs text-right bg-card"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Label settings */}
      <div className="px-3 py-2.5 border-t border-border bg-muted/20 space-y-2">
        <p className="text-[11px] font-medium flex items-center gap-1"><FlaskConical className="w-3 h-3 text-primary" /> Pengaturan Label Racikan</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nama Fasilitas (untuk label)</label>
            <input value={facilityName} onChange={e => setFacilityName(e.target.value)} placeholder="Klinik & Apotek Sehat" className="w-full px-2 py-1 border border-border rounded text-xs bg-card" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Header Label (opsional)</label>
            <input value={labelTemplate} onChange={e => setLabelTemplate(e.target.value)} placeholder="Disimpan sesuai anjuran dokter" className="w-full px-2 py-1 border border-border rounded text-xs bg-card" />
          </div>
        </div>
        <button onClick={saveLabelSettings} disabled={savingLabel}
          className="flex items-center gap-1.5 px-3 py-1 btn-primary rounded text-xs font-medium disabled:opacity-50">
          <Save className="w-3 h-3" /> {savingLabel ? 'Menyimpan…' : 'Simpan Pengaturan Label'}
        </button>
      </div>

      <div className="px-3 py-2.5 border-t border-border bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          <strong>Pembulatan</strong> diterapkan saat menghitung pengambilan stok per bahan. Nilai teoritis (desimal) tetap tersimpan untuk audit. Apoteker bisa override per bahan di worksheet.
        </p>
      </div>
    </div>
  );
}
