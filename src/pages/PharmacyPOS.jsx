import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2, Plus, Minus, Receipt, CreditCard, Banknote, X, User, ShoppingCart, FileText, Layers, Package, FlaskConical, Wallet, History, ShieldAlert, Tag } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SmartDrugSearch from '@/components/SmartDrugSearch';
import PrescriptionQueue from '@/components/PrescriptionQueue';
import ExternalRxForm from '@/components/ExternalRxForm';
import PengadaanRequests from '@/components/PengadaanRequests';
import { processFEFODispensing } from '@/lib/pharmacy';
import PatientClinicalDrawer from '@/components/PatientClinicalDrawer';
import RacikanWorksheet from '@/components/RacikanWorksheet';
import TransactionHistory from '@/components/TransactionHistory';
import { racikanToFEFOCart } from '@/lib/racikan';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import DefectaPanel from '@/components/pharmacy/DefectaPanel';
import SipnapReport from '@/components/pharmacy/SipnapReport';
import DestructionRequestPanel from '@/components/pharmacy/DestructionRequestPanel';
import TebusStatusPanel from '@/components/pharmacy/TebusStatusPanel';
import PioRecorder from '@/components/pharmacy/PioRecorder';
import PrescriptionScanUpload from '@/components/pharmacy/PrescriptionScanUpload';
import PatientQuickAccessDrawer from '@/components/PatientQuickAccessDrawer';
import LabelPrintModal from '@/components/print/LabelPrintModal';
import PrescriptionPrintModal from '@/components/print/PrescriptionPrintModal';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';
import RoleWorkflowGuide from '@/components/RoleWorkflowGuide';
import DrugInfoDrawer from '@/components/DrugInfoDrawer';
import PrescriptionDictionaryPanel from '@/components/pharmacy/PrescriptionDictionaryPanel';

export default function PharmacyPOS() {
  const [tab, setTab] = useState('pos');
  const [searchParams] = useSearchParams();
  const [cart, setCart] = useState([]);
  const [patient, setPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [showPatientList, setShowPatientList] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [paidAmount, setPaidAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showExternalRx, setShowExternalRx] = useState(false);
  const [activePrescription, setActivePrescription] = useState(null);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [clinicalPatient, setClinicalPatient] = useState(null);
  const [racikanFromRx, setRacikanFromRx] = useState(null);
  const [discountType, setDiscountType] = useState('Tidak Ada');
  const [discountValue, setDiscountValue] = useState(0);
  const [embalaseFee, setEmbalaseFee] = useState(0);
  const [showTebus, setShowTebus] = useState(null);
  const [showPIO, setShowPIO] = useState(null);
  const [showScan, setShowScan] = useState(null);
  const [showLabel, setShowLabel] = useState(null);
  const [showPrescriptionPrint, setShowPrescriptionPrint] = useState(null);
  const [quickPatient, setQuickPatient] = useState(null);
  const [drugInfo, setDrugInfo] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const clinicRole = getClinicRole(user);
  const canDispense = ['Apoteker', 'Apoteker Penanggung Jawab', 'Apoteker Pendamping'].includes(clinicRole);
  const canViewSipnap = ['Apoteker', 'Apoteker Penanggung Jawab'].includes(clinicRole);
  const canViewDestruction = ['Apoteker', 'Apoteker Penanggung Jawab', 'Admin Farmasi'].includes(clinicRole);
  const canManageDictionary = ['Apoteker Penanggung Jawab', 'Admin Farmasi'].includes(clinicRole);
  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const allowedTabs = new Set(['pos', 'queue', 'pengadaan', 'racikan', 'riwayat', 'defecta']);
    if (canViewSipnap) allowedTabs.add('sipnap');
    if (canViewDestruction) allowedTabs.add('pemusnahan');
    if (canManageDictionary) allowedTabs.add('kamus');
    if (requestedTab && allowedTabs.has(requestedTab)) setTab(requestedTab);
  }, [canManageDictionary, canViewDestruction, canViewSipnap, searchParams]);

  useEffect(() => {
    base44.entities.Patient.list().then(setPatients).catch(() => {});
    base44.entities.Medicine.list().then(setMedicines).catch(() => {});
  }, []);

  const addToCart = (med) => {
    setCart(prev => {
      const existing = prev.find(i => i.medicine_id === med.id);
      if (existing) {
        if (existing.quantity >= (med.stock_on_hand || 0)) {
          toast({ title: 'Stok tidak mencukupi', variant: 'destructive' });
          return prev;
        }
        return prev.map(i => i.medicine_id === med.id ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price } : i);
      }
      return [...prev, {
        medicine_id: med.id, medicine_name: med.name,
        quantity: 1, price: med.selling_price || 0,
        subtotal: med.selling_price || 0, stock: med.stock_on_hand || 0,
        product_type: med.product_type || 'Obat',
        category: med.category || '',
      }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i.medicine_id !== id) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return null;
      if (newQty > i.stock) { toast({ title: 'Stok tidak mencukupi', variant: 'destructive' }); return i; }
      return { ...i, quantity: newQty, subtotal: newQty * i.price };
    }).filter(Boolean));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.medicine_id !== id));

  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);

  // Calculate discount amount based on type
  const calculateDiscountAmount = (baseSubtotal) => {
    if (discountType === 'Tidak Ada' || !discountValue) return 0;
    if (discountType === 'Keluarga' || discountType === 'Karyawan' || discountType === 'Custom') {
      // If value <= 100, treat as percentage; otherwise nominal
      return discountValue <= 100 ? Math.round(baseSubtotal * discountValue / 100) : discountValue;
    }
    return 0;
  };
  const discountAmount = React.useMemo(() => calculateDiscountAmount(subtotal), [discountType, discountValue, subtotal]);

  const total = Math.max(0, subtotal - discountAmount + embalaseFee);
  const isClinicPrescription = Boolean(activePrescription?.visit_id || activePrescription?.encounter_id || activePrescription?.queue_entry_id);

  const filteredPatients = patientSearch ? patients.filter(p =>
    p.full_name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.mr_number?.toLowerCase().includes(patientSearch.toLowerCase())
  ) : [];

  // Load prescription items into cart for dispensing
  const handleDispensePrescription = async (rx) => {
    setActivePrescription(rx);
    // If racikan prescription, route to Racikan tab with template loaded
    if (rx.is_racikan && rx.racikan_template_id) {
      try {
        const tpl = await base44.entities.RacikanTemplate.get(rx.racikan_template_id);
        if (rx.patient_name && rx.patient_name !== 'Walk-in') {
          const p = patients.find(x => x.full_name === rx.patient_name);
          if (p) setPatient(p);
        }
        setRacikanFromRx(tpl);
        setTab('racikan');
        toast({ title: `Resep racikan ${rx.prescription_number} dimuat`, description: 'Review komposisi & lanjutkan workflow racikan' });
        return;
      } catch (e) {
        toast({ title: 'Gagal memuat racikan', description: e.message, variant: 'destructive' });
      }
    }
    setTab('pos');
    // Load items into cart
    const meds = await base44.entities.Medicine.list();
    const newCart = (rx.items || []).map(it => {
      const med = meds.find(m => m.id === it.medicine_id);
      const price = med?.selling_price || 0;
      const stock = med?.stock_on_hand || 0;
      return {
        medicine_id: it.medicine_id,
        medicine_name: it.medicine_name,
        quantity: it.quantity || 1,
        price,
        subtotal: (it.quantity || 1) * price,
        stock,
        product_type: med?.product_type || 'Obat',
        category: med?.category || '',
      };
    }).filter(i => i.medicine_id);
    setCart(newCart);
    if (rx.patient_name && rx.patient_name !== 'Walk-in') {
      const p = patients.find(x => x.full_name === rx.patient_name);
      if (p) setPatient(p);
    }
    toast({ title: `Resep ${rx.prescription_number} dimuat ke keranjang`, description: 'Periksa item, selesaikan dispensing, lalu kirim tagihan ke Kasir Klinik' });
  };

  // Process racikan: FEFO dispense components, create transaction with racikan item, audit log
  const handleProcessRacikan = async (racikan, computed) => {
    const fefoCart = racikanToFEFOCart(computed);
    if (fefoCart.length === 0) {
      toast({ title: 'Tidak ada bahan untuk didispensing', variant: 'destructive' });
      throw new Error('Empty FEFO cart');
    }

    const today = new Date().toISOString().split('T')[0];
    const invNum = `FARMASI-${today.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;

    // FEFO dispensing for racikan components
    const dispenseResult = await processFEFODispensing(fefoCart, { transaction_id: 'pending', invoice_number: invNum, reference_type: activePrescription ? 'Prescription' : 'OTC' });
    if (!dispenseResult.success) {
      toast({
        title: 'Stok tidak cukup untuk racikan',
        description: dispenseResult.errors.map(e => e.message).join('; '),
        variant: 'destructive',
      });
      throw new Error('Insufficient stock');
    }

    // Create transaction with racikan as single line item
    const txn = await base44.entities.Transaction.create({
      invoice_number: invNum,
      type: 'Resep',
      cash_point: 'farmasi',
      invoice_status: isClinicPrescription ? 'POSTED' : 'PAID',
      encounter_id: activePrescription?.encounter_id || activePrescription?.visit_id || '',
      visit_id: activePrescription?.visit_id || activePrescription?.encounter_id || '',
      queue_entry_id: activePrescription?.queue_entry_id || '',
      prescription_id: activePrescription?.id || '',
      patient_id: patient?.id || '',
      patient_name: patient?.full_name || 'Walk-in',
      items: [{
        is_racikan: true,
        medicine_id: `racikan-${invNum}`,
        medicine_name: racikan.racikan_name,
        quantity: 1,
        price: computed.total,
        subtotal: computed.total,
        bentuk_racikan: racikan.bentuk_racikan,
        jumlah_resep: racikan.jumlah_resep,
        jumlah_ambil: racikan.jumlah_ambil,
        signa: racikan.signa,
        components: computed.components.map(c => ({
          medicine_id: c.medicine_id,
          medicine_name: c.medicine_name,
          kekuatan: c.kekuatan,
          dosis_per_racikan: c.dosis_per_racikan,
          dosis_mode: c.dosis_mode,
          dosis_label: c.dosis_label,
          kebutuhan_teoritis: c.kebutuhan_teoritis,
          kebutuhan_ambil: c.kebutuhan_ambil,
          harga_unit: c.harga_unit,
          subtotal: c.subtotal,
        })),
        kemasan_fee: racikan.kemasan_fee,
        jasa_racik_fee: racikan.jasa_racik_fee,
      }],
      subtotal: computed.total,
      total: computed.total,
      payment_method: isClinicPrescription ? '' : 'Tunai',
      payment_status: isClinicPrescription ? 'Belum Bayar' : 'Lunas',
      paid_amount: isClinicPrescription ? 0 : computed.total,
      transaction_date: today,
    });

    if (!isClinicPrescription) {
      await base44.entities.Payment.create({
        invoice_id: txn.id,
        visit_id: txn.visit_id || '',
        cash_point: 'farmasi',
        amount: computed.total,
        method: 'Tunai',
        status: 'PAID',
        reference: invNum,
        paid_at: new Date().toISOString(),
      });
    }

    // Update stock movements with real transaction id
    await base44.entities.StockMovement.updateMany(
      { reference_id: 'pending', reference_number: invNum },
      { $set: { reference_id: txn.id } }
    );

    // Audit log with full calculation trail
    await base44.entities.AuditLog.create({
      action: 'create', entity: 'Transaction', entity_id: txn.id,
      description: `Racikan ${racikan.racikan_name} (${racikan.bentuk_racikan}) — ${racikan.jumlah_ambil} unit, ${computed.components.length} bahan, total Rp ${computed.total.toLocaleString('id-ID')}`,
      old_value: '',
      new_value: JSON.stringify({
        bentuk: racikan.bentuk_racikan,
        jumlah_resep: racikan.jumlah_resep,
        jumlah_ambil: racikan.jumlah_ambil,
        components: computed.components.map(c => ({
          name: c.medicine_name, dosis: c.dosis_label, teoritis: c.kebutuhan_teoritis, ambil: c.kebutuhan_ambil, biaya: c.subtotal,
        })),
        kemasan: racikan.kemasan_fee, jasa_racik: racikan.jasa_racik_fee, total: computed.total,
      }),
      user_name: 'Apoteker', severity: 'Info',
      timestamp: new Date().toISOString(),
    });

    // Update prescription & queue for clinic patients
    const rxId = activePrescription?.id;
    const queueId = activePrescription?.queue_entry_id;
    if (rxId) {
      await base44.entities.Prescription.update(rxId, { status: 'Selesai Dispensing', workflow_status: 'DISPENSED', transaction_id: txn.id, dispensed_at: new Date().toISOString() });
      const rxOrders = await base44.entities.Order.filter({ source_id: rxId });
      for (const order of rxOrders) await base44.entities.Order.update(order.id, { status: 'DISPENSED', completed_at: new Date().toISOString() });
    }
    if (queueId) {
      await base44.functions.invoke('refreshEncounterClosure', {
        queue_entry_id: queueId,
        prescription_id: rxId,
        pharmacy_transaction_id: txn.id,
      });
    }

    toast({
      title: `Racikan ${racikan.racikan_name} diproses`,
      description: isClinicPrescription
        ? `${racikan.jumlah_ambil} ${racikan.bentuk_racikan.toLowerCase()} siap diserahkan. Tagihan Rp ${computed.total.toLocaleString('id-ID')} dikirim ke Kasir Klinik untuk pembayaran terpadu.`
        : `Total Rp ${computed.total.toLocaleString('id-ID')} telah dibayar di kasir farmasi.`,
    });
    if (activePrescription) {
      // The prescription has already been dispensed at this point. Keep the
      // label modal open, but return the underlying page to the queue so that
      // closing the modal never shows a fresh worksheet or repeats the racikan
      // steps for the same prescription.
      setShowLabel({ rx: activePrescription });
      setTab('queue');
    }
    setRacikanFromRx(null);
    setActivePrescription(null);
  };

  const checkout = async () => {
    if (cart.length === 0) { toast({ title: 'Keranjang kosong', variant: 'destructive' }); return; }
    if (!activePrescription && cart.some(item => item.category === 'Obat Bebas Terbatas') && !canDispense) {
      toast({ title: 'Otorisasi apoteker wajib', description: 'Obat bebas terbatas hanya dapat difinalisasi oleh apoteker pengawas.', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const invNum = `FARMASI-${today.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;

      // Quote uses the exact FEFO plan that dispensing uses. This prevents a
      // stale master price from being charged when the earliest-expiry batch
      // has a different approved price.
      const quote = await processFEFODispensing(cart, {
        transaction_id: 'preview', invoice_number: invNum,
        reference_type: activePrescription ? 'Prescription' : 'OTC', preview_only: true,
      });
      if (!quote.success) {
        toast({ title: 'Stok tidak cukup', description: quote.errors.map(e => e.message).join('; '), variant: 'destructive' });
        setProcessing(false);
        return;
      }
      const resolvedSubtotal = quote.itemsWithBatches.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const resolvedDiscount = calculateDiscountAmount(resolvedSubtotal);
      const resolvedTotal = Math.max(0, resolvedSubtotal - resolvedDiscount + Number(embalaseFee || 0));
      if (!isClinicPrescription && paymentMethod === 'Tunai' && paidAmount && parseFloat(paidAmount) < resolvedTotal) {
        toast({ title: 'Jumlah bayar kurang', description: `Total FEFO: Rp ${resolvedTotal.toLocaleString('id-ID')}`, variant: 'destructive' });
        setProcessing(false);
        return;
      }

      // FEFO dispensing: allocate batches, reduce stock, record movements
      const dispenseResult = await processFEFODispensing(cart, {
        transaction_id: 'pending',
        invoice_number: invNum,
        reference_type: activePrescription ? 'Prescription' : 'OTC',
      });

      if (!dispenseResult.success) {
        toast({
          title: 'Stok tidak cukup',
          description: dispenseResult.errors.map(e => e.message).join('; '),
          variant: 'destructive',
        });
        setProcessing(false);
        return;
      }

      // Resep dari kunjungan klinik hanya disiapkan di farmasi. Invoice-nya
      // direkonsiliasi dan dibayar bersama layanan klinik oleh Kasir.
      const txn = await base44.entities.Transaction.create({
        invoice_number: invNum,
        type: activePrescription ? 'Resep' : 'Apotek/POS',
        cash_point: 'farmasi',
        invoice_status: isClinicPrescription ? 'POSTED' : 'PAID',
        encounter_id: activePrescription?.encounter_id || activePrescription?.visit_id || '',
        visit_id: activePrescription?.visit_id || activePrescription?.encounter_id || '',
        queue_entry_id: activePrescription?.queue_entry_id || '',
        patient_id: patient?.id || '',
        patient_name: patient?.full_name || (activePrescription?.patient_name !== 'Walk-in' ? activePrescription?.patient_name : 'Walk-in'),
        prescription_id: activePrescription?.id || '',
        items: dispenseResult.itemsWithBatches.map(i => ({
          medicine_id: i.medicine_id, medicine_name: i.medicine_name,
          quantity: i.quantity, price: i.price, subtotal: i.subtotal,
          batch_number: i.batch_number, price_source: i.price_source, batch_pricing: i.batch_pricing,
        })),
        subtotal: resolvedSubtotal,
        discount: resolvedDiscount,
        discount_type: discountType,
        discount_value: discountValue,
        embalase_fee: embalaseFee,
        total: resolvedTotal,
        payment_method: isClinicPrescription ? '' : paymentMethod,
        payment_status: isClinicPrescription ? 'Belum Bayar' : 'Lunas',
        paid_amount: isClinicPrescription ? 0 : (paymentMethod === 'Tunai' ? (parseFloat(paidAmount) || resolvedTotal) : resolvedTotal),
        change_amount: isClinicPrescription ? 0 : (paymentMethod === 'Tunai' ? Math.max(0, (parseFloat(paidAmount) || resolvedTotal) - resolvedTotal) : 0),
        transaction_date: today,
      });

      if (!isClinicPrescription) {
        await base44.entities.Payment.create({
          invoice_id: txn.id,
          visit_id: txn.visit_id || '',
          cash_point: 'farmasi',
          amount: resolvedTotal,
          method: paymentMethod,
          status: 'PAID',
          reference: invNum,
          paid_at: new Date().toISOString(),
        });
      }

      // Update stock movements with real transaction id
      await base44.entities.StockMovement.updateMany(
        { reference_id: 'pending', reference_number: invNum },
        { $set: { reference_id: txn.id } }
      );

      // Update prescription status if from prescription
      if (activePrescription) {
        await base44.entities.Prescription.update(activePrescription.id, {
          status: 'Selesai Dispensing',
          workflow_status: 'DISPENSED',
          transaction_id: txn.id,
          dispensed_at: new Date().toISOString(),
        });
        const rxOrders = await base44.entities.Order.filter({ source_id: activePrescription.id });
        for (const order of rxOrders) {
          await base44.entities.Order.update(order.id, { status: 'DISPENSED', completed_at: new Date().toISOString() });
        }
        if (activePrescription.queue_entry_id) {
          await base44.functions.invoke('refreshEncounterClosure', {
            queue_entry_id: activePrescription.queue_entry_id,
            prescription_id: activePrescription.id,
            pharmacy_transaction_id: txn.id,
          });
        }
      }

      // Audit log
      await base44.entities.AuditLog.create({
        action: 'create', entity: 'Transaction', entity_id: txn.id,
        description: `Transaksi POS ${invNum} Rp ${resolvedTotal.toLocaleString('id-ID')} • FEFO ${dispenseResult.itemsWithBatches.length} item`,
        user_name: 'Sistem', severity: 'Info',
        timestamp: new Date().toISOString(),
      });

      toast({
        title: isClinicPrescription ? `Dispensing resep ${invNum} selesai` : `Pembayaran farmasi ${invNum} berhasil`,
        description: isClinicPrescription
          ? `Tagihan obat Rp ${resolvedTotal.toLocaleString('id-ID')} sudah dikirim ke Kasir Klinik bersama layanan kunjungan.`
          : `Total Rp ${resolvedTotal.toLocaleString('id-ID')} • Harga dan batch FEFO tercatat`,
      });
      if (activePrescription) setShowLabel({ rx: activePrescription });
      setCart([]); setPatient(null); setPaidAmount(''); setPatientSearch('');
      setDiscountType('Tidak Ada'); setDiscountValue(0); setEmbalaseFee(0);
      setActivePrescription(null);
      setQueueRefreshKey(k => k + 1);
    } catch (e) {
      toast({ title: 'Gagal memproses transaksi', description: e.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const change = paymentMethod === 'Tunai' && paidAmount ? Math.max(0, parseFloat(paidAmount) - total) : 0;

  return (
    <div className="p-3 lg:p-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3">
        <button onClick={() => setTab('pos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'pos' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          }`}>
          <ShoppingCart className="w-3.5 h-3.5" /> POS / Kasir
        </button>
        <button onClick={() => setTab('queue')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'queue' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          }`}>
          <FileText className="w-3.5 h-3.5" /> Antrean Resep
        </button>
        <button onClick={() => setShowExternalRx(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted">
          <FileText className="w-3.5 h-3.5 text-primary" /> Resep Eksternal
        </button>
        <button onClick={() => setTab('racikan')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'racikan' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          }`}>
          <FlaskConical className="w-3.5 h-3.5" /> Kalkulator Racikan
        </button>
        <button onClick={() => setTab('defecta')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'defecta' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          }`}>
          <Package className="w-3.5 h-3.5" /> Defecta
        </button>
        <button onClick={() => setTab('pengadaan')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'pengadaan' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          }`}>
          <Package className="w-3.5 h-3.5" /> Pengadaan
        </button>
        {canViewSipnap && <button onClick={() => setTab('sipnap')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'sipnap' ? 'bg-rose-600 text-white border-rose-600' : 'border-border hover:bg-muted'
          }`}>
          <ShieldAlert className="w-3.5 h-3.5" /> SIPNAP
        </button>}
        {canViewDestruction && <button onClick={() => setTab('pemusnahan')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'pemusnahan' ? 'bg-rose-600 text-white border-rose-600' : 'border-border hover:bg-muted'
          }`}>
          <Trash2 className="w-3.5 h-3.5" /> Pemusnahan
        </button>}
        {canManageDictionary && <button onClick={() => setTab('kamus')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'kamus' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          }`}>
          <FileText className="w-3.5 h-3.5" /> Kamus Resep
        </button>}
        <button onClick={() => setTab('riwayat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            tab === 'riwayat' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          }`}>
          <History className="w-3.5 h-3.5" /> Riwayat
        </button>
      </div>

      <RoleWorkflowGuide role="Farmasi" visit={activePrescription} />

      <ModuleStatHeader stats={[
        { icon: ShoppingCart, label: 'Item Keranjang', value: cart.length, color: 'text-blue-600' },
        { icon: Wallet, label: 'Total Penjualan', value: `Rp ${cart.reduce((s, i) => s + (i.subtotal || 0), 0).toLocaleString('id-ID')}`, color: 'text-emerald-600' },
        { icon: User, label: 'Pasien', value: patient ? 1 : 0, color: 'text-teal-600' },
        { icon: Package, label: 'Total Unit', value: cart.reduce((s, i) => s + (i.quantity || 0), 0), color: 'text-amber-600' },
      ]} />

      {tab === 'queue' ? (
        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Antrean Resep Apoteker
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Screening ringan: peringatan interaksi & duplikasi zat aktif otomatis. Lepas ke POS untuk dispensing FEFO.
            </p>
          </div>
          <PrescriptionQueue
            onDispense={handleDispensePrescription}
            onPrint={(rx) => {
              const linkedPatient = patients.find((item) => item.id === rx?.patient_id) || null;
              setShowPrescriptionPrint({ rx, patient: linkedPatient });
            }}
            refreshKey={queueRefreshKey}
            onTebus={setShowTebus}
            onPIO={setShowPIO}
            onScan={setShowScan}
            onLabel={setShowLabel}
            onQuickPatient={setQuickPatient}
            onDrugInfo={setDrugInfo}
          />
        </div>
      ) : tab === 'pengadaan' ? (
        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Permintaan Pengadaan dari Dokter
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tanggapi permintaan obat dari dokter — feedback langsung kembali ke pengirim.
            </p>
          </div>
          <PengadaanRequests refreshKey={queueRefreshKey} />
        </div>
      ) : tab === 'racikan' ? (
        <div className="space-y-3">
          <div>
            <h1 className="text-lg font-medium mb-1">Kalkulator Racikan Farmasi</h1>
            <p className="text-[11px] text-muted-foreground">
              Area kerja farmasi setelah resep diterima: verifikasi komposisi, hitung kebutuhan, cek FEFO, BUD, kemasan, dan etiket. Dokter tidak mengisi kalkulator ini.
            </p>
          </div>
          {racikanFromRx && (
            <div className="panel-accent px-3 py-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium">Resep Racikan: {racikanFromRx.racikan_name}</p>
                <p className="text-[11px] text-muted-foreground">{racikanFromRx.bentuk_racikan} • Status: {racikanFromRx.workflow_status || 'Draft'}</p>
              </div>
              <button onClick={() => setRacikanFromRx(null)} className="p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <RacikanWorksheet
            patient={patient}
            onProcess={handleProcessRacikan}
            mode="pharmacy"
            initialRacikan={racikanFromRx}
            onClose={racikanFromRx ? () => setRacikanFromRx(null) : undefined}
          />
        </div>
      ) : tab === 'riwayat' ? (
        <TransactionHistory defaultType="Apotek/POS" />
      ) : tab === 'defecta' ? (
        <DefectaPanel />
      ) : tab === 'sipnap' ? (
        <SipnapReport />
      ) : tab === 'pemusnahan' ? (
        <DestructionRequestPanel />
      ) : tab === 'kamus' && canManageDictionary ? (
        <div className="panel p-3">
          <h2 className="mb-3 text-sm font-semibold">Kamus Singkatan Resep</h2>
          <PrescriptionDictionaryPanel clinicRole={clinicRole} user={user} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 h-[calc(100vh-120px)]">
          {/* Left: Search + Results */}
          <div className="space-y-3 overflow-y-auto">
          <div>
            <h1 className="text-lg font-medium mb-2">Apotek / POS</h1>
            <SmartDrugSearch onSelect={addToCart} otcOnly={!activePrescription} />
          </div>
          {activePrescription && (
            <div className="panel-accent px-3 py-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium">Resep {activePrescription.prescription_number}</p>
                <p className="text-[11px] text-muted-foreground">{activePrescription.patient_name} • {activePrescription.doctor_name}</p>
              </div>
              {activePrescription.patient_id && (
                <button
                  onClick={() => setClinicalPatient({ id: activePrescription.patient_id, full_name: activePrescription.patient_name })}
                  className="text-[11px] text-primary hover:text-primary-hover font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-primary/30 hover:bg-primary/5"
                >
                  <FileText className="w-3 h-3" /> Lihat RM
                </button>
              )}
              <button onClick={() => setActivePrescription(null)} className="p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          </div>

          {/* Right: Cart + Checkout */}
          <div className="panel flex flex-col">
            {/* Patient */}
            <div className="px-3 py-2.5 border-b border-border">
              <p className="micro-label mb-1.5">Pasien</p>
              {patient ? (
                <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium flex-1">{patient.full_name}</span>
                  <span className="text-[11px] text-muted-foreground">{patient.mr_number}</span>
                  <button onClick={() => setClinicalPatient(patient)} className="text-[11px] text-primary hover:text-primary-hover font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-primary/30 hover:bg-primary/5">
                    <FileText className="w-3 h-3" /> Lihat RM
                  </button>
                  <button onClick={() => setPatient(null)} className="p-0.5 hover:bg-muted rounded"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center gap-2 px-2 py-1.5 border border-border rounded">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={patientSearch}
                      onChange={e => { setPatientSearch(e.target.value); setShowPatientList(true); }}
                      placeholder="Cari pasien (opsional, walk-in jika kosong)"
                      className="flex-1 bg-transparent outline-none text-xs"
                    />
                  </div>
                  {showPatientList && patientSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredPatients.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ditemukan</p>}
                      {filteredPatients.map(p => (
                        <button key={p.id} onClick={() => { setPatient(p); setPatientSearch(''); setShowPatientList(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left text-xs">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{p.full_name}</span>
                          <span className="text-muted-foreground ml-auto">{p.mr_number}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <ShoppingCart className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">Keranjang kosong</p>
                  <p className="text-[11px]">Cari & pilih obat/produk untuk menambahkan</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {cart.map(item => (
                    <div key={item.medicine_id} className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium truncate">{item.medicine_name}</p>
                            {item.product_type && item.product_type !== 'Obat' && (
                              <span className="pill pill-info">{item.product_type}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">Rp {item.price.toLocaleString('id-ID')} / {item.stock} stok</p>
                        </div>
                        <button onClick={() => removeFromCart(item.medicine_id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.medicine_id, -1)} className="w-6 h-6 flex items-center justify-center border border-border rounded hover:bg-muted">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                          <button onClick={() => updateQty(item.medicine_id, 1)} className="w-6 h-6 flex items-center justify-center border border-border rounded hover:bg-muted">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs font-semibold">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout */}
            {cart.length > 0 && (
              <div className="border-t border-border p-3 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                </div>

                {/* Discount & Embalase */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                    <select
                      value={discountType}
                      onChange={e => { setDiscountType(e.target.value); setDiscountValue(0); }}
                      className="flex-1 px-1.5 py-1 border border-border rounded text-[11px] outline-none"
                    >
                      <option value="Tidak Ada">Tanpa Diskon</option>
                      <option value="Keluarga">Diskon Keluarga</option>
                      <option value="Karyawan">Diskon Karyawan</option>
                      <option value="Custom">Custom</option>
                    </select>
                    {discountType !== 'Tidak Ada' && (
                      <input
                        type="number"
                        value={discountValue || ''}
                        onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                        placeholder={discountValue <= 100 ? '%' : 'Rp'}
                        className="w-16 px-1.5 py-1 border border-border rounded text-[11px] text-center outline-none"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                    <input
                      type="number"
                      value={embalaseFee || ''}
                      onChange={e => setEmbalaseFee(parseFloat(e.target.value) || 0)}
                      placeholder="Embalase (Rp)"
                      className="flex-1 px-1.5 py-1 border border-border rounded text-[11px] outline-none"
                    />
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-amber-600">
                    <span>Diskon ({discountType})</span>
                    <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {embalaseFee > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Embalase</span>
                    <span>+ Rp {embalaseFee.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">Rp {total.toLocaleString('id-ID')}</span>
                </div>

                {isClinicPrescription ? (
                  <div className="rounded border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] text-sky-800">
                    Resep klinik: farmasi menyiapkan obat dan menerbitkan tagihan. Pembayaran dilakukan sekali di Kasir Klinik bersama layanan kunjungan.
                  </div>
                ) : (
                  <>
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
                  </>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                  <Layers className="w-3 h-3 text-primary" />
                  Dispensing otomatis FEFO (batch terdekat kadaluarsa)
                </div>

                <button
                  onClick={checkout} disabled={processing}
                  className="w-full btn-primary py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Receipt className="w-4 h-4" /> {processing ? 'Memproses…' : isClinicPrescription ? 'Proses Dispensing & Kirim Tagihan' : 'Proses & Bayar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showExternalRx && (
        <ExternalRxForm
          onClose={() => setShowExternalRx(false)}
          onCreated={(rx) => {
            setShowExternalRx(false);
            setQueueRefreshKey(k => k + 1);
            setTab('queue');
          }}
        />
      )}

      {clinicalPatient && (
        <PatientClinicalDrawer
          patientId={clinicalPatient.id}
          patientName={clinicalPatient.full_name}
          onClose={() => setClinicalPatient(null)}
          onCopyRacikan={(tpl) => {
            setClinicalPatient(null);
            setRacikanFromRx(tpl);
            setTab('racikan');
          }}
        />
      )}

      {showTebus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowTebus(null)}>
          <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <TebusStatusPanel rx={showTebus} onUpdate={() => { setShowTebus(null); setQueueRefreshKey(k => k + 1); }} />
          </div>
        </div>
      )}

      {showPIO && (
        <PioRecorder rx={showPIO} medicines={medicines} onClose={() => setShowPIO(null)} onSaved={() => setQueueRefreshKey(k => k + 1)} />
      )}

      {showScan && (
        <PrescriptionScanUpload rx={showScan} medicines={medicines} onClose={() => setShowScan(null)} onSaved={() => setQueueRefreshKey(k => k + 1)} />
      )}

      {showLabel && (
        <LabelPrintModal
          rx={showLabel.rx}
          items={showLabel.rx?.items || (showLabel.item ? [showLabel.item] : [])}
          medicines={medicines}
          onClose={() => setShowLabel(null)}
        />
      )}

      {showPrescriptionPrint && (
        <PrescriptionPrintModal
          rx={showPrescriptionPrint.rx}
          patient={showPrescriptionPrint.patient}
          doctor={{
            full_name: showPrescriptionPrint.rx?.doctor_name,
            sip_number: showPrescriptionPrint.rx?.doctor_sip,
            specialization: showPrescriptionPrint.rx?.doctor_specialization,
            practice_address: showPrescriptionPrint.rx?.doctor_practice_address,
            phone: showPrescriptionPrint.rx?.doctor_phone,
          }}
          initialPrintReason="Tidak Ditebus"
          allowIncomplete
          onClose={() => setShowPrescriptionPrint(null)}
        />
      )}

      {quickPatient && (
        <PatientQuickAccessDrawer patientId={quickPatient.id} patientName={quickPatient.name} onClose={() => setQuickPatient(null)} />
      )}

      {drugInfo && <DrugInfoDrawer medicine={drugInfo} onClose={() => setDrugInfo(null)} />}
    </div>
  );
}
