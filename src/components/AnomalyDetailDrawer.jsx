const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { X, AlertTriangle, Shield, CheckCircle2, FileText, ArrowRight } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

const ANOMALY_META = {
  stock_out_no_transaction: { icon: AlertTriangle, label: 'Stok Keluar Tanpa Transaksi', color: 'text-rose-600' },
  unpaid_prescription: { icon: FileText, label: 'Resep Belum Dibayar', color: 'text-amber-600' },
  void_after_dispensing: { icon: AlertTriangle, label: 'Void Setelah Obat Keluar', color: 'text-rose-600' },
  frequent_adjustment: { icon: Shield, label: 'Stock Adjustment Sering', color: 'text-amber-600' },
  price_change: { icon: Shield, label: 'Harga Diubah Manual', color: 'text-amber-600' },
  abnormal_discount: { icon: AlertTriangle, label: 'Diskon Abnormal', color: 'text-amber-600' },
  transaction_deleted: { icon: AlertTriangle, label: 'Transaksi Dihapus', color: 'text-rose-600' },
  cash_difference: { icon: AlertTriangle, label: 'Selisih Kas', color: 'text-amber-600' },
};

export default function AnomalyDetailDrawer({ anomaly, onClose, onResolved, canResolve = true }) {
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');
  const { toast } = useToast();

  if (!anomaly) return null;
  const meta = ANOMALY_META[anomaly.type] || { icon: AlertTriangle, label: anomaly.type, color: 'text-amber-600' };
  const Icon = meta.icon;

  let evidence = {};
  try { evidence = JSON.parse(anomaly.evidence_json || '{}'); } catch {}

  const resolve = async (status) => {
    setResolving(true);
    try {
      await db.entities.Anomaly.update(anomaly.id, {
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: 'Owner',
        resolution_note: note,
      });
      toast({ title: `Anomali ${status === 'Diselesaikan' ? 'diselesaikan' : 'dielangkan'}` });
      onResolved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
    setResolving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded bg-rose-50 flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${meta.color}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{meta.label}</h3>
              <p className="text-[11px] text-muted-foreground">Terdeteksi {anomaly.detected_at?.slice(0, 16).replace('T', ' ')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        {/* Severity + Status */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className={`pill ${anomaly.severity === 'critical' ? 'pill-critical' : 'pill-warning'}`}>
            {anomaly.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
          </span>
          <span className={`pill ${anomaly.status === 'Baru' ? 'pill-info' : anomaly.status === 'Diselesaikan' ? 'pill-success' : 'pill-inactive'}`}>
            {anomaly.status}
          </span>
        </div>

        {/* Description */}
        <div className="px-4 py-3 border-b border-border">
          <p className="micro-label mb-1.5">Deskripsi</p>
          <p className="text-sm">{anomaly.description}</p>
        </div>

        {/* Evidence */}
        <div className="px-4 py-3 border-b border-border">
          <p className="micro-label mb-2">Bukti Silang</p>
          <div className="bg-muted/50 rounded-md p-3 space-y-1.5">
            {Object.entries(evidence).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground font-medium min-w-[100px]">{k}:</span>
                <span className="flex-1 break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
            {Object.keys(evidence).length === 0 && (
              <p className="text-xs text-muted-foreground">Tidak ada bukti terstruktur</p>
            )}
          </div>
        </div>

        {/* Related entity */}
        {anomaly.related_entity && (
          <div className="px-4 py-3 border-b border-border">
            <p className="micro-label mb-1.5">Dokumen Terkait</p>
            <div className="flex items-center gap-2 text-xs">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">{anomaly.related_entity}</span>
              {anomaly.related_id && <span className="text-muted-foreground font-mono text-[10px]">{anomaly.related_id.slice(-8)}</span>}
            </div>
          </div>
        )}

        {/* Resolution */}
        {canResolve && anomaly.status === 'Baru' && (
          <div className="px-4 py-3 sticky bottom-0 bg-card border-t border-border">
            <p className="micro-label mb-1.5">Catatan Resolusi (opsional)</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Mis. sudah diperiksa, stok sudah dikoreksi…"
              className="w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => resolve('Diselesaikan')}
                disabled={resolving}
                className="flex-1 flex items-center justify-center gap-1.5 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Selesai
              </button>
              <button
                onClick={() => resolve('Dielangkan')}
                disabled={resolving}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Elangkan
              </button>
            </div>
          </div>
        )}

        {!canResolve && anomaly.status === 'Baru' && (
          <div className="px-4 py-3 sticky bottom-0 bg-card border-t border-border text-xs text-blue-800 bg-blue-50">
            Owner hanya dapat meninjau bukti anomali. Penyelesaian dilakukan oleh Admin atau role operasional yang ditugaskan.
          </div>
        )}

        {anomaly.status !== 'Baru' && anomaly.resolution_note && (
          <div className="px-4 py-3">
            <p className="micro-label mb-1.5">Catatan Resolusi</p>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-2">{anomaly.resolution_note}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5">Diselesaikan oleh {anomaly.resolved_by} • {anomaly.resolved_at?.slice(0, 16).replace('T', ' ')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
