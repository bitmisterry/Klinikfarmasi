const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArchiveX, ClipboardCheck, ClipboardList, FileClock, FileText,
  FlaskConical, Package, Pill, Receipt, ShieldAlert, ShieldCheck, Truck,
} from 'lucide-react';
import { HomeGreeting, TodayGrid, AttentionList, TaskChecklist, HomePanel } from '@/components/home/HomeParts';
import { getClinicRole } from '@/lib/roles';

const CONTROLLED_CATEGORIES = new Set(['Narkotika/Psikotropika', 'Narkotika', 'Psikotropika', 'Prekursor']);
const ACTIVE_RX_STATUSES = ['Baru', 'Diresepkan', 'Dispensing'];
const safeList = (promise) => promise.catch(() => []);

function SmallMetric({ value, label, tone = 'muted' }) {
  const backgrounds = { muted: 'bg-muted', amber: 'bg-amber-50', rose: 'bg-rose-50', teal: 'bg-teal-50', blue: 'bg-blue-50' };
  const textColors = { muted: '', amber: 'text-amber-600', rose: 'text-rose-600', teal: 'text-teal-600', blue: 'text-blue-600' };
  return <div className={`text-center px-3 py-2.5 rounded-md ${backgrounds[tone]}`}><p className={`text-kpi-sm ${textColors[tone]}`}>{value}</p><p className="text-caption">{label}</p></div>;
}

function BoundaryNote({ children }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">{children}</div>;
}

export default function PharmacistHome({ user }) {
  const role = getClinicRole(user);
  const isApj = role === 'Apoteker Penanggung Jawab';
  const isCompanion = role === 'Apoteker Pendamping';
  const isAdminFarmasi = role === 'Admin Farmasi';
  const isPharmacist = role === 'Apoteker';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const in7 = new Date(); in7.setDate(in7.getDate() + 7);
        const in30 = new Date(); in30.setDate(in30.getDate() + 30);
        const operationalPharmacy = isPharmacist || isApj || isCompanion;
        const canSeePurchasing = isPharmacist || isApj || isAdminFarmasi;
        const [rx, racikan, meds, batches, invoices, pos, purchaseOrders, requests] = await Promise.all([
          operationalPharmacy ? safeList(db.entities.Prescription.filter({ status: { $in: ACTIVE_RX_STATUSES } }, '-created_date', 50)) : Promise.resolve([]),
          operationalPharmacy ? safeList(db.entities.RacikanTemplate.filter({ workflow_status: { $in: ['Review Farmasi', 'Siap Diracik', 'Diracik'] } }, '-created_date', 20)) : Promise.resolve([]),
          safeList(db.entities.Medicine.list()),
          safeList(db.entities.StockBatch.filter({ status: 'Aktif' })),
          canSeePurchasing ? safeList(db.entities.SupplierInvoice.filter({ status: { $ne: 'Lunas' } }, 'due_date', 50)) : Promise.resolve([]),
          isPharmacist || isApj ? safeList(db.entities.Transaction.filter({ transaction_date: today, type: 'Apotek/POS' })) : Promise.resolve([]),
          canSeePurchasing ? safeList(db.entities.PurchaseOrder.list()) : Promise.resolve([]),
          safeList(db.entities.InternalRequest.filter({ type: 'Pengajuan Pemusnahan Obat' }, '-created_date', 50)),
        ]);
        if (cancelled) return;
        setData({
          rx: rx || [], racikan: racikan || [], meds: meds || [],
          batches: (batches || []).filter((batch) => batch.expiry_date && batch.expiry_date <= in30.toISOString().split('T')[0] && batch.expiry_date >= today),
          invoices: invoices || [], pos: pos || [], purchaseOrders: purchaseOrders || [], requests: requests || [],
          in7: in7.toISOString().split('T')[0],
        });
      } catch (error) {
        console.error(error);
        if (!cancelled) setData({ rx: [], racikan: [], meds: [], batches: [], invoices: [], pos: [], purchaseOrders: [], requests: [], in7: '' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdminFarmasi, isApj, isCompanion, isPharmacist]);

  const derived = useMemo(() => {
    if (!data) return {};
    const lowStock = data.meds.filter((medicine) => (medicine.stock_on_hand || 0) > 0 && (medicine.stock_on_hand || 0) <= (medicine.min_stock || 0));
    const stockOut = data.meds.filter((medicine) => (medicine.stock_on_hand || 0) <= 0);
    const waitingDispense = data.rx.filter((prescription) => ['Diresepkan', 'Dispensing'].includes(prescription.status));
    const controlledMeds = data.meds.filter((medicine) => CONTROLLED_CATEGORIES.has(medicine.category));
    const pendingApprovals = data.purchaseOrders.filter((po) => po.status === 'Menunggu Approval' || po.approval_status === 'Menunggu Approval');
    const pendingReceipts = data.purchaseOrders.filter((po) => ['Dikirim', 'Diterima Sebagian'].includes(po.status));
    const dueInvoices = data.invoices.filter((invoice) => invoice.due_date && invoice.due_date <= data.in7);
    const pendingDestruction = data.requests.filter((request) => !['Disetujui', 'Ditolak', 'Selesai', 'Dibatalkan'].includes(request.status));
    const interactionRx = data.rx.filter((prescription) => (prescription.items || []).some((item) => {
      const medicine = data.meds.find((row) => row.id === item.medicine_id);
      return medicine?.interactions || medicine?.pregnancy_category;
    }));
    return { lowStock, stockOut, waitingDispense, controlledMeds, pendingApprovals, pendingReceipts, dueInvoices, pendingDestruction, interactionRx };
  }, [data]);

  if (loading || !data) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;

  const roleLabel = role === 'Apoteker' ? 'Apoteker' : role;
  const taskStorageKey = `pharmacy-${role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  if (isApj) {
    const attention = [
      ...(derived.pendingApprovals.length ? [{ dot: 'red', text: `${derived.pendingApprovals.length} PO menunggu approval APJ`, to: '/purchasing' }] : []),
      ...(derived.pendingDestruction.length ? [{ dot: 'red', text: `${derived.pendingDestruction.length} pengajuan pemusnahan perlu ditinjau`, to: '/pharmacy?tab=pemusnahan' }] : []),
      ...(derived.controlledMeds.length ? [{ dot: 'yellow', text: `${derived.controlledMeds.length} obat narkotika/psikotropika dalam pengawasan`, to: '/pharmacy?tab=sipnap' }] : []),
      ...(derived.lowStock.length + derived.stockOut.length ? [{ dot: 'yellow', text: `${derived.lowStock.length + derived.stockOut.length} obat perlu tindak lanjut stok`, to: '/inventory' }] : []),
    ];
    const tasks = [
      ...derived.pendingApprovals.slice(0, 3).map((po) => ({ id: `apj-po-${po.id}`, label: `Approve PO ${po.po_number}`, to: '/purchasing' })),
      ...derived.pendingDestruction.slice(0, 2).map((request) => ({ id: `apj-destruction-${request.id}`, label: `Review pemusnahan ${request.semester || ''}`, to: '/pharmacy?tab=pemusnahan' })),
      ...(derived.controlledMeds.length ? [{ id: 'apj-sipnap', label: 'Periksa rekap SIPNAP', to: '/pharmacy?tab=sipnap' }] : []),
      ...derived.waitingDispense.slice(0, 2).map((rx) => ({ id: `apj-rx-${rx.id}`, label: `Pantau resep ${rx.patient_name}`, to: '/pharmacy?tab=queue' })),
    ];
    return <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName={roleLabel} />
      <BoundaryNote>Mode APJ: mengawasi proses kefarmasian, menyetujui pengadaan, meninjau pemusnahan, dan memastikan pelaporan narkotika/psikotropika. Pembayaran supplier tetap berada pada Finance.</BoundaryNote>
      <div><h2 className="text-section-title mb-2.5">Pengawasan Farmasi Hari Ini</h2><TodayGrid stats={[
        { icon: FileText, label: 'Resep Aktif', value: data.rx.length },
        { icon: ClipboardCheck, label: 'PO Menunggu Approval', value: derived.pendingApprovals.length },
        { icon: ArchiveX, label: 'Pemusnahan Ditinjau', value: derived.pendingDestruction.length },
        { icon: ShieldAlert, label: 'Obat Khusus', value: derived.controlledMeds.length },
      ]} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HomePanel icon={ShieldCheck} title="Kontrol & Kepatuhan" to="/pharmacy?tab=sipnap" actionLabel="Buka SIPNAP"><div className="p-3 grid grid-cols-2 gap-2.5"><SmallMetric value={derived.controlledMeds.length} label="Narkotika/Psikotropika" tone="rose" /><SmallMetric value={derived.pendingDestruction.length} label="Pemusnahan Menunggu Review" tone="amber" /></div></HomePanel>
        <HomePanel icon={Truck} title="Pengadaan" to="/purchasing" actionLabel="Kelola"><div className="p-3 grid grid-cols-2 gap-2.5"><SmallMetric value={derived.pendingApprovals.length} label="Perlu Approval" tone="amber" /><SmallMetric value={derived.pendingReceipts.length} label="Menunggu Penerimaan" tone="blue" /></div></HomePanel>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><HomePanel icon={AlertTriangle} title="Perlu Perhatian"><AttentionList items={attention} /></HomePanel><HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas APJ"><TaskChecklist storageKey={taskStorageKey} dataTasks={tasks} /></HomePanel></div>
    </div>;
  }

  if (isCompanion) {
    const attention = [
      ...(derived.stockOut.length ? [{ dot: 'red', text: `${derived.stockOut.length} obat habis — laporkan ke APJ`, to: '/inventory' }] : []),
      ...(derived.lowStock.length ? [{ dot: 'yellow', text: `${derived.lowStock.length} obat mendekati batas minimum`, to: '/inventory' }] : []),
      ...(derived.interactionRx.length ? [{ dot: 'yellow', text: `${derived.interactionRx.length} resep memiliki peringatan PIO/interaksi`, to: '/pharmacy?tab=queue' }] : []),
      ...(data.batches.length ? [{ dot: 'yellow', text: `${data.batches.length} batch mendekati kedaluwarsa`, to: '/inventory' }] : []),
    ];
    const tasks = [
      ...derived.waitingDispense.slice(0, 4).map((rx) => ({ id: `companion-rx-${rx.id}`, label: `Screening resep ${rx.patient_name}`, to: '/pharmacy?tab=queue' })),
      ...data.racikan.slice(0, 2).map((racikan) => ({ id: `companion-racikan-${racikan.id}`, label: `Bantu racikan ${racikan.racikan_name}`, to: '/pharmacy?tab=racikan' })),
      ...derived.lowStock.slice(0, 2).map((medicine) => ({ id: `companion-stock-${medicine.id}`, label: `Cek stok ${medicine.name}`, to: '/inventory' })),
    ];
    return <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName={roleLabel} />
      <BoundaryNote>Mode Pendamping: membantu screening, dispensing, etiket, PIO, dan stok sesuai delegasi APJ. Tidak ada akses pengadaan, approval PO, pembayaran supplier, atau persetujuan pemusnahan.</BoundaryNote>
      <div><h2 className="text-section-title mb-2.5">Operasional Dispensing</h2><TodayGrid stats={[
        { icon: FileText, label: 'Resep Ditugaskan', value: data.rx.length },
        { icon: Pill, label: 'Menunggu Dispensing', value: derived.waitingDispense.length },
        { icon: FlaskConical, label: 'Racikan', value: data.racikan.length },
        { icon: AlertTriangle, label: 'Peringatan PIO/Interaksi', value: derived.interactionRx.length },
      ]} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><HomePanel icon={ClipboardCheck} title="Antrean Kerja" to="/pharmacy?tab=queue" actionLabel="Buka Antrean"><div className="p-3 grid grid-cols-2 gap-2.5"><SmallMetric value={derived.waitingDispense.length} label="Perlu Screening" tone="blue" /><SmallMetric value={data.racikan.length} label="Perlu Racikan" tone="amber" /></div></HomePanel><HomePanel icon={Package} title="Stok Delegasi" to="/inventory" actionLabel="Lihat Stok"><div className="p-3 grid grid-cols-2 gap-2.5"><SmallMetric value={derived.stockOut.length} label="Stok Habis" tone="rose" /><SmallMetric value={derived.lowStock.length} label="Stok Rendah" tone="amber" /></div></HomePanel></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><HomePanel icon={AlertTriangle} title="Perlu Perhatian"><AttentionList items={attention} /></HomePanel><HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas pendamping"><TaskChecklist storageKey={taskStorageKey} dataTasks={tasks} /></HomePanel></div>
    </div>;
  }

  if (isAdminFarmasi) {
    const attention = [
      ...(derived.pendingReceipts.length ? [{ dot: 'red', text: `${derived.pendingReceipts.length} PO menunggu penerimaan barang`, to: '/purchasing' }] : []),
      ...(derived.dueInvoices.length ? [{ dot: 'yellow', text: `${derived.dueInvoices.length} faktur mendekati/jatuh tempo`, to: '/purchasing' }] : []),
      ...(derived.stockOut.length ? [{ dot: 'red', text: `${derived.stockOut.length} obat stok habis`, to: '/inventory' }] : []),
      ...(data.batches.length ? [{ dot: 'yellow', text: `${data.batches.length} batch mendekati kedaluwarsa`, to: '/inventory' }] : []),
    ];
    const tasks = [
      ...derived.pendingReceipts.slice(0, 3).map((po) => ({ id: `admin-receipt-${po.id}`, label: `Terima barang ${po.po_number}`, to: '/purchasing' })),
      ...data.invoices.slice(0, 3).map((invoice) => ({ id: `admin-invoice-${invoice.id}`, label: `Proses faktur ${invoice.invoice_number}`, to: '/purchasing' })),
      ...derived.stockOut.slice(0, 2).map((medicine) => ({ id: `admin-stock-${medicine.id}`, label: `Tindak lanjuti stok ${medicine.name}`, to: '/inventory' })),
    ];
    return <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <HomeGreeting user={user} roleName={roleLabel} />
      <BoundaryNote>Mode Admin Farmasi: mengelola administrasi stok, batch, penerimaan, faktur, supplier, dan dokumen pengadaan. Tidak memverifikasi isi resep, melakukan keputusan klinis, atau menyetujui pemusnahan.</BoundaryNote>
      <div><h2 className="text-section-title mb-2.5">Administrasi Farmasi Hari Ini</h2><TodayGrid stats={[
        { icon: FileText, label: 'PO Aktif', value: data.purchaseOrders.length },
        { icon: Package, label: 'Menunggu Penerimaan', value: derived.pendingReceipts.length },
        { icon: Receipt, label: 'Faktur Belum Lunas', value: data.invoices.length },
        { icon: FileClock, label: 'Batch ≤30 Hari', value: data.batches.length },
      ]} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><HomePanel icon={Truck} title="Procurement & Penerimaan" to="/purchasing" actionLabel="Kelola"><div className="p-3 grid grid-cols-2 gap-2.5"><SmallMetric value={derived.pendingReceipts.length} label="Perlu Diterima" tone="amber" /><SmallMetric value={data.invoices.length} label="Faktur Diproses" tone="blue" /></div></HomePanel><HomePanel icon={Package} title="Inventory & Batch" to="/inventory" actionLabel="Kelola"><div className="p-3 grid grid-cols-2 gap-2.5"><SmallMetric value={derived.stockOut.length} label="Stok Habis" tone="rose" /><SmallMetric value={data.batches.length} label="Segera Kedaluwarsa" tone="amber" /></div></HomePanel></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><HomePanel icon={AlertTriangle} title="Perlu Perhatian"><AttentionList items={attention} /></HomePanel><HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas administrasi"><TaskChecklist storageKey={taskStorageKey} dataTasks={tasks} /></HomePanel></div>
    </div>;
  }

  // Apoteker umum: resep dokter → dispensing → tagihan farmasi, ditambah stok,
  // racikan, OTC, dan pengadaan operasional.
  const attention = [
    ...(derived.stockOut.length ? [{ dot: 'red', text: `${derived.stockOut.length} obat stok habis`, to: '/inventory' }] : []),
    ...(derived.lowStock.length ? [{ dot: 'yellow', text: `${derived.lowStock.length} obat hampir habis`, to: '/inventory' }] : []),
    ...(data.batches.length ? [{ dot: 'yellow', text: `${data.batches.length} obat mendekati kedaluwarsa`, to: '/inventory' }] : []),
    ...(derived.dueInvoices.length ? [{ dot: 'red', text: `${derived.dueInvoices.length} faktur jatuh tempo ≤7 hari`, to: '/purchasing' }] : []),
  ];
  const tasks = [
    ...derived.waitingDispense.slice(0, 3).map((rx) => ({ id: `rx-${rx.id}`, label: `Cek resep ${rx.patient_name}`, to: '/pharmacy?tab=queue' })),
    ...data.racikan.slice(0, 2).map((racikan) => ({ id: `rac-${racikan.id}`, label: `Selesaikan racikan ${racikan.racikan_name}`, to: '/pharmacy?tab=racikan' })),
    ...derived.stockOut.slice(0, 2).map((medicine) => ({ id: `out-${medicine.id}`, label: `Ajukan pengadaan ${medicine.name}`, to: '/pharmacy?tab=defecta' })),
  ];
  return <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
    <HomeGreeting user={user} roleName={roleLabel} />
    <div><h2 className="text-section-title mb-2.5">Farmasi Hari Ini</h2><TodayGrid stats={[
      { icon: FileText, label: 'Resep Masuk', value: data.rx.length },
      { icon: FlaskConical, label: 'Racikan', value: data.racikan.length },
      { icon: Pill, label: 'Menunggu Diserahkan', value: derived.waitingDispense.length },
      { icon: Package, label: 'Penjualan OTC', value: data.pos.length },
    ]} /></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><HomePanel icon={Package} title="Stok" to="/inventory" actionLabel="Kelola"><div className="p-3 grid grid-cols-2 gap-2.5"><SmallMetric value={derived.lowStock.length + derived.stockOut.length} label="Perlu Restock" tone="amber" /><SmallMetric value={data.batches.length} label="Mendekati Kedaluwarsa" tone="rose" /></div></HomePanel><HomePanel icon={Receipt} title="Pengadaan" to="/purchasing" actionLabel="Kelola"><div className="p-3 grid grid-cols-2 gap-2.5"><SmallMetric value={data.invoices.length} label="Faktur Belum Lunas" /><SmallMetric value={derived.dueInvoices.length} label="Jatuh Tempo ≤7 Hari" tone="amber" /></div></HomePanel></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><HomePanel icon={AlertTriangle} title="Perlu Perhatian"><AttentionList items={attention} /></HomePanel><HomePanel icon={ClipboardList} title="Yang Perlu Dikerjakan" subtitle="Tugas hari ini"><TaskChecklist storageKey={taskStorageKey} dataTasks={tasks} /></HomePanel></div>
  </div>;
}
