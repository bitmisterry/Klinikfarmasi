const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Receipt, Calendar, ChevronDown, History, Banknote, CreditCard, XCircle, RotateCcw, Eye, X } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { logAuditAction } from '@/lib/roles';
import { getClinicRole } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';
import EmptyState from '@/components/EmptyState';

const TYPE_LABELS = {
  'Apotek/POS': 'Apotek',
  'Klinik': 'Klinik',
  'Resep': 'Resep',
  'Bebas': 'Bebas',
  'Pendapatan Lain': 'Lain',
};

const STATUS_PILLS = {
  'Lunas': 'pill-success',
  'Belum Bayar': 'pill-warning',
  'Refund': 'pill-critical',
  'Void': 'pill-critical',
};

const PAY_ICONS = {
  'Tunai': Banknote,
  'QRIS': CreditCard,
  'Debit': CreditCard,
  'Transfer': CreditCard,
  'BPJS': CreditCard,
};

const DATE_OPTIONS = [
  { label: 'Hari Ini', days: 0 },
  { label: 'Kemarin', days: 1 },
  { label: '7 Hari Terakhir', days: 7 },
  { label: '30 Hari Terakhir', days: 30 },
];

export default function TransactionHistory({ defaultType = 'Semua' }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(7);
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [typeFilter, setTypeFilter] = useState(defaultType || 'Semua');
  const [detail, setDetail] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const canCorrectTransactions = getClinicRole(user) !== 'Kasir';

  useEffect(() => { load(); }, [daysBack]);

  const load = async () => {
    setLoading(true);
    try {
      const dates = [];
      for (let i = 0; i <= daysBack; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      const results = await Promise.all(
        dates.map(d => db.entities.Transaction.filter({ transaction_date: d }, '-created_date', 200).catch(() => []))
      );
      setRecords(results.flat());
    } catch {} finally { setLoading(false); }
  };

  const filtered = records.filter(r => {
    if (statusFilter !== 'Semua' && r.payment_status !== statusFilter) return false;
    if (typeFilter !== 'Semua' && r.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: filtered.length,
    revenue: filtered.filter(r => r.payment_status === 'Lunas').reduce((s, r) => s + (r.total || 0), 0),
    void: filtered.filter(r => r.payment_status === 'Void').length,
    refund: filtered.filter(r => r.payment_status === 'Refund').length,
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  // Group by date
  const grouped = filtered.reduce((acc, r) => {
    const d = r.transaction_date || 'Tanpa Tanggal';
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const voidTransaction = async (t) => {
    const reason = prompt(`Alasan void transaksi ${t.invoice_number}?`);
    if (!reason) return;
    setActionLoading(t.id);
    try {
      await db.entities.Transaction.update(t.id, { payment_status: 'Void', void_reason: reason });
      await logAuditAction({
        action: 'void', entity: 'Transaction', entity_id: t.id, entity_name: t.invoice_number,
        module: 'finance', description: `Void transaksi ${t.invoice_number}: ${reason}`,
        old_value: t.payment_status, new_value: 'Void', reason,
        user_name: 'Sistem', severity: 'Warning', timestamp: new Date().toISOString(),
      });
      toast({ title: `${t.invoice_number} dibatalkan (void)` });
      load();
    } catch (e) { toast({ title: 'Gagal void', description: e.message, variant: 'destructive' }); }
    setActionLoading(null);
  };

  const refundTransaction = async (t) => {
    const reason = prompt(`Alasan refund transaksi ${t.invoice_number}?`);
    if (!reason) return;
    setActionLoading(t.id);
    try {
      await db.entities.Transaction.update(t.id, { payment_status: 'Refund', void_reason: reason });
      await logAuditAction({
        action: 'refund', entity: 'Transaction', entity_id: t.id, entity_name: t.invoice_number,
        module: 'finance', description: `Refund transaksi ${t.invoice_number}: ${reason}`,
        old_value: t.payment_status, new_value: 'Refund', reason,
        user_name: 'Sistem', severity: 'Critical', timestamp: new Date().toISOString(),
      });
      toast({ title: `${t.invoice_number} direfund` });
      load();
    } catch (e) { toast({ title: 'Gagal refund', description: e.message, variant: 'destructive' }); }
    setActionLoading(null);
  };

  return (
    <div className="panel flex flex-col">
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Riwayat Transaksi
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Histori penjualan, pembayaran, void & refund</p>
          </div>
          <div className="relative">
            <select value={daysBack} onChange={e => setDaysBack(Number(e.target.value))}
              className="appearance-none px-2.5 py-1.5 border border-border rounded text-xs font-medium bg-card outline-none focus:border-primary pr-7">
              {DATE_OPTIONS.map(o => <option key={o.days} value={o.days}>{o.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            {['Semua', 'Lunas', 'Belum Bayar', 'Void', 'Refund'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                  statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                }`}>{s}</button>
            ))}
          </div>
          {!defaultType && (
            <div className="relative">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="appearance-none px-2.5 py-1.5 border border-border rounded text-[11px] font-medium bg-card outline-none focus:border-primary pr-7">
                {['Semua', 'Apotek/POS', 'Klinik', 'Resep', 'Bebas', 'Pendapatan Lain'].map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="text-center">
          <p className="text-base font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Transaksi</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-emerald-600">Rp {(stats.revenue / 1000).toFixed(0)}k</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendapatan</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-rose-600">{stats.void}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Void</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-amber-600">{stats.refund}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Refund</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-340px)]">
        {loading && <p className="px-3 py-8 text-center text-xs text-muted-foreground">Memuat riwayat…</p>}
        {!loading && filtered.length === 0 && (
          <EmptyState icon={Receipt} title="Tidak ada transaksi" description="Belum ada transaksi pada rentang ini" />
        )}
        {!loading && sortedDates.map(date => (
          <div key={date}>
            <div className="px-3 py-1.5 bg-muted/50 border-b border-border sticky top-0">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                <span className="text-muted-foreground/60">• {grouped[date].length} transaksi • Rp {grouped[date].filter(r => r.payment_status === 'Lunas').reduce((s, r) => s + (r.total || 0), 0).toLocaleString('id-ID')}</span>
              </p>
            </div>
            {grouped[date].map(t => {
              const PayIcon = PAY_ICONS[t.payment_method] || Receipt;
              return (
                <div key={t.id} className="px-3 py-2 flex items-center gap-3 border-b border-border hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <PayIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-semibold">{t.invoice_number}</span>
                      <span className="pill pill-inactive">{TYPE_LABELS[t.type] || t.type}</span>
                      <span className={`pill ${STATUS_PILLS[t.payment_status] || 'pill-inactive'}`}>{t.payment_status}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t.patient_name || 'Walk-in'} • {t.items?.length || 0} item • {t.cashier_name || '-'} • {t.payment_method}
                      {t.void_reason && <span className="text-rose-500"> • {t.void_reason}</span>}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Rp {(t.total || 0).toLocaleString('id-ID')}</span>
                    <button onClick={() => setDetail(t)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Detail">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {canCorrectTransactions && t.payment_status === 'Lunas' && (
                      <>
                        <button onClick={() => voidTransaction(t)} disabled={actionLoading === t.id}
                          className="p-1.5 hover:bg-rose-50 rounded text-rose-500 hover:text-rose-700 disabled:opacity-50" title="Void">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => refundTransaction(t)} disabled={actionLoading === t.id}
                          className="p-1.5 hover:bg-amber-50 rounded text-amber-500 hover:text-amber-700 disabled:opacity-50" title="Refund">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-card rounded-lg border border-border max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">Detail Transaksi {detail.invoice_number}</h3>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-muted-foreground">Tanggal</p><p className="font-medium">{fmtDate(detail.transaction_date)}</p></div>
                <div><p className="text-muted-foreground">Tipe</p><p className="font-medium">{TYPE_LABELS[detail.type] || detail.type}</p></div>
                <div><p className="text-muted-foreground">Pasien</p><p className="font-medium">{detail.patient_name || 'Walk-in'}</p></div>
                <div><p className="text-muted-foreground">Kasir</p><p className="font-medium">{detail.cashier_name || '-'}</p></div>
                <div><p className="text-muted-foreground">Metode Bayar</p><p className="font-medium">{detail.payment_method}</p></div>
                <div><p className="text-muted-foreground">Status</p><p className="font-medium">{detail.payment_status}</p></div>
              </div>
              {detail.items && detail.items.length > 0 && (
                <div>
                  <p className="micro-label mb-1.5">ITEM OBAT/PRODUK</p>
                  <div className="space-y-1">
                    {detail.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-xs py-1 border-b border-border/50">
                        <span className="truncate">{it.medicine_name} ×{it.quantity}</span>
                        <span className="font-medium">Rp {(it.subtotal || 0).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1 pt-2 border-t border-border">
                {detail.consultation_fee > 0 && (
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Jasa Konsultasi</span><span>Rp {detail.consultation_fee.toLocaleString('id-ID')}</span></div>
                )}
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>Rp {(detail.subtotal || 0).toLocaleString('id-ID')}</span></div>
                {detail.discount > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Diskon</span><span>- Rp {detail.discount.toLocaleString('id-ID')}</span></div>}
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border"><span>Total</span><span className="text-primary">Rp {(detail.total || 0).toLocaleString('id-ID')}</span></div>
                {detail.paid_amount > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Dibayar</span><span>Rp {detail.paid_amount.toLocaleString('id-ID')}</span></div>}
                {detail.change_amount > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Kembalian</span><span>Rp {detail.change_amount.toLocaleString('id-ID')}</span></div>}
              </div>
              {detail.void_reason && (
                <div className="bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-700">
                  <p className="font-semibold">Dibatalkan: {detail.void_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
