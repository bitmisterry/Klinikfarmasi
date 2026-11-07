const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Receipt, CreditCard, Banknote, Stethoscope, FileText, X, User, Users, Wallet, Clock, History } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import CashierQueue from '@/components/CashierQueue';
import TransactionHistory from '@/components/TransactionHistory';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import ReceiptPrintModal from '@/components/print/ReceiptPrintModal';
import RoleWorkflowGuide from '@/components/RoleWorkflowGuide';
import CashSessionPanel from '@/components/CashSessionPanel';
import { useAuth } from '@/lib/AuthContext';

export default function Kasir() {
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [prescription, setPrescription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [paidAmount, setPaidAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [alreadyDispensed, setAlreadyDispensed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kasir');
  const [receipt, setReceipt] = useState(null);
  const [cashSession, setCashSession] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => { loadQueue(); }, [refreshKey]);

  const loadQueue = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = await db.entities.QueueEntry.filter(
        { status: 'Kasir', visit_date: today },
        'created_date', 50
      ) || [];
      const transactions = await db.entities.Transaction.list();
      setQueue(q.filter((entry) => {
        const visitId = entry.visit_id || entry.encounter_id;
        return (transactions || []).some((invoice) =>
          invoice.invoice_status !== 'VOIDED'
          && invoice.invoice_status !== 'PAID'
          && ((visitId && invoice.visit_id === visitId) || invoice.queue_entry_id === entry.id));
      }));
    } catch {} finally { setLoading(false); }
  };

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = db.entities.QueueEntry.subscribe(() => loadQueue());
    return unsubscribe;
  }, []);

  const selectPatient = async (q) => {
    setSelected(q);
    setPaidAmount('');
    setPaymentMethod('Tunai');
    setAlreadyDispensed(false);
    setInvoices([]);

    try {
      const visitId = q.visit_id || q.encounter_id;
      const [invoicesByVisit, invoicesByQueue] = await Promise.all([
        visitId ? db.entities.Transaction.filter({ visit_id: visitId }) : Promise.resolve([]),
        db.entities.Transaction.filter({ queue_entry_id: q.id }),
      ]);
      const visitInvoices = [...new Map([...(invoicesByVisit || []), ...(invoicesByQueue || [])].map((invoice) => [invoice.id, invoice])).values()];
      const billableInvoices = visitInvoices.filter(item => item.invoice_status !== 'VOIDED' && item.invoice_status !== 'PAID');
      setInvoices(billableInvoices);
    } catch {}

    // Load prescription if linked
    try {
      let rx = null;
      if (q.prescription_id) {
        rx = await db.entities.Prescription.get(q.prescription_id);
      } else {
        const rxs = await db.entities.Prescription.filter({ queue_entry_id: q.id }) || [];
        if (rxs.length > 0) rx = rxs[0];
      }
      if (rx) {
        setPrescription(rx);
        setAlreadyDispensed(['Selesai Dispensing', 'Billed', 'Paid'].includes(rx.status) || rx.workflow_status === 'DISPENSED');
      } else {
        setPrescription(null);
      }
    } catch {
      setPrescription(null);
    }
  };

  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  const checkout = async () => {
    if (invoices.length === 0) { toast({ title: 'Belum ada tagihan terbuka', description: 'Kasir hanya dapat melunasi invoice yang dibentuk otomatis oleh layanan klinik atau farmasi.', variant: 'destructive' }); return; }
    if (!cashSession) { toast({ title: 'Shift kas belum dibuka', description: 'Buka shift kas terlebih dahulu agar pembayaran terhubung ke CashSession dan laporan shift.', variant: 'destructive' }); return; }
    if (prescription && invoices.some((invoice) => invoice.cash_point === 'farmasi') && !alreadyDispensed) {
      toast({ title: 'Menunggu farmasi', description: 'Resep belum selesai disiapkan dan diserahkan. Kasir belum dapat menagih tagihan farmasi ini.', variant: 'destructive' }); return;
    }
    if (total <= 0) { toast({ title: 'Tidak ada tagihan', variant: 'destructive' }); return; }
    if (paymentMethod === 'Tunai' && paidAmount && parseFloat(paidAmount) < total) {
      toast({ title: 'Jumlah bayar kurang', variant: 'destructive' }); return;
    }
    setProcessing(true);
    try {
      const paidAt = new Date().toISOString();
      const tendered = paymentMethod === 'Tunai' ? (parseFloat(paidAmount) || total) : total;
      const paidInvoices = [];
      const cashierName = user?.full_name || user?.email || 'Kasir';
      for (const invoice of invoices) {
        const txn = await db.entities.Transaction.update(invoice.id, {
          invoice_status: 'PAID',
          payment_method: paymentMethod,
          payment_status: 'Lunas',
          paid_amount: Number(invoice.total || 0),
          change_amount: invoice.id === invoices[0].id && paymentMethod === 'Tunai' ? Math.max(0, tendered - total) : 0,
          paid_at: paidAt,
          cashier_id: user?.id || '',
          cashier_name: cashierName,
          cash_session_id: cashSession.id,
        });
        paidInvoices.push(txn);
        await db.entities.Payment.create({
          invoice_id: txn.id,
          visit_id: txn.visit_id || selected.visit_id || selected.encounter_id || '',
          cash_point: txn.cash_point || 'klinik',
          amount: Number(txn.total || 0),
          method: paymentMethod,
          status: 'PAID',
          reference: txn.invoice_number,
          paid_at: paidAt,
          cash_session_id: cashSession.id,
        });
      }

      const closure = await db.functions.invoke('refreshEncounterClosure', { queue_entry_id: selected.id });
      const finalQueue = (closure.data || closure).queue;

      // Audit log
      await db.entities.AuditLog.create({
        action: 'create', entity: 'Transaction', entity_id: paidInvoices[0]?.id,
        description: `Pembayaran kasir terpadu ${paidInvoices.map((item) => item.invoice_number).join(', ')} • ${paidInvoices.length} invoice • Total Rp ${total.toLocaleString('id-ID')} • Status kunjungan ${finalQueue?.status || '-'}`,
        user_id: user?.id || '', user_name: user?.full_name || user?.email || 'Kasir', user_role: 'Kasir', severity: 'Info',
        timestamp: new Date().toISOString(),
      });

      toast({
        title: `Pembayaran ${paidInvoices.length} tagihan berhasil`,
        description: finalQueue?.status === 'Selesai' ? 'Kunjungan ditutup; seluruh prasyarat klinis, farmasi, dan pembayaran telah selesai.' : `Total Rp ${total.toLocaleString('id-ID')} • Masih menunggu tahap lain`,
      });
      setReceipt({
        number: `KWT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
        patientName: selected.patient_name,
        invoices: paidInvoices,
        total,
        paymentMethod,
        paidAt,
      });
      setSelected(null);
      setPrescription(null);
      setInvoices([]);
      setPaidAmount('');
      setAlreadyDispensed(false);
      setRefreshKey(k => k + 1);
    } catch (e) {
      toast({ title: 'Gagal memproses pembayaran', description: e.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const change = paymentMethod === 'Tunai' && paidAmount ? Math.max(0, parseFloat(paidAmount) - total) : 0;

  return (
    <div className="p-3 lg:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" /> Kasir Klinik
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rekonsiliasi satu kali untuk tagihan layanan/tindakan klinik dan resep yang telah selesai disiapkan farmasi.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setView('kasir')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              view === 'kasir' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}>
            <Receipt className="w-3.5 h-3.5" /> Kasir Aktif
          </button>
          <button onClick={() => setView('riwayat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              view === 'riwayat' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}>
            <History className="w-3.5 h-3.5" /> Riwayat Transaksi
          </button>
        </div>
      </div>

      <RoleWorkflowGuide role="Kasir" visit={selected} />

      <CashSessionPanel user={user} onSessionChange={setCashSession} refreshKey={refreshKey} />

      {view === 'riwayat' ? (
        <TransactionHistory />
      ) : (
      <>
      <ModuleStatHeader stats={[
        { icon: Users, label: 'Antrean Kasir', value: queue.length, color: 'text-amber-600' },
        { icon: Clock, label: 'Pasien Dipilih', value: selected ? 1 : 0, color: 'text-blue-600' },
        { icon: Receipt, label: 'Sumber Tagihan', value: 'Klinik + Farmasi', color: 'text-teal-600' },
        { icon: Wallet, label: 'Total Tagihan', value: selected ? `Rp ${total.toLocaleString('id-ID')}` : 'Rp 0', color: 'text-emerald-600' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 h-[calc(100vh-140px)]">
        {/* Left: Cashier Queue */}
        {loading ? (
          <div className="panel flex items-center justify-center">
            <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <CashierQueue queue={queue} selected={selected} onSelect={selectPatient} />
        )}

        {/* Right: Bill + Checkout */}
        <div className="panel flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Receipt className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Pilih pasien dari antrean kasir</p>
              <p className="text-[11px] mt-0.5">Tagihan yang otomatis dibentuk klinik dan farmasi akan muncul di sini</p>
            </div>
          ) : (
            <>
              {/* Patient header */}
              <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{selected.patient_name}</p>
                  <p className="text-[11px] text-muted-foreground">{selected.queue_number} • {selected.loket || 'Poli Umum'}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Automatically generated visit invoices */}
                <div className="px-3 py-2.5 border-b border-border bg-blue-50/30">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-700">Tagihan Kunjungan Otomatis</p>
                  </div>
                  {invoices.length === 0 ? (
                    <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">Belum ada invoice terbuka. Pembayaran dikunci sampai tindakan atau dispensing membentuk tagihan.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {invoices.map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between rounded border border-border bg-card px-3 py-2">
                          <div>
                            <p className="text-xs font-medium">{invoice.cash_point === 'farmasi' ? 'Tagihan Farmasi' : 'Layanan & Tindakan Klinik'}</p>
                            <p className="text-[10px] text-muted-foreground">{invoice.invoice_number} • {invoice.cash_point === 'farmasi' ? 'Disiapkan Apoteker' : 'Dibentuk Dokter'}</p>
                          </div>
                          <span className="text-sm font-semibold">Rp {Number(invoice.total || 0).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {prescription && (
                  <div className="px-3 py-2.5 border-b border-border bg-amber-50/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-amber-600" /><span className="text-xs font-semibold text-amber-700">Resep {prescription.prescription_number}</span></div>
                    <span className={`pill ${alreadyDispensed ? 'pill-success' : 'pill-warning'}`}>{alreadyDispensed ? 'Siap direkonsiliasi di kasir' : 'Belum selesai di farmasi'}</span>
                  </div>
                )}
              </div>

              {/* Checkout */}
              <div className="border-t border-border p-3 space-y-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Jumlah invoice</span>
                    <span>{invoices.length} tagihan</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5">
                    <span>Total</span>
                    <span className="text-primary">Rp {total.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div>
                  <p className="micro-label mb-1">Metode Bayar</p>
                  <div className="grid grid-cols-3 gap-1">
                    {['Tunai', 'QRIS', 'Debit'].map(m => (
                      <button key={m} onClick={() => setPaymentMethod(m)}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded text-xs border transition-colors ${
                          paymentMethod === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                        }`}>
                        {m === 'Tunai' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />} {m}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'Tunai' && (
                  <div>
                    <p className="micro-label mb-1">Jumlah Bayar</p>
                    <input
                      type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                      placeholder={total.toString()}
                      className="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-primary"
                    />
                    {paidAmount && change > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">Kembalian: Rp {change.toLocaleString('id-ID')}</p>
                    )}
                  </div>
                )}

                <button
                  onClick={checkout} disabled={processing || invoices.length === 0}
                  className="w-full btn-primary py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Receipt className="w-4 h-4" /> {processing ? 'Memproses…' : 'Bayar & Rekonsiliasi Kunjungan'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </>
      )}
      <ReceiptPrintModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
