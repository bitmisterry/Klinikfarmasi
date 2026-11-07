import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Package, Truck, X, FileText, Wallet, PackageCheck, Receipt, CalendarClock, AlertTriangle, CheckCircle, Banknote, ShieldAlert, Check, XCircle, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import GoodsReceiptModal from '@/components/GoodsReceiptModal';
import InvoiceForm from '@/components/InvoiceForm';
import PaymentScheduleForm from '@/components/PaymentScheduleForm';
import { markPaymentPaid, checkOverdueInvoices, voidInvoice } from '@/lib/procurement';
import { logAuditAction } from '@/lib/roles';
import { getClinicRole } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';
import DocumentAttachments from '@/components/documents/DocumentAttachments';
import PurchaseOrderDocumentModal from '@/components/purchasing/PurchaseOrderDocumentModal';
import PurchaseOrderDetailModal from '@/components/purchasing/PurchaseOrderDetailModal';
import SupplierInvoiceDetailModal from '@/components/purchasing/SupplierInvoiceDetailModal';
import SupplierReturnModal from '@/components/purchasing/SupplierReturnModal';
import SupplierReturnActionModal from '@/components/purchasing/SupplierReturnActionModal';

const TABS = [
  { key: 'po', label: 'SP / Approval', icon: FileText },
  { key: 'receipt', label: 'Penerimaan', icon: PackageCheck },
  { key: 'invoice', label: 'Faktur', icon: Receipt },
  { key: 'return', label: 'Retur Supplier', icon: RotateCcw },
  { key: 'payment', label: 'Jadwal Bayar', icon: CalendarClock },
  { key: 'supplier', label: 'Supplier', icon: Truck },
];

export default function Purchasing() {
  const [tab, setTab] = useState('po');
  const [searchParams] = useSearchParams();
  const [pos, setPos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [supplierReturns, setSupplierReturns] = useState([]);
  const [showPO, setShowPO] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptPO, setReceiptPO] = useState(null);
  const [documentPO, setDocumentPO] = useState(null);
  const [detailPO, setDetailPO] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [returnInvoice, setReturnInvoice] = useState(null);
  const [returnAction, setReturnAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const clinicRole = getClinicRole(user);
  const isOwner = clinicRole === 'Owner';
  const canCreatePurchasing = ['Apoteker', 'Apoteker Penanggung Jawab', 'Admin Farmasi'].includes(clinicRole);
  const canApprovePO = clinicRole === 'Apoteker Penanggung Jawab';
  const canSendPO = canCreatePurchasing;
  const canReceiveGoods = canCreatePurchasing;
  const canManageSupplier = ['Apoteker Penanggung Jawab', 'Admin Farmasi'].includes(clinicRole);
  const canCreateInvoice = canCreatePurchasing;
  const canVoidInvoice = clinicRole === 'Finance';
  const canCreateReturn = ['Apoteker', 'Apoteker Penanggung Jawab', 'Admin Farmasi'].includes(clinicRole);
  const canApproveReturn = clinicRole === 'Apoteker Penanggung Jawab';
  // Pemisahan tugas retur: APJ hanya menyetujui/menolak, sedangkan
  // pengeluaran batch dilakukan oleh tim operasional Farmasi.
  const canProcessReturn = ['Apoteker', 'Admin Farmasi'].includes(clinicRole);
  const canCancelReturn = ['Finance', 'Apoteker Penanggung Jawab'].includes(clinicRole);
  const canFinanceReturn = clinicRole === 'Finance';
  const canViewPayments = ['Owner', 'Finance'].includes(clinicRole);
  const canManagePayments = clinicRole === 'Finance';
  const visibleTabs = TABS.filter((item) => item.key !== 'payment' || canViewPayments);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && visibleTabs.some((item) => item.key === requestedTab)) {
      setTab(requestedTab);
    }
  }, [canViewPayments, searchParams]);

  const userName = user?.full_name || user?.email || 'Sistem';

  const reload = () => {
    Promise.all([
      base44.entities.PurchaseOrder.list(),
      base44.entities.Supplier.list(),
      base44.entities.SupplierInvoice.list(),
      base44.entities.SupplierReturn.list(),
      canViewPayments ? base44.entities.PaymentSchedule.list() : Promise.resolve([]),
    ]).then(([p, s, inv, returns, sch]) => {
      setPos(p || []);
      setSuppliers(s || []);
      setInvoices(inv || []);
      setSupplierReturns(returns || []);
      setSchedules(sch || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    if (!isOwner) checkOverdueInvoices().catch(() => {});
  }, [isOwner, canViewPayments]);

  useEffect(() => {
    const unsubscribePurchaseOrder = base44.entities.PurchaseOrder.subscribe(() => reload());
    const unsubscribeSupplier = base44.entities.Supplier.subscribe(() => reload());
    const unsubscribeInvoice = base44.entities.SupplierInvoice.subscribe(() => reload());
    const unsubscribeReturn = base44.entities.SupplierReturn.subscribe(() => reload());
    return () => {
      unsubscribePurchaseOrder?.();
      unsubscribeSupplier?.();
      unsubscribeInvoice?.();
      unsubscribeReturn?.();
    };
  }, [isOwner, canViewPayments]);

  // Stats
  const outstandingAP = invoices.filter((i) => i.status !== 'Lunas').reduce((s, i) => s + ((i.total_amount || 0) - (i.paid_amount || 0)), 0);
  const overdueAmount = invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + ((i.total_amount || 0) - (i.paid_amount || 0)), 0);
  const pendingReceipts = pos.filter((p) => p.status === 'Dikirim' || p.status === 'Diterima Sebagian').length;
  const scheduledThisWeek = schedules.filter((s) => s.status === 'Terjadwal').length;

  const handleApprovePO = async (po) => {
    if (!confirm(`Setujui SP ${po.po_number}? Setelah disetujui, SP dapat ditinjau, dicetak, dan dikirim ke supplier.`)) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await base44.entities.PurchaseOrder.update(po.id, {
        status: 'Disetujui',
        approval_status: 'Disetujui',
        approved_by: userName,
        approved_by_role: clinicRole,
        approved_date: today,
        document_status: 'Tersedia',
      });
      await logAuditAction({
        action: 'update', entity: 'PurchaseOrder', entityId: po.id, entityName: po.po_number,
        module: 'purchasing',
        description: `SP ${po.po_number} disetujui APJ${po.is_narcotic_po ? ' (NARKOTIKA)' : ''}`,
        severity: po.is_narcotic_po ? 'Warning' : 'Info',
      });
      toast({ title: `SP ${po.po_number} disetujui`, description: 'Dokumen SP tersedia untuk preview, print/PDF, lalu dapat dikirim ke supplier.' });
      setDetailPO(null);
      reload();
    } catch (e) {
      toast({ title: 'Gagal menyetujui', description: e.message, variant: 'destructive' });
    }
  };

  const handleRejectPO = async (po) => {
    const reason = prompt(`Alasan penolakan SP ${po.po_number}:`);
    if (!reason) return;
    try {
      await base44.entities.PurchaseOrder.update(po.id, {
        status: 'Ditolak',
        approval_status: 'Ditolak',
        document_status: 'Ditolak',
        rejected_by: userName,
        rejected_date: new Date().toISOString(),
        rejection_reason: reason,
        notes: (po.notes || '') + ` | DITOLAK: ${reason}`,
      });
      await logAuditAction({
        action: 'update', entity: 'PurchaseOrder', entityId: po.id, entityName: po.po_number,
        module: 'purchasing',
        description: `SP ${po.po_number} DITOLAK: ${reason}`,
        severity: 'Warning',
      });
      toast({ title: `SP ${po.po_number} ditolak`, description: reason });
      setDetailPO(null);
      reload();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const handleSendPO = async (po) => {
    if (!confirm(`Kirim SP ${po.po_number} ke supplier ${po.supplier_name}?`)) return;
    try {
      await base44.entities.PurchaseOrder.update(po.id, {
        status: 'Dikirim',
        sent_by: userName,
        sent_date: new Date().toISOString(),
        document_status: 'Dikirim ke supplier',
      });
      await logAuditAction({
        action: 'update', entity: 'PurchaseOrder', entityId: po.id, entityName: po.po_number,
        module: 'purchasing',
        description: `SP ${po.po_number} dikirim ke supplier ${po.supplier_name}`,
      });
      toast({ title: `SP ${po.po_number} dikirim` });
      reload();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const handleVoidInvoice = async (inv) => {
    const reason = prompt(`Alasan pembatalan faktur ${inv.invoice_number}?\nStok yang sudah diterima akan dikembalikan ke supplier.`);
    if (!reason) return;
    try {
      await voidInvoice(inv.id, reason, userName);
      toast({ title: `Faktur ${inv.invoice_number} dibatalkan`, description: 'Stok dikembalikan, audit & anomali dicatat' });
      reload();
    } catch (e) {
      toast({ title: 'Gagal membatalkan', description: e.message, variant: 'destructive' });
    }
  };

  const [paidSchedule, setPaidSchedule] = useState(null);
  const handlePay = async (sched) => {
    if (!confirm(`Konfirmasi pembayaran Rp ${sched.amount.toLocaleString('id-ID')} ke ${sched.supplier_name}?`)) return;
    try {
      await markPaymentPaid(sched, userName);
      await logAuditAction({
        action: 'payment', entity: 'PaymentSchedule', entityId: sched.id, entityName: sched.schedule_number,
        module: 'finance',
        description: `Pembayaran ${sched.schedule_number} ke ${sched.supplier_name} — Rp ${sched.amount.toLocaleString('id-ID')}`,
        severity: 'Warning',
      });
      toast({ title: 'Pembayaran dicatat', description: `Lampirkan bukti bayar di bawah — Rp ${sched.amount.toLocaleString('id-ID')}` });
      setPaidSchedule(sched);
      reload();
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
        <h1 className="text-lg font-medium">Pembelian & Procurement-to-Pay</h1>
        <div className="flex gap-2 flex-wrap">
          {canCreateInvoice && tab === 'invoice' && <button onClick={() => setShowInvoice(true)} className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded-md text-xs font-medium"><Plus className="w-3.5 h-3.5" /> Faktur Baru</button>}
          {canManagePayments && tab === 'payment' && <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded-md text-xs font-medium"><Plus className="w-3.5 h-3.5" /> Jadwal Bayar</button>}
          {canCreatePurchasing && tab === 'po' && <button onClick={() => setShowPO(true)} className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded-md text-xs font-medium"><Plus className="w-3.5 h-3.5" /> PO Baru</button>}
          {canManageSupplier && <button onClick={() => setShowSupplier(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs hover:bg-muted"><Truck className="w-3.5 h-3.5" /> Supplier</button>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
            {t.key === 'receipt' && pendingReceipts > 0 && <span className="ml-0.5 text-[10px] bg-amber-500 text-white px-1.5 rounded-full">{pendingReceipts}</span>}
            {t.key === 'invoice' && invoices.filter((i) => i.status !== 'Lunas').length > 0 && <span className="ml-0.5 text-[10px] bg-rose-500 text-white px-1.5 rounded-full">{invoices.filter((i) => i.status !== 'Lunas').length}</span>}
          </button>
        ))}
      </div>

      <ModuleStatHeader stats={[
        { icon: FileText, label: 'Total PO', value: pos.length, color: 'text-blue-600' },
        { icon: PackageCheck, label: 'Perlu Diterima', value: pendingReceipts, color: 'text-amber-600' },
        { icon: Wallet, label: 'Utang Outstanding', value: `Rp ${(outstandingAP / 1000000).toFixed(1)}jt`, color: overdueAmount > 0 ? 'text-rose-600' : 'text-teal-600', subtitle: overdueAmount > 0 ? `Overdue: Rp ${(overdueAmount / 1000000).toFixed(1)}jt` : 'Tidak ada overdue' },
        { icon: CalendarClock, label: 'Jadwal Bayar', value: scheduledThisWeek, color: 'text-purple-600' },
      ]} />

      {/* PO Tab */}
      {tab === 'po' && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="px-3 py-2 micro-label">No. PO</th>
                <th className="px-3 py-2 micro-label">Supplier</th>
                <th className="px-3 py-2 micro-label hidden sm:table-cell">Tanggal</th>
                <th className="px-3 py-2 micro-label">Status</th>
                <th className="px-3 py-2 micro-label text-right">Total</th>
                <th className="px-3 py-2 micro-label text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pos.map((po) => (
                <tr key={po.id} className="row-hover">
                  <td className="px-3 py-2 font-mono text-primary flex items-center gap-1.5">
                    {po.is_narcotic_po && <ShieldAlert className="w-3 h-3 text-rose-600" />}
                    {po.po_number}
                  </td>
                  <td className="px-3 py-2">{po.supplier_name}</td>
                  <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{po.order_date}</td>
                  <td className="px-3 py-2">
                    <span className={`pill ${po.status === 'Diterima' ? 'pill-success' : po.status === 'Dikirim' ? 'pill-info' : po.status === 'Diterima Sebagian' ? 'pill-warning' : po.status === 'Disetujui' ? 'bg-teal-50 text-teal-700 border-teal-200' : po.status === 'Menunggu Approval' ? 'bg-amber-50 text-amber-700 border-amber-200' : po.status === 'Draft' ? 'pill-inactive' : 'pill-critical'}`}>{po.status}</span>
                    {po.is_narcotic_po && <span className="pill pill-critical ml-1">Narkotik</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">Rp {(po.total_amount || 0).toLocaleString('id-ID')}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canApprovePO && po.status === 'Menunggu Approval' && (
                        <>
                          <button onClick={() => handleApprovePO(po)} title="Setujui SP" className="text-emerald-600 hover:bg-emerald-50 p-1 rounded border border-emerald-300">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleRejectPO(po)} title="Tolak SP" className="text-rose-600 hover:bg-rose-50 p-1 rounded border border-rose-300">
                            <XCircle className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      {canSendPO && po.status === 'Disetujui' && (
                        <button onClick={() => handleSendPO(po)} className="text-xs font-medium text-primary hover:text-primary-hover px-2 py-1 rounded border border-primary/30 hover:bg-primary/5 flex items-center gap-1">
                          <Truck className="w-3 h-3" /> Kirim
                        </button>
                      )}
                      {canReceiveGoods && (po.status === 'Dikirim' || po.status === 'Diterima Sebagian') && (
                        <button onClick={() => setReceiptPO(po)} className="text-xs font-medium text-primary hover:text-primary-hover px-2 py-1 rounded border border-primary/30 hover:bg-primary/5 flex items-center gap-1">
                          <PackageCheck className="w-3 h-3" /> Terima
                        </button>
                      )}
                      {po.status === 'Diterima' && <span className="text-[11px] text-emerald-600 flex items-center gap-0.5 justify-center"><CheckCircle className="w-3 h-3" /> Selesai</span>}
                      {po.status !== 'Dibatalkan' && <button onClick={() => setDocumentPO(po)} title="Lihat dokumen SP" className="text-xs font-medium text-primary hover:text-primary-hover px-2 py-1 rounded border border-primary/30 hover:bg-primary/5 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Dokumen
                      </button>}
                      {po.status !== 'Dibatalkan' && <button onClick={() => setDetailPO(po)} title="Lihat detail SP" className="text-xs font-medium text-foreground hover:text-primary px-2 py-1 rounded border border-border hover:bg-muted flex items-center gap-1">
                        Detail
                      </button>}
                      {(po.status === 'Draft' || po.status === 'Dibatalkan') && <span className="text-[11px] text-muted-foreground">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pos.length === 0 && <div className="py-4"><EmptyState icon={Package} title="Belum ada PO" description="Buat purchase order baru untuk membeli obat" /></div>}
        </div>
      )}

      {/* Receipt Tab — POs awaiting goods receipt */}
      {tab === 'receipt' && (
        <div className="space-y-2">
          {pos.filter((p) => p.status === 'Dikirim' || p.status === 'Diterima Sebagian').map((po) => {
            const totalOrdered = po.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0;
            const totalReceived = po.items?.reduce((s, it) => s + (it.received_quantity || 0), 0) || 0;
            const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
            return (
              <div key={po.id} className="panel p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-primary">{po.po_number}</span>
                      <span className={`pill ${po.status === 'Diterima Sebagian' ? 'pill-warning' : 'pill-info'}`}>{po.status}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{po.supplier_name} • {po.order_date}</p>
                  </div>
                  {canReceiveGoods && <button onClick={() => setReceiptPO(po)} className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded-md text-xs font-medium">
                    <PackageCheck className="w-3.5 h-3.5" /> Terima Barang
                  </button>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{totalReceived}/{totalOrdered} unit ({pct}%)</span>
                </div>
              </div>
            );
          })}
          {pos.filter((p) => p.status === 'Dikirim' || p.status === 'Diterima Sebagian').length === 0 && (
            <div className="panel"><EmptyState icon={PackageCheck} title="Tidak ada PO menunggu penerimaan" description="PO yang dikirim ke supplier akan muncul di sini untuk diterima" /></div>
          )}
        </div>
      )}

      {/* Invoice Tab */}
      {tab === 'invoice' && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="px-3 py-2 micro-label">No. Faktur</th>
                <th className="px-3 py-2 micro-label">Supplier</th>
                <th className="px-3 py-2 micro-label hidden md:table-cell">PO</th>
                <th className="px-3 py-2 micro-label hidden sm:table-cell">Jatuh Tempo</th>
                <th className="px-3 py-2 micro-label">Status</th>
                <th className="px-3 py-2 micro-label hidden lg:table-cell">Kontrabon</th>
                <th className="px-3 py-2 micro-label text-right">Total</th>
                <th className="px-3 py-2 micro-label text-right">Sisa</th>
                <th className="px-3 py-2 micro-label text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => {
                const remaining = (inv.total_amount || 0) - (inv.paid_amount || 0);
                const isOverdue = inv.status === 'Overdue';
                return (
                  <tr key={inv.id} className={`row-hover ${isOverdue ? 'bg-rose-50/50' : ''}`}>
                    <td className="px-3 py-2 font-mono text-primary">{inv.invoice_number}</td>
                    <td className="px-3 py-2">{inv.supplier_name}</td>
                    <td className="px-3 py-2 hidden md:table-cell font-mono text-[11px] text-muted-foreground">{inv.po_number || '-'}</td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      {inv.due_date && (
                        <span className={isOverdue ? 'text-rose-600 font-medium flex items-center gap-0.5' : 'text-muted-foreground'}>
                          {isOverdue && <AlertTriangle className="w-3 h-3" />} {inv.due_date}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`pill ${inv.status === 'Lunas' ? 'pill-success' : inv.status === 'Overdue' ? 'pill-critical' : inv.status === 'Sebagian Bayar' ? 'pill-warning' : 'pill-inactive'}`}>{inv.status}</span>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {inv.kontrabon_status && (
                        <span className={`pill ${
                          inv.kontrabon_status === 'Kontrabon' ? 'pill-critical' :
                          inv.kontrabon_status === 'Mendekati Jatuh Tempo' ? 'pill-warning' :
                          inv.kontrabon_status === 'Selesai' ? 'pill-success' : 'pill-inactive'
                        }`}>
                          {inv.kontrabon_status}
                          {inv.days_until_due != null && inv.kontrabon_status !== 'Selesai' && inv.kontrabon_status !== 'Belum Jatuh Tempo' && ` H${inv.days_until_due >= 0 ? '-' : '+'}${Math.abs(inv.days_until_due)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">Rp {(inv.total_amount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 text-right font-medium text-rose-600">{remaining > 0 ? `Rp ${remaining.toLocaleString('id-ID')}` : '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setDetailInvoice(inv)} className="text-primary hover:bg-primary/5 px-2 py-1 rounded text-[11px] border border-primary/30">Detail</button>
                      {canVoidInvoice && inv.status !== 'Batal' && inv.status !== 'Lunas' && (
                        <button onClick={() => handleVoidInvoice(inv)} className="text-rose-500 hover:bg-rose-50 px-2 py-1 rounded text-[11px] flex items-center gap-1 border border-rose-200" title="Batalkan faktur & kembalikan stok">
                          <XCircle className="w-3 h-3" /> Batal
                        </button>
                      )}
                      {canCreateReturn && inv.status !== 'Batal' && (
                        <button onClick={() => setReturnInvoice(inv)} className="text-amber-700 hover:bg-amber-50 px-2 py-1 rounded text-[11px] flex items-center gap-1 border border-amber-300" title="Ajukan retur supplier berdasarkan batch faktur">
                          <RotateCcw className="w-3 h-3" /> Retur
                        </button>
                      )}
                      {inv.status === 'Batal' && <span className="pill pill-inactive">Dibatalkan</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {invoices.length === 0 && <div className="py-4"><EmptyState icon={Receipt} title="Belum ada faktur" description="Catat faktur supplier setelah barang diterima" /></div>}
        </div>
      )}

      {/* Supplier Return Tab */}
      {tab === 'return' && (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="border-b border-border bg-muted/50"><tr className="text-left">
              <th className="px-3 py-2 micro-label">No. Retur</th><th className="px-3 py-2 micro-label">Faktur / Supplier</th><th className="px-3 py-2 micro-label">Alasan</th><th className="px-3 py-2 micro-label text-right">Nilai</th><th className="px-3 py-2 micro-label">Status</th><th className="px-3 py-2 micro-label text-center">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {supplierReturns.map((supplierReturn) => (
                <tr key={supplierReturn.id} className="row-hover">
                  <td className="px-3 py-2"><p className="font-mono font-medium text-primary">{supplierReturn.return_number}</p><p className="text-[10px] text-muted-foreground">{supplierReturn.created_by || '-'} • {supplierReturn.created_at ? new Date(supplierReturn.created_at).toLocaleDateString('id-ID') : '-'}</p></td>
                  <td className="px-3 py-2"><p className="font-mono text-[11px]">{supplierReturn.invoice_number}</p><p className="text-muted-foreground">{supplierReturn.supplier_name}</p></td>
                  <td className="max-w-[250px] px-3 py-2"><p className="truncate" title={supplierReturn.reason}>{supplierReturn.reason}</p>{supplierReturn.approval_notes && <p className="mt-0.5 text-[10px] text-muted-foreground">APJ: {supplierReturn.approval_notes}</p>}</td>
                  <td className="px-3 py-2 text-right font-medium">Rp {Number(supplierReturn.total_amount || 0).toLocaleString('id-ID')}</td>
                  <td className="px-3 py-2"><span className={`pill ${['Selesai', 'Direkonsiliasi'].includes(supplierReturn.status) ? 'pill-success' : ['Disetujui', 'Nota Kredit Diterima'].includes(supplierReturn.status) ? 'pill-info' : ['Menunggu Approval', 'Menunggu Nota Kredit'].includes(supplierReturn.status) ? 'pill-warning' : 'pill-inactive'}`}>{supplierReturn.status}</span></td>
                  <td className="px-3 py-2"><div className="flex justify-center gap-1">
                    <button onClick={() => setReturnAction({ supplierReturn, action: 'detail' })} className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted">Detail</button>
                    {canApproveReturn && supplierReturn.status === 'Menunggu Approval' && <><button onClick={() => setReturnAction({ supplierReturn, action: 'approve' })} className="rounded border border-emerald-300 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50">Setujui</button><button onClick={() => setReturnAction({ supplierReturn, action: 'reject' })} className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50">Tolak</button></>}
                    {canProcessReturn && supplierReturn.status === 'Disetujui' && <button onClick={() => setReturnAction({ supplierReturn, action: 'process' })} className="rounded border border-primary/30 px-2 py-1 text-[11px] text-primary hover:bg-primary/5">Proses Stok</button>}
                    {canCancelReturn && ['Menunggu Approval', 'Disetujui'].includes(supplierReturn.status) && <button onClick={() => setReturnAction({ supplierReturn, action: 'cancel' })} className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted">Batalkan</button>}
                    {canFinanceReturn && ['Diproses', 'Menunggu Nota Kredit'].includes(supplierReturn.status) && <button onClick={() => setReturnAction({ supplierReturn, action: 'credit' })} className="rounded border border-blue-300 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50">Catat Nota Kredit</button>}
                    {canFinanceReturn && supplierReturn.status === 'Nota Kredit Diterima' && <button onClick={() => setReturnAction({ supplierReturn, action: 'reconcile' })} className="rounded border border-indigo-300 px-2 py-1 text-[11px] text-indigo-700 hover:bg-indigo-50">Rekonsiliasi</button>}
                    {canFinanceReturn && supplierReturn.status === 'Direkonsiliasi' && <button onClick={() => setReturnAction({ supplierReturn, action: 'close' })} className="rounded border border-emerald-300 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50">Tutup Retur</button>}
                    {['Ditolak', 'Dibatalkan'].includes(supplierReturn.status) && <span className="text-[11px] text-muted-foreground">{supplierReturn.status}</span>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!supplierReturns.length && <div className="py-4"><EmptyState icon={RotateCcw} title="Belum ada retur supplier" description="Ajukan retur dari tab Faktur; APJ menyetujui sebelum stok dikurangi." /></div>}
        </div>
      )}

      {/* Payment Schedule Tab */}
      {tab === 'payment' && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="px-3 py-2 micro-label">No. Jadwal</th>
                <th className="px-3 py-2 micro-label">Supplier</th>
                <th className="px-3 py-2 micro-label hidden md:table-cell">Faktur</th>
                <th className="px-3 py-2 micro-label">Rencana Bayar</th>
                <th className="px-3 py-2 micro-label text-right">Jumlah</th>
                <th className="px-3 py-2 micro-label">Status</th>
                <th className="px-3 py-2 micro-label text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules.map((sch) => {
                const isOverdue = sch.status === 'Terjadwal' && sch.planned_date < new Date().toISOString().split('T')[0];
                return (
                  <tr key={sch.id} className={`row-hover ${isOverdue ? 'bg-rose-50/50' : ''}`}>
                    <td className="px-3 py-2 font-mono text-primary">{sch.schedule_number}</td>
                    <td className="px-3 py-2">{sch.supplier_name}</td>
                    <td className="px-3 py-2 hidden md:table-cell font-mono text-[11px] text-muted-foreground">{sch.invoice_number || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={isOverdue ? 'text-rose-600 font-medium flex items-center gap-0.5' : ''}>
                        {isOverdue && <AlertTriangle className="w-3 h-3" />} {sch.planned_date}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">Rp {(sch.amount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2">
                      <span className={`pill ${sch.status === 'Dibayar' ? 'pill-success' : sch.status === 'Ditunda' ? 'pill-warning' : sch.status === 'Dibatalkan' ? 'pill-critical' : isOverdue ? 'pill-critical' : 'pill-info'}`}>
                        {isOverdue && sch.status === 'Terjadwal' ? 'Terlambat' : sch.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {canManagePayments && sch.status === 'Terjadwal' && (
                        <button onClick={() => handlePay(sch)} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded border border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 mx-auto">
                          <Banknote className="w-3 h-3" /> Bayar
                        </button>
                      )}
                      {sch.status === 'Dibayar' && <span className="text-[11px] text-emerald-600 flex items-center gap-0.5 justify-center"><CheckCircle className="w-3 h-3" /> {sch.paid_date}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {schedules.length === 0 && <div className="py-4"><EmptyState icon={CalendarClock} title="Belum ada jadwal bayar" description="Jadwalkan pembayaran untuk faktur supplier" /></div>}
        </div>
      )}

      {/* Supplier Tab */}
      {tab === 'supplier' && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="px-3 py-2 micro-label">Kode</th>
                <th className="px-3 py-2 micro-label">Nama</th>
                <th className="px-3 py-2 micro-label hidden md:table-cell">Kontak</th>
                <th className="px-3 py-2 micro-label hidden lg:table-cell">Termin</th>
                <th className="px-3 py-2 micro-label">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suppliers.map((s) => (
                <tr key={s.id} className="row-hover">
                  <td className="px-3 py-2 font-mono">{s.code}</td>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{s.contact_person} • {s.phone}</td>
                  <td className="px-3 py-2 hidden lg:table-cell">{s.payment_terms}</td>
                  <td className="px-3 py-2">{s.is_active ? <span className="pill pill-success">Aktif</span> : <span className="pill pill-inactive">Nonaktif</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {suppliers.length === 0 && <div className="py-4"><EmptyState icon={Truck} title="Belum ada supplier" description="Tambah supplier untuk mulai membuat PO" /></div>}
        </div>
      )}

      {/* Modals */}
      {showPO && <POForm suppliers={suppliers} userName={userName} clinicRole={clinicRole} onClose={() => setShowPO(false)} onSaved={() => { setShowPO(false); reload(); }} />}
      {showSupplier && <SupplierForm onClose={() => setShowSupplier(false)} onSaved={() => { setShowSupplier(false); reload(); }} />}
      {showInvoice && <InvoiceForm suppliers={suppliers} pos={pos} userName={userName} onClose={() => setShowInvoice(false)} onSaved={() => { setShowInvoice(false); reload(); }} />}
      {showPayment && <PaymentScheduleForm invoices={invoices} userName={userName} onClose={() => setShowPayment(false)} onSaved={() => { setShowPayment(false); reload(); }} />}
      {receiptPO && <GoodsReceiptModal po={receiptPO} supplier={suppliers.find((s) => s.id === receiptPO.supplier_id)} userName={userName} onClose={() => setReceiptPO(null)} onSaved={() => { setReceiptPO(null); reload(); }} />}
      {documentPO && <PurchaseOrderDocumentModal
        po={documentPO}
        supplier={suppliers.find((s) => s.id === documentPO.supplier_id) || documentPO.supplier_snapshot || {}}
        user={user}
        onClose={() => setDocumentPO(null)}
        onSaved={(updated) => {
          if (!updated) return;
          setDocumentPO((current) => ({ ...current, ...updated }));
          reload();
        }}
      />}
      {detailPO && <PurchaseOrderDetailModal
        po={detailPO}
        supplier={suppliers.find((supplier) => supplier.id === detailPO.supplier_id) || detailPO.supplier_snapshot || {}}
        canApprove={canApprovePO}
        onApprove={handleApprovePO}
        onReject={handleRejectPO}
        onClose={() => setDetailPO(null)}
      />}
      {detailInvoice && <SupplierInvoiceDetailModal invoice={detailInvoice} onClose={() => setDetailInvoice(null)} />}
      {returnInvoice && <SupplierReturnModal invoice={returnInvoice} onClose={() => setReturnInvoice(null)} onSaved={() => { setReturnInvoice(null); reload(); }} />}
      {returnAction && <SupplierReturnActionModal supplierReturn={returnAction.supplierReturn} action={returnAction.action} onClose={() => setReturnAction(null)} onSaved={() => { setReturnAction(null); reload(); }} />}

      {/* Proof of Payment Attachment Modal */}
      {paidSchedule && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setPaidSchedule(null)}>
          <div className="w-full max-w-lg bg-card h-full overflow-y-auto border-l border-border" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-600" /> Bukti Pembayaran</h3>
              <button onClick={() => setPaidSchedule(null)} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="panel p-3 bg-emerald-50/50">
                <p className="text-xs text-muted-foreground">Pembayaran ke</p>
                <p className="text-sm font-medium">{paidSchedule.supplier_name}</p>
                <p className="text-lg font-semibold text-emerald-700 mt-1">Rp {(paidSchedule.amount || 0).toLocaleString('id-ID')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{paidSchedule.schedule_number} • {paidSchedule.paid_date || 'hari ini'}</p>
              </div>
              <DocumentAttachments
                ownerType="Pembayaran Supplier"
                ownerId={paidSchedule.id}
                ownerName={paidSchedule.schedule_number}
                suggestedCategories={['Bukti Bayar', 'Bukti Transfer', 'Kwitansi', 'Lainnya']}
              />
              <p className="text-[10px] text-muted-foreground">Bukti bayar disimpan **privately** — no public URL, so access follows your app's permissions.</p>
            </div>
            <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3">
              <button onClick={() => setPaidSchedule(null)} className="w-full btn-primary py-2 rounded-md text-xs font-medium">Selesai</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function POForm({ suppliers, userName, clinicRole, onClose, onSaved }) {
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState([]);
  const [medSearch, setMedSearch] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { base44.entities.Medicine.list().then(setMedicines); }, []);

  const filteredMeds = medSearch ? medicines.filter((m) => m.name?.toLowerCase().includes(medSearch.toLowerCase()) || m.active_substance?.toLowerCase().includes(medSearch.toLowerCase())) : [];

  const addItem = (m) => {
    setItems((prev) => [...prev, { medicine_id: m.id, medicine_name: m.name, unit: m.unit || '', quantity: 1, unit_price: m.purchase_price || 0, subtotal: m.purchase_price || 0 }]);
    setMedSearch('');
  };

  const updateItem = (i, k, v) => {
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [k]: v };
      updated.subtotal = (updated.quantity || 0) * (updated.unit_price || 0);
      return updated;
    }));
  };

  const total = items.reduce((s, i) => s + (i.subtotal || 0), 0);

  const submit = async () => {
    if (!supplier || items.length === 0) { toast({ title: 'Pilih supplier & item', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const sup = suppliers.find((s) => s.id === supplier);
      const today = new Date().toISOString().split('T')[0];
      const hasNarcotic = items.some(it => {
        const med = medicines.find(m => m.id === it.medicine_id);
        return med?.category === 'Narkotika/Psikotropika';
      });
      const poNumber = hasNarcotic ? `SPN-${today.replace(/-/g, '')}-${String(Date.now()).slice(-3)}` : `SP-${today.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
      await base44.entities.PurchaseOrder.create({
        po_number: poNumber,
        supplier_id: supplier, supplier_name: sup.name,
        supplier_snapshot: { name: sup.name, address: sup.address || '', phone: sup.phone || '', email: sup.email || '' },
        order_date: today, expected_date: today, status: 'Menunggu Approval',
        is_narcotic_po: hasNarcotic,
        narcotic_form_number: hasNarcotic ? poNumber : '',
        items, total_amount: total, created_by: userName, created_by_role: clinicRole,
        source_type: 'Manual', document_type: 'Surat Pesanan', document_status: 'Menunggu Approval',
      });
      toast({ title: 'SP dibuat', description: 'Menunggu approval APJ' });
      onSaved();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card h-full overflow-y-auto border-l border-border" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Purchase Order Baru</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground">Supplier</label>
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls}>
              <option value="">Pilih supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Cari Obat</label>
            <div className="relative">
              <input value={medSearch} onChange={(e) => setMedSearch(e.target.value)} className={inputCls} placeholder="Nama obat / zat aktif…" />
              {medSearch && filteredMeds.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg z-10 max-h-40 overflow-y-auto">
                  {filteredMeds.slice(0, 6).map((m) => (
                    <button key={m.id} onClick={() => addItem(m)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-xs">
                      <Package className="w-3 h-3 text-muted-foreground" />
                      <span>{m.name}</span>
                      <span className="text-muted-foreground ml-auto">Rp {(m.purchase_price || 0).toLocaleString('id-ID')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="micro-label mb-1">Item PO</p>
            <div className="space-y-1.5">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/30 rounded p-2">
                  <span className="text-xs flex-1 truncate">{it.medicine_name}</span>
                  <input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', +e.target.value)} className="w-14 px-1 py-1 border border-border rounded text-xs text-center" />
                  <span className="text-[11px] text-muted-foreground">×</span>
                  <input type="number" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', +e.target.value)} className="w-20 px-1 py-1 border border-border rounded text-xs" />
                  <span className="text-xs font-medium w-20 text-right">Rp {it.subtotal.toLocaleString('id-ID')}</span>
                  <button onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-rose-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Belum ada item</p>}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3">
          <div className="flex justify-between mb-2 text-sm font-semibold">
            <span>Total</span><span className="text-primary">Rp {total.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
            <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50">{saving ? 'Menyimpan…' : 'Buat PO'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupplierForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', payment_terms: 'COD' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  const submit = async () => {
    if (!form.name) { toast({ title: 'Nama supplier wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const count = (await base44.entities.Supplier.list() || []).length;
      await base44.entities.Supplier.create({ ...form, code: `SUP${String(count + 1).padStart(3, '0')}` });
      toast({ title: 'Supplier ditambah' }); onSaved();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Supplier Baru</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className="text-[11px] text-muted-foreground">Nama *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} /></div>
          <div><label className="text-[11px] text-muted-foreground">Kontak Person</label><input value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} className={inputCls} /></div>
          <div><label className="text-[11px] text-muted-foreground">Telepon</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} /></div>
          <div><label className="text-[11px] text-muted-foreground">Email</label><input value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></div>
          <div><label className="text-[11px] text-muted-foreground">Alamat</label><textarea value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} rows={2} /></div>
          <div><label className="text-[11px] text-muted-foreground">Termin Pembayaran</label><select value={form.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} className={inputCls}>{['COD','Net 14','Net 30','Net 60'].map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}
