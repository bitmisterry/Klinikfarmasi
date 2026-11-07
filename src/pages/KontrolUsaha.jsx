const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, RefreshCw, CheckCircle2, XCircle,
  Package, Receipt, Pill, Wallet, TrendingDown, Tag, Eye, Clock, ShieldAlert
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import { getClinicRole } from '@/lib/roles';

// 11 tipe Perlu Diperiksa — bahasa pekerjaan, bukan istilah sistem
const ANOMALY_TYPES = {
  stock_out_no_transaction: { label: 'Stok berkurang tanpa penjualan', icon: Package, color: 'red' },
  procedure_not_billed: { label: 'Tindakan belum masuk tagihan', icon: Receipt, color: 'yellow' },
  unpaid_prescription: { label: 'Resep diserahkan belum dibayar', icon: Pill, color: 'yellow' },
  void_after_dispensing: { label: 'Transaksi dibatalkan setelah obat keluar', icon: XCircle, color: 'red' },
  adjustment_no_reason: { label: 'Penyesuaian stok tanpa alasan', icon: Package, color: 'yellow' },
  price_change: { label: 'Harga diubah', icon: Tag, color: 'yellow' },
  abnormal_discount: { label: 'Diskon di luar batas', icon: Tag, color: 'yellow' },
  abnormal_refund: { label: 'Pengembalian uang abnormal', icon: Receipt, color: 'red' },
  cash_mismatch: { label: 'Kas tidak sesuai transaksi', icon: Wallet, color: 'red' },
  purchase_receipt_mismatch: { label: 'Pembelian diterima, faktur tidak sesuai', icon: Package, color: 'yellow' },
  stock_opname_difference: { label: 'Selisih stock opname', icon: TrendingDown, color: 'yellow' },
  price_below_target: { label: 'Harga jual di bawah target margin', icon: Tag, color: 'yellow' },
  price_below_minimum: { label: 'Harga jual di bawah Harga Minimum Aman', icon: ShieldAlert, color: 'red' },
  old_stock_high_hpp: { label: 'Stok lama dengan HPP lebih tinggi', icon: Package, color: 'yellow' },
  supplier_price_change_significant: { label: 'Harga beli supplier naik signifikan', icon: TrendingDown, color: 'yellow' },
  invoice_receipt_mismatch: { label: 'Faktur tidak sesuai barang diterima', icon: Receipt, color: 'red' },
};

const SEVERITY_STYLE = {
  critical: { dot: '🔴', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Perlu Segera' },
  warning: { dot: '🟡', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Perlu Diperiksa' },
};

export default function KontrolUsaha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = getClinicRole(user) === 'Owner';
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [resolvedView, setResolvedView] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = resolvedView ? 'Diselesaikan' : 'Baru';
      const data = await db.entities.Anomaly.filter({ status }, '-detected_at', 200);
      setAnomalies(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [resolvedView]);

  useEffect(() => { load(); }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await db.functions.invoke('runAnomalyScan', {});
      const data = res.data || res;
      toast({
        title: 'Pemeriksaan selesai',
        description: `${data.created || 0} baru ditemukan · ${data.total || 0} total diperiksa`,
      });
      load();
    } catch (e) {
      toast({ title: 'Gagal memeriksa', description: e.message, variant: 'destructive' });
    }
    setScanning(false);
  };

  const resolveAnomaly = async (a) => {
    try {
      await db.entities.Anomaly.update(a.id, {
        status: 'Diselesaikan',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.full_name || user?.email,
        resolution_note: 'Diselesaikan oleh owner',
      });
      toast({ title: 'Ditandai selesai' });
      load();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const navigateToSource = (a) => {
    const ent = a.related_entity;
    if (ent === 'Transaction' || ent === 'CashSession') navigate('/kasir');
    else if (ent === 'Prescription') navigate('/pharmacy');
    else if (ent === 'StockMovement' || ent === 'Medicine' || ent === 'PurchaseOrder') navigate('/inventory');
    else if (ent === 'MedicalRecord') navigate('/patients');
    else if (ent === 'AuditLog') navigate('/audit-log');
  };

  const filtered = filterType === 'all' ? anomalies : anomalies.filter(a => a.type === filterType);
  const grouped = ANOMALY_TYPES ? Object.keys(ANOMALY_TYPES).map(type => ({
    type,
    config: ANOMALY_TYPES[type],
    items: anomalies.filter(a => a.type === type),
  })).filter(g => g.items.length > 0) : [];

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const warningCount = anomalies.filter(a => a.severity === 'warning').length;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-page-title">Kontrol Usaha</h1>
          <p className="text-caption mt-0.5">Hal-hal yang perlu Anda periksa di klinik</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setResolvedView(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm transition-colors ${resolvedView ? 'bg-muted text-muted-foreground' : 'bg-card border-border hover:bg-muted'}`}
          >
            {resolvedView ? 'Lihat yang Aktif' : 'Lihat Selesai'}
          </button>
          {!isOwner && <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-2 btn-primary rounded-md text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Memeriksa…' : 'Periksa Sekarang'}
          </button>}
        </div>
      </div>

      {/* Ringkasan */}
      {!resolvedView && (
        <ModuleStatHeader
          stats={[
            { label: 'Perlu Segera', value: criticalCount, icon: AlertTriangle, color: 'text-rose-600' },
            { label: 'Perlu Diperiksa', value: warningCount, icon: Clock, color: 'text-amber-600' },
            { label: 'Total Aktif', value: anomalies.length, icon: AlertTriangle, color: 'text-slate-700' },
            { label: 'Aturan Aktif', value: 16, icon: CheckCircle2, color: 'text-emerald-600' },
          ]}
        />
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}
        >
          Semua ({anomalies.length})
        </button>
        {Object.entries(ANOMALY_TYPES).map(([type, cfg]) => {
          const count = anomalies.filter(a => a.type === type).length;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterType === type ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Daftar Perlu Diperiksa */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
          <p className="text-section-title text-emerald-700">Tidak ada yang perlu diperiksa</p>
          <p className="text-caption mt-1">Semua transaksi dan stok sesuai. Klik "Periksa Sekarang" untuk memeriksa ulang.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(a => {
            const cfg = ANOMALY_TYPES[a.type] || { label: a.type, icon: AlertTriangle, color: 'yellow' };
            const sev = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.warning;
            const Icon = cfg.icon;
            return (
              <div key={a.id} className={`panel p-4 ${sev.border} border-l-2`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-md ${sev.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${sev.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-body-medium">{cfg.label}</span>
                      <span className={`pill ${a.severity === 'critical' ? 'pill-critical' : 'pill-warning'}`}>{sev.label}</span>
                    </div>
                    <p className="text-body mt-1">{a.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-caption flex-wrap">
                      {a.user_name && <span>oleh {a.user_name}</span>}
                      {a.detected_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(a.detected_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                      {resolvedView && a.resolution_note && <span>• {a.resolution_note}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!resolvedView && (
                      <>
                        <button
                          onClick={() => navigateToSource(a)}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-md text-xs hover:bg-muted transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Periksa
                        </button>
                        {!isOwner && <button
                          onClick={() => resolveAnomaly(a)}
                          className="flex items-center gap-1 px-2.5 py-1.5 btn-primary rounded-md text-xs font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                        </button>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
