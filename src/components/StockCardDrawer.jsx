import React, { useState, useEffect } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, RefreshCw, FileText, Package } from 'lucide-react';

import { getStockCard } from '@/lib/pharmacy';

export default function StockCardDrawer({ medicine, onClose }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!medicine?.id) return;
    setLoading(true);
    getStockCard(medicine.id).then(m => {
      setMovements(m);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [medicine?.id]);

  const typeIcon = (type) => {
    switch (type) {
      case 'Masuk': return <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Keluar': return <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />;
      case 'Adjustment': return <RefreshCw className="w-3.5 h-3.5 text-amber-600" />;
      case 'Opname': return <Package className="w-3.5 h-3.5 text-blue-600" />;
      case 'Retur': return <ArrowUpCircle className="w-3.5 h-3.5 text-purple-600" />;
      default: return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <div>
            <h3 className="text-sm font-semibold">Kartu Stok</h3>
            <p className="text-[11px] text-muted-foreground">{medicine?.name} {medicine?.strength}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        {/* Summary */}
        <div className="px-4 py-3 border-b border-border grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="micro-label">Stok Saat Ini</p>
            <p className="text-sm font-semibold mt-0.5">{medicine?.stock_on_hand || 0} <span className="text-[11px] font-normal text-muted-foreground">{medicine?.unit}</span></p>
          </div>
          <div>
            <p className="micro-label">Min. Stok</p>
            <p className="text-sm font-semibold mt-0.5">{medicine?.min_stock || 0}</p>
          </div>
          <div>
            <p className="micro-label">Rak</p>
            <p className="text-sm font-semibold mt-0.5">{medicine?.shelf_location || '-'}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="px-4 py-3">
          <p className="micro-label mb-2">Riwayat Mutasi Stok</p>
          {loading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Memuat…</p>
          ) : movements.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Belum ada mutasi stok tercatat</p>
          ) : (
            <div className="space-y-1">
              {movements.map(m => {
                const isIn = (m.quantity || 0) > 0;
                return (
                  <div key={m.id} className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
                    <div className="mt-0.5">{typeIcon(m.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{m.type}</span>
                        <span className={`text-xs font-semibold ${isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isIn ? '+' : ''}{m.quantity}
                        </span>
                        {m.batch_number && <span className="text-[10px] text-muted-foreground">Batch: {m.batch_number}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {m.notes || m.reference_number || m.reference_type || '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(m.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        {m.user_name && ` • ${m.user_name}`}
                      </p>
                    </div>
                    {m.balance_after != null && (
                      <span className="text-[11px] text-muted-foreground shrink-0">Saldo: {m.balance_after}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}