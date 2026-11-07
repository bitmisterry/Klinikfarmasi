// @ts-nocheck -- Purchase order details support standard and narcotic SP variants.
import React from 'react';
import { Check, FileText, Package, Truck, X, XCircle } from 'lucide-react';

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function PurchaseOrderDetailModal({ po, supplier = {}, canApprove, onApprove, onReject, onClose }) {
  if (!po) return null;

  const defectaSources = new Map((po.source_defecta_items || []).map((item) => [item.medicine_id, item]));
  const isPending = po.status === 'Menunggu Approval';
  const sourceLabel = po.source_type === 'Defecta' ? 'Defecta stok minimum' : 'Pengadaan manual';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-md border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Detail SP & Approval</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{po.po_number} • {po.supplier_name || supplier.name || 'Supplier belum dipilih'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Tutup detail SP"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 p-4 text-xs">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded border border-border p-2"><p className="micro-label">Status</p><p className="mt-1 font-semibold text-primary">{po.status || 'Draft'}</p></div>
            <div className="rounded border border-border p-2"><p className="micro-label">Tanggal SP</p><p className="mt-1">{po.order_date || '—'}</p></div>
            <div className="rounded border border-border p-2"><p className="micro-label">Kebutuhan</p><p className="mt-1">{po.expected_date || '—'}</p></div>
            <div className="rounded border border-border p-2"><p className="micro-label">Sumber</p><p className="mt-1">{sourceLabel}</p></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded border border-border p-3">
              <h3 className="flex items-center gap-1.5 font-semibold"><Truck className="h-4 w-4 text-primary" /> Supplier</h3>
              <p className="mt-2 font-medium">{po.supplier_name || supplier.name || '—'}</p>
              <p className="text-muted-foreground">{supplier.address || po.supplier_snapshot?.address || 'Alamat belum tersedia'}</p>
              <p className="text-muted-foreground">{supplier.phone || po.supplier_snapshot?.phone || 'Telepon belum tersedia'}</p>
            </section>
            <section className="rounded border border-border p-3">
              <h3 className="flex items-center gap-1.5 font-semibold"><Package className="h-4 w-4 text-primary" /> Ringkasan Pengadaan</h3>
              <p className="mt-2">Jumlah item: <strong>{po.items?.length || 0}</strong></p>
              <p>Total estimasi: <strong>{formatCurrency(po.total_amount)}</strong></p>
              <p className="text-muted-foreground">Dibuat oleh: {po.created_by || '—'}{po.created_by_role ? ` (${po.created_by_role})` : ''}</p>
              {po.approved_by && <p className="text-muted-foreground">Disetujui oleh: {po.approved_by} • {po.approved_date || '—'}</p>}
            </section>
          </div>

          <section className="overflow-x-auto rounded border border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-2 font-semibold">Rincian item dan sumber Defecta</div>
            <table className="w-full min-w-[640px] text-xs">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Obat/Barang</th>
                  <th className="px-3 py-2">Stok awal</th>
                  <th className="px-3 py-2">Minimum</th>
                  <th className="px-3 py-2">Jumlah pesan</th>
                  <th className="px-3 py-2 text-right">Harga</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(po.items || []).map((item) => {
                  const source = defectaSources.get(item.medicine_id);
                  return (
                    <tr key={`${po.id}-${item.medicine_id || item.medicine_name}`}>
                      <td className="px-3 py-2 font-medium">{item.medicine_name || item.name || '—'}<span className="block text-[11px] text-muted-foreground">{po.source_type === 'Defecta' ? 'Dari Defecta' : 'Manual'}</span></td>
                      <td className="px-3 py-2">{source ? `${source.stock_on_hand || 0} ${item.unit || ''}` : '—'}</td>
                      <td className="px-3 py-2">{source ? `${source.min_stock || 0} ${item.unit || ''}` : '—'}</td>
                      <td className="px-3 py-2 font-medium">{item.quantity || 0} {item.unit || ''}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.subtotal || (item.quantity || 0) * (item.unit_price || 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {po.notes && <div className="rounded border border-border bg-muted/20 px-3 py-2"><strong>Catatan:</strong> {po.notes}</div>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-card px-4 py-3">
          {canApprove && isPending && <>
            <button type="button" onClick={() => onReject?.(po)} className="inline-flex items-center gap-1.5 rounded border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"><XCircle className="h-3.5 w-3.5" /> Tolak SP</button>
            <button type="button" onClick={() => onApprove?.(po)} className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"><Check className="h-3.5 w-3.5" /> Setujui SP</button>
          </>}
          <button type="button" onClick={onClose} className="rounded border border-border px-3 py-2 text-xs hover:bg-muted">Tutup</button>
        </div>
      </div>
    </div>
  );
}
