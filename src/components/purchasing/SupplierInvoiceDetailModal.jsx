import React, { useEffect, useState } from 'react';
import { X, FileCheck2, History, ReceiptText } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function SupplierInvoiceDetailModal({ invoice, onClose }) {
  const [audit, setAudit] = useState(invoice.audit_summary ? [invoice.audit_summary] : []);

  useEffect(() => {
    let live = true;
    base44.entities.AuditLog.filter({ entity: 'SupplierInvoice', entity_id: invoice.id }, '-timestamp', 20)
      .then((rows) => { if (live) setAudit(rows?.length ? rows : (invoice.audit_summary ? [invoice.audit_summary] : [])); })
      .catch(() => { if (live && invoice.audit_summary) setAudit([invoice.audit_summary]); });
    return () => { live = false; };
  }, [invoice.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between bg-card border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2"><ReceiptText className="w-4 h-4 text-primary" /> Rekonsiliasi Faktur {invoice.invoice_number}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{invoice.receipt_mode || 'Data faktur lama'} • {invoice.pricing_status || invoice.status}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Summary label="Supplier" value={invoice.supplier_name || '-'} />
            <Summary label="PO sumber" value={invoice.po_number || 'Pembelian langsung'} />
            <Summary label="Total faktur" value={money(invoice.total_amount)} />
            <Summary label="Pencatat" value={invoice.created_by || '-'} />
          </div>
          <div className="rounded border border-teal-200 bg-teal-50 p-3 text-teal-900">
            <p className="font-medium flex items-center gap-1.5"><FileCheck2 className="w-3.5 h-3.5" /> Dasar harga</p>
            <p className="mt-1 text-[11px]">HNA adalah harga netto setelah diskon. HPP memuat PPN dan biaya faktur. Harga jual menggunakan gross margin dan pembulatan klinik.</p>
          </div>

          <div className="border border-border rounded overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="px-3 py-2">Obat / Kelompok</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">HNA</th><th className="px-3 py-2 text-right">HPP</th><th className="px-3 py-2 text-right">Harga Jual</th><th className="px-3 py-2">Batch terhubung</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {(invoice.items || []).map((item, index) => (
                  <tr key={`${item.medicine_id}-${index}`}>
                    <td className="px-3 py-2"><p className="font-medium">{item.medicine_name}</p><p className="text-[10px] text-muted-foreground">{item.category_snapshot || 'Kategori mengikuti master obat'} • margin {item.target_margin || 0}%</p></td>
                    <td className="px-3 py-2 text-right">{item.quantity || 0}{item.bonus_quantity ? ` + ${item.bonus_quantity} bonus` : ''}</td>
                    <td className="px-3 py-2 text-right">{money(item.hna_per_unit ?? item.net_unit_price)}</td>
                    <td className="px-3 py-2 text-right">{money(item.hpp_per_unit)}</td>
                    <td className="px-3 py-2 text-right font-medium text-primary">{money(item.selling_price ?? item.hna_baru)}</td>
                    <td className="px-3 py-2">{item.batch_allocations?.length ? item.batch_allocations.map((batch) => <span key={batch.batch_id || batch.batch_number} className="inline-block mr-1 mb-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{batch.batch_number} · {batch.quantity}</span>) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
            <Summary label="Bruto" value={money(invoice.subtotal)} /><Summary label="Diskon" value={`- ${money(invoice.total_discount)}`} /><Summary label="PPN" value={money(invoice.tax_ppn)} /><Summary label="Biaya lain" value={money(invoice.other_charges)} /><Summary label="Total" value={money(invoice.total_amount)} />
          </div>

          <section className="border border-border rounded p-3">
            <p className="font-semibold flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-primary" /> Audit faktur</p>
            {audit.length ? <div className="mt-2 space-y-2">{audit.map((entry, index) => <div key={entry.id || `${entry.at}-${index}`} className="border-l-2 border-primary/30 pl-2"><p>{entry.description || `${entry.action || 'Faktur diproses'} • ${entry.receipt_mode || '-'}`}</p><p className="text-[10px] text-muted-foreground">{entry.user_name || entry.by || '-'} • {entry.timestamp || entry.at ? new Date(entry.timestamp || entry.at).toLocaleString('id-ID') : '-'}</p></div>)}</div> : <p className="mt-2 text-muted-foreground">Belum ada audit tambahan.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }) {
  return <div className="rounded border border-border p-2"><p className="micro-label">{label}</p><p className="mt-0.5 font-medium truncate" title={String(value)}>{value}</p></div>;
}
