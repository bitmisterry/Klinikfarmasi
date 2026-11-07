// @ts-nocheck -- Dynamic entity names intentionally mirror the former SDK surface.
import { buildBase44SeedData } from './localSeed.js';
import { buildDoctorPatientSeed } from './doctorPatientSeed.js';
import { createDemoUser, DEMO_IDENTITIES, normalizeDemoUser } from '@/lib/demoIdentities';
import {
  BRANCH_ID,
  INVOICE_STATUS,
  PRESCRIPTION_STATUS,
  VISIT_STATUS,
  canTransitionVisit,
  encounterIdForQueue,
  isInvoiceFinal,
  isPrescriptionFinal,
  nowIso,
  queueStatusFromVisit,
  visitStatusFromQueue,
} from '@/lib/clinicWorkflow';
import { parseFreeTextPrescription } from '@/lib/freeTextPrescription';
import { checkAllergies } from '@/lib/prescriptionSafety';
import { calculateInvoiceFinancials, calcProtectedMinSafePrice } from '@/lib/pricing';
import {
  assertFieldPolicy,
  canInvokeFunction,
  canMutateEntity,
  canReadEntity,
  isDoctorRole,
  normalizeClinicRole,
  sanitizeRecordForRole,
} from '@/lib/accessPolicy';

const STORAGE_KEY = 'klinikfarmasios.local-db';
const STORAGE_VERSION = 3;
const SIGNED_OUT_KEY = 'klinikfarmasios.local-db.signed-out';
const SESSION_USER_KEY = 'klinikfarmasios.session-user';
const LEGACY_SESSION_USER_KEY = 'demoUser';
const STORAGE_LOCK_KEY = 'klinikfarmasios.local-db.lock';
const STORAGE_LOCK_TTL_MS = 4000;
const TAB_ID_KEY = 'klinikfarmasios.tab-id';
const today = new Date().toISOString().slice(0, 10);
const todayDay = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(`${today}T12:00:00`).getDay()];

const defaultUser = {
  id: 'local-owner',
  email: 'demo.owner@klinikfarma.com',
  full_name: 'Demo Owner',
  role: 'admin',
  clinic_role: 'Owner',
  data: { clinic_role: 'Owner' },
};

const demoUsers = Object.values(DEMO_IDENTITIES)
  .filter((identity) => identity.id !== defaultUser.id)
  .map((identity) => ({
    ...identity,
    role: ['Owner', 'Admin'].includes(identity.clinic_role) ? 'admin' : 'user',
    active_role: identity.clinic_role,
    data: { clinic_role: identity.clinic_role, active_role: identity.clinic_role, ...(identity.patient_id ? { patient_id: identity.patient_id } : {}) },
  }));

const seedData = {
  User: [defaultUser, ...demoUsers],
  Staff: [
    { id: 'staff-doctor-1', full_name: 'dr. Andi Pratama', role: 'Dokter', license_number: 'SIP-3273-001', phone: '081234567801', email: 'dr.andi@klinik.local', shift: 'Pagi', hire_date: '2024-01-01', is_active: true },
    { id: 'demo-pediatrician', full_name: 'dr. Anak Demo, Sp.A', role: 'Dokter Spesialis Anak', license_number: 'SIP-3273-002', phone: '081234567802', email: 'demo.dokteranak@klinikfarma.com', shift: 'Pagi', hire_date: '2024-01-15', is_active: true },
    { id: 'demo-internist', full_name: 'dr. Nabila Putri, Sp.PD', role: 'Dokter Spesialis Penyakit Dalam', license_number: 'SIP-3273-003', phone: '081234567803', email: 'demo.dokterdalam@klinikfarma.com', shift: 'Pagi', hire_date: '2024-02-01', is_active: true },
    { id: 'demo-dentist', full_name: 'drg. Demo', role: 'Dokter Gigi', license_number: 'SIP-3273-004', phone: '081234567804', email: 'demo.doktergigi@klinikfarma.com', shift: 'Pagi', hire_date: '2024-01-15', is_active: true },
    { id: 'demo-locum', full_name: 'dr. Rizky Mahendra', role: 'Dokter Locum', license_number: 'SIP-3273-005', phone: '081234567805', email: 'demo.dokterlocum@klinikfarma.com', shift: 'Sore', hire_date: '2025-01-10', is_active: true },
    { id: 'staff-pharmacist-1', full_name: 'apt. Sari Wulandari', role: 'Apoteker', license_number: 'STRA-3273-002', phone: '081234567802', email: 'apt.sari@klinik.local', shift: 'Pagi', hire_date: '2024-01-01', is_active: true },
  ],
  Medicine: [
    { id: 'medicine-paracetamol', code: 'MED-PCM-500', name: 'Paracetamol 500 mg', generic_name: 'Paracetamol', active_substance: 'Paracetamol', strength: '500 mg', form: 'Tablet', category: 'Obat Bebas', unit: 'Tablet', manufacturer: 'Kimia Farma', shelf_location: 'A-01', purchase_price: 300, selling_price: 500, stock_on_hand: 240, min_stock: 50, is_active: true },
    { id: 'medicine-amoxicillin', code: 'MED-AMX-500', name: 'Amoxicillin 500 mg', generic_name: 'Amoxicillin', active_substance: 'Amoxicillin', strength: '500 mg', form: 'Kapsul', category: 'Obat Keras', unit: 'Kapsul', manufacturer: 'Kimia Farma', shelf_location: 'B-02', purchase_price: 700, selling_price: 1200, stock_on_hand: 120, min_stock: 30, is_active: true },
    { id: 'medicine-ctm', code: 'MED-CTM-4', name: 'CTM 4 mg', generic_name: 'Chlorpheniramine', active_substance: 'Chlorpheniramine maleate', strength: '4 mg', form: 'Tablet', category: 'Obat Bebas Terbatas', unit: 'Tablet', manufacturer: 'Indofarma', shelf_location: 'A-03', purchase_price: 150, selling_price: 300, stock_on_hand: 180, min_stock: 40, is_active: true },
    { id: 'medicine-uat-return', code: 'MED-UAT-RET', name: 'Cetirizine 10 mg UAT', generic_name: 'Cetirizine', active_substance: 'Cetirizine HCl', strength: '10 mg', form: 'Tablet', category: 'Obat Keras', unit: 'Tablet', manufacturer: 'UAT Pharma', shelf_location: 'UAT-01', purchase_price: 450, hna_per_unit: 450, hpp_per_unit: 500, selling_price: 1000, stock_on_hand: 50, min_stock: 10, is_active: true },
  ],
  Patient: [
    { id: 'patient-local-1', mr_number: 'RM-LOCAL-001', full_name: 'Budi Santoso', nik: '3273010101800001', birth_date: '1980-01-01', gender: 'L', phone: '081234567811', address: 'Jl. Melati No. 10, Bandung', blood_type: 'O', insurance_type: 'Umum' },
    { id: 'patient-local-2', mr_number: 'RM-LOCAL-002', full_name: 'Siti Aminah', nik: '3273015202850002', birth_date: '1985-02-12', gender: 'P', phone: '081234567812', address: 'Jl. Mawar No. 5, Bandung', blood_type: 'A', insurance_type: 'BPJS', allergies: 'Tidak ada' },
  ],
  QueueEntry: [
    { id: 'queue-local-1', queue_number: 'A-001', patient_id: 'patient-local-1', patient_name: 'Budi Santoso', visit_type: 'Poliklinik', status: 'Menunggu', loket: 'Poli Umum', doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andi Pratama', visit_date: today, check_in_time: new Date().toISOString() },
    { id: 'queue-local-2', queue_number: 'A-002', patient_id: 'patient-local-2', patient_name: 'Siti Aminah', visit_type: 'Poliklinik', status: 'Menunggu', loket: 'Poli Umum', doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andi Pratama', visit_date: today, check_in_time: new Date().toISOString() },
  ],
  DoctorSchedule: [
    { id: 'schedule-doctor-1', doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andi Pratama', day_of_week: todayDay, start_time: '08:00', end_time: '12:00', poli: 'Poli Umum', is_active: true, effective_from: today, status: 'Dijadwalkan' },
    { id: 'schedule-pediatrician-1', doctor_id: 'demo-pediatrician', doctor_name: 'dr. Anak Demo, Sp.A', day_of_week: todayDay, start_time: '08:00', end_time: '12:00', poli: 'Poli Anak', is_active: true, effective_from: today, status: 'Dijadwalkan' },
    { id: 'schedule-internal-1', doctor_id: 'demo-internist', doctor_name: 'dr. Nabila Putri, Sp.PD', day_of_week: todayDay, start_time: '08:00', end_time: '13:00', poli: 'Poli Penyakit Dalam', is_active: true, effective_from: today, status: 'Dijadwalkan' },
    { id: 'schedule-dentist-1', doctor_id: 'demo-dentist', doctor_name: 'drg. Demo', day_of_week: todayDay, start_time: '09:00', end_time: '13:00', poli: 'Poli Gigi', is_active: true, effective_from: today, status: 'Dijadwalkan' },
    { id: 'schedule-locum-1', doctor_id: 'demo-locum', doctor_name: 'dr. Rizky Mahendra', day_of_week: todayDay, start_time: '16:00', end_time: '20:00', poli: 'Poli Umum Sore', is_active: true, effective_from: today, status: 'Dijadwalkan' },
  ],
  Supplier: [
    { id: 'supplier-local-1', code: 'SUP-LOCAL-001', name: 'PT Sehat Sentosa', contact_person: 'Rina Kurnia', phone: '022-7000100', email: 'order@sehatsentosa.local', address: 'Jl. Industri No. 20, Bandung', payment_terms: '30 hari', is_active: true },
  ],
  PurchaseOrder: [
    { id: 'po-local-1', po_number: 'PO-LOCAL-001', supplier_id: 'supplier-local-1', supplier_name: 'PT Sehat Sentosa', order_date: today, expected_date: today, status: 'Draft', items: [{ medicine_id: 'medicine-paracetamol', medicine_name: 'Paracetamol 500 mg', quantity: 100, unit_price: 300, subtotal: 30000, received_quantity: 0 }], total_amount: 30000, created_by: 'apt. Sari Wulandari' },
  ],
  SupplierInvoice: [
    {
      id: 'invoice-uat-return', invoice_number: 'INV-UAT-RETUR-001', supplier_id: 'supplier-local-1', supplier_name: 'PT Sehat Sentosa',
      invoice_date: today, due_date: today, status: 'Sebagian Bayar', subtotal: 25000, total_discount: 0, tax_ppn: 0,
      total_amount: 25000, paid_amount: 10000, outstanding_amount: 15000, stock_posted: true, receipt_mode: 'Penerimaan Faktur Langsung',
      items: [{ medicine_id: 'medicine-uat-return', medicine_name: 'Cetirizine 10 mg UAT', batch_number: 'UAT-RET-001', quantity: 50, bonus_quantity: 0, total_received: 50, hna_per_unit: 450, hpp_per_unit: 500, selling_price: 1000, batch_allocations: [{ batch_id: 'batch-uat-return', batch_number: 'UAT-RET-001', quantity: 50 }] }],
      created_by: 'UAT Seed', created_at: new Date().toISOString(), pricing_status: 'Selesai',
    },
  ],
  SupplierReturn: [],
  SupplierCreditNote: [],
  ClinicSetting: [
    { id: 'setting-clinic-name', key: 'clinic_name', value: 'Klinik Farmasi Lokal', category: 'Profil', label: 'Nama Klinik', type: 'text' },
    { id: 'setting-clinic-address', key: 'clinic_address', value: 'Jl. Kesehatan No. 10, Bandung', category: 'Profil', label: 'Alamat Klinik', type: 'textarea' },
    { id: 'setting-clinic-phone', key: 'clinic_phone', value: '022-7000100', category: 'Profil', label: 'Telepon Klinik', type: 'text' },
    { id: 'setting-service-time', key: 'avg_service_minutes', value: '15', category: 'Antrean', label: 'Rata-rata waktu layanan (menit)', type: 'number' },
  ],
  StockBatch: [
    { id: 'batch-paracetamol-1', medicine_id: 'medicine-paracetamol', medicine_name: 'Paracetamol 500 mg', batch_number: 'PCM-2401', quantity: 240, initial_quantity: 300, expiry_date: '2027-01-31', received_date: today, supplier_id: 'supplier-local-1', supplier_name: 'PT Sehat Sentosa', purchase_price: 300, selling_price: 500, status: 'Aktif' },
    { id: 'batch-amoxicillin-1', medicine_id: 'medicine-amoxicillin', medicine_name: 'Amoxicillin 500 mg', batch_number: 'AMX-2402', quantity: 120, initial_quantity: 150, expiry_date: '2026-12-31', received_date: today, supplier_id: 'supplier-local-1', supplier_name: 'PT Sehat Sentosa', purchase_price: 700, selling_price: 1200, status: 'Aktif' },
    { id: 'batch-uat-return', medicine_id: 'medicine-uat-return', medicine_name: 'Cetirizine 10 mg UAT', batch_number: 'UAT-RET-001', quantity: 50, initial_quantity: 50, expiry_date: '2028-12-31', received_date: today, supplier_id: 'supplier-local-1', supplier_name: 'PT Sehat Sentosa', purchase_price: 450, hna_per_unit: 450, hpp_per_unit: 500, selling_price: 1000, invoice_id: 'invoice-uat-return', invoice_number: 'INV-UAT-RETUR-001', status: 'Aktif' },
  ],
  StockMovement: [
    { id: 'movement-paracetamol-1', medicine_id: 'medicine-paracetamol', medicine_name: 'Paracetamol 500 mg', type: 'Masuk', quantity: 300, balance_after: 300, batch_number: 'PCM-2401', reference_type: 'Initial', reference_number: 'SEED-001', notes: 'Stok awal lokal', user_name: 'apt. Sari Wulandari', timestamp: new Date().toISOString() },
    { id: 'movement-paracetamol-2', medicine_id: 'medicine-paracetamol', medicine_name: 'Paracetamol 500 mg', type: 'Keluar', quantity: -60, balance_after: 240, batch_number: 'PCM-2401', reference_type: 'Transaction', reference_id: 'transaction-local-1', reference_number: 'INV-LOCAL-001', notes: 'Penjualan obat', user_name: 'Kasir Lokal', timestamp: new Date().toISOString() },
  ],
  Prescription: [
    { id: 'prescription-local-1', prescription_number: 'RX-LOCAL-001', patient_id: 'patient-local-1', patient_name: 'Budi Santoso', queue_entry_id: 'queue-local-1', doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andi Pratama', prescription_date: today, source: 'Internal', status: 'Diresepkan', is_racikan: false, items: [{ medicine_id: 'medicine-paracetamol', medicine_name: 'Paracetamol 500 mg', strength: '500 mg', dosage: '3x1 tablet', quantity: 10, instructions: 'Sesudah makan', substituted: false }], notes: 'Kontrol bila demam berlanjut' },
  ],
  MedicalRecord: [
    { id: 'record-local-1', patient_id: 'patient-local-1', patient_name: 'Budi Santoso', queue_entry_id: 'queue-local-1', visit_date: today, doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andi Pratama', chief_complaint: 'Demam dan batuk ringan', subjective: 'Keluhan sejak dua hari lalu', vital_signs_bp: '120/80', vital_signs_temp: 37.8, vital_signs_pulse: 82, vital_signs_rr: 20, vital_signs_weight: 68, vital_signs_height: 170, bmi: 23.5, physical_exam: 'Tenggorokan sedikit hiperemis', diagnosis: 'Common cold', diagnosis_code: 'J00', procedures: ['Pemeriksaan umum'], tindakan_total: 50000, treatment_plan: 'Istirahat cukup dan minum obat', follow_up_date: today, patient_education: 'Minum air hangat dan kembali jika memburuk', notes: 'Seed rekam medis' },
  ],
  Transaction: [
    { id: 'transaction-local-1', invoice_number: 'INV-LOCAL-001', type: 'Klinik', patient_id: 'patient-local-1', patient_name: 'Budi Santoso', queue_entry_id: 'queue-local-1', prescription_id: 'prescription-local-1', items: [{ medicine_id: 'medicine-paracetamol', medicine_name: 'Paracetamol 500 mg', quantity: 10, price: 500, subtotal: 5000, batch_number: 'PCM-2401' }], subtotal: 5000, discount: 0, consultation_fee: 50000, other_fees: 0, total: 55000, payment_method: 'Tunai', payment_status: 'Lunas', paid_amount: 60000, change_amount: 5000, cash_session_id: 'cash-session-local-1', cashier_id: 'local-owner', cashier_name: 'Kasir Lokal', transaction_date: today },
  ],
  CashSession: [
    { id: 'cash-session-local-1', session_number: 'CS-LOCAL-001', opened_by: 'local-owner', opened_by_name: 'Kasir Lokal', opened_at: new Date().toISOString(), opening_cash: 200000, expected_cash: 255000, difference: 0, status: 'Aktif', total_transactions: 1, total_cash_sales: 55000 },
  ],
  Expense: [
    { id: 'expense-local-1', expense_number: 'EXP-LOCAL-001', category: 'Operasional', description: 'Pembelian perlengkapan klinik', amount: 75000, payment_method: 'Tunai', payee: 'Toko Medika', expense_date: today, created_by: 'Kasir Lokal' },
  ],
  RacikanConfig: [
    { id: 'racikan-config-1', bentuk_racikan: 'Puyer', pembulatan_rule: 'ceil', default_kemasan_fee: 2000, default_jasa_racik_fee: 5000, is_active: true, label_template: 'KlinikFarma', facility_name: 'Klinik Farmasi Lokal' },
    { id: 'racikan-config-mixtura', bentuk_racikan: 'Mixtura', pembulatan_rule: 'none', default_kemasan_fee: 2000, default_jasa_racik_fee: 5000, is_active: true, label_template: 'KlinikFarma', facility_name: 'Klinik Farmasi Lokal', default_storage_instruction: 'Simpan di tempat sejuk dan terlindung dari cahaya.', default_bud_days: 14, shake_well: true },
  ],
  PrescriptionAbbreviation: [
    { id: 'abbr-r', abbreviation: 'R/', aliases: 'R', standard_meaning: 'recipe', context: 'Header resep', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-s', abbreviation: 'S', aliases: 'S., Signa', standard_meaning: 'signa', context: 'Aturan pakai', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-no', abbreviation: 'No', aliases: 'No., #', standard_meaning: 'quantity', context: 'Subscriptio', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-mfm', abbreviation: 'Mfm', aliases: 'M.f.m., M.f., Mf, M.f pulv, M.f. pulv', standard_meaning: 'misce fac', context: 'Racikan', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-dd', abbreviation: 'dd', aliases: 'TDD, sdd, bdd', standard_meaning: 'kali sehari', context: 'Signa', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-meal', abbreviation: 'pc', aliases: 'ac, prn, hs', standard_meaning: 'waktu pakai', context: 'Signa', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-form', abbreviation: 'tab', aliases: 'tablet, cap, caps, kapsul, ue, cth', standard_meaning: 'satuan sediaan', context: 'Signa', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-iter', abbreviation: 'iter', aliases: 'ne iter', standard_meaning: 'pengulangan resep', context: 'Penutup resep', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-latin-frequency', abbreviation: 'tid', aliases: 'T.I.D., tdd, T.D.D., ter in die, ter de die, bid, B.I.D., bd, B.D., bdd, B.D.D., bis de die, bis in die, qid, Q.I.D., qdd, Q.D.D., qd, Q.D., sdd, S.D.D., qod, Q.O.D., q4h, q6h, q8h, q12h', standard_meaning: 'frekuensi pemakaian', context: 'Signa Latin', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-latin-meal', abbreviation: 'pc', aliases: 'P.C., post cibum, post coenam, ac, A.C., ante cibum, ante coenam, hs, H.S., hora somni, mane, vespere, nocte, sns, S.N.S., si necesse sit, prn, P.R.N., sos, S.O.S., stat, cito', standard_meaning: 'waktu atau kebutuhan pemakaian', context: 'Signa Latin', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-latin-compounding', abbreviation: 'M.f.', aliases: 'M.f.m., M.f. pulv, M.f. pulvis, M.f. pulveres, misce fac, misce fac pulveres, misce fac capsulae, fiat', standard_meaning: 'instruksi pembuatan racikan', context: 'Racikan Latin', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-latin-quantity', abbreviation: 'd.t.d.', aliases: 'dtd, D.T.D., da tales doses, div, div. in partes aequales, aa, ana, ad, q.s., qs, quantum satis', standard_meaning: 'jumlah dan pembagian racikan', context: 'Subscriptio Latin', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-latin-forms', abbreviation: 'pulv', aliases: 'pulvis, pulveres, puyer, tab, tabs, tablet, cap, caps, capsulae, drg, dragee, syr, sir, susp, sol, gtt, guttae, C, C.th., cochlear, cochleare theae, ung, ungt., unguentum, amp, vial, fls', standard_meaning: 'bentuk sediaan dan alat ukur', context: 'Bentuk obat Latin', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
    { id: 'abbr-latin-route', abbreviation: 'po', aliases: 'P.O., per os, o.d., oculus dexter, o.s., oculus sinister, o.u., oculi uterque, a.d., auris dextra, a.s., auris sinistra, ad us. int., ad usum internum, ad us. ext., ad usum externum, im, I.M., iv, I.V., sc, S.C., sl, S.L., top', standard_meaning: 'rute pemakaian', context: 'Rute Latin', approval_status: 'Disetujui', approved_by: 'seed-apj', approved_at: new Date().toISOString() },
  ],
  RacikanTemplate: [
    { id: 'racikan-template-1', patient_id: 'patient-local-2', patient_name: 'Siti Aminah', racikan_name: 'Puyer Batuk Anak', bentuk_racikan: 'Puyer', jumlah_resep: 10, jumlah_ambil: 10, signa: '3x1 bungkus', components: [{ medicine_id: 'medicine-ctm', medicine_name: 'CTM 4 mg', active_substance: 'Chlorpheniramine maleate', kekuatan: '4 mg', dosis_per_racikan: 2, dosis_mode: 'mg', dosis_label: '2 mg', kebutuhan_teoritis: 5, kebutuhan_ambil: 5, pembulatan_rule: 'ceil', harga_unit: 300, subtotal: 1500 }], kemasan_fee: 2000, jasa_racik_fee: 5000, notes: 'Seed racikan', workflow_status: 'Siap Diracik', verified_by: 'apt. Sari Wulandari', verified_at: new Date().toISOString(), label_printed: false, adjustment_log: '', is_master_template: true },
  ],
  Schedule: [
    { id: 'schedule-staff-1', staff_id: 'staff-pharmacist-1', staff_name: 'apt. Sari Wulandari', role: 'Apoteker', shift_date: today, shift: 'Pagi', start_time: '08:00', end_time: '16:00', status: 'Hadir', notes: 'Shift farmasi' },
  ],
  Asset: [
    { id: 'asset-local-1', asset_code: 'AST-LOCAL-001', name: 'Tensimeter Digital', category: 'Medis', location: 'Poli Umum', purchase_date: '2025-01-15', purchase_value: 450000, condition: 'Baik', last_maintenance: '2026-08-01', next_maintenance: '2027-02-01', notes: 'Kalibrasi rutin' },
  ],
  AuditLog: [
    { id: 'audit-local-1', action: 'create', entity: 'Transaction', entity_id: 'transaction-local-1', description: 'Transaksi seed dibuat', old_value: '', new_value: 'INV-LOCAL-001', user_id: 'local-owner', user_name: 'Kasir Lokal', user_role: 'Kasir', severity: 'Info', timestamp: new Date().toISOString() },
  ],
  Anomaly: [
    { id: 'anomaly-local-1', type: 'frequent_adjustment', severity: 'warning', description: 'Contoh notifikasi audit stok untuk data lokal', evidence_json: '{"medicine":"Paracetamol 500 mg"}', related_entity: 'Medicine', related_id: 'medicine-paracetamol', status: 'Baru', detected_at: new Date().toISOString() },
  ],
  Appointment: [
    { id: 'appointment-local-1', patient_id: 'patient-local-2', patient_name: 'Siti Aminah', doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andi Pratama', appointment_date: today, time_slot: '10:00', poli: 'Poli Umum', status: 'Terjadwalkan', notes: 'Kontrol rutin', source: 'Portal Pasien' },
  ],
  Notification: [
    { id: 'notification-local-1', target_role: 'Apoteker', type: 'Stok', title: 'Stok obat diperbarui', body: 'Stok Paracetamol tersedia 240 tablet.', priority: 'Normal', related_entity: 'Medicine', related_id: 'medicine-paracetamol', is_read: false, action_label: 'Lihat Inventori', action_type: 'navigate', action_payload: '/inventory' },
  ],
  Memo: [
    { id: 'memo-local-1', from_user_id: 'local-owner', from_user_name: 'Admin Lokal', target_role: 'Semua', subject: 'Briefing pagi', body: 'Pastikan stok dan antrean diperiksa sebelum layanan dimulai.', priority: 'Normal', is_pinned: true, read_by: [] },
  ],
  ChatMessage: [
    { id: 'chat-local-1', channel: 'umum', sender_id: 'staff-pharmacist-1', sender_name: 'apt. Sari Wulandari', sender_role: 'Apoteker', message: 'Stok obat utama sudah diperiksa.', timestamp: new Date().toISOString() },
  ],
  InternalRequest: [
    { id: 'request-local-1', request_number: 'REQ-LOCAL-001', type: 'Permintaan Obat', from_user_id: 'staff-doctor-1', from_user_name: 'dr. Andi Pratama', from_role: 'Dokter', to_role: 'Apoteker', subject: 'Ketersediaan Amoxicillin', message: 'Mohon konfirmasi ketersediaan Amoxicillin 500 mg.', medicine_id: 'medicine-amoxicillin', medicine_name: 'Amoxicillin 500 mg', status: 'Baru', priority: 'Penting', created_date: new Date().toISOString() },
  ],
  SubstitutionRule: [
    { id: 'substitution-local-1', from_medicine_id: 'medicine-paracetamol', from_medicine_name: 'Paracetamol 500 mg', to_medicine_id: 'medicine-ctm', to_medicine_name: 'CTM 4 mg', rule_type: 'Alternatif', priority: 1, is_active: true, created_by: 'apt. Sari Wulandari', notes: 'Contoh aturan substitusi lokal' },
  ],
};

const remotePatientNames = ['Siti Rahayu', 'Ahmad Fauzi', 'Dewi Lestari', 'Joko Widodo', 'Ratna Sari', 'Bambang Susilo', 'Wati Sugianto', 'Agus Wijaya', 'Bambang Sutrisno', 'Eko Prasetyo', 'Ira Susanti', 'Joko Santoso', 'Maya Putri', 'Rizky Ramadhan', 'Nur Aisyah', 'Fajar Hidayat', 'Lina Marlina', 'Deni Kurniawan', 'Rina Kartika', 'Tono Prabowo', 'Fitri Handayani', 'Yusuf Maulana', 'Sri Wahyuni'];
const remoteMedicines = [
  ['Betamethasone Cream 0.1%', 'BET-001', 0, 10, 'Salep'], ['Amoxiclav 625mg', 'AMX-625', 0, 15, 'Tablet'], ['Metformin 500mg', 'MET-500', 0, 20, 'Tablet'], ['Ranitidine 150mg', 'RAN-150', 12, 25, 'Tablet'],
  ['Ibuprofen 400mg', 'IBU-400', 150, 30, 'Tablet'], ['Omeprazole 20mg', 'OME-020', 95, 20, 'Kapsul'], ['Cetirizine 10mg', 'CET-010', 80, 20, 'Tablet'], ['Domperidone 10mg', 'DOM-010', 60, 15, 'Tablet'],
  ['Amlodipine 5mg', 'AML-005', 110, 25, 'Tablet'], ['Captopril 25mg', 'CAP-025', 90, 20, 'Tablet'], ['Losartan 50mg', 'LOS-050', 70, 20, 'Tablet'], ['Simvastatin 20mg', 'SIM-020', 85, 20, 'Tablet'],
  ['Salbutamol 2mg', 'SAL-002', 75, 15, 'Tablet'], ['Ambroxol 30mg', 'AMB-030', 100, 20, 'Tablet'], ['Loratadine 10mg', 'LOR-010', 90, 20, 'Tablet'], ['Mefenamic Acid 500mg', 'MFA-500', 80, 20, 'Tablet'],
  ['Diclofenac Sodium 50mg', 'DIC-050', 65, 15, 'Tablet'], ['Antasida Doen', 'ANT-001', 120, 25, 'Tablet'], ['Oralit', 'ORL-001', 90, 20, 'Serbuk'], ['Vitamin C 500mg', 'VIT-500', 150, 30, 'Tablet'],
  ['Zinc 20mg', 'ZIN-020', 70, 15, 'Tablet'], ['Furosemide 40mg', 'FUR-040', 60, 15, 'Tablet'], ['Allopurinol 100mg', 'ALL-100', 75, 15, 'Tablet'], ['Meloxicam 7.5mg', 'MEL-075', 55, 15, 'Tablet'],
  ['Ciprofloxacin 500mg', 'CIP-500', 80, 20, 'Tablet'], ['Acyclovir 400mg', 'ACY-400', 45, 10, 'Tablet'], ['Fluconazole 150mg', 'FLU-150', 35, 10, 'Kapsul'], ['Ketoconazole Cream 2%', 'KET-020', 40, 10, 'Salep'],
  ['Povidone Iodine 10%', 'POV-100', 50, 10, 'Cair'], ['ORS Anak', 'ORS-002', 65, 15, 'Serbuk'], ['Lansoprazole 30mg', 'LAN-030', 70, 15, 'Kapsul'], ['Azithromycin 500mg', 'AZI-500', 50, 10, 'Tablet'],
  ['Clindamycin 300mg', 'CLI-300', 45, 10, 'Kapsul'], ['Dextromethorphan 15mg', 'DEX-015', 60, 15, 'Sirup'], ['Paracetamol Sirup', 'PCM-SYR', 55, 15, 'Sirup'], ['Multivitamin Anak', 'MVT-001', 80, 20, 'Sirup'],
  ['Masker Bedah', 'ALK-001', 200, 50, 'Lainnya'],
];

seedData.Patient.push(...remotePatientNames.map((full_name, index) => ({
  id: `patient-remote-${index + 2}`, mr_number: `RM2026${String(index + 2).padStart(3, '0')}`, full_name,
  nik: `327301010180${String(index + 2).padStart(4, '0')}`, birth_date: `19${75 + (index % 20)}-0${(index % 9) + 1}-15`, gender: index % 2 ? 'L' : 'P',
  phone: `08123456${String(820 + index).padStart(4, '0')}`, address: 'Bandung', blood_type: ['A', 'B', 'AB', 'O'][index % 4], allergies: index % 6 === 0 ? 'Alergi udang' : '', insurance_type: index % 3 === 0 ? 'BPJS' : 'Umum', emergency_contact: 'Keluarga', notes: 'Data seed Base44',
})));

seedData.Medicine.push(...remoteMedicines.map(([name, code, stock, min_stock, form], index) => ({
  id: `medicine-remote-${index + 1}`, code, name, product_type: 'Obat', generic_name: name, active_substance: name.split(' ')[0], strength: name.match(/\d+\s?(mg|%)/i)?.[0] || '', form,
  category: name.includes('Amoxic') || name.includes('Ciprofloxacin') || name.includes('Clindamycin') ? 'Obat Keras' : 'Obat Bebas', barcode: `899000${String(index + 1).padStart(6, '0')}`, manufacturer: 'KlinikFarma', shelf_location: `R-${String((index % 8) + 1).padStart(2, '0')}`,
  unit: form === 'Sirup' || form === 'Cair' ? 'Botol' : 'Tablet', selling_price: 1500 + (index * 250), purchase_price: 900 + (index * 150), stock_on_hand: stock, min_stock, is_active: true,
  indication: 'Sesuai indikasi medis', contraindication: '', side_effects: '', interactions: '', precautions: '', pregnancy_category: '', reference_url: '',
})));
// Formularium demo untuk skenario penerimaan resep teks bebas & Mfm. "Cerita"
// sengaja tidak ada agar FLAG obat tidak ditemukan dapat diuji tanpa data palsu.
seedData.Medicine.push(
  { id: 'medicine-forifek-forte', code: 'MIX-001', name: 'Forifek Forte 60 ml', generic_name: 'Forifek Forte', active_substance: 'Ferrous fumarate', strength: '60 ml', form: 'Sirup', category: 'Obat Keras', unit: 'Botol', selling_price: 42000, purchase_price: 33000, stock_on_hand: 15, min_stock: 5, is_active: true, aliases: ['Forifek Forte', 'Forifek Sirup'] },
  { id: 'medicine-forifek-500', code: 'MIX-007', name: 'Forifek 500 mg', generic_name: 'Forifek', active_substance: 'Cefadroxil', strength: '500 mg', form: 'Kapsul', category: 'Obat Keras', unit: 'Kapsul', selling_price: 15000, purchase_price: 11000, stock_on_hand: 50, min_stock: 10, is_active: true, aliases: ['Forifek 500mg', 'Forifek 500 mg', 'Forifek', 'Cefadroxil 500mg'] },
  { id: 'medicine-proris-100', code: 'MIX-002', name: 'Proris 100 mg/5 ml', generic_name: 'Proris', active_substance: 'Ibuprofen', strength: '100 mg/5 ml', form: 'Sirup', category: 'Obat Bebas Terbatas', unit: 'Botol', selling_price: 30000, purchase_price: 23000, stock_on_hand: 18, min_stock: 5, is_active: true, aliases: ['Proris Sirup', 'Proris 100'] },
  { id: 'medicine-proris-forte', code: 'MIX-003', name: 'Proris Forte 200 mg/5 ml', generic_name: 'Proris', active_substance: 'Ibuprofen', strength: '200 mg/5 ml', form: 'Sirup', category: 'Obat Bebas Terbatas', unit: 'Botol', selling_price: 37000, purchase_price: 28500, stock_on_hand: 12, min_stock: 5, is_active: true, aliases: ['Proris Forte', 'Proris Forte Sirup'] },
  { id: 'medicine-proris-200', code: 'MIX-008', name: 'Proris 200 mg', generic_name: 'Proris', active_substance: 'Ibuprofen', strength: '200 mg', form: 'Tablet', category: 'Obat Bebas Terbatas', unit: 'Tablet', selling_price: 3500, purchase_price: 2500, stock_on_hand: 100, min_stock: 20, is_active: true, aliases: ['Proris 150mg', 'Proris 200mg', 'Proris Tablet', 'Proris'] },
  { id: 'medicine-aminofilin-200', code: 'MIX-009', name: 'Aminofilin 200 mg', generic_name: 'Aminophilin', active_substance: 'Aminophylline', strength: '200 mg', form: 'Tablet', category: 'Obat Keras', unit: 'Tablet', selling_price: 1500, purchase_price: 1000, stock_on_hand: 80, min_stock: 15, is_active: true, aliases: ['Aminophilin 75mg', 'Aminophilin', 'Aminofilin', 'Aminophylline', 'Aminofilin 200 mg'] },
  { id: 'medicine-meptin', code: 'MIX-004', name: 'Meptin 4 mg', generic_name: 'Meptin', active_substance: 'Procaterol', strength: '4 mg', form: 'Tablet', category: 'Obat Keras', unit: 'Tablet', selling_price: 2500, purchase_price: 1800, stock_on_hand: 60, min_stock: 10, is_active: true, aliases: ['Meptin', 'Meptin 4 mg', 'Meptin 1/2 tab', 'Procaterol'] },
  { id: 'medicine-cerini-10', code: 'MIX-010', name: 'Cerini 10 mg', generic_name: 'Cerini', active_substance: 'Cetirizine', strength: '10 mg', form: 'Tablet', category: 'Obat Keras', unit: 'Tablet', selling_price: 6000, purchase_price: 4500, stock_on_hand: 60, min_stock: 10, is_active: true, aliases: ['Cerini', 'Cerini 1/2 tab', 'Cetirizine 10mg', 'Cetirizine'] },
  { id: 'medicine-opicort', code: 'MIX-005', name: 'Opicort 5 mg', generic_name: 'Opicort', active_substance: 'Prednisone', strength: '5 mg', form: 'Tablet', category: 'Obat Keras', unit: 'Tablet', selling_price: 2200, purchase_price: 1600, stock_on_hand: 50, min_stock: 10, is_active: true, aliases: ['Opicort', 'Opicort 5 mg', 'Opicort 1 tab', 'Prednisone'] },
  { id: 'medicine-mucera', code: 'MIX-006', name: 'Mucera 30 mg', generic_name: 'Mucera', active_substance: 'Ambroxol', strength: '30 mg', form: 'Tablet', category: 'Obat Keras', unit: 'Tablet', selling_price: 2000, purchase_price: 1500, stock_on_hand: 55, min_stock: 10, is_active: true, aliases: ['Mucera', 'Mucera 30 mg', 'Ambroxol'] },
);

const queueStatuses = ['Menunggu', 'Menunggu', 'Menunggu', 'Menunggu', 'Pemeriksaan', 'Pemeriksaan', 'Pemeriksaan', 'Pemeriksaan', 'Pemeriksaan', 'Di Apotek', 'Di Apotek', 'Di Apotek', 'Di Apotek', 'Kasir', 'Selesai Periksa', 'Selesai Periksa', 'Selesai Periksa', 'Selesai Periksa', 'Batal'];
seedData.QueueEntry.push(...queueStatuses.map((status, index) => {
  const patient = seedData.Patient[index + 2];
  return { id: `queue-remote-${index + 3}`, queue_number: `A-${String(index + 3).padStart(3, '0')}`, patient_id: patient.id, patient_name: patient.full_name, visit_type: 'Poliklinik', status, loket: 'Poli Umum', priority: index === 4, complaint: ['Batuk', 'Sakit kepala', 'Sakit perut', 'Gigi sakit', 'Maag', 'Pusing'][index % 6], doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andini Pratama', visit_date: today, check_in_time: new Date().toISOString() };
}));

seedData.Prescription.push(...Array.from({ length: 22 }, (_, index) => {
  const patient = seedData.Patient[(index % 24) + 1];
  const medicine = seedData.Medicine[(index % 36) + 1];
  const is_racikan = index < 4;
  return { id: `prescription-remote-${index + 2}`, prescription_number: `R20260921${String(index + 2).padStart(3, '0')}`, patient_id: patient.id, patient_name: patient.full_name, queue_entry_id: `queue-remote-${(index % 19) + 3}`, doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andini Pratama', prescription_date: today, source: 'Internal', status: index < 6 ? 'Diresepkan' : index < 10 ? 'Dispensing' : 'Billed', is_racikan, racikan_template_id: is_racikan ? 'racikan-template-1' : '', items: [{ medicine_id: medicine.id, medicine_name: medicine.name, strength: medicine.strength, dosage: '3x1', quantity: 10, instructions: 'Sesudah makan', substituted: false }], notes: 'Data resep seed' };
}));

seedData.Transaction.push(...Array.from({ length: 28 }, (_, index) => {
  const patient = seedData.Patient[(index % 24) + 1];
  const amount = [100000, 75000, 30000, 80000, 15000, 100000, 45000, 125000][index % 8];
  return { id: `transaction-remote-${index + 2}`, invoice_number: `INV20260921${String(index + 2).padStart(3, '0')}`, type: index % 4 === 0 ? 'Klinik' : 'Apotek/POS', patient_id: patient.id, patient_name: patient.full_name, queue_entry_id: `queue-remote-${(index % 19) + 3}`, prescription_id: `prescription-remote-${(index % 22) + 2}`, items: [], subtotal: amount, discount: 0, consultation_fee: 0, other_fees: 0, total: amount, payment_method: ['Tunai', 'QRIS', 'Debit', 'Transfer'][index % 4], payment_status: 'Lunas', paid_amount: amount, change_amount: 0, cash_session_id: 'cash-session-local-1', cashier_id: 'local-owner', cashier_name: 'Kasir Lokal', transaction_date: today };
}));

seedData.Anomaly.push(...Array.from({ length: 9 }, (_, index) => ({
  id: `anomaly-remote-${index + 2}`, type: index % 2 ? 'unpaid_prescription' : 'stock_out_no_transaction', severity: index < 3 ? 'critical' : 'warning', description: index === 0 ? 'Stok Betamethasone Cream 0.1% habis tanpa transaksi tercatat' : `Contoh anomali operasional ${index + 2}`, evidence_json: '{}', related_entity: index % 2 ? 'Prescription' : 'Medicine', related_id: index % 2 ? `prescription-remote-${index + 2}` : `medicine-remote-${index + 1}`, status: 'Baru', detected_at: new Date().toISOString(),
})));

seedData.Memo.push(...[
  { id: 'memo-remote-2', from_user_name: 'Ira Susanti', target_role: 'Semua', subject: 'Libur Nasional', body: 'Klinik tetap buka pada libur nasional dengan jam operasional 08:00-14:00. Minimal 1 dokter dan 1 apoteker jaga.', priority: 'Normal', is_pinned: false, read_by: [] },
  { id: 'memo-remote-3', from_user_name: 'Joko Santoso', target_role: 'Semua', subject: 'Pengumuman Kenaikan Harga Obat', body: 'Mulai 1 Oktober 2026, harga obat akan disesuaikan. Mohon update harga di sistem sebelum tanggal tersebut.', priority: 'Penting', is_pinned: true, read_by: [] },
  { id: 'memo-remote-4', from_user_name: 'Joko Santoso', target_role: 'Semua', subject: 'Pelatihan Pelayanan Pasien', body: 'Pelatihan pelayanan pasien akan diadakan Sabtu 4 Oktober 2026. Semua staff wajib ikut.', priority: 'Normal', is_pinned: false, read_by: [] },
]);

// The hosted Base44 seed function contains a second, comprehensive DEMO- dataset.
// Keep the same records locally so switching storage does not remove demo coverage.
const base44SeedData = buildBase44SeedData({ userId: defaultUser.id, userName: defaultUser.full_name });
Object.entries(base44SeedData).forEach(([entity, records]) => {
  seedData[entity] ||= [];
  seedData[entity].push(...records);
});

seedData.Role = [
  { id: 'role-owner', name: 'Owner', display_name: 'Owner / Manajemen Puncak', is_active: true, is_system: true, is_default: true, user_ids: ['local-owner'] },
  { id: 'role-doctor', name: 'Dokter', display_name: 'Dokter Umum / Keluarga', is_active: true, is_system: true, is_default: true, user_ids: ['staff-doctor-1'] },
  { id: 'role-doctor-general', name: 'Dokter Umum', display_name: 'Dokter Umum / Keluarga', is_active: true, is_system: true, is_default: true, user_ids: ['staff-doctor-1'] },
  { id: 'role-dentist', name: 'Dokter Gigi', display_name: 'Dokter Gigi', is_active: true, is_system: true, is_default: true, user_ids: ['demo-dentist'] },
  { id: 'role-pediatrician', name: 'Dokter Spesialis Anak', display_name: 'Dokter Spesialis Anak', is_active: true, is_system: true, is_default: true, user_ids: ['demo-pediatrician'] },
  { id: 'role-internist', name: 'Dokter Spesialis Penyakit Dalam', display_name: 'Dokter Spesialis Penyakit Dalam', is_active: true, is_system: true, is_default: true, user_ids: ['demo-internist'] },
  { id: 'role-locum', name: 'Dokter Locum', display_name: 'Dokter Locum', is_active: true, is_system: true, is_default: true, user_ids: ['demo-locum'] },
  { id: 'role-nurse', name: 'Perawat', display_name: 'Perawat / Asisten Medis', is_active: true, is_system: true, is_default: true, user_ids: ['demo-nurse'] },
  { id: 'role-front-office', name: 'Front Office', display_name: 'Front Desk / Resepsionis', is_active: true, is_system: true, is_default: true, user_ids: ['demo-front-office'] },
  { id: 'role-cashier', name: 'Kasir', display_name: 'Kasir / Keuangan Harian', is_active: true, is_system: true, is_default: true, user_ids: ['demo-cashier'] },
  { id: 'role-pharmacist', name: 'Apoteker', display_name: 'Apoteker / Petugas Farmasi', is_active: true, is_system: true, is_default: true, user_ids: ['staff-pharmacist-1'] },
  { id: 'role-pharmacy-pic', name: 'Apoteker Penanggung Jawab', display_name: 'Apoteker Penanggung Jawab (APJ)', is_active: true, is_system: true, is_default: true, user_ids: ['demo-apj'] },
  { id: 'role-pharmacy-companion', name: 'Apoteker Pendamping', display_name: 'Apoteker Pendamping', is_active: true, is_system: true, is_default: true, user_ids: ['demo-apoteker-pendamping'] },
  { id: 'role-pharmacy-admin', name: 'Admin Farmasi', display_name: 'Admin Farmasi', is_active: true, is_system: true, is_default: true, user_ids: ['demo-admin-farmasi'] },
  { id: 'role-ops-manager', name: 'Manajer Operasional', display_name: 'Manajer Operasional / Supervisor', is_active: true, is_system: true, is_default: true, user_ids: ['demo-ops-manager'] },
  { id: 'role-admin', name: 'Admin', display_name: 'Administrator Sistem', is_active: true, is_system: true, is_default: true, user_ids: ['local-admin'] },
  { id: 'role-pharmacy-assistant', name: 'TTK/Asisten Farmasi', display_name: 'TTK / Asisten Farmasi', is_active: true, is_system: true, is_default: true, user_ids: ['demo-ttk'] },
  { id: 'role-finance', name: 'Finance', display_name: 'Finance', is_active: true, is_system: true, is_default: true, user_ids: ['demo-finance'] },
  { id: 'role-doctor-assistant', name: 'Asisten Dokter', display_name: 'Asisten Dokter', is_active: true, is_system: true, is_default: true, user_ids: ['demo-doctor-assistant'] },
  { id: 'role-patient', name: 'Pasien', display_name: 'Pasien', is_active: true, is_system: true, is_default: true, user_ids: ['demo-patient'] },
];

// Keep the remaining schema entities available locally as well. These are the
// supporting records used by the doctor, pediatric, dental, document, and help modules.
const demoDoctor = base44SeedData.DoctorProfile?.[0] || base44SeedData.Staff?.[0];
const demoPatient = base44SeedData.Patient?.[0] || seedData.Patient[0];
const demoMedicine = base44SeedData.Medicine?.[0] || seedData.Medicine[0];
seedData.DoctorProfile = [
  { id: 'doctor-profile-demo-1', user_id: demoDoctor?.id, staff_id: demoDoctor?.id, full_name: demoDoctor?.full_name || 'dr. Andini Pratama, Sp.PD', display_name: demoDoctor?.full_name || 'dr. Andini Pratama, Sp.PD', specialization: 'Umum', str_number: 'STR-001', sip_number: 'SIP-001', competencies: ['Konsultasi Umum'], practice_days: ['Senin', 'Rabu', 'Jumat'], default_start_time: '08:00', default_end_time: '12:00', slot_duration: 15, daily_quota: 20, consultation_types: ['Konsultasi Umum'], practice_room: 'Poli Umum', employment_status: 'Tetap', join_date: '2024-01-15', remuneration_scheme: 'Nominal per Konsultasi', remuneration_nominal: 50000, is_active: true },
  { id: 'doctor-profile-general-local', user_id: 'staff-doctor-1', staff_id: 'staff-doctor-1', full_name: 'dr. Andi Pratama', display_name: 'dr. Andi Pratama', specialization: 'Umum / Keluarga', str_number: 'STR-U-001', sip_number: 'SIP-U-001', competencies: ['Konsultasi Umum', 'Kedokteran Keluarga'], practice_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'], default_start_time: '08:00', default_end_time: '12:00', slot_duration: 15, daily_quota: 20, consultation_types: ['Konsultasi Umum'], practice_room: 'Poli Umum', employment_status: 'Tetap', join_date: '2024-01-01', remuneration_scheme: 'Nominal per Konsultasi', remuneration_nominal: 50000, is_active: true },
  { id: 'doctor-profile-pediatrician', user_id: 'demo-pediatrician', full_name: 'dr. Anak Demo, Sp.A', display_name: 'dr. Anak Demo, Sp.A', specialization: 'Anak', str_number: 'STR-A-001', sip_number: 'SIP-A-001', competencies: ['Pediatri', 'Tumbuh Kembang', 'Imunisasi'], practice_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'], default_start_time: '08:00', default_end_time: '12:00', slot_duration: 20, daily_quota: 16, consultation_types: ['Konsultasi Anak', 'Imunisasi'], practice_room: 'Poli Anak', employment_status: 'Tetap', join_date: '2024-01-15', remuneration_scheme: 'Nominal per Konsultasi', remuneration_nominal: 60000, is_active: true },
  { id: 'doctor-profile-internist', user_id: 'demo-internist', staff_id: 'demo-internist', full_name: 'dr. Nabila Putri, Sp.PD', display_name: 'dr. Nabila Putri, Sp.PD', specialization: 'Penyakit Dalam', str_number: 'STR-PD-001', sip_number: 'SIP-PD-001', competencies: ['Penyakit Dalam', 'Hipertensi', 'Diabetes'], practice_days: ['Senin', 'Rabu', 'Jumat'], default_start_time: '08:00', default_end_time: '13:00', slot_duration: 20, daily_quota: 15, consultation_types: ['Konsultasi Penyakit Dalam'], practice_room: 'Poli Penyakit Dalam', employment_status: 'Tetap', join_date: '2024-02-01', remuneration_scheme: 'Nominal per Konsultasi', remuneration_nominal: 150000, is_active: true },
  { id: 'doctor-profile-dentist', user_id: 'demo-dentist', full_name: 'drg. Demo', display_name: 'drg. Demo', specialization: 'Gigi', str_number: 'STR-G-001', sip_number: 'SIP-G-001', competencies: ['Odontogram', 'Scaling', 'Tambal', 'Cabut'], practice_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'], default_start_time: '09:00', default_end_time: '13:00', slot_duration: 30, daily_quota: 10, consultation_types: ['Konsultasi Gigi', 'Tindakan Gigi'], practice_room: 'Poli Gigi', employment_status: 'Tetap', join_date: '2024-01-15', remuneration_scheme: 'Per Tindakan', remuneration_per_tindakan: 75000, is_active: true },
  { id: 'doctor-profile-locum', user_id: 'demo-locum', staff_id: 'demo-locum', full_name: 'dr. Rizky Mahendra', display_name: 'dr. Rizky Mahendra', specialization: 'Umum / Locum', str_number: 'STR-L-001', sip_number: 'SIP-L-001', competencies: ['Konsultasi Umum', 'Layanan Sore'], practice_days: ['Senin', 'Selasa', 'Kamis'], default_start_time: '16:00', default_end_time: '20:00', slot_duration: 15, daily_quota: 16, consultation_types: ['Konsultasi Umum'], practice_room: 'Poli Umum Sore', employment_status: 'Locum', join_date: '2025-01-10', remuneration_scheme: 'Nominal per Konsultasi', remuneration_nominal: 60000, is_active: true },
];
seedData.DoctorAssistant = [{ id: 'doctor-assistant-demo-1', assistant_email: 'asisten@klinikfarma.local', assistant_name: 'Asisten Demo', doctor_user_id: demoDoctor?.id, doctor_profile_id: 'doctor-profile-demo-1', doctor_name: demoDoctor?.full_name || 'dr. Andini Pratama, Sp.PD', doctor_specialization: 'Umum', is_active: true }];
seedData.DoctorChecklist = [{ id: 'doctor-checklist-demo-1', doctor_id: demoDoctor?.id, doctor_name: demoDoctor?.full_name || 'dr. Andini Pratama, Sp.PD', checklist_date: today, items: [{ label: 'Review antrean pasien', done: false, category: 'Review' }, { label: 'Periksa stok resep', done: false, category: 'Farmasi' }, { label: 'Lengkapi catatan klinis', done: false, category: 'Catatan' }], completed_count: 0, total_count: 3 }];
seedData.Document = [{ id: 'document-demo-1', owner_type: 'Dokter', owner_id: demoDoctor?.id, owner_name: demoDoctor?.full_name || 'dr. Andini Pratama, Sp.PD', name: 'STR Dokter Demo', category: 'STR', description: 'Dokumen seed lokal', attachment_type: 'link', file_uri: '', external_url: '', document_number: 'STR-001', issued_date: '2024-01-15', valid_until: '2028-01-15', reminder_days: 30, added_by_name: defaultUser.full_name, added_at: new Date().toISOString(), is_active: true }];
seedData.ExamTemplate = [
  { id: 'exam-template-general-ispa', name: 'ISPA Dewasa', doctor_id: 'staff-doctor-1', doctor_name: 'dr. Andi Pratama', clinical_specialty: 'Dokter Umum', diagnosis_tag: 'ISPA', chief_complaint: 'Demam, batuk, pilek', diagnosis: 'Infeksi saluran pernapasan atas', diagnosis_code: 'J06.9', procedures: [{ name: 'Konsultasi Dokter Umum', code: 'UMU-001', fee: 50000, quantity: 1, subtotal: 50000 }], treatment_plan: 'Terapi sesuai indikasi klinis', follow_up_instructions: 'Kontrol bila keluhan tidak membaik', patient_education: 'Minum cukup dan kembali bila ada tanda bahaya', is_active: true },
  { id: 'exam-template-pediatric-fever', name: 'Demam Anak', doctor_id: 'demo-pediatrician', doctor_name: 'dr. Anak Demo, Sp.A', clinical_specialty: 'Dokter Spesialis Anak', diagnosis_tag: 'Demam Anak', chief_complaint: 'Demam pada anak', diagnosis: 'Demam, tidak spesifik', diagnosis_code: 'R50.9', procedures: [{ name: 'Konsultasi Dokter Anak', code: 'ANK-001', fee: 60000, quantity: 1, subtotal: 60000 }, { name: 'Pemeriksaan Tumbuh Kembang', code: 'ANK-002', fee: 75000, quantity: 1, subtotal: 75000 }], treatment_plan: 'Evaluasi hidrasi dan tanda bahaya sesuai usia', follow_up_instructions: 'Kontrol bila demam menetap atau muncul tanda bahaya', patient_education: 'Pantau suhu, asupan cairan, dan aktivitas anak', is_active: true },
  { id: 'exam-template-internist-hypertension', name: 'Kontrol Hipertensi', doctor_id: 'demo-internist', doctor_name: 'dr. Nabila Putri, Sp.PD', clinical_specialty: 'Dokter Spesialis Penyakit Dalam', diagnosis_tag: 'Hipertensi', chief_complaint: 'Kontrol tekanan darah', diagnosis: 'Hipertensi esensial', diagnosis_code: 'I10', procedures: [{ name: 'Konsultasi Penyakit Dalam', code: 'PD-001', fee: 150000, quantity: 1, subtotal: 150000 }, { name: 'Interpretasi EKG 12 Lead', code: 'PD-002', fee: 100000, quantity: 1, subtotal: 100000 }], treatment_plan: 'Evaluasi tekanan darah dan kepatuhan terapi', follow_up_instructions: 'Kontrol sesuai kondisi klinis', patient_education: 'Catat tekanan darah dan terapkan pola makan rendah garam', is_active: true },
  { id: 'exam-template-dental-caries', name: 'Karies Dentin', doctor_id: 'demo-dentist', doctor_name: 'drg. Demo', clinical_specialty: 'Dokter Gigi', diagnosis_tag: 'Karies', chief_complaint: 'Nyeri gigi atau gigi berlubang', diagnosis: 'Karies dentin', diagnosis_code: 'K02.1', procedures: [{ name: 'Konsultasi Dokter Gigi', code: 'GGI-001', fee: 75000, quantity: 1, subtotal: 75000 }, { name: 'Pemeriksaan Gigi dan Odontogram', code: 'GGI-002', fee: 50000, quantity: 1, subtotal: 50000 }], treatment_plan: 'Evaluasi odontogram dan rencana perawatan gigi', follow_up_instructions: 'Kontrol sesuai rencana perawatan', patient_education: 'Jaga kebersihan gigi dan kurangi makanan manis', is_active: true },
];
seedData.FamilyAccount = [{ id: 'family-account-demo-1', family_name: 'Keluarga Demo', parent_user_id: defaultUser.id, parent_name: defaultUser.full_name, parent_phone: '081234567800', parent_email: defaultUser.email, parent_relation: 'Wali', member_patient_ids: [demoPatient?.id], is_active: true }];
seedData.GrowthRecord = [{ id: 'growth-demo-1', patient_id: demoPatient?.id, patient_name: demoPatient?.full_name, visit_date: today, age_months: 72, gender: demoPatient?.gender || 'L', weight: 22, height: 120, head_circumference: 52, bmi: 15.3, nutrition_status: 'Normal', doctor_id: demoDoctor?.id, doctor_name: demoDoctor?.full_name, notes: 'Data pertumbuhan seed lokal' }];
seedData.ImmunizationRecord = [{ id: 'immunization-demo-1', patient_id: demoPatient?.id, patient_name: demoPatient?.full_name, vaccine_type: 'MR', vaccine_label: 'MR 1', dose_number: 1, administered_date: today, age_at_administration: '18 bulan', doctor_id: demoDoctor?.id, doctor_name: demoDoctor?.full_name, batch_number: 'MR-DEMO-001', manufacturer: 'Bio Farma', site: 'Lengan Kiri', next_due_date: today, status: 'Terkonfirmasi', notes: 'Data imunisasi seed lokal' }];
seedData.OdontogramRecord = [{ id: 'odontogram-demo-1', patient_id: demoPatient?.id, patient_name: demoPatient?.full_name, tooth_number: '11', tooth_type: 'Incisor', arch: 'Upper', condition: 'Sehat', notes: 'Data odontogram seed lokal', recorded_date: today, recorded_by: demoDoctor?.full_name }];
seedData.PrescriptionTemplate = [{ id: 'prescription-template-demo-1', name: 'ISPA Dewasa', doctor_id: demoDoctor?.id, doctor_name: demoDoctor?.full_name, diagnosis_tag: 'Common cold', items: [{ medicine_id: demoMedicine?.id, medicine_name: demoMedicine?.name, strength: demoMedicine?.strength, dosage: '3x1 tablet', quantity: 10, instructions: 'Setelah makan', substituted: false }], has_racikan: false, is_active: true }];
seedData.RequiredDocument = [
  { id: 'required-document-doctor-str', owner_type: 'Dokter', clinic_role: 'Dokter', document_name: 'STR', category: 'Izin & Profesi', has_expiry: true, sort_order: 1, is_active: true },
  { id: 'required-document-doctor-sip', owner_type: 'Dokter', clinic_role: 'Dokter', document_name: 'SIP', category: 'Izin & Profesi', has_expiry: true, sort_order: 2, is_active: true },
  { id: 'required-document-staff-contract', owner_type: 'Staf', document_name: 'Kontrak Kerja', category: 'Kerja Sama', has_expiry: true, sort_order: 3, is_active: true },
];
seedData.ScheduleChangeRequest = [{ id: 'schedule-change-demo-1', doctor_id: demoDoctor?.id, doctor_name: demoDoctor?.full_name || 'dr. Andini Pratama, Sp.PD', request_type: 'Ubah Jadwal', affected_date: today, reason: 'Contoh pengajuan lokal', impacted_appointments: [], impacted_count: 0, status: 'Diajukan', submitted_by: defaultUser.id, submitted_at: new Date().toISOString() }];
seedData.PaymentSchedule = [
  { id: 'payment-schedule-uat-return', schedule_number: 'PAY-UAT-RET-001', invoice_id: 'invoice-uat-return', invoice_number: 'INV-UAT-RETUR-001', supplier_id: 'supplier-local-1', supplier_name: 'PT Sehat Sentosa', planned_date: today, amount: 15000, status: 'Terjadwal', notes: 'Seed UAT rekonsiliasi retur supplier' },
];
seedData.SearchGuide = [
  { id: 'search-guide-patient', title: 'Tambah Pasien Baru', category: 'Cara Melakukan', keywords: ['pasien', 'registrasi', 'pendaftaran'], description: 'Buka menu Pasien lalu pilih tombol tambah untuk membuat data pasien.', steps: ['Buka menu Pasien', 'Pilih Tambah Pasien', 'Simpan formulir'] },
  { id: 'search-guide-inventory', title: 'Kelola Stok Obat', category: 'Menu & Fitur', keywords: ['stok', 'obat', 'inventori'], description: 'Gunakan menu Inventori untuk memeriksa batch, stok, dan pergerakan barang.', steps: ['Buka Inventori', 'Cari obat', 'Periksa batch'] },
  { id: 'search-guide-prescription', title: 'Proses Resep', category: 'Cara Melakukan', keywords: ['resep', 'dispensing', 'farmasi'], description: 'Resep dokter diproses melalui antrean farmasi dan status dispensing.', steps: ['Buka Apotek', 'Pilih resep', 'Selesaikan dispensing'] },
];
seedData.SearchTerm = [
  { id: 'search-term-patient', canonical: 'Pasien', synonyms: ['customer', 'penderita', 'registrasi'], guide_id: 'search-guide-patient', page_path: '/patients', page_label: 'Pasien', is_active: true, is_default: true },
  { id: 'search-term-stock', canonical: 'Stok Obat', synonyms: ['inventori', 'persediaan', 'obat'], guide_id: 'search-guide-inventory', page_path: '/inventory', page_label: 'Inventori', is_active: true, is_default: true },
  { id: 'search-term-prescription', canonical: 'Resep', synonyms: ['resep dokter', 'dispensing'], guide_id: 'search-guide-prescription', page_path: '/pharmacy', page_label: 'Apotek', is_active: true, is_default: true },
];
seedData.TindakanMaster = [
  { id: 'tindakan-demo-consultation', code: 'TND-001', name: 'Pemeriksaan Umum', category: 'Konsultasi', fee: 50000, consumables: [], is_active: true, description: 'Konsultasi dan pemeriksaan umum' },
  { id: 'tindakan-demo-injection', code: 'TND-002', name: 'Injeksi Intramuskular', category: 'Tindakan Medis', fee: 35000, consumables: [], is_active: true, description: 'Tindakan injeksi intramuskular' },
  { id: 'tindakan-demo-wound', code: 'TND-003', name: 'Perawatan Luka', category: 'Prosedur', fee: 75000, consumables: [], is_active: true, description: 'Perawatan luka sederhana' },
];
seedData.TreatmentPlan = [{ id: 'treatment-plan-demo-1', patient_id: demoPatient?.id, patient_name: demoPatient?.full_name, doctor_id: demoDoctor?.id, doctor_name: demoDoctor?.full_name, plan_name: 'Perawatan Umum Demo', plan_type: 'Umum', sessions: [{ session_number: 1, description: 'Kontrol awal', tooth_numbers: [], estimated_cost: 50000, status: 'Dijadwalkan', scheduled_date: today }], total_estimate: 50000, total_paid: 0, status: 'Aktif', notes: 'Data rencana perawatan seed lokal' }];

// Add complete, deterministic patient journeys for every interactive doctor
// account. Existing browser data wins by id, so this merge never overwrites a
// user's edits and remains safe on every reload.
const doctorPatientSeedData = buildDoctorPatientSeed({ today });
Object.entries(doctorPatientSeedData).forEach(([entity, records]) => {
  seedData[entity] ||= [];
  seedData[entity].push(...records);
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const prescriptionStatusMap = {
  Baru: PRESCRIPTION_STATUS.SENT_TO_PHARMACY,
  Diresepkan: PRESCRIPTION_STATUS.SENT_TO_PHARMACY,
  Dispensing: PRESCRIPTION_STATUS.PROCESSING,
  'Selesai Dispensing': PRESCRIPTION_STATUS.DISPENSED,
  Billed: PRESCRIPTION_STATUS.DISPENSED,
  Paid: PRESCRIPTION_STATUS.DISPENSED,
};

const normalizeDataStore = (store) => {
  const normalized = store || {};
  normalized.__meta = {
    revision: Number(normalized.__meta?.revision || 0),
    updated_at: normalized.__meta?.updated_at || '',
    writer_id: normalized.__meta?.writer_id || '',
    ...(normalized.__meta || {}),
    version: STORAGE_VERSION,
  };
  normalized.Visit ||= [];
  normalized.Order ||= [];
  normalized.Payment ||= [];
  normalized.ClinicalRecord ||= [];

  // Backfill role metadata for localStorage created by older builds. Existing
  // custom assignments remain untouched; only missing system-role metadata is
  // restored so the Owner screen can distinguish system and custom roles.
  const systemRoleNames = new Set(seedData.Role.map((role) => role.name));
  const seedRoleByName = new Map(seedData.Role.map((role) => [role.name, role]));
  for (const role of normalized.Role || []) {
    if (!systemRoleNames.has(role.name)) continue;
    const seedRole = seedRoleByName.get(role.name);
    role.is_system = true;
    role.is_default = true;
    role.user_ids ||= [...(seedRole.user_ids || [])];
    role.display_name ||= seedRole.display_name;
  }

  // Migrasi role generik dari build lama. Dokter umum sekarang mempunyai role
  // eksplisit sehingga satu user tidak lagi tampil sebagai anggota dua role.
  const legacyDoctorRole = (normalized.Role || []).find((role) => role.id === 'role-doctor' && role.name === 'Dokter');
  const generalDoctorRole = (normalized.Role || []).find((role) => role.id === 'role-doctor-general' || role.name === 'Dokter Umum');
  if (legacyDoctorRole && generalDoctorRole?.user_ids?.includes('staff-doctor-1')) {
    legacyDoctorRole.user_ids = (legacyDoctorRole.user_ids || []).filter((userId) => userId !== 'staff-doctor-1');
  }

  // Migrasi workflow retur dari build lama. Status "Diproses" sebelumnya
  // berarti stok sudah keluar tetapi nota kredit Finance belum dicatat.
  for (const supplierReturn of normalized.SupplierReturn || []) {
    if (supplierReturn.status === 'Diproses') supplierReturn.status = 'Menunggu Nota Kredit';
    supplierReturn.financial_status ||= supplierReturn.status;
    supplierReturn.status_history ||= [{
      status: supplierReturn.status || 'Menunggu Approval',
      at: supplierReturn.created_at || nowIso(),
      by: supplierReturn.created_by || 'Migrasi localStorage',
      role: 'Migrasi',
      notes: 'Riwayat awal dibuat saat migrasi data lokal.',
    }];
  }

  const visitsByQueue = new Map(normalized.Visit.map((visit) => [visit.queue_entry_id, visit]));
  for (const queue of normalized.QueueEntry || []) {
    const visitId = queue.encounter_id || queue.visit_id || encounterIdForQueue(queue.id);
    const workflowStatus = queue.workflow_status || visitStatusFromQueue(queue.status);
    queue.encounter_id = visitId;
    queue.visit_id = visitId;
    queue.workflow_status = workflowStatus;
    queue.branch_id ||= BRANCH_ID;

    const existing = visitsByQueue.get(queue.id) || normalized.Visit.find((visit) => visit.id === visitId);
    if (existing) {
      existing.patient_id ||= queue.patient_id;
      existing.doctor_id ||= queue.doctor_id;
      existing.poli ||= queue.loket;
      existing.status ||= workflowStatus;
      existing.branch_id ||= BRANCH_ID;
      existing.queue_entry_id ||= queue.id;
      queue.encounter_id = existing.id;
      queue.visit_id = existing.id;
    } else {
      const createdAt = queue.created_date || queue.check_in_time || nowIso();
      normalized.Visit.push({
        id: visitId,
        encounter_number: queue.queue_number,
        queue_entry_id: queue.id,
        patient_id: queue.patient_id,
        patient_name: queue.patient_name,
        doctor_id: queue.doctor_id || '',
        doctor_name: queue.doctor_name || '',
        poli: queue.loket || queue.visit_type || '',
        visit_type: queue.visit_type || 'Poliklinik',
        status: workflowStatus,
        branch_id: BRANCH_ID,
        registered_at: createdAt,
        status_history: [{ from: null, to: workflowStatus, at: createdAt, actor: 'Migrasi localStorage' }],
      });
    }
  }

  const queueById = new Map((normalized.QueueEntry || []).map((queue) => [queue.id, queue]));
  for (const entityName of ['MedicalRecord', 'Prescription', 'Transaction', 'Order']) {
    for (const record of normalized[entityName] || []) {
      const queue = queueById.get(record.queue_entry_id);
      const visitId = record.encounter_id || record.visit_id || queue?.encounter_id;
      if (visitId) {
        record.encounter_id = visitId;
        record.visit_id = visitId;
      }
      record.branch_id ||= BRANCH_ID;
      if (entityName === 'Prescription') {
        record.workflow_status ||= prescriptionStatusMap[record.status] || PRESCRIPTION_STATUS.SENT_TO_PHARMACY;
      }
      if (entityName === 'Transaction') {
        record.cash_point ||= record.type === 'Klinik' ? 'klinik' : 'farmasi';
        record.invoice_status ||= record.payment_status === 'Lunas' ? INVOICE_STATUS.PAID : INVOICE_STATUS.DRAFT;
      }
    }
  }

  return normalized;
};

const mergeSeedData = (savedData) => {
  const merged = { ...savedData };
  Object.entries(seedData).forEach(([entity, seedRecords]) => {
    const existingRecords = savedData?.[entity] || [];
    const existingIds = new Set(existingRecords.map((record) => record.id));
    if (entity === 'Medicine') {
      const seedMap = new Map(seedRecords.map((r) => [r.id, r]));
      const enrichedExisting = existingRecords.map((rec) => {
        const seedRec = seedMap.get(rec.id);
        if (seedRec?.aliases && (!rec.aliases || !rec.aliases.length)) {
          return { ...rec, aliases: seedRec.aliases };
        }
        return rec;
      });
      merged[entity] = [...seedRecords.filter((record) => !existingIds.has(record.id)), ...enrichedExisting];
    } else {
      merged[entity] = [...seedRecords.filter((record) => !existingIds.has(record.id)), ...existingRecords];
    }
  });
  return merged;
};

const load = () => {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    return normalizeDataStore(saved ? mergeSeedData(JSON.parse(saved)) : clone(seedData));
  } catch {
    return normalizeDataStore(clone(seedData));
  }
};

let data = load();
let memoryUser = null;
let internalFunctionDepth = 0;
const subscriptions = new Map();

const tabId = (() => {
  const existing = globalThis.sessionStorage?.getItem(TAB_ID_KEY);
  if (existing) return existing;
  const created = `tab-${crypto.randomUUID()}`;
  globalThis.sessionStorage?.setItem(TAB_ID_KEY, created);
  return created;
})();

const resolvePersistedDemoUser = (candidate) => {
  if (!candidate) return null;
  const normalized = normalizeDemoUser(candidate);
  const persisted = (data.User || []).find((item) => item.id === normalized.id)
    || (data.User || []).find((item) => String(item.email || '').toLowerCase() === String(normalized.email || '').toLowerCase());
  if (!persisted) return normalized;
  const persistedRole = persisted.active_role || persisted.data?.active_role || persisted.clinic_role || persisted.data?.clinic_role;
  return {
    ...normalized,
    ...persisted,
    role: ['Owner', 'Admin'].includes(persistedRole) ? 'admin' : 'user',
    clinic_role: persistedRole || normalized.clinic_role,
    active_role: persistedRole || normalized.active_role,
    data: {
      ...(normalized.data || {}),
      ...(persisted.data || {}),
      clinic_role: persistedRole || normalized.clinic_role,
      active_role: persistedRole || normalized.active_role,
    },
  };
};

const writeStoredDemoUser = (user) => {
  if (!user) return;
  globalThis.sessionStorage?.setItem(SESSION_USER_KEY, JSON.stringify(user));
  // The legacy localStorage session made every tab share one role. New
  // sessions are tab-scoped so multi-role UAT can run in parallel.
  globalThis.localStorage?.removeItem(LEGACY_SESSION_USER_KEY);
};

const readStoredDemoUser = () => {
  try {
    const raw = globalThis.sessionStorage?.getItem(SESSION_USER_KEY)
      || globalThis.localStorage?.getItem(LEGACY_SESSION_USER_KEY);
    if (!raw) return null;
    const storedUser = JSON.parse(raw);
    const normalizedUser = resolvePersistedDemoUser(storedUser);
    if (JSON.stringify(normalizedUser) !== JSON.stringify(storedUser)) {
      writeStoredDemoUser(normalizedUser);
    }
    return normalizedUser;
  } catch {
    return null;
  }
};

globalThis.addEventListener?.('storage', (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    data = normalizeDataStore(mergeSeedData(JSON.parse(event.newValue)));
    if (memoryUser) {
      memoryUser = resolvePersistedDemoUser(memoryUser);
      writeStoredDemoUser(memoryUser);
      globalThis.dispatchEvent?.(new CustomEvent('local-user-role-changed'));
    }
    subscriptions.forEach((listeners, entity) => {
      listeners.forEach((callback) => callback({ type: 'storage-sync', entity }));
    });
  } catch (error) {
    console.error('Sinkronisasi localStorage lintas tab gagal', error);
  }
});

const APPEND_ONLY_ENTITIES = new Set(['AuditLog', 'StockMovement']);
const NO_HARD_DELETE_ENTITIES = new Set([
  'AuditLog', 'Visit', 'ClinicalRecord', 'MedicalRecord', 'Order', 'Prescription',
  'Transaction', 'Payment', 'StockMovement',
]);

const dispatchStorageIssue = (message) => {
  globalThis.dispatchEvent?.(new CustomEvent('local-db-conflict', { detail: { message } }));
};

const acquireStorageLock = () => {
  const storage = globalThis.localStorage;
  if (!storage) return () => {};
  const now = Date.now();
  const current = JSON.parse(storage.getItem(STORAGE_LOCK_KEY) || 'null');
  if (current && current.owner !== tabId && Number(current.expires_at || 0) > now) {
    const message = 'Data sedang disimpan di tab lain. Tunggu sebentar lalu ulangi agar perubahan tidak saling menimpa.';
    dispatchStorageIssue(message);
    throw new Error(message);
  }
  const token = `${tabId}:${crypto.randomUUID()}`;
  storage.setItem(STORAGE_LOCK_KEY, JSON.stringify({ owner: tabId, token, expires_at: now + STORAGE_LOCK_TTL_MS }));
  const confirmed = JSON.parse(storage.getItem(STORAGE_LOCK_KEY) || 'null');
  if (confirmed?.token !== token) {
    const message = 'Tab lain mengambil giliran penyimpanan. Muat ulang data lalu coba kembali.';
    dispatchStorageIssue(message);
    throw new Error(message);
  }
  return () => {
    const latest = JSON.parse(storage.getItem(STORAGE_LOCK_KEY) || 'null');
    if (latest?.token === token) storage.removeItem(STORAGE_LOCK_KEY);
  };
};

const save = () => {
  const storage = globalThis.localStorage;
  if (!storage) return;
  const release = acquireStorageLock();
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    const storedRevision = Number(stored?.__meta?.revision || 0);
    const localRevision = Number(data.__meta?.revision || 0);
    if (stored && storedRevision > localRevision && stored?.__meta?.writer_id !== tabId) {
      data = normalizeDataStore(mergeSeedData(stored));
      const message = 'Data lebih baru ditemukan dari tab lain. Tampilan telah disinkronkan; ulangi tindakan Anda.';
      dispatchStorageIssue(message);
      throw new Error(message);
    }
    data.__meta = {
      ...(data.__meta || {}),
      version: STORAGE_VERSION,
      revision: Math.max(storedRevision, localRevision) + 1,
      updated_at: nowIso(),
      writer_id: tabId,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } finally {
    release();
  }
};

const currentActorSync = () => memoryUser || readStoredDemoUser();

const actorRole = (actor = currentActorSync()) => normalizeClinicRole(
  actor?.active_role || actor?.data?.active_role || actor?.clinic_role || actor?.data?.clinic_role || actor?.role,
);

const hashText = (value) => {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const appendAuditRecord = ({ action, entity, entityId, before, after, description, reason, severity = 'Info', ...metadata }) => {
  data.AuditLog ||= [];
  const previous = data.AuditLog.at(-1);
  const timestamp = nowIso();
  const actor = currentActorSync() || defaultUser;
  const payload = JSON.stringify({ action, entity, entityId, timestamp, before, after, reason });
  const record = {
    ...clone(metadata),
    id: `auditlog-${crypto.randomUUID()}`,
    action,
    entity,
    entity_id: entityId,
    description: description || `${action} ${entity}`,
    old_value: before == null ? (metadata.old_value || '') : JSON.stringify(before),
    new_value: after == null ? (metadata.new_value || '') : JSON.stringify(after),
    reason: reason || '',
    user_id: actor?.id || '',
    user_name: actor?.full_name || actor?.email || 'Sistem',
    user_role: actor?.active_role || actor?.clinic_role || actor?.role || 'Sistem',
    role_aktif: actor?.active_role || actor?.clinic_role || actor?.role || 'Sistem',
    timestamp,
    hash_prev: previous?.hash || '',
    hash: hashText(`${previous?.hash || ''}|${payload}`),
    severity,
  };
  data.AuditLog.push(record);
  emit('AuditLog', { type: 'create', data: clone(record) });
  return record;
};

const syncVisitFromQueue = (queue) => {
  if (!queue?.id) return;
  data.Visit ||= [];
  const visitId = queue.encounter_id || queue.visit_id || encounterIdForQueue(queue.id);
  queue.encounter_id = visitId;
  queue.visit_id = visitId;
  queue.workflow_status ||= visitStatusFromQueue(queue.status);
  let visit = data.Visit.find((item) => item.id === visitId || item.queue_entry_id === queue.id);
  if (!visit) {
    visit = { id: visitId, queue_entry_id: queue.id, status_history: [] };
    data.Visit.push(visit);
  }
  Object.assign(visit, {
    encounter_number: queue.queue_number,
    patient_id: queue.patient_id,
    patient_name: queue.patient_name,
    doctor_id: queue.doctor_id || visit.doctor_id || '',
    doctor_name: queue.doctor_name || visit.doctor_name || '',
    poli: queue.loket || visit.poli || '',
    visit_type: queue.visit_type || visit.visit_type || 'Poliklinik',
    complaint: queue.complaint || visit.complaint || '',
    channel: queue.channel || visit.channel || 'walk-in',
    payer_type: queue.payer_type || visit.payer_type || 'Umum',
    insurance_number: queue.insurance_number || visit.insurance_number || '',
    schedule_id: queue.schedule_id || visit.schedule_id || '',
    appointment_id: queue.appointment_id || visit.appointment_id || '',
    branch_id: queue.branch_id || BRANCH_ID,
    status: queue.workflow_status,
    updated_at: nowIso(),
  });
};

const emit = (name, event = {}) => {
  subscriptions.get(name)?.forEach((callback) => callback(event));
};

const matchesValue = (actual, expected) => {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('$in' in expected) return expected.$in.includes(actual);
    if ('$ne' in expected) return actual !== expected.$ne;
    if ('$regex' in expected) {
      const regex = expected.$regex instanceof RegExp ? expected.$regex : new RegExp(String(expected.$regex), 'i');
      return regex.test(String(actual ?? ''));
    }
    if ('$exists' in expected) return (actual !== undefined) === Boolean(expected.$exists);
    if ('$gt' in expected) return actual > expected.$gt;
    if ('$gte' in expected) return actual >= expected.$gte;
    if ('$lt' in expected) return actual < expected.$lt;
    if ('$lte' in expected) return actual <= expected.$lte;
  }
  return actual === expected;
};

const matches = (record, query = {}) => Object.entries(query || {}).every(([key, value]) => matchesValue(record[key], value));

const sorted = (items, sort) => {
  if (!sort) return items;
  const descending = sort.startsWith('-');
  const key = descending ? sort.slice(1) : sort;
  return [...items].sort((a, b) => {
    if (a[key] === b[key]) return 0;
    const comparison = a[key] > b[key] ? 1 : -1;
    return descending ? -comparison : comparison;
  });
};

const doctorMatches = (record, actor) => Boolean(record && actor && (
  (record.doctor_id && record.doctor_id === actor.id)
  || (record.doctor_user_id && record.doctor_user_id === actor.id)
  || (record.doctor_name && actor.full_name && record.doctor_name === actor.full_name)
));

const relatedQueueFor = (record) => {
  if (!record) return null;
  const queueId = record.queue_entry_id;
  const visitId = record.visit_id || record.encounter_id;
  return (data.QueueEntry || []).find((queue) => queue.id === queueId
    || queue.visit_id === visitId || queue.encounter_id === visitId) || null;
};

const validReferralFor = (patientId, actor, medicalRecordId = '') => (data.InternalRequest || []).find((request) =>
  request.type === 'Rujukan Internal'
  && request.patient_id === patientId
  && request.to_user_id === actor?.id
  && String(request.reason || '').trim()
  && !['Dibatalkan', 'Ditolak'].includes(request.status)
  && (!request.medical_record_id || !medicalRecordId || request.medical_record_id === medicalRecordId));

const isPatientAssignedToDoctor = (patientId, actor) => Boolean(patientId && actor && (
  (data.QueueEntry || []).some((queue) => queue.patient_id === patientId && doctorMatches(queue, actor))
  || (data.MedicalRecord || []).some((record) => record.patient_id === patientId && doctorMatches(record, actor))
  || validReferralFor(patientId, actor)
));

const familyPatientIds = (family) => [
  ...(family?.member_patient_ids || []),
  ...(family?.child_patient_ids || []),
];

const hasFamilyAccount = (patientId) => (data.FamilyAccount || []).some((family) =>
  family.is_active !== false && familyPatientIds(family).includes(patientId));

const isRowVisible = (name, record, actor, role) => {
  if (internalFunctionDepth > 0) return true;
  if (name === 'Notification') {
    if (record.target_user_id) return record.target_user_id === actor?.id;
    if (!record.target_role || ['Semua', 'All'].includes(record.target_role)) return true;
    if (record.target_role === 'Dokter') return isDoctorRole(role);
    return record.target_role === role;
  }
  if (isDoctorRole(role)) {
    if (['QueueEntry', 'Visit'].includes(name)) return doctorMatches(record, actor);
    if (['ClinicalRecord', 'MedicalRecord', 'Prescription', 'Order'].includes(name)) {
      return doctorMatches(record, actor) || doctorMatches(relatedQueueFor(record), actor)
        || (name === 'MedicalRecord' && Boolean(validReferralFor(record.patient_id, actor, record.id)));
    }
    if (['ExamTemplate', 'PrescriptionTemplate', 'DoctorChecklist'].includes(name)) {
      return !record.doctor_id || record.doctor_id === actor.id;
    }
    if (name === 'InternalRequest') {
      return record.from_user_id === actor.id || record.to_user_id === actor.id
        || (!record.from_user_id && record.from_user_name === actor.full_name);
    }
    if (name === 'ClinicalFeedback') {
      return record.to_user_id === actor.id || record.doctor_id === actor.id
        || (record.to_name && actor.full_name && record.to_name === actor.full_name);
    }
    if (name === 'Patient') {
      return isPatientAssignedToDoctor(record.id, actor);
    }
    if (['OdontogramRecord', 'TreatmentPlan', 'GrowthRecord', 'ImmunizationRecord'].includes(name)) {
      return isPatientAssignedToDoctor(record.patient_id, actor);
    }
    if (name === 'FamilyAccount') {
      return familyPatientIds(record).some((patientId) => isPatientAssignedToDoctor(patientId, actor));
    }
  }
  if (['Perawat', 'Asisten Dokter'].includes(role)) {
    const activeStatuses = new Set(['Dipanggil', 'Menunggu Intake', 'Siap Dokter', 'Pemeriksaan']);
    if (name === 'QueueEntry') return activeStatuses.has(record.status);
    if (name === 'Visit') return activeStatuses.has(queueStatusFromVisit(record.status));
    if (name === 'ClinicalRecord') return record.record_type === 'intake';
    if (name === 'Patient') return (data.QueueEntry || []).some((queue) => queue.patient_id === record.id && activeStatuses.has(queue.status));
  }
  if (role === 'Kasir') {
    if (name === 'QueueEntry') return ['Kasir', 'Selesai'].includes(record.status);
    if (name === 'Visit') return ['COMPLETED', 'READY_TO_CLOSE', 'CLOSED'].includes(record.status);
    if (name === 'Patient') return (data.Transaction || []).some((transaction) => transaction.patient_id === record.id)
      || (data.QueueEntry || []).some((queue) => queue.patient_id === record.id && ['Kasir', 'Selesai'].includes(queue.status));
  }
  if (role === 'Pasien') {
    const patientId = actor?.patient_id || actor?.data?.patient_id;
    if (name === 'Patient') return record.id === patientId;
    if (record.patient_id) return record.patient_id === patientId;
  }
  return true;
};

const readableRecords = (name) => {
  const raw = data[name] ||= [];
  if (internalFunctionDepth > 0) return raw;
  const actor = currentActorSync();
  if (!actor) return [];
  const role = actorRole(actor);
  if (!canReadEntity(role, name)) return [];
  return raw
    .filter((record) => isRowVisible(name, record, actor, role))
    .map((record) => sanitizeRecordForRole(role, name, record));
};

const denyMutation = (name, action, payload, reason, entityId = '') => {
  appendAuditRecord({
    action: `denied_${action}`,
    entity: name,
    entityId,
    after: payload,
    description: `Akses ${action} ${name} ditolak: ${reason}`,
    reason,
    severity: 'Warning',
  });
  save();
  throw new Error(reason);
};

const authorizeMutation = (name, action, payload = {}, before = null) => {
  if (internalFunctionDepth > 0) return;
  const actor = currentActorSync();
  if (!actor) denyMutation(name, action, payload, 'Sesi lokal belum masuk', before?.id);
  const role = actorRole(actor);
  if (!canMutateEntity(role, name, action)) {
    denyMutation(name, action, payload, `${role} tidak memiliki hak untuk ${action} data ${name}`, before?.id);
  }
  if (action !== 'create' && before && !isRowVisible(name, before, actor, role)) {
    denyMutation(name, action, payload, `${role} tidak dapat mengubah data ${name} di luar ruang lingkupnya`, before?.id);
  }
  try {
    assertFieldPolicy({ role, entity: name, action, payload, before });
  } catch (error) {
    denyMutation(name, action, payload, error.message, before?.id);
  }
  if (isDoctorRole(role)) {
    const ownerFieldByEntity = {
      DoctorProfile: 'user_id',
      ExamTemplate: 'doctor_id',
      PrescriptionTemplate: 'doctor_id',
      DoctorChecklist: 'doctor_id',
      ScheduleChangeRequest: 'doctor_id',
    };
    const ownerField = ownerFieldByEntity[name];
    if (ownerField) {
      const ownerId = before?.[ownerField] || payload?.[ownerField];
      if (!ownerId || ownerId !== actor.id) {
        denyMutation(name, action, payload, 'Dokter hanya dapat mengubah data profil, template, checklist, dan jadwal miliknya sendiri', before?.id);
      }
    }
    if (name === 'InternalRequest' && action !== 'create') {
      const isSender = before?.from_user_id === actor.id;
      const isReferralRecipient = before?.type === 'Rujukan Internal' && before?.to_user_id === actor.id;
      if (!isSender && !isReferralRecipient) {
        denyMutation(name, action, payload, 'Dokter hanya dapat mengubah permintaan yang dibuat atau rujukan yang ditujukan kepadanya', before?.id);
      }
    }
    if (['OdontogramRecord', 'TreatmentPlan', 'GrowthRecord', 'ImmunizationRecord'].includes(name)) {
      const patientId = payload.patient_id || before?.patient_id;
      if (!isPatientAssignedToDoctor(patientId, actor)) {
        denyMutation(name, action, payload, 'Modul klinis hanya dapat diubah untuk pasien yang sedang ditangani atau dirujuk kepada dokter ini', before?.id);
      }
      if (['GrowthRecord', 'ImmunizationRecord'].includes(name) && !hasFamilyAccount(patientId)) {
        denyMutation(name, action, payload, 'Data anak wajib terhubung ke akun orang tua/wali sebelum growth chart atau imunisasi dicatat', before?.id);
      }
    }
  }
};

const entityApi = (name) => {
  const records = () => (data[name] ||= []);
  return {
    list: async (sort, limit, skip = 0) => clone(sorted(readableRecords(name), sort).slice(skip, limit ? skip + limit : undefined)),
    filter: async (query, sort, limit, skip = 0) => clone(sorted(readableRecords(name).filter((record) => matches(record, query)), sort).slice(skip, limit ? skip + limit : undefined)),
    get: async (id) => clone(readableRecords(name).find((record) => record.id === id) || null),
    create: async (payload) => {
      authorizeMutation(name, 'create', payload);
      if (name === 'AuditLog') {
        const auditRecord = appendAuditRecord({
          ...clone(payload),
          action: payload.action || 'log',
          entity: payload.entity || 'System',
          entityId: payload.entity_id || payload.entityId || '',
        });
        save();
        return clone(auditRecord);
      }
      const actor = currentActorSync();
      const role = actorRole(actor);
      const normalizedPayload = clone(payload);
      if (name === 'InternalRequest' && actor && internalFunctionDepth === 0) {
        normalizedPayload.from_user_id = actor.id;
        normalizedPayload.from_user_name = actor.full_name || actor.email;
        normalizedPayload.from_role = role;
      }
      const record = { id: `${name.toLowerCase()}-${crypto.randomUUID()}`, created_date: new Date().toISOString(), ...normalizedPayload };
      if (name === 'QueueEntry') {
        record.encounter_id ||= record.visit_id || encounterIdForQueue(record.id);
        record.visit_id = record.encounter_id;
        record.workflow_status ||= visitStatusFromQueue(record.status);
        record.branch_id ||= BRANCH_ID;
      }
      if (name === 'Prescription') {
        record.workflow_status ||= prescriptionStatusMap[record.status] || PRESCRIPTION_STATUS.SENT_TO_PHARMACY;
        record.branch_id ||= BRANCH_ID;
      }
      if (name === 'Transaction') {
        record.cash_point ||= record.type === 'Klinik' ? 'klinik' : 'farmasi';
        record.invoice_status ||= record.payment_status === 'Lunas' ? INVOICE_STATUS.PAID : INVOICE_STATUS.DRAFT;
        record.branch_id ||= BRANCH_ID;
      }
      records().push(record);
      if (name === 'QueueEntry') syncVisitFromQueue(record);
      appendAuditRecord({ action: 'create', entity: name, entityId: record.id, after: record });
      save();
      emit(name, { type: 'create', data: clone(record) });
      return clone(record);
    },
    update: async (id, payload) => {
      if (APPEND_ONLY_ENTITIES.has(name)) {
        appendAuditRecord({ action: 'denied_update', entity: name, entityId: id, after: payload, description: `Percobaan mengubah ${name} ditolak`, severity: 'Warning' });
        save();
        throw new Error(`${name} bersifat append-only dan tidak dapat diubah`);
      }
      const index = records().findIndex((record) => record.id === id);
      if (index < 0) throw new Error(`${name} tidak ditemukan`);
      const before = clone(records()[index]);
      authorizeMutation(name, 'update', payload, before);
      records()[index] = { ...records()[index], ...clone(payload), updated_date: new Date().toISOString() };
      if (name === 'QueueEntry') {
        if (payload.status && !payload.workflow_status) records()[index].workflow_status = visitStatusFromQueue(payload.status);
        syncVisitFromQueue(records()[index]);
      }
      if (name === 'Prescription' && payload.status && !payload.workflow_status) {
        records()[index].workflow_status = prescriptionStatusMap[payload.status] || records()[index].workflow_status;
      }
      if (name === 'Transaction' && payload.payment_status && !payload.invoice_status) {
        records()[index].invoice_status = payload.payment_status === 'Lunas' ? INVOICE_STATUS.PAID : records()[index].invoice_status;
      }
      appendAuditRecord({ action: 'update', entity: name, entityId: id, before, after: records()[index] });
      save();
      emit(name, { type: 'update', data: clone(records()[index]) });
      return clone(records()[index]);
    },
    bulkCreate: async (payloads = []) => {
      const created = [];
      for (const payload of payloads) created.push(await entityApi(name).create(payload));
      return created;
    },
    updateMany: async (query, update) => {
      const patch = update.$set || update;
      if (APPEND_ONLY_ENTITIES.has(name)) {
        const allowedReferencePatch = name === 'StockMovement'
          && Object.keys(patch).every((key) => ['reference_id', 'reference_type'].includes(key));
        if (!allowedReferencePatch) {
          appendAuditRecord({ action: 'denied_update_many', entity: name, after: patch, description: `Percobaan mengubah massal ${name} ditolak`, severity: 'Warning' });
          save();
          throw new Error(`${name} bersifat append-only dan tidak dapat diubah massal`);
        }
      }
      const updated = records().filter((record) => matches(record, query));
      const before = clone(updated);
      authorizeMutation(name, 'update_many', patch, before[0] || null);
      updated.forEach((record) => Object.assign(record, clone(patch), { updated_date: new Date().toISOString() }));
      if (name === 'QueueEntry') updated.forEach((record) => {
        if (patch.status && !patch.workflow_status) record.workflow_status = visitStatusFromQueue(patch.status);
        syncVisitFromQueue(record);
      });
      appendAuditRecord({ action: 'update_many', entity: name, entityId: updated.map((item) => item.id).join(','), before, after: updated });
      save();
      emit(name, { type: 'updateMany', data: clone(updated) });
      return { modifiedCount: updated.length };
    },
    delete: async (id) => {
      const deleted = records().find((record) => record.id === id);
      authorizeMutation(name, 'delete', {}, deleted || { id });
      if (NO_HARD_DELETE_ENTITIES.has(name)) {
        appendAuditRecord({ action: 'denied_delete', entity: name, entityId: id, before: deleted, description: `Percobaan menghapus ${name} ditolak; gunakan batal/koreksi`, severity: 'Warning' });
        save();
        throw new Error(`${name} tidak boleh dihapus; gunakan pembatalan atau koreksi beralasan`);
      }
      data[name] = records().filter((record) => record.id !== id);
      appendAuditRecord({ action: 'delete', entity: name, entityId: id, before: deleted });
      save();
      emit(name, { type: 'delete', data: clone(deleted) });
      return deleted ? clone(deleted) : null;
    },
    subscribe: (callback) => {
      const listeners = subscriptions.get(name) || new Set();
      listeners.add(callback);
      subscriptions.set(name, listeners);
      return () => listeners.delete(callback);
    },
  };
};

/** @type {any} */
const entities = new Proxy({}, { get: (_, name) => entityApi(name) });

const functionResponse = (data) => ({ data });
const currentUser = () => localDb.auth.me();

const uploadLocalFile = async (file) => {
  if (!file) return { file_url: '', file_uri: '', file_name: '' };
  if (typeof FileReader === 'undefined') return { file_url: '', file_uri: '', file_name: file.name || '' };
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('File gagal dibaca'));
    reader.readAsDataURL(file);
  });
  return { file_url: dataUrl, file_uri: dataUrl, file_name: file.name || '', file_size: file.size || 0 };
};

const auditLocally = async (payload = {}) => {
  const user = await currentUser();
  await entities.AuditLog.create({
    ...payload,
    user_id: payload.user_id || user?.id,
    user_name: payload.user_name || user?.full_name || user?.email || 'Sistem',
    user_role: payload.user_role || user?.clinic_role || user?.role || 'Staff',
    timestamp: payload.timestamp || new Date().toISOString(),
  });
  return { success: true };
};

const getQueueVisit = async (queueEntryId) => {
  const queue = await entities.QueueEntry.get(queueEntryId);
  if (!queue) throw new Error('Kunjungan/antrean tidak ditemukan');
  const visitId = queue.encounter_id || queue.visit_id || encounterIdForQueue(queue.id);
  let visit = await entities.Visit.get(visitId);
  if (!visit) {
    syncVisitFromQueue(queue);
    visit = await entities.Visit.get(visitId);
  }
  return { queue, visit, visitId };
};

const transitionVisit = async (queueEntryId, targetStatus, options = {}) => {
  const { queue, visit, visitId } = await getQueueVisit(queueEntryId);
  const fromStatus = visit?.status || queue.workflow_status || visitStatusFromQueue(queue.status);
  if (!options.force && !canTransitionVisit(fromStatus, targetStatus)) {
    throw new Error(`Transisi kunjungan ${fromStatus} → ${targetStatus} tidak diperbolehkan`);
  }
  const at = nowIso();
  const actor = await currentUser();
  const history = [
    ...(visit?.status_history || []),
    { from: fromStatus, to: targetStatus, at, actor: actor?.full_name || actor?.email || 'Sistem', role: actor?.active_role || actor?.clinic_role || actor?.role || 'Sistem', reason: options.reason || '' },
  ];
  await entities.Visit.update(visitId, {
    status: targetStatus,
    status_history: history,
    [`${targetStatus.toLowerCase()}_at`]: at,
    updated_at: at,
  });
  const queueStatus = options.queueStatus || queueStatusFromVisit(targetStatus);
  await entities.QueueEntry.update(queue.id, {
    status: queueStatus,
    workflow_status: targetStatus,
    encounter_id: visitId,
    visit_id: visitId,
    ...(options.queuePatch || {}),
  });
  return { queue: await entities.QueueEntry.get(queue.id), visit: await entities.Visit.get(visitId) };
};

const refreshEncounterClosure = async (queueEntryId) => {
  const { queue, visit, visitId } = await getQueueVisit(queueEntryId);
  if (visit?.status === VISIT_STATUS.CLOSED) {
    return { queue, visit, already_closed: true };
  }
  const [prescriptions, transactions, orders] = await Promise.all([
    entities.Prescription.filter({ visit_id: visitId }),
    entities.Transaction.filter({ visit_id: visitId }),
    entities.Order.filter({ visit_id: visitId }),
  ]);
  const prescriptionReady = prescriptions.every((item) => isPrescriptionFinal(item.workflow_status || prescriptionStatusMap[item.status]));
  const pharmacyRequired = prescriptions.length > 0;
  const pharmacyInvoices = transactions.filter((item) => item.cash_point === 'farmasi' && item.invoice_status !== INVOICE_STATUS.VOIDED);
  const clinicInvoices = transactions.filter((item) => item.cash_point === 'klinik' && item.invoice_status !== INVOICE_STATUS.VOIDED);
  // Farmasi hanya menyelesaikan dispensing dan menerbitkan tagihan. Pembayaran
  // seluruh tagihan kunjungan adalah satu titik di Kasir agar rekonsiliasi tidak
  // terpecah antara layanan klinik dan resep.
  const pharmacyInvoiceCreated = !pharmacyRequired || pharmacyInvoices.length > 0;
  const openInvoices = [...clinicInvoices, ...pharmacyInvoices];
  const invoicesPaid = openInvoices.length > 0 && openInvoices.every((item) => isInvoiceFinal(item.invoice_status));
  const ordersFinal = orders.every((order) => ['COMPLETED', 'CANCELLED', 'DISPENSED', 'HANDED_TO_PATIENT', 'BILLED'].includes(order.status));

  if (prescriptionReady && pharmacyInvoiceCreated && invoicesPaid && ordersFinal) {
    const ready = await transitionVisit(queue.id, VISIT_STATUS.READY_TO_CLOSE, { force: true, queueStatus: 'Kasir' });
    return transitionVisit(ready.queue.id, VISIT_STATUS.CLOSED, { queueStatus: 'Selesai', queuePatch: { check_out_time: nowIso() } });
  }

  if (prescriptionReady && pharmacyInvoiceCreated && ordersFinal) {
    const ready = await transitionVisit(queue.id, VISIT_STATUS.READY_TO_CLOSE, { force: true, queueStatus: 'Kasir' });
    return {
      queue: ready.queue,
      visit: ready.visit,
      pending: { prescriptionReady, pharmacyInvoiceCreated, invoicesPaid, ordersFinal },
    };
  }

  await entities.QueueEntry.update(queue.id, {
    status: 'Di Apotek',
    workflow_status: visit?.status || VISIT_STATUS.COMPLETED,
  });
  return {
    queue: await entities.QueueEntry.get(queue.id),
    visit: await entities.Visit.get(visitId),
    pending: { prescriptionReady, pharmacyInvoiceCreated, invoicesPaid, ordersFinal },
  };
};

const invokeLocalFunction = async (name, payload = {}) => {
  const user = await currentUser();
  if (!user && name !== 'fetchDrugInfoSummary' && name !== 'searchHelp') throw new Error('Sesi lokal belum masuk');

  if (name === 'logAudit') return functionResponse(await auditLocally(payload));

  if (name === 'registerPatient') {
    const fullName = String(payload.full_name || '').trim();
    const birthDate = String(payload.birth_date || '').trim();
    const nik = String(payload.nik || '').replace(/\D/g, '');
    const phone = String(payload.phone || '').replace(/\D/g, '');
    if (!fullName || !birthDate || !payload.gender) {
      throw new Error('Nama lengkap, tanggal lahir, dan jenis kelamin wajib diisi');
    }
    if (nik && nik.length !== 16) throw new Error('NIK harus terdiri dari 16 digit');
    const birth = new Date(`${birthDate}T12:00:00`);
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear()
      - (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    const isChild = Number.isFinite(age) && age < 18;
    if (isChild && (!String(payload.guardian_name || '').trim()
      || !String(payload.guardian_relation || '').trim()
      || !String(payload.guardian_phone || '').trim())) {
      throw new Error('Pasien anak wajib memiliki nama, hubungan, dan nomor telepon orang tua/wali');
    }

    const normalizeName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedName = normalizeName(fullName);
    const patients = await entities.Patient.list();
    const duplicateMatches = patients.filter((patient) => {
      const sameNik = nik && String(patient.nik || '').replace(/\D/g, '') === nik;
      const sameIdentity = patient.birth_date === birthDate && normalizeName(patient.full_name) === normalizedName;
      const sameContact = phone && patient.birth_date === birthDate && String(patient.phone || '').replace(/\D/g, '') === phone;
      return sameNik || sameIdentity || sameContact;
    });
    if (duplicateMatches.length && !payload.allow_duplicate) {
      return functionResponse({ success: false, duplicate_found: true, matches: duplicateMatches.slice(0, 5) });
    }

    const year = new Date().getFullYear();
    const usedNumbers = patients
      .map((patient) => String(patient.mr_number || '').match(new RegExp(`^RM-${year}-(\\d+)$`))?.[1])
      .filter(Boolean)
      .map(Number);
    const nextNumber = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;
    const patient = await entities.Patient.create({
      full_name: fullName,
      nik,
      gender: payload.gender,
      birth_date: birthDate,
      phone: String(payload.phone || '').trim(),
      email: String(payload.email || '').trim(),
      address: String(payload.address || '').trim(),
      blood_type: '-',
      allergies: '',
      insurance_type: payload.insurance_type || 'Umum',
      bpjs_number: String(payload.bpjs_number || '').trim(),
      insurance_number: String(payload.insurance_number || payload.bpjs_number || '').trim(),
      guardian_name: String(payload.guardian_name || '').trim(),
      guardian_relation: String(payload.guardian_relation || '').trim(),
      guardian_phone: String(payload.guardian_phone || '').trim(),
      emergency_contact: String(payload.emergency_contact || '').trim(),
      mr_number: `RM-${year}-${String(nextNumber).padStart(5, '0')}`,
      branch_id: BRANCH_ID,
    });
    let familyAccount = null;
    if (isChild) {
      const guardianName = String(payload.guardian_name).trim();
      const guardianPhone = String(payload.guardian_phone).trim();
      familyAccount = (await entities.FamilyAccount.list()).find((family) =>
        (guardianPhone && String(family.parent_phone || '').replace(/\D/g, '') === guardianPhone.replace(/\D/g, ''))
        || (family.parent_name === guardianName && family.is_active !== false));
      if (familyAccount) {
        const memberIds = [...new Set([...familyPatientIds(familyAccount), patient.id])];
        familyAccount = await entities.FamilyAccount.update(familyAccount.id, {
          member_patient_ids: memberIds,
          child_patient_ids: memberIds,
          child_names: [...new Set([...(familyAccount.child_names || []), patient.full_name])],
          is_active: true,
        });
      } else {
        familyAccount = await entities.FamilyAccount.create({
          family_name: `Keluarga ${guardianName}`,
          parent_name: guardianName,
          parent_phone: guardianPhone,
          parent_email: String(payload.email || '').trim(),
          parent_relation: String(payload.guardian_relation).trim(),
          address: String(payload.address || '').trim(),
          member_patient_ids: [patient.id],
          child_patient_ids: [patient.id],
          child_names: [patient.full_name],
          is_active: true,
        });
      }
    }
    return functionResponse({ success: true, patient, family_account_id: familyAccount?.id || null });
  }

  if (name === 'getFrontOfficeDocumentData') {
    const type = String(payload.type || '');
    const patient = await entities.Patient.get(payload.patient_id);
    if (!patient) throw new Error('Pasien tidak ditemukan');
    const documentTypes = {
      prescription: { approvalKey: 'prescription_print', label: 'resep' },
      sick_letter: { approvalKey: 'sick_leave', label: 'surat istirahat' },
      external_referral: { approvalKey: 'external_referral', label: 'surat rujukan eksternal' },
      medical_summary: { approvalKey: 'medical_summary', label: 'resume medis' },
      instructions: { approvalKey: 'instructions', label: 'instruksi/anjuran' },
      control_card: { approvalKey: 'control_card', label: 'kartu kontrol' },
    };
    if (!['envelope', ...Object.keys(documentTypes)].includes(type)) {
      throw new Error('Jenis dokumen Front Office tidak dikenali');
    }
    if (type === 'envelope') {
      await auditLocally({ action: 'access_print_data', entity: 'Patient', entity_id: patient.id, entity_name: patient.full_name, module: 'front_desk', description: 'Front Office menyiapkan amplop dokumen pasien' });
      return functionResponse({ patient, medical_record: null });
    }
    const { approvalKey, label } = documentTypes[type];
    const record = [...(data.MedicalRecord || [])]
      .filter((item) => item.patient_id === patient.id
        && (!payload.medical_record_id || item.id === payload.medical_record_id)
        && item.finalized && item.administrative_documents?.[approvalKey]?.approved)
      .sort((a, b) => String(b.finalized_at || b.created_date || '').localeCompare(String(a.finalized_at || a.created_date || '')))[0];
    if (!record) {
      throw new Error(`Belum ada ${label} yang disetujui dokter pada rekam medis final pasien ini`);
    }
    // This narrow, audited payload is the only clinical document surface given
    // to Front Office. It is used for release/printing, not for browsing RME.
    const documentRecord = {
      id: record.id,
      visit_id: record.visit_id || record.encounter_id || '',
      visit_date: record.visit_date || '',
      patient_name: record.patient_name,
      doctor_name: record.doctor_name,
      doctor_sip: record.doctor_sip || '',
      diagnosis: ['external_referral', 'medical_summary', 'control_card'].includes(type) ? record.diagnosis || '' : '',
      administrative_documents: {
        [approvalKey]: record.administrative_documents[approvalKey],
      },
    };
    if (type === 'prescription') {
      const prescription = [...(data.Prescription || [])]
        .filter((item) => item.patient_id === patient.id && (item.visit_id || item.encounter_id) === documentRecord.visit_id)
        .sort((a, b) => String(b.created_date || b.prescription_date || '').localeCompare(String(a.created_date || a.prescription_date || '')))[0];
      if (!prescription) throw new Error('Resep yang disetujui belum tersedia untuk Visit ini');
      documentRecord.prescription = {
        prescription_number: prescription.prescription_number || '',
        prescription_date: prescription.prescription_date || documentRecord.visit_date,
        original_text: prescription.original_text || '',
        normalized_text: prescription.normalized_text || '',
        is_racikan: Boolean(prescription.is_racikan),
        items: prescription.items || [],
      };
    }
    if (type === 'medical_summary') {
      Object.assign(documentRecord, {
        chief_complaint: record.chief_complaint || '', subjective: record.subjective || '',
        vital_signs_bp: record.vital_signs_bp || '', vital_signs_temp: record.vital_signs_temp || '',
        vital_signs_pulse: record.vital_signs_pulse || '', vital_signs_rr: record.vital_signs_rr || '',
        vital_signs_weight: record.vital_signs_weight || '', physical_exam: record.physical_exam || '',
        procedures: record.procedures || [], treatment_plan: record.treatment_plan || '',
        follow_up_date: record.follow_up_date || '', follow_up_instructions: record.follow_up_instructions || '',
        patient_education: record.patient_education || '',
      });
    }
    if (type === 'instructions') Object.assign(documentRecord, {
      treatment_plan: record.treatment_plan || '', follow_up_instructions: record.follow_up_instructions || '', patient_education: record.patient_education || '',
    });
    if (type === 'control_card') Object.assign(documentRecord, {
      follow_up_date: record.follow_up_date || '', follow_up_instructions: record.follow_up_instructions || '',
    });
    await auditLocally({
      action: 'access_print_data', entity: 'MedicalRecord', entity_id: record.id, entity_name: patient.full_name,
      module: 'front_desk', description: `Front Office membuka data cetak ${label} yang telah disetujui dokter`,
    });
    return functionResponse({ patient, medical_record: documentRecord });
  }

  if (name === 'listFrontOfficeApprovedDocuments') {
    // The Front Office queue exposes only release metadata. Clinical fields are
    // intentionally withheld until an approved document is explicitly opened.
    const documentTypes = [
      { type: 'prescription', approvalKey: 'prescription_print', label: 'Resep Obat' },
      { type: 'sick_letter', approvalKey: 'sick_leave', label: 'Surat Keterangan Istirahat' },
      { type: 'external_referral', approvalKey: 'external_referral', label: 'Surat Rujukan' },
      { type: 'medical_summary', approvalKey: 'medical_summary', label: 'Resume Medis' },
      { type: 'instructions', approvalKey: 'instructions', label: 'Instruksi / Anjuran' },
      { type: 'control_card', approvalKey: 'control_card', label: 'Kartu Kontrol' },
    ];
    const patientsById = new Map((data.Patient || []).map((patient) => [patient.id, patient]));
    const documents = (data.MedicalRecord || [])
      .filter((record) => record.finalized)
      .flatMap((record) => {
        const patient = patientsById.get(record.patient_id);
        return documentTypes
          .filter(({ approvalKey }) => record.administrative_documents?.[approvalKey]?.approved)
          .map(({ type, approvalKey, label }) => ({
            id: `${record.id}:${type}`,
            medical_record_id: record.id,
            visit_id: record.visit_id || record.encounter_id || '',
            visit_date: record.visit_date || '',
            patient_id: record.patient_id,
            patient_name: patient?.full_name || record.patient_name || 'Pasien',
            patient_mr_number: patient?.mr_number || '',
            doctor_name: record.doctor_name || 'Dokter',
            document_type: type,
            document_label: label,
            approved_at: record.administrative_documents?.[approvalKey]?.approved_at || record.finalized_at || record.created_date || '',
          }));
      })
      .sort((a, b) => String(b.approved_at).localeCompare(String(a.approved_at)));
    await auditLocally({
      action: 'view_approved_documents', entity: 'MedicalRecord', module: 'front_desk',
      description: 'Front Office melihat antrean dokumen yang telah disetujui dokter',
      metadata: { document_count: documents.length },
    });
    return functionResponse({ documents });
  }

  if (name === 'registerVisit') {
    if (!payload.patient_id || !payload.patient_name || !payload.poli || !payload.doctor_id || !payload.schedule_id) {
      throw new Error('Pasien, poli, dokter tujuan, dan jadwal praktik wajib diisi');
    }
    if (!String(payload.complaint || '').trim()) throw new Error('Keluhan awal wajib diisi dan tidak boleh berupa diagnosis');
    const visitDate = payload.visit_date || new Date().toISOString().slice(0, 10);
    const visitDay = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(`${visitDate}T12:00:00`).getDay()];
    if (String(payload.schedule_id).startsWith('profile-')) {
      const profile = await entities.DoctorProfile.get(String(payload.schedule_id).slice('profile-'.length));
      const profileDoctorId = profile?.user_id || profile?.staff_id || profile?.id;
      if (!profile || profileDoctorId !== payload.doctor_id || !(profile.practice_days || []).includes(visitDay) || (profile.practice_room || `Poli ${profile.specialization || 'Umum'}`) !== payload.poli) {
        throw new Error('Dokter tidak memiliki jadwal praktik yang sesuai untuk poli dan tanggal ini');
      }
    } else {
      const schedule = await entities.DoctorSchedule.get(payload.schedule_id);
      if (!schedule || schedule.is_active === false || ['Cuti', 'Izin', 'Sakit', 'Tidak Praktik', 'Dibatalkan'].includes(schedule.status)
        || schedule.day_of_week !== visitDay || schedule.doctor_id !== payload.doctor_id || schedule.poli !== payload.poli
        || (schedule.effective_from && schedule.effective_from > visitDate)
        || (schedule.effective_until && schedule.effective_until < visitDate)) {
        throw new Error('Jadwal dokter sudah tidak tersedia atau tidak sesuai dengan poli tujuan');
      }
    }
    const patient = await entities.Patient.get(payload.patient_id);
    if (!patient) throw new Error('Data pasien tidak ditemukan');
    if (payload.appointment_id) {
      const appointment = await entities.Appointment.get(payload.appointment_id);
      if (!appointment || appointment.patient_id !== payload.patient_id || appointment.appointment_date !== visitDate) {
        throw new Error('Janji temu tidak sesuai dengan pasien atau tanggal kunjungan');
      }
    }
    const existing = (await entities.QueueEntry.filter({ patient_id: payload.patient_id, visit_date: visitDate }))
      .find((item) => !['Selesai', 'Batal', 'No-Show'].includes(item.status)
        && item.loket === payload.poli
        && (!payload.doctor_id || item.doctor_id === payload.doctor_id));
    if (existing) return functionResponse({ success: true, duplicate_prevented: true, queue: existing, visit: await entities.Visit.get(existing.visit_id || existing.encounter_id) });

    const queue = await entities.QueueEntry.create({
      queue_number: payload.queue_number,
      patient_id: payload.patient_id,
      patient_name: payload.patient_name,
      visit_type: payload.visit_type || 'Poliklinik',
      status: 'Menunggu',
      workflow_status: VISIT_STATUS.WAITING,
      loket: payload.poli,
      doctor_id: payload.doctor_id || '',
      doctor_name: payload.doctor_name || '',
      schedule_id: payload.schedule_id || '',
      appointment_id: payload.appointment_id || '',
      priority: Boolean(payload.priority),
      complaint: payload.complaint || '',
      channel: payload.channel || 'walk-in',
      payer_type: payload.payer_type || 'Umum',
      insurance_number: payload.insurance_number || '',
      registration_notes: payload.registration_notes || '',
      handoff_to: 'Perawat / Intake',
      check_in_time: nowIso(),
      visit_date: visitDate,
      branch_id: BRANCH_ID,
    });
    if (payload.appointment_id) {
      const appointment = await entities.Appointment.get(payload.appointment_id);
      if (appointment) {
        await entities.Appointment.update(appointment.id, {
          status: 'Hadir',
          queue_entry_id: queue.id,
          visit_id: queue.visit_id,
          encounter_id: queue.encounter_id,
          checked_in_at: nowIso(),
        });
      }
    }
    await auditLocally({
      action: 'create',
      entity: 'Visit',
      entity_id: queue.visit_id,
      entity_name: payload.patient_name,
      module: 'front_desk',
      description: `Kunjungan ${queue.queue_number} didaftarkan ke ${payload.poli} — ${payload.doctor_name}`,
    });
    return functionResponse({ success: true, queue, visit: await entities.Visit.get(queue.visit_id || queue.encounter_id) });
  }

  if (name === 'callVisit') {
    const { queue } = await getQueueVisit(payload.queue_entry_id);
    const transitioned = await transitionVisit(queue.id, VISIT_STATUS.CALLED, {
      queueStatus: 'Dipanggil',
      queuePatch: { called_time: nowIso(), arrived_at: null, handoff_to: 'Front Office' },
    });
    return functionResponse({ success: true, ...transitioned });
  }

  if (name === 'returnVisitToWaiting') {
    const transitioned = await transitionVisit(payload.queue_entry_id, VISIT_STATUS.WAITING, {
      reason: payload.reason || 'Panggilan dilewati',
      queueStatus: 'Menunggu',
      queuePatch: { called_time: null, arrived_at: null, handoff_to: 'Front Office' },
    });
    return functionResponse({ success: true, ...transitioned });
  }

  if (name === 'confirmVisitArrival') {
    const { queue, visitId } = await getQueueVisit(payload.queue_entry_id);
    if (queue.workflow_status !== VISIT_STATUS.CALLED && queue.status !== 'Dipanggil') {
      throw new Error('Pasien harus dipanggil sebelum kedatangannya dikonfirmasi');
    }
    const arrivalAt = nowIso();
    await entities.QueueEntry.update(queue.id, {
      status: 'Menunggu Intake',
      workflow_status: VISIT_STATUS.CALLED,
      arrived_at: arrivalAt,
      handoff_to: 'Perawat / Intake',
    });
    await entities.Visit.update(visitId, { arrived_at: arrivalAt, handoff_to: 'Perawat / Intake' });
    await auditLocally({
      action: 'handoff',
      entity: 'Visit',
      entity_id: queue.visit_id || queue.encounter_id,
      entity_name: queue.patient_name,
      module: 'front_desk',
      description: `${queue.queue_number} hadir dan diteruskan ke intake perawat`,
    });
    return functionResponse({ success: true, queue: await entities.QueueEntry.get(queue.id), visit: await entities.Visit.get(queue.visit_id || queue.encounter_id) });
  }

  if (name === 'saveIntake') {
    const { queue, visitId } = await getQueueVisit(payload.queue_entry_id);
    if (![VISIT_STATUS.CALLED, VISIT_STATUS.INTAKE_DONE].includes(queue.workflow_status)) {
      throw new Error('Pasien belum dikonfirmasi hadir oleh Front Office');
    }
    const intakeAt = nowIso();
    const intake = {
      visit_id: visitId,
      encounter_id: visitId,
      queue_entry_id: queue.id,
      patient_id: queue.patient_id,
      patient_name: queue.patient_name,
      record_type: 'intake',
      complaint: payload.complaint || '',
      allergy: payload.allergy || '',
      allergy_verified: Boolean(payload.allergy_verified),
      sterile_equipment_ready: Boolean(payload.sterile_equipment_ready),
      room_ready: Boolean(payload.room_ready),
      vital_signs_bp: payload.vital_signs_bp || null,
      vital_signs_temp: payload.vital_signs_temp || null,
      vital_signs_pulse: payload.vital_signs_pulse || null,
      vital_signs_rr: payload.vital_signs_rr || null,
      vital_signs_weight: payload.vital_signs_weight || null,
      vital_signs_height: payload.vital_signs_height || null,
      vital_signs_spo2: payload.vital_signs_spo2 || null,
      vital_signs_head_circumference: payload.vital_signs_head_circumference || null,
      author_user_id: user.id,
      author_name: user.full_name || user.email,
      recorded_at: intakeAt,
      version: 1,
    };
    const previous = (await entities.ClinicalRecord.filter({ visit_id: visitId, record_type: 'intake' })).at(-1);
    const savedIntake = previous
      ? await entities.ClinicalRecord.create({ ...intake, version: Number(previous.version || 1) + 1, supersedes_id: previous.id })
      : await entities.ClinicalRecord.create(intake);
    if (payload.allergy) {
      await entities.Patient.update(queue.patient_id, { allergies: payload.allergy, allergy_verified_at: intakeAt });
    }
    const transitioned = await transitionVisit(queue.id, VISIT_STATUS.INTAKE_DONE, {
      queueStatus: 'Siap Dokter',
      queuePatch: {
        ...intake,
        vital_signs_recorded_by: intake.author_name,
        vital_signs_recorded_at: intakeAt,
        intake_record_id: savedIntake.id,
        priority: Boolean(payload.priority),
      },
    });
    return functionResponse({ success: true, intake: savedIntake, ...transitioned });
  }

  if (name === 'acceptVisit') {
    const { queue } = await getQueueVisit(payload.queue_entry_id);
    if (!doctorMatches(queue, user)) {
      throw new Error('Dokter hanya dapat menerima pasien yang ditugaskan kepadanya oleh Front Office');
    }
    if (!queue.intake_record_id && !queue.vital_signs_recorded_at && !payload.override_reason) {
      throw new Error('Pemeriksaan awal perawat belum selesai. Gunakan alasan override hanya untuk kondisi mendesak.');
    }
    const transitioned = await transitionVisit(queue.id, VISIT_STATUS.IN_SERVICE, {
      force: queue.workflow_status !== VISIT_STATUS.INTAKE_DONE,
      reason: payload.override_reason || '',
      queueStatus: 'Pemeriksaan',
      queuePatch: { doctor_id: payload.doctor_id || queue.doctor_id, doctor_name: payload.doctor_name || queue.doctor_name, accepted_at: nowIso() },
    });
    return functionResponse({ success: true, ...transitioned });
  }

  if (name === 'refreshEncounterClosure') {
    if (payload.pharmacy_transaction_id && actorRole(user) === 'Apoteker') {
      await entities.QueueEntry.update(payload.queue_entry_id, {
        prescription_id: payload.prescription_id || '',
        pharmacy_transaction_id: payload.pharmacy_transaction_id,
      });
    }
    return functionResponse({ success: true, ...(await refreshEncounterClosure(payload.queue_entry_id)) });
  }

  if (name === 'fetchDrugInfoSummary') {
    const medicine = (await entities.Medicine.list()).find((item) => item.name === payload.medicineName);
    return functionResponse({
      summary: medicine ? `${medicine.name} (${medicine.form || 'sediaan'}) mengandung ${medicine.active_substance || medicine.generic_name || '-'} dengan kekuatan ${medicine.strength || '-'}.` : 'Informasi obat belum tersedia di penyimpanan lokal.',
      sources: medicine?.reference_url ? [medicine.reference_url] : [],
    });
  }

  if (name === 'searchHelp') {
    const query = String(payload.query || payload.searchTerm || '').toLowerCase();
    const [guides, terms] = await Promise.all([entities.SearchGuide.list(), entities.SearchTerm.list()]);
    const results = [...guides, ...terms].filter((item) => JSON.stringify(item).toLowerCase().includes(query));
    return functionResponse({ results: results.slice(0, 20) });
  }

  if (name === 'calculateDoctorRemuneration') {
    if (payload.doctor_id && payload.doctor_id !== user.id) {
      throw new Error('Dokter hanya dapat melihat perhitungan jasa miliknya sendiri');
    }
    const records = await entities.MedicalRecord.filter({ doctor_id: payload.doctor_id, visit_date: { $gte: payload.period_start, $lte: payload.period_end } });
    const mine = records.filter((record) => record.doctor_id === payload.doctor_id || record.doctor_name === payload.doctor_name);
    const consultations = mine.length;
    const tindakanCount = mine.reduce((total, record) => total + (record.procedures || []).length, 0);
    const tindakanTotal = mine.reduce((total, record) => total + (record.tindakan_total || 0), 0);
    const profile = (await entities.DoctorProfile.filter({ user_id: payload.doctor_id })).at(0);
    const scheme = profile?.remuneration_scheme || 'N/A';
    const remuneration = scheme === 'Persentase' ? tindakanTotal * ((profile?.remuneration_percent || 0) / 100) : scheme === 'Per Tindakan' ? tindakanCount * (profile?.remuneration_per_tindakan || 0) : scheme === 'Kombinasi' ? consultations * (profile?.remuneration_nominal || 0) + tindakanTotal * ((profile?.remuneration_percent || 0) / 100) : consultations * (profile?.remuneration_nominal || 0);
    return functionResponse({ success: true, period_start: payload.period_start, period_end: payload.period_end, doctor_name: payload.doctor_name, scheme, metrics: { consultations, tindakan_count: tindakanCount, tindakan_total: tindakanTotal, unique_patients: new Set(mine.map((record) => record.patient_id).filter(Boolean)).size, follow_ups: mine.filter((record) => record.follow_up_date).length }, remuneration, breakdown: { scheme } });
  }

  if (name === 'submitOwnerChangeRequest') {
    const subject = String(payload.subject || '').trim();
    const message = String(payload.message || '').trim();
    if (!subject || !message) throw new Error('Judul dan rincian perubahan wajib diisi');
    const request = await entities.InternalRequest.create({
      request_number: `OWN-CHG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
      type: 'Permintaan Perubahan Owner',
      from_user_id: user.id,
      from_user_name: user.full_name || user.email,
      from_role: 'Owner',
      to_role: 'Admin',
      subject,
      message,
      scope: String(payload.scope || 'Operasional / Konfigurasi'),
      priority: payload.priority || 'Normal',
      status: 'Baru',
      created_date: nowIso(),
    });
    await entities.Notification.create({
      type: 'owner_change_request',
      target_role: 'Admin',
      title: `Permintaan perubahan Owner: ${subject}`,
      body: message,
      priority: request.priority,
      related_entity: 'InternalRequest',
      related_id: request.id,
      action_label: 'Tinjau Permintaan',
      action_type: 'navigate',
      action_payload: JSON.stringify({ path: '/roles' }),
    });
    await auditLocally({ action: 'create', entity: 'InternalRequest', entity_id: request.id, entity_name: subject, module: 'owner_request', description: 'Owner mengajukan perubahan untuk diproses Admin.' });
    return functionResponse({ success: true, request });
  }

  if (name === 'reviewOwnerChangeRequest') {
    const request = await entities.InternalRequest.get(payload.request_id);
    if (!request || request.type !== 'Permintaan Perubahan Owner') throw new Error('Permintaan perubahan Owner tidak ditemukan');
    const status = payload.action === 'approve' ? 'Disetujui Admin' : 'Ditolak Admin';
    const updated = await entities.InternalRequest.update(request.id, {
      status,
      review_notes: String(payload.review_notes || '').trim(),
      reviewed_by: user.id,
      reviewed_by_name: user.full_name || user.email,
      reviewed_at: nowIso(),
    });
    await entities.Notification.create({
      type: 'owner_change_request_reviewed',
      target_role: 'Owner',
      target_user_id: request.from_user_id,
      title: `${status}: ${request.subject}`,
      body: String(payload.review_notes || 'Permintaan telah ditinjau oleh Admin.'),
      priority: request.priority || 'Normal',
      related_entity: 'InternalRequest',
      related_id: request.id,
    });
    await auditLocally({ action: 'update', entity: 'InternalRequest', entity_id: request.id, entity_name: request.subject, module: 'admin_request', description: `Admin menetapkan status ${status}.` });
    return functionResponse({ success: true, request: updated });
  }

  if (name === 'submitScheduleChange') {
    if (payload.doctor_id && payload.doctor_id !== user.id) {
      throw new Error('Dokter hanya dapat mengajukan perubahan jadwal praktik miliknya sendiri');
    }
    const dateQuery = payload.affected_date_end ? { appointment_date: { $gte: payload.affected_date, $lte: payload.affected_date_end }, status: { $in: ['Terjadwalkan', 'Dikonfirmasi'] } } : { appointment_date: payload.affected_date, status: { $in: ['Terjadwalkan', 'Dikonfirmasi'] } };
    const appointments = (await entities.Appointment.filter(dateQuery)).filter((appointment) => !appointment.doctor_id || appointment.doctor_id === payload.doctor_id || appointment.doctor_name === payload.doctor_name);
    const impacted = appointments.map((appointment) => ({ appointment_id: appointment.id, patient_name: appointment.patient_name, time_slot: appointment.time_slot }));
    if (payload.preview) return functionResponse({ preview: true, impacted_count: impacted.length, impacted_appointments: impacted });
    const request = await entities.ScheduleChangeRequest.create({ ...payload, impacted_appointments: impacted, impacted_count: impacted.length, status: 'Diajukan', submitted_by: user.id, submitted_at: new Date().toISOString() });
    for (const targetRole of ['Owner', 'Manajer Operasional']) {
      await entities.Notification.create({ type: 'schedule_change', target_role: targetRole, title: `Persetujuan ${payload.request_type}: ${payload.doctor_name}`, body: `${payload.doctor_name} mengajukan ${payload.request_type} untuk ${payload.affected_date}. ${impacted.length} pasien terdampak.`, priority: impacted.length ? 'Penting' : 'Normal', related_entity: 'ScheduleChangeRequest', related_id: request.id, action_label: 'Buka persetujuan', action_type: 'navigate', action_payload: JSON.stringify({ path: '/schedule-approvals' }) });
    }
    await auditLocally({ action: 'create', entity: 'ScheduleChangeRequest', entity_id: request.id, entity_name: `${payload.doctor_name} — ${payload.request_type}`, module: 'doctor_schedule', description: `Pengajuan perubahan jadwal untuk ${payload.affected_date}.` });
    return functionResponse({ success: true, request_id: request.id, impacted_count: impacted.length, impacted_appointments: impacted });
  }

  if (name === 'approveScheduleChange') {
    const request = await entities.ScheduleChangeRequest.get(payload.request_id);
    if (!request) throw new Error('Request tidak ditemukan');
    const status = payload.action === 'approve' ? 'Disetujui' : 'Ditolak';
    await entities.ScheduleChangeRequest.update(request.id, { status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_notes: payload.review_notes || '', reschedule_action: payload.reschedule_action || 'Notifikasi Pasien' });
    let notified = 0;
    if (payload.action === 'approve') for (const appointment of request.impacted_appointments || []) {
      await entities.Appointment.update(appointment.appointment_id, { status: 'Perlu Reschedule', notes: `Dokter ${request.request_type} ${request.affected_date}. Mohon hubungi pasien untuk reschedule.` });
      await entities.Notification.create({ type: 'appointment_impacted', target_role: 'Front Office', title: `Janji temu terdampak: ${appointment.patient_name}`, body: `Pasien ${appointment.patient_name} terdampak perubahan jadwal.`, priority: 'Penting', related_entity: 'Appointment', related_id: appointment.appointment_id });
      notified++;
    }
    return functionResponse({ success: true, status, rescheduled: payload.reschedule_action === 'Reschedule Otomatis' ? notified : 0, notified });
  }

  if (name === 'runAnomalyScan') {
    const medicines = await entities.Medicine.list();
    const anomalies = [];
    for (const medicine of medicines.filter((item) => item.stock_on_hand <= item.min_stock)) {
      const existing = await entities.Anomaly.filter({ related_entity: 'Medicine', related_id: medicine.id, type: 'low_stock' });
      if (!existing.length) anomalies.push(await entities.Anomaly.create({ type: 'low_stock', severity: medicine.stock_on_hand === 0 ? 'critical' : 'warning', description: `Stok ${medicine.name} berada di bawah minimum`, related_entity: 'Medicine', related_id: medicine.id, status: 'Baru', detected_at: new Date().toISOString() }));
    }
    return functionResponse({ success: true, created: anomalies.length, anomalies });
  }

  if (name === 'syncRoleAssignments') {
    const role = await entities.Role.get(payload.role_id);
    if (!role || role.is_active === false) throw new Error('Role tujuan tidak ditemukan atau tidak aktif');
    if (role.name === 'Owner' && actorRole(user) !== 'Owner') {
      throw new Error('Hanya Owner yang dapat menetapkan jabatan Owner');
    }

    const selectedIds = [...new Set((payload.user_ids || []).filter(Boolean))];
    const allUsers = await entities.User.list();
    const validUserIds = new Set(allUsers.map((item) => item.id));
    if (selectedIds.some((id) => !validUserIds.has(id))) throw new Error('Salah satu user yang dipilih tidak ditemukan');

    const allRoles = await entities.Role.list();
    const formerlyAssigned = (role.user_ids || []).filter((id) => !selectedIds.includes(id));

    // Satu user hanya memiliki satu jabatan aktif. Hapus keanggotaan lama
    // lebih dahulu agar matrix Role, User.clinic_role, dan sesi demo tidak
    // dapat berisi nilai yang saling bertentangan.
    for (const otherRole of allRoles) {
      const currentIds = otherRole.user_ids || [];
      const nextIds = otherRole.id === role.id
        ? selectedIds
        : currentIds.filter((id) => !selectedIds.includes(id) && !formerlyAssigned.includes(id));
      if (JSON.stringify(currentIds) !== JSON.stringify(nextIds)) {
        await entities.Role.update(otherRole.id, { user_ids: nextIds });
      }
    }

    for (const userId of selectedIds) {
      const member = allUsers.find((item) => item.id === userId);
      await entities.User.update(userId, {
        clinic_role: role.name,
        active_role: role.name,
        data: { ...(member?.data || {}), clinic_role: role.name, active_role: role.name },
      });
    }
    for (const userId of formerlyAssigned) {
      const member = allUsers.find((item) => item.id === userId);
      // User yang dilepas tidak mempertahankan izin sebelumnya. Role Staff
      // adalah fallback least-privilege sampai Owner menetapkan jabatan baru.
      await entities.User.update(userId, {
        clinic_role: 'Staff',
        active_role: 'Staff',
        data: { ...(member?.data || {}), clinic_role: 'Staff', active_role: 'Staff' },
      });
    }

    const session = readStoredDemoUser();
    const sessionTarget = [...selectedIds.map((id) => ({ id, role: role.name })), ...formerlyAssigned.map((id) => ({ id, role: 'Staff' }))]
      .find((entry) => entry.id === session?.id);
    if (session && sessionTarget) {
      const updatedSession = {
        ...session,
        clinic_role: sessionTarget.role,
        active_role: sessionTarget.role,
        data: { ...(session.data || {}), clinic_role: sessionTarget.role, active_role: sessionTarget.role },
      };
      memoryUser = updatedSession;
      writeStoredDemoUser(updatedSession);
      if (typeof globalThis.CustomEvent === 'function') {
        globalThis.dispatchEvent?.(new CustomEvent('local-user-role-changed', { detail: { user_id: updatedSession.id, clinic_role: sessionTarget.role } }));
      }
    }
    await auditLocally({
      action: 'role_assignment_sync', entity: 'Role', entity_id: role.id, entity_name: role.name, module: 'user_role',
      description: `Keanggotaan role ${role.name} disinkronkan ke ${selectedIds.length} user`,
      new_value: JSON.stringify({ user_ids: selectedIds, removed_user_ids: formerlyAssigned }), severity: 'Warning',
    });
    return functionResponse({ success: true, role_id: role.id, role_name: role.name, user_ids: selectedIds, removed_user_ids: formerlyAssigned });
  }

  if (name === 'changeSellingPrice') {
    const medicine = await entities.Medicine.get(payload.medicine_id);
    if (!medicine) throw new Error('Obat tidak ditemukan');
    const settings = await entities.ClinicSetting.filter({ category: 'Penentuan Harga' });
    const setting = Object.fromEntries(settings.map((item) => [item.key, item.value]));
    const targetMargin = medicine.target_margin_default || Number(setting.default_target_margin || 30);
    // Harga minimum dan margin selalu memakai HPP (bukan harga beli lama) serta
    // definisi gross margin yang sama dengan proses faktur.
    const hpp = Number(medicine.hpp_per_unit ?? medicine.purchase_price ?? 0);
    const rounding = Number(setting.price_rounding || 500);
    const minSafePrice = Math.ceil((hpp / Math.max(0.01, 1 - targetMargin / 100)) / rounding) * rounding;
    const belowMinimum = Number(payload.new_price) < minSafePrice;
    if (belowMinimum && !payload.reason) throw new Error('Alasan wajib untuk harga di bawah batas minimum');
    const newPrice = Number(payload.new_price);
    const grossMargin = newPrice > 0 ? ((newPrice - hpp) / newPrice) * 100 : 0;
    await entities.Medicine.update(medicine.id, { selling_price: newPrice, min_safe_price: minSafePrice, margin_percent: grossMargin, margin_method: 'Gross Margin', price_protection_active: false });
    const authority = actorRole(user) === 'Owner' ? 'Owner override' : 'Admin price management';
    await entities.PriceHistory.create({ medicine_id: medicine.id, medicine_name: medicine.name, old_price: medicine.selling_price || 0, new_price: Number(payload.new_price), min_safe_price: minSafePrice, target_margin: targetMargin, reason: payload.reason || '', changed_by_name: user.full_name || user.email, approver_role: actorRole(user), source: belowMinimum ? 'override' : 'manual', below_minimum: belowMinimum, authority, timestamp: new Date().toISOString() });
    await auditLocally({ action: 'price_change', entity: 'Medicine', entity_name: medicine.name, module: 'master_obat', description: `Harga ${medicine.name} diubah oleh ${authority}.` });
    return functionResponse({ ok: true, old_price: medicine.selling_price || 0, new_price: newPrice, min_safe_price: minSafePrice, protected: false, below_minimum: belowMinimum });
  }

  if (name === 'createSupplierReturn') {
    const invoice = await entities.SupplierInvoice.get(payload.invoice_id);
    if (!invoice || invoice.status === 'Batal') throw new Error('Faktur sumber tidak tersedia untuk retur');
    const reason = String(payload.reason || '').trim();
    if (!reason) throw new Error('Alasan retur supplier wajib diisi');
    const requestedItems = (payload.items || []).filter((item) => Number(item.return_quantity) > 0);
    if (!requestedItems.length) throw new Error('Pilih minimal satu batch dan jumlah retur');

    const batches = await entities.StockBatch.list();
    const items = [];
    for (const requestItem of requestedItems) {
      const batch = batches.find((item) => item.id === requestItem.batch_id);
      const quantity = Number(requestItem.return_quantity || 0);
      if (!batch || (batch.invoice_id !== invoice.id && batch.invoice_number !== invoice.invoice_number)) throw new Error('Batch retur harus berasal dari faktur yang dipilih');
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(batch.quantity || 0)) {
        throw new Error(`Jumlah retur ${batch.batch_number} harus antara 1 dan ${batch.quantity || 0}`);
      }
      items.push({
        batch_id: batch.id, batch_number: batch.batch_number, medicine_id: batch.medicine_id,
        medicine_name: batch.medicine_name, available_quantity: Number(batch.quantity || 0),
        return_quantity: quantity, unit_price: Number(batch.hpp_per_unit ?? batch.purchase_price ?? batch.cost_per_unit ?? 0),
        subtotal: quantity * Number(batch.hpp_per_unit ?? batch.purchase_price ?? batch.cost_per_unit ?? 0), expiry_date: batch.expiry_date || '',
      });
    }
    const returnNumber = `RTS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;
    const supplierReturn = await entities.SupplierReturn.create({
      return_number: returnNumber, invoice_id: invoice.id, invoice_number: invoice.invoice_number,
      supplier_id: invoice.supplier_id, supplier_name: invoice.supplier_name, items, reason,
      notes: String(payload.notes || '').trim(), status: 'Menunggu Approval',
      total_amount: items.reduce((sum, item) => sum + item.subtotal, 0),
      created_by: user.full_name || user.email, created_by_id: user.id, created_at: nowIso(),
      financial_status: 'Belum Diproses',
      status_history: [{ status: 'Menunggu Approval', at: nowIso(), by: user.full_name || user.email, role: actorRole(user), notes: reason }],
    });
    await entities.Notification.create({
      type: 'supplier_return_approval', target_role: 'Apoteker Penanggung Jawab',
      title: `Retur supplier menunggu persetujuan: ${returnNumber}`,
      body: `${invoice.supplier_name} • ${items.length} batch • alasan: ${reason}`,
      priority: 'Penting', related_entity: 'SupplierReturn', related_id: supplierReturn.id,
      action_label: 'Buka Retur Supplier', action_type: 'navigate', action_payload: JSON.stringify({ path: '/purchasing?tab=return' }),
    });
    await auditLocally({ action: 'create', entity: 'SupplierReturn', entity_id: supplierReturn.id, entity_name: returnNumber, module: 'purchasing', description: `Retur supplier ${returnNumber} diajukan dari faktur ${invoice.invoice_number}.`, severity: 'Warning' });
    return functionResponse({ success: true, supplier_return: supplierReturn });
  }

  if (name === 'approveSupplierReturn') {
    const supplierReturn = await entities.SupplierReturn.get(payload.return_id);
    if (!supplierReturn || supplierReturn.status !== 'Menunggu Approval') throw new Error('Retur tidak berada pada status menunggu persetujuan');
    const action = payload.action === 'approve' ? 'approve' : 'reject';
    const notes = String(payload.notes || '').trim();
    if (action === 'reject' && !notes) throw new Error('Alasan penolakan retur wajib diisi');
    const status = action === 'approve' ? 'Disetujui' : 'Ditolak';
    const updated = await entities.SupplierReturn.update(supplierReturn.id, {
      status, approval_notes: notes, approved_by: user.full_name || user.email, approved_by_id: user.id, approved_at: nowIso(),
      status_history: [...(supplierReturn.status_history || []), { status, at: nowIso(), by: user.full_name || user.email, role: actorRole(user), notes }],
    });
    if (action === 'approve') {
      await entities.Notification.create({
        type: 'supplier_return_ready', target_role: 'Admin Farmasi', title: `Retur siap diproses: ${supplierReturn.return_number}`,
        body: `${supplierReturn.supplier_name} telah disetujui APJ. Keluarkan barang berdasarkan batch yang tercantum.`, priority: 'Penting',
        related_entity: 'SupplierReturn', related_id: supplierReturn.id, action_label: 'Proses Retur', action_type: 'navigate', action_payload: JSON.stringify({ path: '/purchasing?tab=return' }),
      });
    }
    await auditLocally({ action: action === 'approve' ? 'approve' : 'reject', entity: 'SupplierReturn', entity_id: supplierReturn.id, entity_name: supplierReturn.return_number, module: 'purchasing', description: `Retur ${supplierReturn.return_number} ${status.toLowerCase()} APJ${notes ? `: ${notes}` : ''}.`, severity: action === 'approve' ? 'Info' : 'Warning' });
    return functionResponse({ success: true, supplier_return: updated });
  }

  if (name === 'processSupplierReturn') {
    const supplierReturn = await entities.SupplierReturn.get(payload.return_id);
    if (!supplierReturn || supplierReturn.status !== 'Disetujui') throw new Error('Hanya retur yang telah disetujui APJ dapat diproses');
    const invoice = await entities.SupplierInvoice.get(supplierReturn.invoice_id);
    if (!invoice || invoice.status === 'Batal') throw new Error('Faktur sumber tidak dapat diproses');
    const batches = await entities.StockBatch.list();
    const medicines = await entities.Medicine.list();
    for (const item of supplierReturn.items || []) {
      const batch = batches.find((entry) => entry.id === item.batch_id);
      if (!batch || batch.status !== 'Aktif' || Number(batch.quantity || 0) < Number(item.return_quantity || 0)) {
        throw new Error(`Batch ${item.batch_number} tidak memiliki stok cukup untuk retur`);
      }
    }
    for (const item of supplierReturn.items || []) {
      const batch = batches.find((entry) => entry.id === item.batch_id);
      const medicine = medicines.find((entry) => entry.id === item.medicine_id);
      const quantity = Number(item.return_quantity || 0);
      const remainingBatch = Number(batch.quantity || 0) - quantity;
      await entities.StockBatch.update(batch.id, { quantity: remainingBatch, status: remainingBatch > 0 ? 'Aktif' : 'Habis', last_return_id: supplierReturn.id, last_return_at: nowIso() });
      if (medicine) {
        const balance = Math.max(0, Number(medicine.stock_on_hand || 0) - quantity);
        await entities.Medicine.update(medicine.id, { stock_on_hand: balance, updated_from_batch: true });
        await entities.StockMovement.create({
          medicine_id: medicine.id, medicine_name: medicine.name, type: 'Retur Supplier', quantity: -quantity, balance_after: balance,
          batch_number: batch.batch_number, reference_type: 'SupplierReturn', reference_id: supplierReturn.id,
          reference_number: supplierReturn.return_number, notes: `Retur dari faktur ${supplierReturn.invoice_number}: ${supplierReturn.reason}`,
          user_name: user.full_name || user.email, timestamp: nowIso(),
        });
      }
    }
    const total = Number(supplierReturn.total_amount || 0);
    const updatedInvoice = await entities.SupplierInvoice.update(invoice.id, {
      returned_amount: Number(invoice.returned_amount || 0) + total,
      credit_note_status: 'Menunggu Nota Kredit',
      return_status: 'Retur Diproses',
    });
    const updated = await entities.SupplierReturn.update(supplierReturn.id, {
      status: 'Menunggu Nota Kredit', financial_status: 'Menunggu Nota Kredit', processed_by: user.full_name || user.email, processed_by_id: user.id, processed_at: nowIso(),
      invoice_credit_status: updatedInvoice.credit_note_status,
      status_history: [...(supplierReturn.status_history || []), { status: 'Menunggu Nota Kredit', at: nowIso(), by: user.full_name || user.email, role: actorRole(user), notes: 'Stok dan batch telah dikeluarkan untuk retur supplier.' }],
    });
    await entities.Notification.create({
      type: 'supplier_return_credit', target_role: 'Finance', title: `Nota kredit retur: ${supplierReturn.return_number}`,
      body: `Retur Rp ${total.toLocaleString('id-ID')} dari faktur ${supplierReturn.invoice_number} telah diproses. Catat nota kredit dari ${supplierReturn.supplier_name}.`, priority: 'Penting',
      related_entity: 'SupplierReturn', related_id: supplierReturn.id, action_label: 'Buka Faktur', action_type: 'navigate', action_payload: JSON.stringify({ path: '/purchasing?tab=invoice' }),
    });
    await auditLocally({ action: 'process', entity: 'SupplierReturn', entity_id: supplierReturn.id, entity_name: supplierReturn.return_number, module: 'inventory', description: `Retur ${supplierReturn.return_number} diproses; stok batch dikurangi dan Finance menunggu nota kredit.`, severity: 'Warning' });
    return functionResponse({ success: true, supplier_return: updated, invoice: updatedInvoice });
  }

  if (name === 'cancelSupplierReturn') {
    const supplierReturn = await entities.SupplierReturn.get(payload.return_id);
    if (!supplierReturn || !['Menunggu Approval', 'Disetujui'].includes(supplierReturn.status)) throw new Error('Hanya retur yang belum diproses dapat dibatalkan');
    const reason = String(payload.reason || '').trim();
    if (!reason) throw new Error('Alasan pembatalan retur wajib diisi');
    const updated = await entities.SupplierReturn.update(supplierReturn.id, {
      status: 'Dibatalkan', cancelled_by: user.full_name || user.email, cancelled_at: nowIso(), cancellation_reason: reason,
      status_history: [...(supplierReturn.status_history || []), { status: 'Dibatalkan', at: nowIso(), by: user.full_name || user.email, role: actorRole(user), notes: reason }],
    });
    await auditLocally({ action: 'cancel', entity: 'SupplierReturn', entity_id: supplierReturn.id, entity_name: supplierReturn.return_number, module: 'purchasing', description: `Retur ${supplierReturn.return_number} dibatalkan: ${reason}`, severity: 'Warning' });
    return functionResponse({ success: true, supplier_return: updated });
  }

  if (name === 'recordSupplierCreditNote') {
    const supplierReturn = await entities.SupplierReturn.get(payload.return_id);
    if (!supplierReturn || supplierReturn.status !== 'Menunggu Nota Kredit') {
      throw new Error('Nota kredit hanya dapat dicatat setelah barang retur dan stok telah diproses');
    }
    const invoice = await entities.SupplierInvoice.get(supplierReturn.invoice_id);
    if (!invoice) throw new Error('Faktur sumber retur tidak ditemukan');
    const creditNumber = String(payload.credit_note_number || '').trim();
    const creditDate = String(payload.credit_note_date || '').trim();
    const amount = Number(payload.amount || 0);
    const settlementMethod = String(payload.settlement_method || '').trim();
    if (!creditNumber) throw new Error('Nomor nota kredit supplier wajib diisi');
    if (!creditDate) throw new Error('Tanggal nota kredit wajib diisi');
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(supplierReturn.total_amount || 0)) {
      throw new Error(`Nilai nota kredit harus lebih dari 0 dan maksimal Rp ${Number(supplierReturn.total_amount || 0).toLocaleString('id-ID')}`);
    }
    if (!settlementMethod) throw new Error('Metode penyelesaian nota kredit wajib dipilih');
    const duplicate = await entities.SupplierCreditNote.filter({ credit_note_number: creditNumber });
    if (duplicate.length) throw new Error('Nomor nota kredit sudah pernah dicatat');

    const creditNote = await entities.SupplierCreditNote.create({
      credit_note_number: creditNumber, credit_note_date: creditDate, amount,
      supplier_return_id: supplierReturn.id, return_number: supplierReturn.return_number,
      invoice_id: invoice.id, invoice_number: invoice.invoice_number,
      supplier_id: invoice.supplier_id, supplier_name: invoice.supplier_name,
      settlement_method: settlementMethod, notes: String(payload.notes || '').trim(),
      status: 'Diterima', recorded_by: user.full_name || user.email, recorded_by_id: user.id, recorded_at: nowIso(),
    });
    const previousCredit = Number(invoice.credit_note_amount || 0);
    const creditTotal = previousCredit + amount;
    const grossTotal = Number(invoice.total_amount || 0);
    const paidAmount = Number(invoice.paid_amount || 0);
    const netPayable = Math.max(0, grossTotal - creditTotal);
    const outstanding = Math.max(0, netPayable - paidAmount);
    const supplierRefundDue = Math.max(0, paidAmount - netPayable);
    const invoiceStatus = outstanding <= 0 ? 'Lunas' : paidAmount > 0 ? 'Sebagian Bayar' : 'Belum Bayar';
    const updatedInvoice = await entities.SupplierInvoice.update(invoice.id, {
      credit_note_amount: creditTotal, credit_note_status: 'Nota Kredit Diterima',
      last_credit_note_id: creditNote.id, last_credit_note_number: creditNumber,
      net_payable: netPayable, outstanding_amount: outstanding, supplier_refund_due: supplierRefundDue,
      settlement_status: supplierRefundDue > 0 ? 'Menunggu Refund Supplier' : 'Menunggu Rekonsiliasi',
      status: invoiceStatus,
    });
    const schedules = await entities.PaymentSchedule.filter({ invoice_id: invoice.id });
    let remainingSchedule = outstanding;
    for (const schedule of [...schedules].sort((a, b) => String(a.planned_date || '').localeCompare(String(b.planned_date || '')))) {
      if (schedule.status === 'Dibayar') continue;
      const nextAmount = Math.min(Number(schedule.amount || 0), remainingSchedule);
      remainingSchedule = Math.max(0, remainingSchedule - nextAmount);
      await entities.PaymentSchedule.update(schedule.id, {
        amount: nextAmount,
        status: nextAmount > 0 ? schedule.status : 'Dibatalkan',
        adjustment_reason: `Nota kredit ${creditNumber}`,
        adjusted_at: nowIso(), adjusted_by: user.full_name || user.email,
      });
    }
    const updatedReturn = await entities.SupplierReturn.update(supplierReturn.id, {
      status: 'Nota Kredit Diterima', financial_status: 'Nota Kredit Diterima',
      credit_note_id: creditNote.id, credit_note_number: creditNumber, credit_note_date: creditDate,
      credit_note_amount: amount, settlement_method: settlementMethod,
      status_history: [...(supplierReturn.status_history || []), { status: 'Nota Kredit Diterima', at: nowIso(), by: user.full_name || user.email, role: actorRole(user), notes: `${creditNumber} • Rp ${amount.toLocaleString('id-ID')}` }],
    });
    await auditLocally({ action: 'credit_note', entity: 'SupplierReturn', entity_id: supplierReturn.id, entity_name: supplierReturn.return_number, module: 'finance', description: `Nota kredit ${creditNumber} senilai Rp ${amount.toLocaleString('id-ID')} dicatat untuk ${supplierReturn.return_number}.`, severity: 'Warning' });
    return functionResponse({ success: true, supplier_return: updatedReturn, invoice: updatedInvoice, credit_note: creditNote });
  }

  if (name === 'reconcileSupplierReturn') {
    const supplierReturn = await entities.SupplierReturn.get(payload.return_id);
    if (!supplierReturn || supplierReturn.status !== 'Nota Kredit Diterima') throw new Error('Retur harus memiliki nota kredit sebelum direkonsiliasi');
    const reference = String(payload.reconciliation_reference || '').trim();
    const notes = String(payload.notes || '').trim();
    if (!reference) throw new Error('Referensi rekonsiliasi wajib diisi');
    const invoice = await entities.SupplierInvoice.get(supplierReturn.invoice_id);
    if (!invoice) throw new Error('Faktur sumber tidak ditemukan');
    const updatedInvoice = await entities.SupplierInvoice.update(invoice.id, {
      credit_note_status: 'Direkonsiliasi', settlement_status: Number(invoice.supplier_refund_due || 0) > 0 ? 'Refund Supplier Dicatat' : 'Direkonsiliasi',
      reconciled_at: nowIso(), reconciled_by: user.full_name || user.email, reconciliation_reference: reference,
    });
    const updatedReturn = await entities.SupplierReturn.update(supplierReturn.id, {
      status: 'Direkonsiliasi', financial_status: 'Direkonsiliasi', reconciliation_reference: reference,
      reconciliation_notes: notes, reconciled_at: nowIso(), reconciled_by: user.full_name || user.email,
      status_history: [...(supplierReturn.status_history || []), { status: 'Direkonsiliasi', at: nowIso(), by: user.full_name || user.email, role: actorRole(user), notes: `${reference}${notes ? ` • ${notes}` : ''}` }],
    });
    await auditLocally({ action: 'reconcile', entity: 'SupplierReturn', entity_id: supplierReturn.id, entity_name: supplierReturn.return_number, module: 'finance', description: `Retur ${supplierReturn.return_number} direkonsiliasi dengan referensi ${reference}.`, severity: 'Info' });
    return functionResponse({ success: true, supplier_return: updatedReturn, invoice: updatedInvoice });
  }

  if (name === 'closeSupplierReturn') {
    const supplierReturn = await entities.SupplierReturn.get(payload.return_id);
    if (!supplierReturn || supplierReturn.status !== 'Direkonsiliasi') throw new Error('Hanya retur yang telah direkonsiliasi yang dapat ditutup');
    const updated = await entities.SupplierReturn.update(supplierReturn.id, {
      status: 'Selesai', financial_status: 'Selesai', closed_at: nowIso(), closed_by: user.full_name || user.email,
      status_history: [...(supplierReturn.status_history || []), { status: 'Selesai', at: nowIso(), by: user.full_name || user.email, role: actorRole(user), notes: String(payload.notes || 'Retur dan dampak keuangan telah selesai.') }],
    });
    await entities.SupplierInvoice.update(supplierReturn.invoice_id, { credit_note_status: 'Selesai', return_status: 'Selesai' });
    await auditLocally({ action: 'close', entity: 'SupplierReturn', entity_id: supplierReturn.id, entity_name: supplierReturn.return_number, module: 'finance', description: `Retur ${supplierReturn.return_number} ditutup setelah rekonsiliasi.`, severity: 'Info' });
    return functionResponse({ success: true, supplier_return: updated });
  }

  if (name === 'voidInvoice') {
    const invoice = await entities.SupplierInvoice.get(payload.invoice_id);
    if (!invoice) throw new Error('Faktur tidak ditemukan');
    if (invoice.status === 'Batal') throw new Error('Faktur sudah dibatalkan');
    if (invoice.paid_amount > 0) throw new Error('Faktur sudah dibayar sebagian/lunas');
    if (!String(payload.reason || '').trim()) throw new Error('Alasan pembatalan faktur wajib dicatat');

    const allBatches = await entities.StockBatch.list();
    const invoiceBatches = allBatches.filter((batch) => batch.invoice_id === invoice.id || batch.invoice_number === invoice.invoice_number);
    const directReceipt = invoice.receipt_mode === 'Penerimaan Faktur Langsung';
    if (directReceipt && invoiceBatches.some((batch) => Number(batch.quantity || 0) < Number(batch.initial_quantity || 0))) {
      throw new Error('Faktur tidak dapat dibatalkan karena sebagian batch sudah keluar. Buat retur supplier agar jejak stok tetap benar.');
    }

    let rolledBackItems = 0;
    const repricedMedicineIds = new Set();
    for (const batch of invoiceBatches) {
      if (directReceipt) {
        const medicine = await entities.Medicine.get(batch.medicine_id);
        const returnQty = Number(batch.quantity || 0);
        await entities.StockBatch.update(batch.id, { quantity: 0, status: 'Dibatalkan', voided_invoice_id: invoice.id, voided_at: nowIso() });
        if (medicine && returnQty > 0) {
          const newStock = Math.max(0, Number(medicine.stock_on_hand || 0) - returnQty);
          await entities.Medicine.update(medicine.id, { stock_on_hand: newStock, updated_from_batch: true });
          await entities.StockMovement.create({
            medicine_id: medicine.id, medicine_name: medicine.name, type: 'Retur Supplier', quantity: -returnQty,
            balance_after: newStock, batch_number: batch.batch_number, reference_type: 'SupplierInvoiceVoid',
            reference_id: invoice.id, reference_number: invoice.invoice_number,
            notes: `Pembatalan faktur ${invoice.invoice_number}: ${payload.reason}`,
            user_name: user.full_name || user.email, timestamp: nowIso(),
          });
          rolledBackItems += returnQty;
          repricedMedicineIds.add(medicine.id);
        }
      } else {
        await entities.StockBatch.update(batch.id, {
          invoice_id: '', invoice_number: '', invoice_allocated_quantity: 0,
          pricing_status: 'Menunggu Faktur', voided_invoice_id: invoice.id, voided_at: nowIso(),
        });
      }
    }
    // Bila faktur penerimaan langsung dibatalkan, harga master dikembalikan ke
    // batch aktif terbaru yang tersisa. Ini mencegah harga dari batch batal tetap
    // dipakai pada transaksi FEFO berikutnya.
    if (directReceipt) {
      const remainingBatches = await entities.StockBatch.list();
      for (const medicineId of repricedMedicineIds) {
        const medicine = await entities.Medicine.get(medicineId);
        const replacement = remainingBatches
          .filter((batch) => batch.medicine_id === medicineId && batch.status === 'Aktif' && Number(batch.quantity || 0) > 0)
          .sort((a, b) => String(b.received_date || '').localeCompare(String(a.received_date || '')))[0];
        if (!medicine || !replacement) continue;
        const oldPrice = Number(medicine.selling_price || 0);
        const restoredPrice = Number(replacement.selling_price || oldPrice || 0);
        await entities.Medicine.update(medicineId, {
          purchase_price: Number(replacement.hna_per_unit ?? replacement.purchase_price ?? 0),
          hna_per_unit: Number(replacement.hna_per_unit ?? replacement.purchase_price ?? 0),
          hpp_per_unit: Number(replacement.hpp_per_unit ?? replacement.purchase_price ?? 0),
          selling_price: restoredPrice,
          min_safe_price: Number(replacement.min_safe_price || 0),
          target_margin_default: Number(replacement.target_margin || medicine.target_margin_default || 0),
          margin_method: replacement.margin_method || 'Gross Margin',
          price_source: `Batch aktif ${replacement.batch_number}`,
          pricing_updated_at: nowIso(),
        });
        if (oldPrice !== restoredPrice) {
          await entities.PriceHistory.create({
            medicine_id: medicineId, medicine_name: medicine.name, old_price: oldPrice, new_price: restoredPrice,
            hna_per_unit: Number(replacement.hna_per_unit ?? replacement.purchase_price ?? 0),
            hpp_per_unit: Number(replacement.hpp_per_unit ?? replacement.purchase_price ?? 0),
            min_safe_price: Number(replacement.min_safe_price || 0), target_margin: Number(replacement.target_margin || 0),
            margin_method: replacement.margin_method || 'Gross Margin', source: 'invoice_void_restore', reference_id: invoice.id,
            reference_number: invoice.invoice_number, reason: `Harga dipulihkan setelah pembatalan faktur: ${payload.reason}`,
            changed_by_name: user.full_name || user.email, timestamp: nowIso(),
          });
        }
      }
    }
    await entities.SupplierInvoice.update(invoice.id, {
      status: 'Batal', voided_at: nowIso(), voided_by: user.full_name || user.email,
      notes: `${invoice.notes || ''} | DIBATALKAN: ${payload.reason}`,
    });
    await auditLocally({ action: 'void', entity: 'SupplierInvoice', entity_id: invoice.id, entity_name: invoice.invoice_number, module: 'purchasing', description: `Faktur ${invoice.invoice_number} dibatalkan: ${payload.reason}. ${directReceipt ? `${rolledBackItems} unit stok dikembalikan.` : 'Hanya rekonsiliasi PO yang dibatalkan; stok fisik tetap.'}` });
    return functionResponse({ ok: true, rolled_back_items: rolledBackItems, receipt_mode: invoice.receipt_mode || 'Legacy' });
  }

  if (name === 'completeExam') {
    const record = payload.record;
    if (!record?.patient_name || !record?.diagnosis) throw new Error('Diagnosis dan nama pasien wajib');
    const internalReferral = record.internal_referral;
    if (internalReferral?.target_doctor_id && !String(internalReferral.reason || '').trim()) {
      throw new Error('Alasan rujukan internal wajib dicatat agar akses rekam medis lintas dokter memiliki dasar yang jelas');
    }
    const administrativeDocuments = record.administrative_documents || {};
    if (administrativeDocuments.sick_leave?.approved
      && (!administrativeDocuments.sick_leave.start_date || !administrativeDocuments.sick_leave.end_date)) {
      throw new Error('Tanggal mulai dan selesai wajib diisi sebelum dokter menyetujui surat keterangan istirahat');
    }
    if (administrativeDocuments.external_referral?.approved
      && (!String(administrativeDocuments.external_referral.destination || '').trim()
        || !String(administrativeDocuments.external_referral.reason || '').trim())) {
      throw new Error('Tujuan dan alasan wajib diisi sebelum dokter menyetujui surat rujukan eksternal');
    }
    if (administrativeDocuments.prescription_print?.approved
      && (!(payload.prescriptionItems || []).length && !payload.racikanData && !String(record.prescriptionText || '').trim())) {
      throw new Error('Resep obat atau racikan wajib tersedia sebelum dokter menyetujui cetak resep');
    }
    if (administrativeDocuments.instructions?.approved
      && !String(record.patient_education || record.treatment_plan || record.follow_up_instructions || '').trim()) {
      throw new Error('Edukasi pasien, rencana terapi, atau instruksi follow-up wajib tersedia sebelum dokter menyetujui cetak instruksi');
    }
    if (administrativeDocuments.control_card?.approved && !record.follow_up_date) {
      throw new Error('Tanggal kontrol wajib diisi sebelum dokter menyetujui cetak kartu kontrol');
    }
    if (payload.mode === 'revise') {
      const medicalRecordId = payload.medical_record_id || record.medical_record_id;
      if (!medicalRecordId) throw new Error('Rekam medis yang akan dikoreksi tidak ditemukan');
      const existingRecord = await entities.MedicalRecord.get(medicalRecordId);
      if (!existingRecord || !existingRecord.finalized) throw new Error('Hanya rekam medis yang sudah difinalkan yang dapat dikoreksi');
      if (existingRecord.doctor_id !== user.id) throw new Error('Koreksi hanya dapat dilakukan oleh dokter yang membuat pemeriksaan');
      const revisionReason = String(payload.revision_reason || record.revision_reason || '').trim();
      if (!revisionReason) throw new Error('Alasan koreksi wajib dicatat');
      const { queue } = await getQueueVisit(existingRecord.queue_entry_id || record.queue_entry_id);
      if (!doctorMatches(queue, user)) throw new Error('Dokter tidak berwenang mengoreksi kunjungan ini');
      const revisionFields = [
        'chief_complaint', 'subjective', 'physical_exam', 'diagnosis', 'diagnosis_code',
        'treatment_plan', 'follow_up_date', 'follow_up_instructions', 'patient_education', 'notes',
      ];
      const patch = Object.fromEntries(revisionFields
        .filter((field) => Object.prototype.hasOwnProperty.call(record, field))
        .map((field) => [field, record[field]]));
      patch.version = Number(existingRecord.version || 1) + 1;
      patch.revised_at = nowIso();
      patch.revised_by = user.id;
      patch.revised_by_name = user.full_name || user.email || 'Dokter';
      patch.revision_reason = revisionReason;
      const revisedRecord = await entities.MedicalRecord.update(existingRecord.id, patch);
      await auditLocally({
        action: 'update',
        entity: 'MedicalRecord',
        entity_id: existingRecord.id,
        entity_name: existingRecord.patient_name,
        module: 'rme',
        description: `Koreksi RME setelah finalisasi: ${revisionReason}`,
        old_value: JSON.stringify({ diagnosis: existingRecord.diagnosis, diagnosis_code: existingRecord.diagnosis_code }),
        new_value: JSON.stringify({ diagnosis: revisedRecord.diagnosis, diagnosis_code: revisedRecord.diagnosis_code, version: revisedRecord.version }),
      });
      return functionResponse({
        success: true,
        revised: true,
        medical_record_id: revisedRecord.id,
        medical_record: revisedRecord,
        next_status: queue.status,
      });
    }
    const todayDate = new Date().toISOString().slice(0, 10);
    const doctorId = user.id;
    const doctorName = user.full_name || 'Dokter';
    const { queue, visitId } = await getQueueVisit(payload.queue_entry_id);
    if (!doctorMatches(queue, user)) {
      throw new Error('Rekam medis hanya dapat ditulis oleh dokter yang sedang ditugaskan menangani pasien ini');
    }
    if (queue.workflow_status !== VISIT_STATUS.IN_SERVICE && queue.status !== 'Perlu Revisi Dokter' && queue.status !== 'Dikembalikan ke Dokter') {
      throw new Error('Dokter harus menekan Terima Pasien sebelum menyelesaikan pemeriksaan');
    }
    const existingRecord = (await entities.MedicalRecord.filter({ visit_id: visitId, finalized: true })).at(0);
    const existingPrescriptions = await entities.Prescription.filter({ visit_id: visitId });
    const existingPrescription = existingPrescriptions.at(0);
    const isRevisingReturnedRx = Boolean(
      existingPrescription?.returned_to_doctor
      || existingPrescription?.workflow_status === 'RETURNED_TO_DOCTOR'
      || queue.status === 'Perlu Revisi Dokter'
      || queue.status === 'Dikembalikan ke Dokter'
      || queue.workflow_status === 'RETURNED_TO_DOCTOR'
    );

    if (existingRecord && !isRevisingReturnedRx) {
      const existingInvoice = (await entities.Transaction.filter({ visit_id: visitId, cash_point: 'klinik' })).at(0);
      return functionResponse({
        success: true,
        duplicate_prevented: true,
        medical_record_id: existingRecord.id,
        prescription_id: existingPrescription?.id,
        transaction_id: existingInvoice?.id,
        next_status: existingPrescription ? 'Di Apotek' : 'Kasir',
      });
    }
    // Validate and prepare the complete prescription before any clinical record is finalized.
    // This prevents a failed prescription from leaving a partially-completed encounter.
    const hasFreeTextPrescription = Boolean(String(record.prescriptionText || '').trim());
    let parsedPrescription = null;
    let racikanData = payload.racikanData || null;
    let prescriptionItems = [...(payload.prescriptionItems || [])];
    let allergyWarnings = [];
    if (hasFreeTextPrescription) {
      const [medicineMaster, abbreviationDictionary, patientForPrescription] = await Promise.all([
        entities.Medicine.list(),
        entities.PrescriptionAbbreviation.filter({ approval_status: 'Disetujui' }),
        entities.Patient.get(record.patient_id),
      ]);
      parsedPrescription = parseFreeTextPrescription(record.prescriptionText, {
        medicines: medicineMaster || [],
        dictionary: abbreviationDictionary || [],
      });
      if (!record.prescriptionConfirmed) {
        throw new Error('Dokter wajib meninjau dan mengonfirmasi teks asli resep sebelum mengirimkannya ke farmasi.');
      }
      allergyWarnings = checkAllergies(parsedPrescription.racikan?.components || parsedPrescription.items || [], patientForPrescription);
      if (allergyWarnings.length && (!record.prescriptionAllergyAcknowledged || !String(record.prescriptionAllergyOverrideReason || '').trim())) {
        throw new Error('Peringatan alergi harus ditinjau dokter, disertai alasan klinis dan konfirmasi eksplisit sebelum resep dikirim.');
      }
      prescriptionItems = parsedPrescription.items?.length
        ? parsedPrescription.items.filter((it) => !it.is_racikan)
        : [...(prescriptionItems || [])];
      if (parsedPrescription.racikan) {
        const racikanForm = parsedPrescription.racikan.bentuk_racikan || 'Puyer';
        const racikanConfig = (await entities.RacikanConfig.filter({ bentuk_racikan: racikanForm, is_active: true })).at(0);
        const budDays = Number(racikanConfig?.default_bud_days || (racikanForm === 'Mixtura' ? 14 : 0));
        const beyondUse = new Date(`${todayDate}T12:00:00`);
        if (budDays) beyondUse.setDate(beyondUse.getDate() + budDays);
        racikanData = {
          racikan_name: parsedPrescription.racikan.racikan_name,
          bentuk_racikan: racikanForm,
          jumlah_resep: Number(parsedPrescription.racikan.quantity || 0),
          jumlah_ambil: Number(parsedPrescription.racikan.quantity || 0),
          signa: parsedPrescription.racikan.signa.translation || parsedPrescription.racikan.signa.raw,
          components: parsedPrescription.racikan.components.map((component) => ({
            medicine_id: component.medicine_id || '', medicine_name: component.medicine_name,
            active_substance: component.active_substance || '', kekuatan: component.strength || '',
            dosis_per_racikan: component.dosis_per_racikan ?? '',
            dosis_mode: component.dosis_mode || 'mg',
            dosis_label: component.dosis_label || component.strength || '',
            kebutuhan_teoritis: '', kebutuhan_ambil: '', pembulatan_rule: 'none', harga_unit: 0, subtotal: 0,
          })),
          kemasan_fee: Number(racikanConfig?.default_kemasan_fee || 0),
          jasa_racik_fee: Number(racikanConfig?.default_jasa_racik_fee || 0),
          notes: `${parsedPrescription.racikan.subscriptio}.${parsedPrescription.racikan.packaging ? ` ${parsedPrescription.racikan.packaging}.` : ''}${parsedPrescription.racikan.shake_well ? ' Kocok dahulu sebelum digunakan.' : ''}`,
          storage_instructions: racikanConfig?.default_storage_instruction || 'Simpan sesuai instruksi farmasi pada etiket.',
          shake_well: Boolean(parsedPrescription.racikan.shake_well),
          beyond_use_date: budDays ? beyondUse.toISOString().slice(0, 10) : '',
          subscriptio: parsedPrescription.racikan.subscriptio,
          packaging: parsedPrescription.racikan.packaging || '',
        };
      }
    }

    if (existingRecord && isRevisingReturnedRx && existingPrescription) {
      let items = prescriptionItems;
      let racikanTemplateId = existingPrescription.racikan_template_id;
      if (racikanData) {
        const template = await entities.RacikanTemplate.create({ ...racikanData, patient_id: record.patient_id, patient_name: record.patient_name, workflow_status: 'Review Farmasi' });
        racikanTemplateId = template.id;
        items.push({
          medicine_id: `racikan-${template.id}`,
          medicine_name: `${racikanData.racikan_name || 'Racikan'} (${racikanData.bentuk_racikan || 'Puyer'})`,
          form: racikanData.bentuk_racikan || 'Puyer',
          administration_route: racikanData.administration_route || 'internal',
          dosage: racikanData.signa || '',
          quantity: racikanData.jumlah_ambil || 0,
          instructions: racikanData.notes || '',
          is_racikan: true,
          racikan_template_id: template.id,
        });
      }
      const confirmedAt = nowIso();
      await entities.Prescription.update(existingPrescription.id, {
        status: 'Terkonfirmasi Dokter',
        workflow_status: PRESCRIPTION_STATUS.SENT_TO_PHARMACY,
        returned_to_doctor: false,
        return_reason: '',
        unavailable_items: [],
        signed_at: confirmedAt,
        doctor_confirmed_at: confirmedAt,
        doctor_confirmed_by: doctorName,
        doctor_confirmed_by_id: doctorId,
        original_text: parsedPrescription?.original_text || payload.prescriptionText || items.map((item) => `R/ ${item.medicine_name || ''} ${item.strength || ''}\nS ${item.dosage || ''} ${item.instructions || ''}`).join('\n\n'),
        normalized_text: parsedPrescription?.normalized_text || '',
        translated_text: parsedPrescription?.translated_text || '',
        parse_result: parsedPrescription || null,
        active_flags: parsedPrescription?.flags || [],
        allergy_warnings: allergyWarnings,
        allergy_override_reason: allergyWarnings.length ? String(record.prescriptionAllergyOverrideReason || '').trim() : '',
        parser_state: parsedPrescription?.parser_state || 'LEGACY',
        interpretation_mode: parsedPrescription?.interpretation_mode || 'structured',
        iter_type: parsedPrescription?.iter_type || payload.iter_type || '',
        is_racikan: Boolean(racikanData),
        racikan_template_id: racikanTemplateId,
        items,
      });

      const existingOrders = await entities.Order.filter({ source_id: existingPrescription.id });
      for (const ord of existingOrders) {
        await entities.Order.update(ord.id, { status: 'SENT_TO_PHARMACY', sent_at: confirmedAt });
      }

      const relatedFeedbacks = await entities.ClinicalFeedback.filter({ prescription_id: existingPrescription.id });
      for (const fb of relatedFeedbacks) {
        await entities.ClinicalFeedback.update(fb.id, {
          status: 'Selesai',
          review_action: 'revised',
          reviewed_at: confirmedAt,
        });
      }

      await transitionVisit(queue.id, VISIT_STATUS.COMPLETED, {
        force: true,
        queueStatus: 'Di Apotek',
        queuePatch: { status: 'Di Apotek', workflow_status: VISIT_STATUS.COMPLETED, prescription_id: existingPrescription.id },
      });

      await entities.Notification.create({
        type: 'prescription_revised',
        target_role: 'Apoteker',
        title: `Resep ${existingPrescription.prescription_number} telah direvisi`,
        body: `Dokter ${doctorName} telah merevisi resep untuk pasien ${record.patient_name}.`,
        priority: 'Penting',
        related_entity: 'Prescription',
        related_id: existingPrescription.id,
      });

      return functionResponse({
        success: true,
        revised_prescription: true,
        medical_record_id: existingRecord.id,
        prescription_id: existingPrescription.id,
        next_status: 'Di Apotek',
      });
    }

    const tindakanTotal = (record.procedures || []).reduce((total, procedure) => total + (procedure.subtotal || 0), 0);
    const medicalPayload = { ...record };
    delete medicalPayload.internal_referral;
    delete medicalPayload.prescriptionItems;
    delete medicalPayload.prescriptionText;
    delete medicalPayload.prescriptionParse;
    delete medicalPayload.freeTextPrescription;
    delete medicalPayload.prescriptionConfirmed;
    delete medicalPayload.prescriptionConfirmedAt;
    delete medicalPayload.prescriptionAllergyWarnings;
    delete medicalPayload.prescriptionAllergyAcknowledged;
    delete medicalPayload.prescriptionAllergyOverrideReason;
    delete medicalPayload.racikanData;
    const [doctorProfileForRecord, doctorStaffForRecord] = await Promise.all([
      entities.DoctorProfile.filter({ user_id: doctorId }).then((rows) => rows.at(0)),
      entities.Staff.get(doctorId),
    ]);
    const medicalRecord = await entities.MedicalRecord.create({
      ...medicalPayload,
      encounter_id: visitId,
      visit_id: visitId,
      queue_entry_id: queue.id,
      doctor_id: doctorId,
      doctor_name: doctorName,
      doctor_sip: doctorProfileForRecord?.sip_number || doctorStaffForRecord?.license_number || '',
      visit_date: record.visit_date || todayDate,
      tindakan_total: tindakanTotal,
      finalized: true,
      finalized_at: nowIso(),
      version: 1,
      branch_id: BRANCH_ID,
    });
    const result = { medical_record_id: medicalRecord.id };
    if (internalReferral?.target_doctor_id) {
      const referral = await entities.InternalRequest.create({
        request_number: `RUJ-${todayDate.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
        type: 'Rujukan Internal',
        from_user_id: doctorId,
        from_user_name: doctorName,
        from_role: actorRole(user),
        to_user_id: internalReferral.target_doctor_id,
        to_user_name: internalReferral.target_doctor_name,
        to_role: 'Dokter',
        patient_id: record.patient_id,
        patient_name: record.patient_name,
        visit_id: visitId,
        medical_record_id: medicalRecord.id,
        reason: String(internalReferral.reason).trim(),
        clinical_summary: String(internalReferral.clinical_summary || '').trim(),
        subject: `Rujukan internal ${record.patient_name}`,
        message: String(internalReferral.clinical_summary || internalReferral.reason).trim(),
        status: 'Baru',
        priority: 'Penting',
      });
      result.internal_referral_id = referral.id;
      await entities.Notification.create({
        type: 'internal_referral',
        target_role: 'Dokter',
        target_user_id: internalReferral.target_doctor_id,
        title: `Rujukan internal: ${record.patient_name}`,
        body: `${doctorName} merujuk pasien dengan alasan: ${String(internalReferral.reason).trim()}`,
        priority: 'Penting',
        related_entity: 'InternalRequest',
        related_id: referral.id,
        action_label: 'Buka Permintaan',
        action_type: 'navigate',
        action_payload: JSON.stringify({ path: '/doctor/requests' }),
      });
    }
    for (const procedure of record.procedures || []) {
      await entities.Order.create({
        visit_id: visitId,
        encounter_id: visitId,
        queue_entry_id: queue.id,
        order_type: 'procedure',
        destination: 'Kasir Klinik',
        source_id: medicalRecord.id,
        service_code: procedure.code || '',
        service_name: procedure.name,
        amount: procedure.subtotal || procedure.fee || 0,
        ordering_user: doctorId,
        status: 'COMPLETED',
        completed_at: nowIso(),
      });
    }
    if (prescriptionItems.length || racikanData || hasFreeTextPrescription) {
      let items = prescriptionItems;
      if (racikanData) {
        const template = await entities.RacikanTemplate.create({ ...racikanData, patient_id: record.patient_id, patient_name: record.patient_name, workflow_status: 'Review Farmasi' });
        result.racikan_template_id = template.id;
        items.push({
          medicine_id: `racikan-${template.id}`,
          medicine_name: `${racikanData.racikan_name || 'Racikan'} (${racikanData.bentuk_racikan || 'Puyer'})`,
          form: racikanData.bentuk_racikan || 'Puyer',
          administration_route: racikanData.administration_route || 'internal',
          dosage: racikanData.signa || '',
          quantity: racikanData.jumlah_ambil || 0,
          instructions: racikanData.notes || '',
          is_racikan: true,
          racikan_template_id: template.id,
        });
      }
      const prescriptionNumber = `RX-${todayDate.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;
      // Keep a minimal demographic snapshot with the immutable prescription so
      // pharmacy/front-office printing does not depend on reopening the full RME.
      // This is especially important for a prescription marked Tidak Ditebus:
      // it may be printed, but it must never be sent to POS/dispensing.
      const prescriptionPatient = await entities.Patient.get(record.patient_id).catch(() => null);
      const doctorProfile = (await entities.DoctorProfile.filter({ user_id: doctorId })).at(0);
      const doctorStaff = await entities.Staff.get(doctorId);
      const confirmedAt = nowIso();
      const prescription = await entities.Prescription.create({
        prescription_number: prescriptionNumber,
        patient_id: record.patient_id,
        patient_name: record.patient_name,
        patient_mr_number: prescriptionPatient?.mr_number || '',
        patient_birth_date: prescriptionPatient?.birth_date || '',
        patient_gender: prescriptionPatient?.gender || '',
        patient_phone: prescriptionPatient?.phone || '',
        patient_address: prescriptionPatient?.address || '',
        patient_allergies: prescriptionPatient?.allergies || '',
        patient_weight: record.vital_signs_weight || '',
        encounter_id: visitId,
        visit_id: visitId,
        queue_entry_id: queue.id,
        doctor_id: doctorId,
        doctor_name: doctorName,
        doctor_specialization: doctorProfile?.specialization || '',
        doctor_sip: doctorProfile?.sip_number || doctorStaff?.license_number || '',
        doctor_practice_address: doctorProfile?.practice_address || doctorProfile?.practice_room || '',
        doctor_phone: doctorProfile?.phone || doctorStaff?.phone || '',
        prescription_date: todayDate,
        source: 'Internal',
        status: 'Terkonfirmasi Dokter',
        workflow_status: PRESCRIPTION_STATUS.SENT_TO_PHARMACY,
        signed_at: confirmedAt,
        doctor_confirmed_at: confirmedAt,
        doctor_confirmed_by: doctorName,
        doctor_confirmed_by_id: doctorId,
        digital_signature: `${doctorName}${doctorProfile?.sip_number ? ` • ${doctorProfile.sip_number}` : ''}`,
        version: 1,
        is_immutable: true,
        original_text: parsedPrescription?.original_text || payload.prescriptionText || items.map((item) => `R/ ${item.medicine_name || ''} ${item.strength || ''}\nS ${item.dosage || ''} ${item.instructions || ''}`).join('\n\n'),
        normalized_text: parsedPrescription?.normalized_text || '',
        translated_text: parsedPrescription?.translated_text || '',
        parse_result: parsedPrescription || null,
        active_flags: parsedPrescription?.flags || [],
        allergy_warnings: allergyWarnings,
        allergy_override_reason: allergyWarnings.length ? String(record.prescriptionAllergyOverrideReason || '').trim() : '',
        allergy_acknowledged_at: allergyWarnings.length ? confirmedAt : '',
        allergy_acknowledged_by: allergyWarnings.length ? doctorName : '',
        allergy_acknowledged_by_id: allergyWarnings.length ? doctorId : '',
        parser_state: parsedPrescription?.parser_state || 'LEGACY',
        interpretation_mode: parsedPrescription?.interpretation_mode || 'structured',
        iter_type: parsedPrescription?.iter_type || payload.iter_type || '',
        is_racikan: Boolean(racikanData),
        racikan_template_id: result.racikan_template_id,
        items,
        branch_id: BRANCH_ID,
      });
      result.prescription_id = prescription.id;
      await auditLocally({
        action: 'confirm', entity: 'Prescription', entity_id: prescription.id, entity_name: prescriptionNumber,
        module: 'prescription', description: `Resep teks bebas dikonfirmasi dokter dan dikirim ke farmasi`,
        old_value: '', new_value: JSON.stringify({ original_text: prescription.original_text, parser_state: prescription.parser_state, flags: prescription.active_flags, allergy_warnings: allergyWarnings, allergy_override_reason: prescription.allergy_override_reason }),
      });
      const prescriptionOrder = await entities.Order.create({
        visit_id: visitId,
        encounter_id: visitId,
        queue_entry_id: queue.id,
        order_type: 'prescription',
        destination: 'Farmasi',
        source_id: prescription.id,
        ordering_user: doctorId,
        status: 'SENT_TO_PHARMACY',
        sent_at: nowIso(),
      });
      result.prescription_order_id = prescriptionOrder.id;
    }
    const nextStatus = result.prescription_id ? 'Di Apotek' : 'Kasir';
    const masterConsultation = (await entities.TindakanMaster.filter({ name: 'Pemeriksaan Umum' })).at(0);
    const clinicTotal = tindakanTotal || Number(masterConsultation?.fee || 0);
    const clinicInvoice = await entities.Transaction.create({
      invoice_number: `KLINIK-${todayDate.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
      type: 'Klinik',
      cash_point: 'klinik',
      encounter_id: visitId,
      visit_id: visitId,
      patient_id: record.patient_id,
      patient_name: record.patient_name,
      queue_entry_id: queue.id,
      prescription_id: result.prescription_id || '',
      source_type: 'MedicalRecord',
      source_id: medicalRecord.id,
      items: (record.procedures || []).map((procedure) => ({
        source_type: 'procedure',
        source_id: procedure.id || procedure.code || procedure.name,
        name: procedure.name,
        quantity: procedure.quantity || 1,
        price: procedure.fee || procedure.subtotal || 0,
        subtotal: procedure.subtotal || procedure.fee || 0,
      })),
      subtotal: clinicTotal,
      consultation_fee: clinicTotal,
      other_fees: 0,
      total: clinicTotal,
      payment_status: 'Belum Bayar',
      invoice_status: INVOICE_STATUS.POSTED,
      transaction_date: todayDate,
      branch_id: BRANCH_ID,
    });
    result.transaction_id = clinicInvoice.id;
    if (record.follow_up_date) {
      const followUpNotification = await entities.Notification.create({
        type: 'follow_up',
        target_role: 'Front Office',
        title: `Jadwalkan kontrol: ${record.patient_name}`,
        body: `Kontrol lanjutan pasien ${record.patient_name} direkomendasikan pada ${record.follow_up_date} oleh ${doctorName}.`,
        priority: 'Normal',
        related_entity: 'Visit',
        related_id: visitId,
        action_label: 'Buka Front Desk',
        action_type: 'navigate',
        action_payload: JSON.stringify({ path: '/front-desk', patient_id: record.patient_id, visit_id: visitId }),
      });
      result.follow_up_notification_id = followUpNotification.id;
    }
    await transitionVisit(queue.id, VISIT_STATUS.COMPLETED, {
      queueStatus: nextStatus,
      queuePatch: { prescription_id: result.prescription_id || '', doctor_id: doctorId, doctor_name: doctorName, clinical_invoice_id: clinicInvoice.id },
    });
    await auditLocally({ action: 'create', entity: 'MedicalRecord', entity_id: medicalRecord.id, entity_name: record.patient_name, module: 'rme', description: `Pemeriksaan selesai: ${record.diagnosis}` });
    return functionResponse({ success: true, ...result, next_status: nextStatus });
  }

  if (name === 'processInvoice') {
    const invoice = payload.invoice || {};
    const requestedItems = payload.items || [];
    const invoiceNumber = String(invoice.invoice_number || '').trim().toUpperCase();
    if (!invoiceNumber || !invoice.supplier_name || !requestedItems.length) throw new Error('Nomor faktur, supplier, dan item wajib');
    const duplicate = (await entities.SupplierInvoice.filter({ invoice_number: invoiceNumber }))
      .find((record) => record.status !== 'Batal');
    if (duplicate) throw new Error(`Nomor faktur ${invoiceNumber} sudah pernah disimpan. Faktur tidak boleh diproses dua kali.`);

    const pricingRecords = await entities.ClinicSetting.filter({ category: 'Penentuan Harga' });
    const pricingConfig = Object.fromEntries((pricingRecords || []).map((record) => [record.key, record.value]));
    const financials = calculateInvoiceFinancials(requestedItems, invoice.other_charges || 0, {
      ...pricingConfig,
      ...(payload.pricing_config || {}),
    });
    const items = financials.items;
    if (items.some((item) => !item.medicine_id || Number(item.quantity || 0) <= 0)) {
      throw new Error('Setiap item faktur wajib memiliki obat master dan kuantitas lebih dari nol.');
    }
    if (items.some((item) => !String(item.batch_number || '').trim() || !item.expiry_date)) {
      throw new Error('Nomor batch dan tanggal expired wajib untuk seluruh item faktur.');
    }

    const po = invoice.po_id ? await entities.PurchaseOrder.get(invoice.po_id) : null;
    if (invoice.po_id && !po) throw new Error('PO sumber faktur tidak ditemukan.');
    if (po && po.supplier_id !== invoice.supplier_id) throw new Error('Supplier faktur harus sama dengan supplier PO.');
    if (po && !['Diterima', 'Diterima Sebagian'].includes(po.status)) {
      throw new Error('Faktur PO hanya dapat dicatat setelah ada penerimaan barang.');
    }

    const allBatches = await entities.StockBatch.list();
    // Penerimaan baru menyimpan purchase_order_id pada batch. Data lama belum
    // tentu memilikinya, sehingga referensi mutasi PO dipakai sebagai fallback
    // hanya untuk menghubungkan faktur ke penerimaan fisik yang benar.
    const poReceiptMovements = po
      ? await entities.StockMovement.filter({ reference_type: 'PurchaseOrder', reference_id: po.id })
      : [];
    const legacyPoBatchNumbers = new Set((poReceiptMovements || []).map((movement) => movement.batch_number).filter(Boolean));
    const isBatchFromPo = (batch) => batch.purchase_order_id === po?.id
      || batch.purchase_order_number === po?.po_number
      || legacyPoBatchNumbers.has(batch.batch_number);
    const allocationPreview = new Map();
    if (po) {
      for (const item of items) {
        const candidates = allBatches
          .filter((batch) => batch.medicine_id === item.medicine_id && isBatchFromPo(batch))
          .filter((batch) => !batch.invoice_id || batch.invoice_id === '')
          .sort((a, b) => String(a.expiry_date || '').localeCompare(String(b.expiry_date || '')));
        let required = Number(item.quantity || 0) + Number(item.bonus_quantity || 0);
        for (const batch of candidates) {
          const alreadyPlanned = allocationPreview.get(batch.id) || 0;
          const capacity = Math.max(0, Number(batch.initial_quantity ?? batch.quantity ?? 0) - Number(batch.invoice_allocated_quantity || 0) - alreadyPlanned);
          const take = Math.min(capacity, required);
          if (take > 0) {
            allocationPreview.set(batch.id, alreadyPlanned + take);
            required -= take;
          }
          if (!required) break;
        }
        if (required > 0) throw new Error(`Penerimaan PO untuk ${item.medicine_name} belum cukup untuk direkonsiliasi ke faktur ini.`);
      }
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const receiptMode = po ? 'Rekonsiliasi PO' : 'Penerimaan Faktur Langsung';
    const savedInvoice = await entities.SupplierInvoice.create({
      ...invoice,
      invoice_number: invoiceNumber,
      items: [],
      subtotal: financials.subtotal,
      total_discount: financials.total_discount,
      net_subtotal: financials.net_subtotal,
      tax_ppn: financials.tax_ppn,
      other_charges: financials.other_charges,
      total_amount: financials.total_amount,
      paid_amount: 0,
      status: 'Belum Bayar',
      receipt_mode: receiptMode,
      stock_posted: !po,
      pricing_definition: financials.definition,
      created_by: payload.userName || user.full_name || user.email,
      created_at: nowIso(),
    });
    const createdItems = [];
    const warnings = [];
    let priceChanges = 0;
    for (const item of items) {
      const totalReceived = (item.quantity || 0) + (item.bonus_quantity || 0);
      const medicine = await entities.Medicine.get(item.medicine_id);
      if (!medicine) throw new Error(`Master obat ${item.medicine_name} tidak ditemukan.`);
      const activeBatches = allBatches.filter((batch) => batch.medicine_id === item.medicine_id && batch.status === 'Aktif');
      const protection = calcProtectedMinSafePrice(item.hpp_per_unit, item.target_margin, pricingConfig.price_rounding || 500, activeBatches);
      const sellingPrice = Math.max(Number(item.selling_price || 0), Number(protection.minSafePrice || 0));
      if (Number(item.selling_price || 0) < Number(protection.minSafePrice || 0)) {
        warnings.push(`${item.medicine_name}: harga jual dinaikkan ke minimum aman Rp ${sellingPrice.toLocaleString('id-ID')}.`);
      }
      const itemRecord = {
        ...item,
        total_received: totalReceived,
        hna_per_unit: item.hna_per_unit,
        hpp_per_unit: item.hpp_per_unit,
        selling_price: sellingPrice,
        min_safe_price: protection.minSafePrice,
        price_source: 'Faktur Supplier',
        margin_method: 'Gross Margin',
        category_snapshot: medicine.category || '',
        product_type_snapshot: medicine.product_type || 'Obat',
        batch_allocations: [],
      };

      if (po) {
        let remaining = totalReceived;
        const candidates = allBatches
          .filter((batch) => batch.medicine_id === item.medicine_id && isBatchFromPo(batch))
          .filter((batch) => !batch.invoice_id || batch.invoice_id === '')
          .sort((a, b) => String(a.expiry_date || '').localeCompare(String(b.expiry_date || '')));
        for (const batch of candidates) {
          if (!remaining) break;
          const capacity = Math.max(0, Number(batch.initial_quantity ?? batch.quantity ?? 0) - Number(batch.invoice_allocated_quantity || 0));
          const take = Math.min(capacity, remaining);
          if (!take) continue;
          await entities.StockBatch.update(batch.id, {
            invoice_id: savedInvoice.id, invoice_number: invoiceNumber,
            invoice_allocated_quantity: Number(batch.invoice_allocated_quantity || 0) + take,
            purchase_price: item.hna_per_unit, hna_per_unit: item.hna_per_unit, hpp_per_unit: item.hpp_per_unit,
            selling_price: sellingPrice, target_margin: item.target_margin, margin_method: 'Gross Margin',
            min_safe_price: protection.minSafePrice, pricing_status: 'Terekonsiliasi Faktur', pricing_updated_at: nowIso(),
          });
          itemRecord.batch_allocations.push({ batch_id: batch.id, batch_number: batch.batch_number, quantity: take });
          remaining -= take;
        }
      } else {
        const batch = await entities.StockBatch.create({
          medicine_id: item.medicine_id, medicine_name: item.medicine_name,
          batch_number: item.batch_number, quantity: totalReceived, initial_quantity: totalReceived,
          expiry_date: item.expiry_date, received_date: todayDate, supplier_id: invoice.supplier_id,
          supplier_name: invoice.supplier_name, purchase_price: item.hna_per_unit,
          hna_per_unit: item.hna_per_unit, hpp_per_unit: item.hpp_per_unit, selling_price: sellingPrice,
          target_margin: item.target_margin, margin_method: 'Gross Margin', min_safe_price: protection.minSafePrice,
          pricing_status: 'Terekonsiliasi Faktur', invoice_id: savedInvoice.id, invoice_number: invoiceNumber,
          status: 'Aktif',
        });
        const newStock = Number(medicine.stock_on_hand || 0) + totalReceived;
        await entities.StockMovement.create({
          medicine_id: medicine.id, medicine_name: medicine.name, type: 'Masuk', quantity: totalReceived,
          balance_after: newStock, batch_number: batch.batch_number, reference_type: 'SupplierInvoice',
          reference_id: savedInvoice.id, reference_number: invoiceNumber,
          notes: `Penerimaan langsung faktur ${invoiceNumber}`, user_name: payload.userName || user.full_name || user.email,
          source_type: 'Faktur Supplier', timestamp: nowIso(),
        });
        await entities.Medicine.update(medicine.id, { stock_on_hand: newStock, updated_from_batch: true });
        allBatches.push(batch);
        itemRecord.batch_allocations.push({ batch_id: batch.id, batch_number: batch.batch_number, quantity: totalReceived });
      }

      const priceChanged = Number(medicine.selling_price || 0) !== sellingPrice
        || Number((medicine.hpp_per_unit ?? medicine.purchase_price) || 0) !== Number(item.hpp_per_unit || 0);
      await entities.Medicine.update(medicine.id, {
        purchase_price: item.hna_per_unit, hna_per_unit: item.hna_per_unit, hpp_per_unit: item.hpp_per_unit,
        selling_price: sellingPrice, min_safe_price: protection.minSafePrice, margin_percent: item.target_margin,
        margin_method: 'Gross Margin', price_source: `Faktur ${invoiceNumber}`, pricing_updated_at: nowIso(), updated_from_batch: true,
      });
      if (priceChanged) {
        await entities.PriceHistory.create({
          medicine_id: medicine.id, medicine_name: medicine.name, old_price: Number(medicine.selling_price || 0), new_price: sellingPrice,
          hna_per_unit: item.hna_per_unit, hpp_per_unit: item.hpp_per_unit, min_safe_price: protection.minSafePrice,
          target_margin: item.target_margin, margin_method: 'Gross Margin', source: 'supplier_invoice',
          reference_id: savedInvoice.id, reference_number: invoiceNumber, reason: `Rekonsiliasi ${receiptMode.toLowerCase()}`,
          changed_by_name: payload.userName || user.full_name || user.email, timestamp: nowIso(),
        });
        priceChanges += 1;
      }
      createdItems.push(itemRecord);
    }
    const auditSummary = {
      action: 'Faktur diproses', at: nowIso(), by: payload.userName || user.full_name || user.email,
      receipt_mode: receiptMode, stock_posted: !po, price_changes: priceChanges,
      batch_count: createdItems.reduce((sum, item) => sum + item.batch_allocations.length, 0),
    };
    const finalizedInvoice = await entities.SupplierInvoice.update(savedInvoice.id, { items: createdItems, pricing_status: 'Selesai', batch_count: auditSummary.batch_count, audit_summary: auditSummary });
    await auditLocally({ action: 'create', entity: 'SupplierInvoice', entity_id: savedInvoice.id, entity_name: invoiceNumber, module: 'purchasing', description: `Faktur ${invoiceNumber} disimpan sebagai ${receiptMode}: ${createdItems.length} item, total Rp ${financials.total_amount.toLocaleString('id-ID')}, ${priceChanges} perubahan harga.` });
    return functionResponse({ ok: true, invoice: finalizedInvoice, warnings, priceChanges, receipt_mode: receiptMode });
  }

  if (name === 'seedAllDemoData') {
    let total = 0;
    const counts = {};
    for (const [entity, records] of Object.entries(base44SeedData)) {
      const existing = await entities[entity].list();
      let created = 0;
      for (const record of records) if (!existing.some((item) => item.id === record.id)) { await entities[entity].create(record); created++; }
      counts[entity] = created;
      total += created;
    }
    return functionResponse({ success: true, counts, total });
  }

  const reason = `Proses lokal "${name}" tidak dikenali. Periksa nama fungsi agar kegagalan tidak dianggap berhasil.`;
  await auditLocally({
    action: 'unknown_function', entity: 'Function', entity_id: name,
    module: 'system', description: reason, severity: 'Warning',
  });
  throw new Error(reason);
};

const invokeAuthorizedLocalFunction = async (name, payload = {}) => {
  const user = await currentUser();
  const publicFunctions = new Set(['fetchDrugInfoSummary', 'searchHelp']);
  if (!user && !publicFunctions.has(name)) throw new Error('Sesi lokal belum masuk');
  if (user && !canInvokeFunction(actorRole(user), name)) {
    const reason = `${actorRole(user)} tidak memiliki hak menjalankan proses ${name}`;
    appendAuditRecord({
      action: 'denied_function',
      entity: 'Function',
      entityId: name,
      after: payload,
      description: reason,
      reason,
      severity: 'Warning',
    });
    save();
    throw new Error(reason);
  }
  internalFunctionDepth += 1;
  try {
    return await invokeLocalFunction(name, payload);
  } finally {
    internalFunctionDepth -= 1;
  }
};

/** @type {any} */
const localDb = {
  auth: {
    isAuthenticated: async () => Boolean(await localDb.auth.me()),
    me: async () => {
      const user = memoryUser || readStoredDemoUser();
      // A demo-role sign-in may occur after logout in the same browser tab.
      // The new demo identity is authoritative; the old per-tab sign-out marker
      // must not leave the UI appearing signed in while mutations are rejected.
      if (user) globalThis.sessionStorage?.removeItem(SIGNED_OUT_KEY);
      memoryUser = user;
      if (user) return user;
      if (globalThis.sessionStorage?.getItem(SIGNED_OUT_KEY)) return null;
      return null;
    },
    loginAsDemoRole: async ({ role, email }) => {
      const identity = createDemoUser({ role, email });
      const user = resolvePersistedDemoUser(identity);
      memoryUser = user;
      writeStoredDemoUser(user);
      globalThis.sessionStorage?.removeItem(SIGNED_OUT_KEY);
      return user;
    },
    loginViaEmailPassword: async (email, password) => {
      if (password !== 'Demo1234!') throw new Error('Email atau password salah');
      const identity = createDemoUser({ email });
      const persisted = (data.User || []).find((item) => String(item.email || '').toLowerCase() === String(email || '').trim().toLowerCase());
      if (!persisted && !Object.values(DEMO_IDENTITIES).some((item) => item.email.toLowerCase() === String(email || '').trim().toLowerCase())) {
        throw new Error('Akun demo tidak ditemukan. Gunakan akun yang tercantum di Pusat UAT.');
      }
      const user = resolvePersistedDemoUser(identity);
      memoryUser = user;
      writeStoredDemoUser(user);
      globalThis.sessionStorage?.removeItem(SIGNED_OUT_KEY);
      return user;
    },
    loginWithProvider: async () => localDb.auth.loginViaEmailPassword(defaultUser.email, 'Demo1234!'),
    logout: async () => {
      memoryUser = null;
      globalThis.sessionStorage?.removeItem(SESSION_USER_KEY);
      globalThis.localStorage?.removeItem(LEGACY_SESSION_USER_KEY);
      globalThis.sessionStorage?.setItem(SIGNED_OUT_KEY, 'true');
    },
    redirectToLogin: (returnTo = '/') => {
      const target = `/login?returnTo=${encodeURIComponent(returnTo || '/')}`;
      if (globalThis.location) globalThis.location.href = target;
    },
    register: async ({ email, password }) => {
      if (!email || !password) throw new Error('Email dan password wajib diisi');
      globalThis.sessionStorage?.setItem('localPendingRegistration', JSON.stringify({ email, password }));
      return { email };
    },
    verifyOtp: async ({ email, otpCode }) => {
      if (!/^\d{6}$/.test(String(otpCode || ''))) throw new Error('Kode verifikasi harus 6 digit');
      const pending = JSON.parse(globalThis.sessionStorage?.getItem('localPendingRegistration') || '{}');
      const user = { ...defaultUser, id: `demo-${String(email).split('@')[0]}`, email: email || pending.email, full_name: String(email || pending.email || 'User').split('@')[0], clinic_role: 'Staff', data: { clinic_role: 'Staff' } };
      memoryUser = user;
      writeStoredDemoUser(user);
      globalThis.sessionStorage?.removeItem('localPendingRegistration');
      globalThis.sessionStorage?.removeItem(SIGNED_OUT_KEY);
      return { access_token: 'local-token', user };
    },
    setToken: () => {},
    resendOtp: async () => {},
    resetPasswordRequest: async () => {},
    resetPassword: async () => {},
  },
  entities,
  functions: { invoke: invokeAuthorizedLocalFunction },
  app: { getPublicSettings: async () => ({ id: 'local', public_settings: {} }) },
  integrations: {
    Core: {
      UploadFile: async ({ file } = {}) => uploadLocalFile(file),
      UploadPublicFile: async ({ file } = {}) => uploadLocalFile(file),
      UploadPrivateFile: async ({ file } = {}) => uploadLocalFile(file),
      CreateFileSignedUrl: async ({ file_uri } = {}) => ({ signed_url: file_uri || '' }),
    },
  },
  localTools: {
    exportData: () => clone(data),
    diagnostics: () => ({
      storage_version: STORAGE_VERSION,
      revision: Number(data.__meta?.revision || 0),
      updated_at: data.__meta?.updated_at || '',
      writer_id: data.__meta?.writer_id || '',
      entity_counts: Object.fromEntries(Object.entries(data).filter(([key, value]) => key !== '__meta' && Array.isArray(value)).map(([key, value]) => [key, value.length])),
    }),
    importData: (snapshot) => {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Berkas backup tidak valid');
      if (!Array.isArray(snapshot.User) || !Array.isArray(snapshot.Role)) throw new Error('Backup tidak memiliki struktur User dan Role yang diperlukan');
      const currentRevision = Number(data.__meta?.revision || 0);
      data = normalizeDataStore(mergeSeedData(clone(snapshot)));
      data.__meta = {
        ...(data.__meta || {}),
        revision: Math.max(currentRevision, Number(data.__meta?.revision || 0)),
      };
      save();
      subscriptions.forEach((listeners, entity) => listeners.forEach((callback) => callback({ type: 'import', entity })));
      return clone(data.__meta);
    },
    resetDemoData: () => {
      const currentRevision = Number(data.__meta?.revision || 0);
      data = normalizeDataStore(clone(seedData));
      data.__meta = {
        ...(data.__meta || {}),
        revision: currentRevision,
      };
      save();
      memoryUser = resolvePersistedDemoUser(memoryUser);
      if (memoryUser) writeStoredDemoUser(memoryUser);
      subscriptions.forEach((listeners, entity) => listeners.forEach((callback) => callback({ type: 'reset', entity })));
      return clone(data.__meta);
    },
  },
};

globalThis.__B44_DB__ = localDb;

export { localDb as db, localDb as base44 };
export default localDb;
