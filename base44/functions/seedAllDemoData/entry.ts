const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Seed comprehensive demo data across all modules — 10+ records per entity
// Dates spread across last 7 days + today. Idempotent via DEMO- prefix marker.

const MARKER = 'DEMO-';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function daysAgoISO(n: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function randInt(min: number, max: number, seed: number): number {
  return min + (seed * 7 % (max - min + 1));
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Hanya admin yang dapat menjalankan seed data' }, { status: 403 });

    const b = db.asServiceRole.entities;
    const counts: Record<string, number> = {};

    // ── SUPPLIERS ──────────────────────────────────────────
    const existingSuppliers = await b.Supplier.filter({ code: { $regex: MARKER } }, undefined, 100);
    const suppliersData = [
      { name: 'PT Kalbe Farma', contact_person: 'Budi Santoso', phone: '021-6500001', email: 'sales@kalbe.co.id', address: 'Jl. Pulomas Raya, Jakarta', payment_terms: '30 hari', npwp: '01.234.567.8-091.000' },
      { name: 'PT Tempo Scan Pacific', contact_person: 'Sari Dewi', phone: '021-6500002', email: 'order@temposcan.co.id', address: 'Jl. Pemuda, Jakarta', payment_terms: '30 hari', npwp: '02.345.678.9-123.000' },
      { name: 'PT Kimia Farma', contact_person: 'Andi Wijaya', phone: '021-6500003', email: 'sales@kimiafarma.co.id', address: 'Jl. Letjen Suprapto, Jakarta', payment_terms: '45 hari', npwp: '03.456.789.0-234.000' },
      { name: 'PT Dexa Medica', contact_person: 'Rina Pratiwi', phone: '021-6500004', email: 'info@dexa.co.id', address: 'Jl. Danau Sunter, Jakarta', payment_terms: '30 hari', npwp: '04.567.890.1-345.000' },
      { name: 'PT Sanbe Farma', contact_person: 'Eko Prasetyo', phone: '021-6500005', email: 'sales@sanbe.co.id', address: 'Jl. Soekarno Hatta, Bandung', payment_terms: '30 hari', npwp: '05.678.901.2-456.000' },
      { name: 'PT Phapros', contact_person: 'Lina Marlina', phone: '021-6500006', email: 'order@phapros.co.id', address: 'Jl. Semarang, Semarang', payment_terms: '60 hari', npwp: '06.789.012.3-567.000' },
      { name: 'PT Bernofarm', contact_person: 'Hadi Kusuma', phone: '021-6500007', email: 'sales@bernofarm.co.id', address: 'Jl. Ahmad Yani, Surabaya', payment_terms: '30 hari', npwp: '07.890.123.4-678.000' },
      { name: 'PT Graha Farma', contact_person: 'Maya Sari', phone: '021-6500008', email: 'info@grahafarma.co.id', address: 'Jl. Diponegoro, Jakarta', payment_terms: '30 hari', npwp: '08.901.234.5-789.000' },
      { name: 'PT Indofarma', contact_person: 'Rudi Hartono', phone: '021-6500009', email: 'sales@indofarma.co.id', address: 'Jl. Grogol, Jakarta', payment_terms: '45 hari', npwp: '09.012.345.6-890.000' },
      { name: 'PT Ifars', contact_person: 'Tina Anggraini', phone: '021-6500010', email: 'order@ifars.co.id', address: 'Jl. Cipinang, Jakarta', payment_terms: '30 hari', npwp: '10.123.456.7-901.000' },
    ];
    const suppliers = [];
    for (let i = 0; i < suppliersData.length; i++) {
      const s = suppliersData[i];
      if (existingSuppliers.length < suppliersData.length) {
        const created = await b.Supplier.create({ ...s, code: `${MARKER}SUP-${String(i+1).padStart(3,'0')}`, is_active: true });
        suppliers.push(created);
      } else {
        suppliers.push(existingSuppliers[i]);
      }
    }
    counts.Supplier = suppliers.length;

    // ── MEDICINES ──────────────────────────────────────────
    const existingMeds = await b.Medicine.filter({ code: { $regex: MARKER } }, undefined, 100);
    const medsData = [
      { name: 'Paracetamol 500mg', generic_name: 'Paracetamol', active_substance: 'Paracetamol', strength: '500mg', form: 'Tablet', category: 'Obat Bebas', barcode: '8990000000011', manufacturer: 'Tempo Scan', unit: 'tablet', selling_price: 500, purchase_price: 350, stock_on_hand: 850, min_stock: 100, substitution_group: 'PARA500' },
      { name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', active_substance: 'Amoxicillin', strength: '500mg', form: 'Kapsul', category: 'Obat Keras', barcode: '8990000000028', manufacturer: 'Kalbe Farma', unit: 'kapsul', selling_price: 1500, purchase_price: 1000, stock_on_hand: 420, min_stock: 80, substitution_group: 'AMOX500' },
      { name: 'Amlodipine 5mg', generic_name: 'Amlodipine', active_substance: 'Amlodipine', strength: '5mg', form: 'Tablet', category: 'Obat Keras', barcode: '8990000000035', manufacturer: 'Kimia Farma', unit: 'tablet', selling_price: 800, purchase_price: 500, stock_on_hand: 8, min_stock: 50, substitution_group: 'AML5' },
      { name: 'Metformin 500mg', generic_name: 'Metformin', active_substance: 'Metformin', strength: '500mg', form: 'Tablet', category: 'Obat Keras', barcode: '8990000000042', manufacturer: 'Dexa Medica', unit: 'tablet', selling_price: 1200, purchase_price: 800, stock_on_hand: 310, min_stock: 60, substitution_group: 'MET500' },
      { name: 'Omeprazole 20mg', generic_name: 'Omeprazole', active_substance: 'Omeprazole', strength: '20mg', form: 'Kapsul', category: 'Obat Keras', barcode: '8990000000059', manufacturer: 'Sanbe Farma', unit: 'kapsul', selling_price: 2500, purchase_price: 1800, stock_on_hand: 180, min_stock: 40, substitution_group: 'OMP20' },
      { name: 'Cetirizine 10mg', generic_name: 'Cetirizine', active_substance: 'Cetirizine', strength: '10mg', form: 'Tablet', category: 'Obat Bebas Terbatas', barcode: '8990000000066', manufacturer: 'Bernofarm', unit: 'tablet', selling_price: 1000, purchase_price: 700, stock_on_hand: 250, min_stock: 50, substitution_group: 'CET10' },
      { name: 'Ibuprofen 400mg', generic_name: 'Ibuprofen', active_substance: 'Ibuprofen', strength: '400mg', form: 'Tablet', category: 'Obat Bebas', barcode: '8990000000073', manufacturer: 'Phapros', unit: 'tablet', selling_price: 800, purchase_price: 550, stock_on_hand: 400, min_stock: 80, substitution_group: 'IBU400' },
      { name: 'CTM 4mg', generic_name: 'Chlorpheniramine', active_substance: 'Chlorpheniramine maleate', strength: '4mg', form: 'Tablet', category: 'Obat Bebas Terbatas', barcode: '8990000000080', manufacturer: 'Indofarma', unit: 'tablet', selling_price: 300, purchase_price: 200, stock_on_hand: 600, min_stock: 100, substitution_group: 'CTM4' },
      { name: 'Vitamin C 1000mg', generic_name: 'Ascorbic Acid', active_substance: 'Ascorbic Acid', strength: '1000mg', form: 'Tablet', category: 'Suplemen', barcode: '8990000000097', manufacturer: 'Ifars', unit: 'tablet', selling_price: 1500, purchase_price: 1000, stock_on_hand: 350, min_stock: 60, substitution_group: 'VITC1' },
      { name: 'Salbutamol 2mg Sirup', generic_name: 'Salbutamol', active_substance: 'Salbutamol', strength: '2mg/5ml', form: 'Sirup', category: 'Obat Keras', barcode: '8990000000103', manufacturer: 'Kalbe Farma', unit: 'botol', selling_price: 18000, purchase_price: 12000, stock_on_hand: 45, min_stock: 20, substitution_group: 'SAL2' },
      { name: 'Ranitidine 150mg', generic_name: 'Ranitidine', active_substance: 'Ranitidine', strength: '150mg', form: 'Tablet', category: 'Obat Keras', barcode: '8990000000110', manufacturer: 'Graha Farma', unit: 'tablet', selling_price: 1000, purchase_price: 700, stock_on_hand: 220, min_stock: 50, substitution_group: 'RAN150' },
      { name: 'Aspirin 100mg', generic_name: 'Aspirin', active_substance: 'Acetylsalicylic Acid', strength: '100mg', form: 'Tablet', category: 'Obat Bebas', barcode: '8990000000127', manufacturer: 'Tempo Scan', unit: 'tablet', selling_price: 600, purchase_price: 400, stock_on_hand: 380, min_stock: 70, substitution_group: 'ASP100' },
    ];
    const medicines = [];
    for (let i = 0; i < medsData.length; i++) {
      const m = medsData[i];
      if (existingMeds.length < medsData.length) {
        const created = await b.Medicine.create({ ...m, code: `${MARKER}MED-${String(i+1).padStart(3,'0')}`, is_active: true, margin_percent: Math.round((m.selling_price - m.purchase_price) / m.purchase_price * 100) });
        medicines.push(created);
      } else {
        medicines.push(existingMeds[i]);
      }
    }
    counts.Medicine = medicines.length;

    // ── PATIENTS ──────────────────────────────────────────
    const existingPatients = await b.Patient.filter({ mr_number: { $regex: MARKER } }, undefined, 100);
    const patientsData = [
      { full_name: 'Budi Hartono', gender: 'L', birth_date: '1985-03-15', phone: '081234567890', address: 'Jl. Melati No. 10, Jakarta', insurance_type: 'BPJS', bpjs_number: '0001234567890', allergies: 'Penisilin', blood_type: 'O' },
      { full_name: 'Siti Aminah', gender: 'P', birth_date: '1990-07-22', phone: '081234567891', address: 'Jl. Mawar No. 5, Jakarta', insurance_type: 'Umum', allergies: 'Tidak ada', blood_type: 'A' },
      { full_name: 'Ahmad Fauzi', gender: 'L', birth_date: '1978-11-30', phone: '081234567892', address: 'Jl. Anggrek No. 8, Jakarta', insurance_type: 'BPJS', bpjs_number: '0001234567891', allergies: 'Tidak ada', blood_type: 'B' },
      { full_name: 'Dewi Lestari', gender: 'P', birth_date: '1995-01-18', phone: '081234567893', address: 'Jl. Kenanga No. 12, Jakarta', insurance_type: 'Asuransi', allergies: 'Sulfonamida', blood_type: 'AB' },
      { full_name: 'Joko Susilo', gender: 'L', birth_date: '1970-05-25', phone: '081234567894', address: 'Jl. Flamboyan No. 3, Jakarta', insurance_type: 'Umum', allergies: 'Tidak ada', blood_type: 'O' },
      { full_name: 'Rina Wijaya', gender: 'P', birth_date: '1988-09-10', phone: '081234567895', address: 'Jl. Cempaka No. 7, Jakarta', insurance_type: 'BPJS', bpjs_number: '0001234567892', allergies: 'Tidak ada', blood_type: 'A' },
      { full_name: 'Bambang Sutrisno', gender: 'L', birth_date: '1965-12-05', phone: '081234567896', address: 'Jl. Dahlia No. 15, Jakarta', insurance_type: 'Umum', allergies: 'Aspirin', blood_type: 'B' },
      { full_name: 'Maya Putri', gender: 'P', birth_date: '2000-04-20', phone: '081234567897', address: 'Jl. Tulip No. 9, Jakarta', insurance_type: 'Umum', allergies: 'Tidak ada', blood_type: 'O' },
      { full_name: 'Hendra Gunawan', gender: 'L', birth_date: '1982-08-14', phone: '081234567898', address: 'Jl. Lavender No. 11, Jakarta', insurance_type: 'BPJS', bpjs_number: '0001234567893', allergies: 'Tidak ada', blood_type: 'AB' },
      { full_name: 'Lestari Indah', gender: 'P', birth_date: '1993-02-28', phone: '081234567899', address: 'Jl. Sakura No. 4, Jakarta', insurance_type: 'Umum', allergies: 'Tidak ada', blood_type: 'A' },
      { full_name: 'Rudi Santoso', gender: 'L', birth_date: '1975-06-12', phone: '081234567800', address: 'Jl. Teratai No. 6, Jakarta', insurance_type: 'BPJS', bpjs_number: '0001234567894', allergies: 'Tidak ada', blood_type: 'B' },
      { full_name: 'Anita Rahma', gender: 'P', birth_date: '1998-10-03', phone: '081234567801', address: 'Jl. Bougenville No. 2, Jakarta', insurance_type: 'Umum', allergies: 'Tidak ada', blood_type: 'O' },
    ];
    const patients = [];
    for (let i = 0; i < patientsData.length; i++) {
      const p = patientsData[i];
      if (existingPatients.length < patientsData.length) {
        const created = await b.Patient.create({ ...p, mr_number: `${MARKER}RM-${String(i+1).padStart(4,'0')}` });
        patients.push(created);
      } else {
        patients.push(existingPatients[i]);
      }
    }
    counts.Patient = patients.length;

    // ── STAFF ──────────────────────────────────────────
    const existingStaff = await b.Staff.filter({ full_name: { $regex: MARKER } }, undefined, 100);
    const staffData = [
      { full_name: `${MARKER}dr. Andini Pratama, Sp.PD`, role: 'Dokter', license_number: 'STR-001', phone: '081200000001', email: 'andini@klinikfarma.id', shift: 'Pagi', hire_date: '2024-01-15', salary: 15000000 },
      { full_name: `${MARKER}dr. Budi Santoso, Sp.A`, role: 'Dokter', license_number: 'STR-002', phone: '081200000002', email: 'budi@klinikfarma.id', shift: 'Pagi', hire_date: '2024-03-01', salary: 18000000 },
      { full_name: `${MARKER}dr. Citra Dewi, drg`, role: 'Dokter', license_number: 'STR-003', phone: '081200000003', email: 'citra@klinikfarma.id', shift: 'Siang', hire_date: '2024-05-10', salary: 14000000 },
      { full_name: `${MARKER}Apoteker Dina Pratiwi`, role: 'Apoteker', license_number: 'SIPA-001', phone: '081200000004', email: 'dina@klinikfarma.id', shift: 'Pagi', hire_date: '2023-08-01', salary: 8000000 },
      { full_name: `${MARKER}Kasir Eko Prasetyo`, role: 'Kasir', license_number: '', phone: '081200000005', email: 'eko@klinikfarma.id', shift: 'Pagi', hire_date: '2023-06-01', salary: 4500000 },
      { full_name: `${MARKER}Kasir Fitri Handayani`, role: 'Kasir', license_number: '', phone: '081200000006', email: 'fitri@klinikfarma.id', shift: 'Siang', hire_date: '2024-01-10', salary: 4500000 },
      { full_name: `${MARKER}Perawat Gita Maharani`, role: 'Perawat', license_number: 'NIPL-001', phone: '081200000007', email: 'gita@klinikfarma.id', shift: 'Pagi', hire_date: '2023-09-15', salary: 5000000 },
      { full_name: `${MARKER}Admin Hadi Kusuma`, role: 'Admin', license_number: '', phone: '081200000008', email: 'hadi@klinikfarma.id', shift: 'Lengkap', hire_date: '2023-01-01', salary: 7000000 },
      { full_name: `${MARKER}Owner Ibu Lina Marlina`, role: 'Owner', license_number: '', phone: '081200000009', email: 'lina@klinikfarma.id', shift: 'Lengkap', hire_date: '2020-01-01', salary: 25000000 },
      { full_name: `${MARKER}Asisten Maya Sari`, role: 'Staff', license_number: '', phone: '081200000010', email: 'maya@klinikfarma.id', shift: 'Pagi', hire_date: '2024-06-01', salary: 3500000 },
    ];
    const staff = [];
    for (let i = 0; i < staffData.length; i++) {
      const s = staffData[i];
      if (existingStaff.length < staffData.length) {
        const created = await b.Staff.create({ ...s, is_active: true });
        staff.push(created);
      } else {
        staff.push(existingStaff[i]);
      }
    }
    counts.Staff = staff.length;

    // ── QUEUE ENTRIES (spread 7 hari + hari ini) ──────────
    const existingQueue = await b.QueueEntry.filter({ queue_number: { $regex: MARKER } }, undefined, 200);
    if (existingQueue.length < 30) {
      const queueEntries = [];
      const statuses = ['Menunggu', 'Pemeriksaan', 'Selesai Periksa', 'Di Apotek', 'Kasir', 'Selesai'];
      const lokets = ['Poli Umum', 'Poli Anak', 'Poli Gigi'];
      for (let i = 0; i < 30; i++) {
        const dayOff = Math.floor(i / 5);
        const patient = patients[i % patients.length];
        const status = dayOff === 0 ? pick(statuses, i) : 'Selesai';
        queueEntries.push({
          queue_number: `${MARKER}Q-${daysAgo(dayOff).replace(/-/g,'')}-${String(i+1).padStart(3,'0')}`,
          patient_id: patient.id,
          patient_name: patient.full_name,
          visit_type: 'Poliklinik',
          status,
          loket: pick(lokets, i),
          priority: i % 7 === 0,
          complaint: pick(['Demam dan batuk', 'Sakit kepala', 'Nyeri ulu hati', 'Pusing', 'Mual muntah', 'Gatal-gatal', 'Nyeri pinggang'], i),
          doctor_name: 'dr. Andini Pratama, Sp.PD',
          check_in_time: daysAgoISO(dayOff, 8 + (i % 4)),
          visit_date: daysAgo(dayOff),
        });
      }
      const created = await b.QueueEntry.bulkCreate(queueEntries);
      counts.QueueEntry = created.length;
    } else {
      counts.QueueEntry = existingQueue.length;
    }

    // ── MEDICAL RECORDS ──────────────────────────────────
    const existingMR = await b.MedicalRecord.filter({ diagnosis: { $regex: MARKER } }, undefined, 200);
    if (existingMR.length < 20) {
      const mrData = [];
      const dxList = ['Acute Upper Respiratory Tract Infection', 'Essential Hypertension', 'Type 2 Diabetes Mellitus', 'Gastritis', 'Common Cold', 'Migraine', 'Dermatitis'];
      const dxCodes = ['J06.9', 'I10', 'E11.9', 'K29.7', 'J00', 'G43.9', 'L30.9'];
      for (let i = 0; i < 20; i++) {
        const dayOff = Math.floor(i / 3);
        const patient = patients[i % patients.length];
        mrData.push({
          patient_id: patient.id,
          patient_name: patient.full_name,
          visit_date: daysAgo(dayOff),
          doctor_name: 'dr. Andini Pratama, Sp.PD',
          chief_complaint: pick(['Demam, batuk, pilek', 'Sakit kepala, pusing', 'Nyeri ulu hati', 'Sering haus, sering kencing', 'Gatal-gatal'], i),
          subjective: `Pasien datang dengan keluhan ${pick(['demam sejak 2 hari', 'sakit kepala berdenyut', 'nyeri perut bagian atas', 'sering buang air kecil', 'ruam kulit gatal'], i)}. Tidak ada riwayat penyakit kronis lain.`,
          vital_signs_bp: pick(['120/80', '140/90', '110/70', '130/85'], i),
          vital_signs_temp: pick([36.5, 37.8, 38.2, 36.8], i),
          vital_signs_pulse: pick([80, 88, 95, 72], i),
          vital_signs_weight: pick([60, 65, 70, 55], i),
          vital_signs_height: pick([165, 170, 160, 175], i),
          physical_exam: 'Tidak ada kelainan khas pada pemeriksaan fisik. Konjungtiva tidak anemis, sclera tidak ikterus.',
          diagnosis: `${MARKER}${pick(dxList, i)}`,
          diagnosis_code: pick(dxCodes, i),
          procedures: [{ name: 'Pemeriksaan Umum', code: 'PEU-01', fee: 50000, quantity: 1, subtotal: 50000 }],
          tindakan_total: 50000,
          treatment_plan: pick(['Paracetamol 500mg 3x1, istirahat', 'Amlodipine 5mg 1x1, diet rendah garam', 'Metformin 500mg 2x1, diet DM', 'Omeprazole 20mg 1x1, diet lunak'], i),
          follow_up_date: daysAgo(-7),
          follow_up_instructions: 'Kontrol 1 minggu jika tidak membaik',
          patient_education: 'Istirahat cukup, minum air banyak',
        });
      }
      const created = await b.MedicalRecord.bulkCreate(mrData);
      counts.MedicalRecord = created.length;
    } else {
      counts.MedicalRecord = existingMR.length;
    }

    // ── PRESCRIPTIONS ──────────────────────────────────
    const existingRx = await b.Prescription.filter({ prescription_number: { $regex: MARKER } }, undefined, 200);
    if (existingRx.length < 20) {
      const rxData = [];
      const rxStatuses = ['Baru', 'Diresepkan', 'Dispensing', 'Selesai Dispensing', 'Billed', 'Paid'];
      for (let i = 0; i < 20; i++) {
        const dayOff = Math.floor(i / 3);
        const patient = patients[i % patients.length];
        const med1 = medicines[i % medicines.length];
        const med2 = medicines[(i + 1) % medicines.length];
        rxData.push({
          prescription_number: `${MARKER}R${daysAgo(dayOff).replace(/-/g,'')}${String(i+1).padStart(3,'0')}`,
          patient_id: patient.id,
          patient_name: patient.full_name,
          doctor_name: 'dr. Andini Pratama, Sp.PD',
          prescription_date: daysAgo(dayOff),
          source: 'Internal',
          status: dayOff === 0 ? pick(rxStatuses, i) : 'Paid',
          items: [
            { medicine_id: med1.id, medicine_name: med1.name, strength: med1.strength, dosage: '3x1 tablet', quantity: 10, instructions: 'Setelah makan' },
            { medicine_id: med2.id, medicine_name: med2.name, strength: med2.strength, dosage: '2x1 tablet', quantity: 7, instructions: 'Sebelum makan' },
          ],
        });
      }
      const created = await b.Prescription.bulkCreate(rxData);
      counts.Prescription = created.length;
    } else {
      counts.Prescription = existingRx.length;
    }

    // ── TRANSACTIONS ──────────────────────────────────
    const existingTx = await b.Transaction.filter({ invoice_number: { $regex: MARKER } }, undefined, 200);
    if (existingTx.length < 25) {
      const txData = [];
      const payMethods = ['Tunai', 'QRIS', 'Debit', 'Transfer', 'BPJS'];
      for (let i = 0; i < 25; i++) {
        const dayOff = Math.floor(i / 4);
        const patient = patients[i % patients.length];
        const med = medicines[i % medicines.length];
        const qty = randInt(1, 5, i);
        const subtotal = med.selling_price * qty;
        const total = subtotal + 50000;
        txData.push({
          invoice_number: `${MARKER}INV${daysAgo(dayOff).replace(/-/g,'')}${String(i+1).padStart(3,'0')}`,
          type: i % 4 === 0 ? 'Klinik' : 'Apotek/POS',
          patient_id: patient.id,
          patient_name: patient.full_name,
          items: [{ medicine_id: med.id, medicine_name: med.name, quantity: qty, price: med.selling_price, subtotal }],
          subtotal,
          consultation_fee: i % 4 === 0 ? 50000 : 0,
          total,
          payment_method: pick(payMethods, i),
          payment_status: dayOff === 0 && i % 3 === 0 ? 'Belum Bayar' : 'Lunas',
          paid_amount: total,
          cashier_name: 'Eko Prasetyo',
          transaction_date: daysAgo(dayOff),
        });
      }
      const created = await b.Transaction.bulkCreate(txData);
      counts.Transaction = created.length;
    } else {
      counts.Transaction = existingTx.length;
    }

    // ── STOCK BATCHES ──────────────────────────────────
    const existingBatch = await b.StockBatch.filter({ batch_number: { $regex: MARKER } }, undefined, 200);
    if (existingBatch.length < 12) {
      const batchData = [];
      for (let i = 0; i < 12; i++) {
        const med = medicines[i % medicines.length];
        const sup = suppliers[i % suppliers.length];
        const expiryDays = i % 3 === 0 ? 60 : i % 3 === 1 ? 400 : 700;
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + expiryDays);
        batchData.push({
          medicine_id: med.id,
          medicine_name: med.name,
          batch_number: `${MARKER}BATCH-${String(i+1).padStart(3,'0')}`,
          quantity: randInt(20, 200, i),
          initial_quantity: randInt(100, 300, i),
          expiry_date: expDate.toISOString().split('T')[0],
          received_date: daysAgo(randInt(0, 7, i)),
          supplier_id: sup.id,
          supplier_name: sup.name,
          purchase_price: med.purchase_price,
          selling_price: med.selling_price,
          status: 'Aktif',
        });
      }
      const created = await b.StockBatch.bulkCreate(batchData);
      counts.StockBatch = created.length;
    } else {
      counts.StockBatch = existingBatch.length;
    }

    // ── PURCHASE ORDERS ──────────────────────────────────
    const existingPO = await b.PurchaseOrder.filter({ po_number: { $regex: MARKER } }, undefined, 100);
    if (existingPO.length < 10) {
      const poData = [];
      const poStatuses = ['Disetujui', 'Dikirim', 'Diterima', 'Diterima Sebagian', 'Menunggu Approval'];
      for (let i = 0; i < 10; i++) {
        const dayOff = Math.floor(i / 2);
        const sup = suppliers[i % suppliers.length];
        const med = medicines[i % medicines.length];
        const qty = randInt(50, 200, i);
        poData.push({
          po_number: `${MARKER}PO-${daysAgo(dayOff).replace(/-/g,'')}-${String(i+1).padStart(3,'0')}`,
          supplier_id: sup.id,
          supplier_name: sup.name,
          order_date: daysAgo(dayOff),
          expected_date: daysAgo(dayOff - 3),
          status: pick(poStatuses, i),
          approval_status: i % 5 === 0 ? 'Menunggu Approval' : 'Disetujui',
          items: [{ medicine_id: med.id, medicine_name: med.name, quantity: qty, unit_price: med.purchase_price, subtotal: med.purchase_price * qty, received_quantity: i % 3 === 0 ? qty : 0 }],
          total_amount: med.purchase_price * qty,
          created_by: user.full_name || 'Admin',
        });
      }
      const created = await b.PurchaseOrder.bulkCreate(poData);
      counts.PurchaseOrder = created.length;
    } else {
      counts.PurchaseOrder = existingPO.length;
    }

    // ── SUPPLIER INVOICES ──────────────────────────────────
    const existingInv = await b.SupplierInvoice.filter({ invoice_number: { $regex: MARKER } }, undefined, 100);
    if (existingInv.length < 10) {
      const invData = [];
      const invStatuses = ['Belum Bayar', 'Sebagian Bayar', 'Lunas', 'Overdue'];
      const kontrabonStatuses = ['Belum Jatuh Tempo', 'Mendekati Jatuh Tempo', 'Kontrabon', 'Selesai'];
      for (let i = 0; i < 10; i++) {
        const dayOff = Math.floor(i / 2);
        const sup = suppliers[i % suppliers.length];
        const med = medicines[i % medicines.length];
        const qty = randInt(50, 150, i);
        const unitPrice = med.purchase_price;
        const subtotal = unitPrice * qty;
        const taxPpn = Math.round(subtotal * 0.11);
        const total = subtotal + taxPpn;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (i % 2 === 0 ? -3 : 14));
        invData.push({
          invoice_number: `${MARKER}FK-${daysAgo(dayOff).replace(/-/g,'')}-${String(i+1).padStart(3,'0')}`,
          supplier_id: sup.id,
          supplier_name: sup.name,
          invoice_date: daysAgo(dayOff),
          due_date: dueDate.toISOString().split('T')[0],
          subtotal,
          total_discount: 0,
          tax_ppn: taxPpn,
          total_amount: total,
          paid_amount: i % 4 === 0 ? total : i % 4 === 1 ? Math.round(total / 2) : 0,
          status: pick(invStatuses, i),
          kontrabon_status: pick(kontrabonStatuses, i),
          items: [{
            medicine_id: med.id,
            medicine_name: med.name,
            quantity: qty,
            batch_number: `${MARKER}BATCH-${String(i+1).padStart(3,'0')}`,
            expiry_date: daysAgo(-365),
            unit_price: unitPrice,
            discount_type: 'Tidak Ada',
            discount_amount: 0,
            net_unit_price: unitPrice,
            ppn_percent: 11,
            ppn_amount: Math.round(unitPrice * qty * 0.11),
            hna_baru: med.selling_price,
            hna_auto: true,
            line_total: total,
          }],
          created_by: user.full_name || 'Admin',
        });
      }
      const created = await b.SupplierInvoice.bulkCreate(invData);
      counts.SupplierInvoice = created.length;
    } else {
      counts.SupplierInvoice = existingInv.length;
    }

    // ── PAYMENT SCHEDULES ──────────────────────────────────
    const existingPS = await b.PaymentSchedule.filter({ schedule_number: { $regex: MARKER } }, undefined, 100);
    if (existingPS.length < 10) {
      const psData = [];
      const psStatuses = ['Terjadwal', 'Dibayar', 'Ditunda'];
      for (let i = 0; i < 10; i++) {
        const sup = suppliers[i % suppliers.length];
        psData.push({
          schedule_number: `${MARKER}JB-${String(i+1).padStart(3,'0')}`,
          supplier_id: sup.id,
          supplier_name: sup.name,
          planned_date: daysAgo(-i),
          amount: randInt(500000, 5000000, i),
          status: pick(psStatuses, i),
          payment_method: 'Transfer',
        });
      }
      const created = await b.PaymentSchedule.bulkCreate(psData);
      counts.PaymentSchedule = created.length;
    } else {
      counts.PaymentSchedule = existingPS.length;
    }

    // ── CASH SESSIONS ──────────────────────────────────
    const existingCS = await b.CashSession.filter({ session_number: { $regex: MARKER } }, undefined, 50);
    if (existingCS.length < 8) {
      const csData = [];
      for (let i = 0; i < 8; i++) {
        const dayOff = i;
        csData.push({
          session_number: `${MARKER}CS-${daysAgo(dayOff).replace(/-/g,'')}`,
          opened_by: user.id,
          opened_by_name: 'Eko Prasetyo',
          opened_at: daysAgoISO(dayOff, 8),
          closed_at: dayOff === 0 ? undefined : daysAgoISO(dayOff, 21),
          opening_cash: 500000,
          closing_cash: dayOff === 0 ? 0 : 500000 + randInt(50000, 500000, i),
          expected_cash: dayOff === 0 ? 0 : 500000 + randInt(50000, 500000, i),
          difference: i % 3 === 0 ? randInt(-20000, 20000, i) : 0,
          status: dayOff === 0 ? 'Aktif' : 'Tutup',
          total_transactions: randInt(5, 20, i),
          total_cash_sales: randInt(200000, 2000000, i),
        });
      }
      const created = await b.CashSession.bulkCreate(csData);
      counts.CashSession = created.length;
    } else {
      counts.CashSession = existingCS.length;
    }

    // ── EXPENSES ──────────────────────────────────────────
    const existingExp = await b.Expense.filter({ expense_number: { $regex: MARKER } }, undefined, 100);
    if (existingExp.length < 10) {
      const expData = [];
      const expCats = ['Pembelian Obat', 'Gaji', 'Operasional', 'Utilitas', 'Maintenance', 'Lainnya'];
      for (let i = 0; i < 10; i++) {
        expData.push({
          expense_number: `${MARKER}EXP-${String(i+1).padStart(3,'0')}`,
          category: pick(expCats, i),
          description: pick(['Pembelian obat rutin', 'Pembayaran gaji staff', 'Listrik dan air', 'Servis AC klinik', 'ATK kantor', 'Internet'], i),
          amount: randInt(500000, 10000000, i),
          payment_method: pick(['Tunai', 'Transfer', 'Debit'], i),
          payee: pick(['PT Kalbe Farma', 'Staff Klinik', 'PLN', 'CV Sejuk AC', 'Toko ATK', 'Indihome'], i),
          expense_date: daysAgo(i),
          created_by: user.id,
        });
      }
      const created = await b.Expense.bulkCreate(expData);
      counts.Expense = created.length;
    } else {
      counts.Expense = existingExp.length;
    }

    // ── APPOINTMENTS ──────────────────────────────────
    const existingAppt = await b.Appointment.filter({ patient_name: { $regex: MARKER } }, undefined, 100);
    if (existingAppt.length < 12) {
      const apptData = [];
      const apptStatuses = ['Terjadwalkan', 'Dikonfirmasi', 'Hadir', 'Selesai', 'No-Show', 'Perlu Reschedule'];
      for (let i = 0; i < 12; i++) {
        const dayOff = Math.floor(i / 2) - 2;
        const patient = patients[i % patients.length];
        apptData.push({
          patient_id: patient.id,
          patient_name: `${MARKER}${patient.full_name}`,
          doctor_name: 'dr. Andini Pratama, Sp.PD',
          appointment_date: daysAgo(dayOff),
          time_slot: `${String(8 + (i % 5)).padStart(2, '0')}:00`,
          poli: 'Poli Umum',
          status: pick(apptStatuses, i),
          source: i % 3 === 0 ? 'Portal' : i % 3 === 1 ? 'Walk-in' : 'Telepon',
        });
      }
      const created = await b.Appointment.bulkCreate(apptData);
      counts.Appointment = created.length;
    } else {
      counts.Appointment = existingAppt.length;
    }

    // ── NOTIFICATIONS ──────────────────────────────────
    const existingNotif = await b.Notification.filter({ title: { $regex: MARKER } }, undefined, 100);
    if (existingNotif.length < 10) {
      const notifData = [];
      const roles = ['Dokter', 'Apoteker', 'Kasir', 'Front Office', 'Admin'];
      const types = ['prescription', 'schedule_change', 'announcement', 'stock_alert', 'feedback'];
      for (let i = 0; i < 10; i++) {
        notifData.push({
          type: pick(types, i),
          target_role: pick(roles, i),
          from_user_name: 'Sistem',
          title: `${MARKER}${pick(['Resep baru menunggu dispensing', 'Jadwal dokter berubah', 'Stok obat menipis', 'Pengumuman rapat staff', 'Feedback dari farmasi'], i)}`,
          body: pick(['Mohon segera diproses', 'Jadwal praktik hari ini diperbarui', 'Stok Amlodipine 5mg tersisa 8', 'Rapat staff jam 16:00 di ruang rapat', 'Konfirmasi substitusi obat diperlukan'], i),
          priority: pick(['Normal', 'Penting', 'Mendesak'], i),
          is_read: i % 2 === 0,
          status: i % 2 === 0 ? 'Dibaca' : 'Baru',
        });
      }
      const created = await b.Notification.bulkCreate(notifData);
      counts.Notification = created.length;
    } else {
      counts.Notification = existingNotif.length;
    }

    // ── MEMOS ──────────────────────────────────────────
    const existingMemo = await b.Memo.filter({ subject: { $regex: MARKER } }, undefined, 50);
    if (existingMemo.length < 5) {
      const memoData = [];
      for (let i = 0; i < 5; i++) {
        memoData.push({
          from_user_name: 'Ibu Lina Marlina (Owner)',
          target_role: pick(['All', 'Dokter', 'Apoteker', 'Kasir', 'Admin'], i),
          subject: `${MARKER}${pick(['Jadwal Libur Lebaran', 'Rapat Bulanan', 'Update SOP Pemeriksaan', 'Pengingat Stock Opname', 'Edukasi Pasien Baru'], i)}`,
          body: pick(['Klinik libur tanggal 25-27. Mohon disesuaikan jadwal praktik.', 'Rapat bulan ini jumat 16:00. Wajib hadir semua staff.', 'SOP pemeriksaan dokter diperbarui, mohon pelajari.', 'Stock opname dijadwalkan akhir bulan. Persiapkan.', 'Pasien baru wajib diberikan edukasi PIO.'], i),
          priority: pick(['Normal', 'Penting', 'Mendesak'], i),
          is_pinned: i < 2,
        });
      }
      const created = await b.Memo.bulkCreate(memoData);
      counts.Memo = created.length;
    } else {
      counts.Memo = existingMemo.length;
    }

    // ── CHAT MESSAGES ──────────────────────────────────
    const existingChat = await b.ChatMessage.filter({ message: { $regex: MARKER } }, undefined, 100);
    if (existingChat.length < 10) {
      const chatData = [];
      const channels = ['all-staff', 'dokter', 'apoteker', 'kasir'];
      for (let i = 0; i < 10; i++) {
        chatData.push({
          channel: pick(channels, i),
          sender_name: pick(['dr. Andini', 'Apoteker Dina', 'Kasir Eko', 'Admin Hadi', 'Perawat Gita'], i),
          sender_role: pick(['Dokter', 'Apoteker', 'Kasir', 'Admin', 'Perawat'], i),
          message: `${MARKER}${pick(['Selamat pagi semua!', 'Ada pasien yang perlu ditindak lanjuti', 'Stok obat habis, mohon PO segera', 'Kasir tutup jam 21:00 ya', 'Rapat jam 16:00 jangan lupa', 'Pasien Budi Hartono sudah selesai', 'Resep baru masuk, tolong diproses', 'Terima kasih kerja kerasnya semua', 'Ada feedback dari farmasi', 'Jadwal dokter hari ini update'], i)}`,
          timestamp: daysAgoISO(Math.floor(i / 2), 8 + (i % 8)),
        });
      }
      const created = await b.ChatMessage.bulkCreate(chatData);
      counts.ChatMessage = created.length;
    } else {
      counts.ChatMessage = existingChat.length;
    }

    // ── CLINICAL FEEDBACK ──────────────────────────────────
    const existingFb = await b.ClinicalFeedback.filter({ subject: { $regex: MARKER } }, undefined, 50);
    if (existingFb.length < 5) {
      const fbData = [];
      for (let i = 0; i < 5; i++) {
        fbData.push({
          type: pick(['Substitution Suggestion', 'Pharmacy Feedback', 'Stock Alert'], i),
          from_name: 'Apoteker Dina Pratiwi',
          from_role: 'Apoteker',
          to_name: 'dr. Andini Pratama, Sp.PD',
          to_role: 'Dokter',
          medicine_name: pick(['Amoxicillin 500mg', 'Metformin 500mg', 'Amlodipine 5mg', 'Omeprazole 20mg', 'Salbutamol Sirup'], i),
          subject: `${MARKER}${pick(['Stok habis — substitusi', 'Konfirmasi dosis', 'Stok menipis', 'Interaksi obat', 'Alternatif tersedia'], i)}`,
          message: pick(['Stok kosong, mohon disubstitusi', 'Pasien ada gangguan ginjal, konfirmasi dosis', 'Stok tersisa 8 tablet', 'Cek interaksi dengan warfarin', 'Alternatif tersedia di apotek'], i),
          alternative_medicine_name: i % 2 === 0 ? pick(['Amoxicillin 250mg', 'Nifedipine 10mg', 'Pantoprazole 40mg'], i) : undefined,
          status: i === 0 ? 'Baru' : 'Dibaca',
        });
      }
      const created = await b.ClinicalFeedback.bulkCreate(fbData);
      counts.ClinicalFeedback = created.length;
    } else {
      counts.ClinicalFeedback = existingFb.length;
    }

    // ── ASSETS ──────────────────────────────────────────
    const existingAsset = await b.Asset.filter({ asset_code: { $regex: MARKER } }, undefined, 50);
    if (existingAsset.length < 10) {
      const assetData = [];
      const cats = ['Medis', 'Kantor', 'IT', 'Fasilitas', 'Lainnya'];
      const conds = ['Baik', 'Perlu Servis', 'Rusak'];
      for (let i = 0; i < 10; i++) {
        assetData.push({
          asset_code: `${MARKER}AST-${String(i+1).padStart(3,'0')}`,
          name: pick(['Stetoskop', 'Tensimeter Digital', 'Komputer Kasir', 'AC Ruang Tunggu', 'Printer Thermal', 'Komputer Front Office', 'Nebulizer', 'Timbangan Pasien', 'Lampu LED Ruang Periksa', 'Fire Extinguisher'], i),
          category: pick(cats, i),
          location: pick(['Rang Periksa 1', 'Kasir', 'Front Office', 'Ruang Tunggu', 'Apotek', 'Ruang Tindakan'], i),
          purchase_date: daysAgo(randInt(100, 500, i)),
          purchase_value: randInt(500000, 5000000, i),
          condition: pick(conds, i),
          last_maintenance: daysAgo(randInt(30, 90, i)),
          next_maintenance: daysAgo(-randInt(30, 90, i)),
        });
      }
      const created = await b.Asset.bulkCreate(assetData);
      counts.Asset = created.length;
    } else {
      counts.Asset = existingAsset.length;
    }

    // ── AUDIT LOGS ──────────────────────────────────────────
    const existingAudit = await b.AuditLog.filter({ description: { $regex: MARKER } }, undefined, 100);
    if (existingAudit.length < 10) {
      const auditData = [];
      const actions = ['create', 'update', 'delete', 'void', 'price_change', 'payment'];
      const entities = ['Patient', 'MedicalRecord', 'Prescription', 'Transaction', 'Medicine', 'PurchaseOrder'];
      for (let i = 0; i < 10; i++) {
        auditData.push({
          action: pick(actions, i),
          entity: pick(entities, i),
          entity_name: pick(['Budi Hartono', 'Resep R001', 'INV-001', 'Paracetamol 500mg', 'PO-001', 'MedicalRecord MR-001'], i),
          module: pick(['patients', 'rme', 'prescription', 'finance', 'inventory', 'purchasing'], i),
          description: `${MARKER}${pick(['Tambah pasien baru', 'Update diagnosis', 'Hapus resep', 'Void transaksi', 'Ubah harga obat', 'Pembayaran invoice', 'Approval PO', 'Stock adjustment', 'Login user', 'Role change'], i)}`,
          user_name: pick(['dr. Andini', 'Apoteker Dina', 'Kasir Eko', 'Admin Hadi', 'Owner Lina'], i),
          user_role: pick(['Dokter', 'Apoteker', 'Kasir', 'Admin', 'Owner'], i),
          severity: i % 5 === 0 ? 'Warning' : 'Info',
          timestamp: daysAgoISO(Math.floor(i / 2), 8 + (i % 8)),
        });
      }
      const created = await b.AuditLog.bulkCreate(auditData);
      counts.AuditLog = created.length;
    } else {
      counts.AuditLog = existingAudit.length;
    }

    // ── ANOMALIES ──────────────────────────────────────────
    const existingAnom = await b.Anomaly.filter({ description: { $regex: MARKER } }, undefined, 50);
    if (existingAnom.length < 6) {
      const anomData = [];
      const anomTypes = ['stock_out_no_transaction', 'procedure_not_billed', 'unpaid_prescription', 'void_after_dispensing', 'price_change', 'cash_mismatch'];
      const severities = ['warning', 'critical'];
      for (let i = 0; i < 6; i++) {
        anomData.push({
          type: pick(anomTypes, i),
          severity: pick(severities, i),
          description: `${MARKER}${pick(['Stok keluar tanpa transaksi', 'Tindakan tidak ditagih', 'Resep belum dibayar', 'Void setelah dispensing', 'Perubahan harga tidak tercatat', 'Selisih kas'], i)}`,
          related_entity: pick(['Medicine', 'MedicalRecord', 'Prescription', 'Transaction', 'Medicine', 'CashSession'], i),
          user_name: pick(['Kasir Eko', 'dr. Andini', 'Apoteker Dina', 'Kasir Eko', 'Apoteker Dina', 'Kasir Fitri'], i),
          status: i < 3 ? 'Baru' : 'Dilihat',
          detected_at: daysAgoISO(Math.floor(i / 2), 10 + i),
        });
      }
      const created = await b.Anomaly.bulkCreate(anomData);
      counts.Anomaly = created.length;
    } else {
      counts.Anomaly = existingAnom.length;
    }

    // ── PRICING SETTINGS (Penentuan Harga) ─────────────────
    const existingSettings = await b.ClinicSetting.filter({ category: 'Penentuan Harga' }, undefined, 50);
    const pricingDefaults = [
      { key: 'hpp_method', label: 'Metode HPP', type: 'select', value: 'Per Batch FEFO' },
      { key: 'bonus_treatment_default', label: 'Perlakuan Bonus (default)', type: 'select', value: 'Per Faktur' },
      { key: 'ppn_in_hpp', label: 'PPN masuk dalam HPP', type: 'boolean', value: 'true' },
      { key: 'default_target_margin', label: 'Target Margin Default (%)', type: 'number', value: '30' },
      { key: 'price_rounding', label: 'Pembulatan Harga (Rp)', type: 'number', value: '500' },
      { key: 'override_roles', label: 'Role yang Boleh Override Harga Minimum', type: 'text', value: 'Owner,Admin' },
    ];
    let settingsCreated = 0;
    for (const def of pricingDefaults) {
      const exists = existingSettings.find((s: any) => s.key === def.key);
      if (!exists) {
        await b.ClinicSetting.create({ ...def, category: 'Penentuan Harga' });
        settingsCreated++;
      }
    }
    counts.ClinicSetting_Pricing = settingsCreated || existingSettings.length;

    // ── PRICE HISTORY ──────────────────────────────────────
    const existingPH = await b.PriceHistory.filter({ medicine_name: { $regex: MARKER } }, undefined, 50);
    if (existingPH.length < 8 && medicines.length > 0) {
      const phData = [];
      for (let i = 0; i < 8 && i < medicines.length; i++) {
        const med = medicines[i];
        const oldPrice = (med.selling_price || 0) * 0.9;
        const newPrice = med.selling_price || 0;
        const hpp = (med.purchase_price || 0) * 1.11;
        const minSafe = Math.round((hpp * 1.1) / 500) * 500;
        phData.push({
          medicine_id: med.id,
          medicine_name: `${MARKER}${med.name}`,
          old_price: Math.round(oldPrice),
          new_price: Math.round(newPrice),
          min_safe_price: minSafe,
          hpp_basis: Math.round(hpp),
          target_margin: 30,
          reason: i % 3 === 0 ? 'Penyesuaian dari faktur supplier terbaru' : i % 3 === 1 ? 'Override di bawah minimum — persetujuan owner' : 'Update harga jual rutin',
          changed_by_name: pick(['Apoteker Dina', 'Owner Lina', 'Admin Hadi'], i),
          source: pick(['faktur', 'manual', 'override'], i),
          below_minimum: i % 4 === 0,
          timestamp: daysAgoISO(Math.floor(i / 2), 9 + i),
        });
      }
      const createdPH = await b.PriceHistory.bulkCreate(phData);
      counts.PriceHistory = createdPH.length;
    } else {
      counts.PriceHistory = existingPH.length;
    }

    // ── PRICE ANOMALIES (tambahan) ──────────────────────────
    const existingPriceAnom = await b.Anomaly.filter({ type: { $in: ['price_below_minimum', 'price_below_target', 'old_stock_high_hpp', 'supplier_price_change_significant', 'invoice_receipt_mismatch'] }, description: { $regex: MARKER } }, undefined, 20);
    if (existingPriceAnom.length < 5) {
      const priceAnomData = [];
      const priceAnomTypes = ['price_below_target', 'price_below_minimum', 'old_stock_high_hpp', 'supplier_price_change_significant', 'invoice_receipt_mismatch'];
      for (let i = 0; i < 5; i++) {
        priceAnomData.push({
          type: priceAnomTypes[i],
          severity: i === 1 || i === 4 ? 'critical' : 'warning',
          description: `${MARKER}${pick(['Harga jual di bawah target margin 30%', 'Harga jual di bawah Harga Minimum Aman — rugi', 'Stok lama HPP lebih tinggi dari batch baru', 'Harga beli supplier naik >20% dari faktur sebelumnya', 'Total faktur tidak sesuai dengan barang yang diterima'], i)}`,
          related_entity: pick(['Medicine', 'Medicine', 'StockBatch', 'SupplierInvoice', 'SupplierInvoice'], i),
          user_name: pick(['Apoteker Dina', 'Apoteker Dina', 'Owner Lina', 'Apoteker Dina', 'Kasir Eko'], i),
          status: 'Baru',
          detected_at: daysAgoISO(Math.floor(i / 2), 10 + i),
        });
      }
      await b.Anomaly.bulkCreate(priceAnomData);
      counts.PriceAnomaly = priceAnomData.length;
    } else {
      counts.PriceAnomaly = existingPriceAnom.length;
    }

    return Response.json({ success: true, counts, total: Object.values(counts).reduce((a: number, c: any) => a + c, 0) });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}