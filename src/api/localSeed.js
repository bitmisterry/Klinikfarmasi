// @ts-nocheck -- Seed records deliberately preserve heterogeneous legacy field shapes.
const marker = 'DEMO-';

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const daysAgoIso = (days, hour = 9) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const pick = (items, index) => items[index % items.length];
const randInt = (min, max, seed) => min + ((seed * 7) % (max - min + 1));
const id = (entity, index) => `${entity.toLowerCase()}-${marker.toLowerCase()}${String(index + 1).padStart(3, '0')}`;

export function buildBase44SeedData({ userId = 'local-owner', userName = 'Demo Owner' } = {}) {
  const suppliersData = [
    ['PT Kalbe Farma', 'Budi Santoso', '021-6500001', 'sales@kalbe.co.id', 'Jl. Pulomas Raya, Jakarta', '30 hari', '01.234.567.8-091.000'],
    ['PT Tempo Scan Pacific', 'Sari Dewi', '021-6500002', 'order@temposcan.co.id', 'Jl. Pemuda, Jakarta', '30 hari', '02.345.678.9-123.000'],
    ['PT Kimia Farma', 'Andi Wijaya', '021-6500003', 'sales@kimiafarma.co.id', 'Jl. Letjen Suprapto, Jakarta', '45 hari', '03.456.789.0-234.000'],
    ['PT Dexa Medica', 'Rina Pratiwi', '021-6500004', 'info@dexa.co.id', 'Jl. Danau Sunter, Jakarta', '30 hari', '04.567.890.1-345.000'],
    ['PT Sanbe Farma', 'Eko Prasetyo', '021-6500005', 'sales@sanbe.co.id', 'Jl. Soekarno Hatta, Bandung', '30 hari', '05.678.901.2-456.000'],
    ['PT Phapros', 'Lina Marlina', '021-6500006', 'order@phapros.co.id', 'Jl. Semarang, Semarang', '60 hari', '06.789.012.3-567.000'],
    ['PT Bernofarm', 'Hadi Kusuma', '021-6500007', 'sales@bernofarm.co.id', 'Jl. Ahmad Yani, Surabaya', '30 hari', '07.890.123.4-678.000'],
    ['PT Graha Farma', 'Maya Sari', '021-6500008', 'info@grahafarma.co.id', 'Jl. Diponegoro, Jakarta', '30 hari', '08.901.234.5-789.000'],
    ['PT Indofarma', 'Rudi Hartono', '021-6500009', 'sales@indofarma.co.id', 'Jl. Grogol, Jakarta', '45 hari', '09.012.345.6-890.000'],
    ['PT Ifars', 'Tina Anggraini', '021-6500010', 'order@ifars.co.id', 'Jl. Cipinang, Jakarta', '30 hari', '10.123.456.7-901.000'],
  ];

  const medicinesData = [
    ['Paracetamol 500mg', 'Paracetamol', 'Paracetamol', '500mg', 'Tablet', 'Obat Bebas', '8990000000011', 'Tempo Scan', 'tablet', 500, 350, 850, 100, 'PARA500'],
    ['Amoxicillin 500mg', 'Amoxicillin', 'Amoxicillin', '500mg', 'Kapsul', 'Obat Keras', '8990000000028', 'Kalbe Farma', 'kapsul', 1500, 1000, 420, 80, 'AMOX500'],
    ['Amlodipine 5mg', 'Amlodipine', 'Amlodipine', '5mg', 'Tablet', 'Obat Keras', '8990000000035', 'Kimia Farma', 'tablet', 800, 500, 8, 50, 'AML5'],
    ['Metformin 500mg', 'Metformin', 'Metformin', '500mg', 'Tablet', 'Obat Keras', '8990000000042', 'Dexa Medica', 'tablet', 1200, 800, 310, 60, 'MET500'],
    ['Omeprazole 20mg', 'Omeprazole', 'Omeprazole', '20mg', 'Kapsul', 'Obat Keras', '8990000000059', 'Sanbe Farma', 'kapsul', 2500, 1800, 180, 40, 'OMP20'],
    ['Cetirizine 10mg', 'Cetirizine', 'Cetirizine', '10mg', 'Tablet', 'Obat Bebas Terbatas', '8990000000066', 'Bernofarm', 'tablet', 1000, 700, 250, 50, 'CET10'],
    ['Ibuprofen 400mg', 'Ibuprofen', 'Ibuprofen', '400mg', 'Tablet', 'Obat Bebas', '8990000000073', 'Phapros', 'tablet', 800, 550, 400, 80, 'IBU400'],
    ['CTM 4mg', 'Chlorpheniramine', 'Chlorpheniramine maleate', '4mg', 'Tablet', 'Obat Bebas Terbatas', '8990000000080', 'Indofarma', 'tablet', 300, 200, 600, 100, 'CTM4'],
    ['Vitamin C 1000mg', 'Ascorbic Acid', 'Ascorbic Acid', '1000mg', 'Tablet', 'Suplemen', '8990000000097', 'Ifars', 'tablet', 1500, 1000, 350, 60, 'VITC1'],
    ['Salbutamol 2mg Sirup', 'Salbutamol', 'Salbutamol', '2mg/5ml', 'Sirup', 'Obat Keras', '8990000000103', 'Kalbe Farma', 'botol', 18000, 12000, 45, 20, 'SAL2'],
    ['Ranitidine 150mg', 'Ranitidine', 'Ranitidine', '150mg', 'Tablet', 'Obat Keras', '8990000000110', 'Graha Farma', 'tablet', 1000, 700, 220, 50, 'RAN150'],
    ['Aspirin 100mg', 'Aspirin', 'Acetylsalicylic Acid', '100mg', 'Tablet', 'Obat Bebas', '8990000000127', 'Tempo Scan', 'tablet', 600, 400, 380, 70, 'ASP100'],
    ['Forifek 500mg', 'Forifek', 'Cefadroxil', '500mg', 'Kapsul', 'Obat Keras', '8990000000134', 'Kalbe Farma', 'kapsul', 15000, 11000, 50, 10, 'FOR500'],
    ['Proris 200mg', 'Proris', 'Ibuprofen', '200mg', 'Tablet', 'Obat Bebas Terbatas', '8990000000141', 'Pharos', 'tablet', 3500, 2500, 100, 20, 'PRO200'],
    ['Aminofilin 200mg', 'Aminophilin', 'Aminophylline', '200mg', 'Tablet', 'Obat Keras', '8990000000158', 'Kimia Farma', 'tablet', 1500, 1000, 80, 15, 'AMI200'],
    ['Cerini 10mg', 'Cerini', 'Cetirizine', '10mg', 'Tablet', 'Obat Keras', '8990000000165', 'Sanbe Farma', 'tablet', 6000, 4500, 60, 10, 'CER10'],
    ['Meptin 4mg', 'Meptin', 'Procaterol', '4mg', 'Tablet', 'Obat Keras', '8990000000172', 'Otsuka', 'tablet', 2500, 1800, 60, 10, 'MEP4'],
    ['Opicort 5mg', 'Opicort', 'Prednisone', '5mg', 'Tablet', 'Obat Keras', '8990000000189', 'Otik', 'tablet', 2200, 1600, 50, 10, 'OPI5'],
  ];

  const patientsData = [
    ['Budi Hartono', 'L', '1985-03-15', '081234567890', 'Jl. Melati No. 10, Jakarta', 'BPJS', '0001234567890', 'Penisilin', 'O'],
    ['Siti Aminah', 'P', '1990-07-22', '081234567891', 'Jl. Mawar No. 5, Jakarta', 'Umum', '', 'Tidak ada', 'A'],
    ['Ahmad Fauzi', 'L', '1978-11-30', '081234567892', 'Jl. Anggrek No. 8, Jakarta', 'BPJS', '0001234567891', 'Tidak ada', 'B'],
    ['Dewi Lestari', 'P', '1995-01-18', '081234567893', 'Jl. Kenanga No. 12, Jakarta', 'Asuransi', '', 'Sulfonamida', 'AB'],
    ['Joko Susilo', 'L', '1970-05-25', '081234567894', 'Jl. Flamboyan No. 3, Jakarta', 'Umum', '', 'Tidak ada', 'O'],
    ['Rina Wijaya', 'P', '1988-09-10', '081234567895', 'Jl. Cempaka No. 7, Jakarta', 'BPJS', '0001234567892', 'Tidak ada', 'A'],
    ['Bambang Sutrisno', 'L', '1965-12-05', '081234567896', 'Jl. Dahlia No. 15, Jakarta', 'Umum', '', 'Aspirin', 'B'],
    ['Maya Putri', 'P', '2000-04-20', '081234567897', 'Jl. Tulip No. 9, Jakarta', 'Umum', '', 'Tidak ada', 'O'],
    ['Hendra Gunawan', 'L', '1982-08-14', '081234567898', 'Jl. Lavender No. 11, Jakarta', 'BPJS', '0001234567893', 'Tidak ada', 'AB'],
    ['Lestari Indah', 'P', '1993-02-28', '081234567899', 'Jl. Sakura No. 4, Jakarta', 'Umum', '', 'Tidak ada', 'A'],
    ['Rudi Santoso', 'L', '1975-06-12', '081234567800', 'Jl. Teratai No. 6, Jakarta', 'BPJS', '0001234567894', 'Tidak ada', 'B'],
    ['Anita Rahma', 'P', '1998-10-03', '081234567801', 'Jl. Bougenville No. 2, Jakarta', 'Umum', '', 'Tidak ada', 'O'],
  ];

  const suppliers = suppliersData.map((s, i) => ({ id: id('Supplier', i), name: s[0], contact_person: s[1], phone: s[2], email: s[3], address: s[4], payment_terms: s[5], npwp: s[6], code: `${marker}SUP-${String(i + 1).padStart(3, '0')}`, is_active: true }));
  const medicines = medicinesData.map((m, i) => ({ id: id('Medicine', i), name: m[0], generic_name: m[1], active_substance: m[2], strength: m[3], form: m[4], category: m[5], barcode: m[6], manufacturer: m[7], unit: m[8], selling_price: m[9], purchase_price: m[10], stock_on_hand: m[11], min_stock: m[12], substitution_group: m[13], code: `${marker}MED-${String(i + 1).padStart(3, '0')}`, is_active: true, margin_percent: Math.round((m[9] - m[10]) / m[10] * 100) }));
  const patients = patientsData.map((p, i) => ({ id: id('Patient', i), full_name: p[0], gender: p[1], birth_date: p[2], phone: p[3], address: p[4], insurance_type: p[5], bpjs_number: p[6] || undefined, allergies: p[7], blood_type: p[8], mr_number: `${marker}RM-${String(i + 1).padStart(4, '0')}` }));
  const staff = [
    ['dr. Andini Pratama, Sp.PD', 'Dokter', 'STR-001', '081200000001', 'andini@klinikfarma.id', 'Pagi', '2024-01-15', 15000000],
    ['dr. Budi Santoso, Sp.A', 'Dokter', 'STR-002', '081200000002', 'budi@klinikfarma.id', 'Pagi', '2024-03-01', 18000000],
    ['dr. Citra Dewi, drg', 'Dokter', 'STR-003', '081200000003', 'citra@klinikfarma.id', 'Siang', '2024-05-10', 14000000],
    ['Apoteker Dina Pratiwi', 'Apoteker', 'SIPA-001', '081200000004', 'dina@klinikfarma.id', 'Pagi', '2023-08-01', 8000000],
    ['Kasir Eko Prasetyo', 'Kasir', '', '081200000005', 'eko@klinikfarma.id', 'Pagi', '2023-06-01', 4500000],
    ['Kasir Fitri Handayani', 'Kasir', '', '081200000006', 'fitri@klinikfarma.id', 'Siang', '2024-01-10', 4500000],
    ['Perawat Gita Maharani', 'Perawat', 'NIPL-001', '081200000007', 'gita@klinikfarma.id', 'Pagi', '2023-09-15', 5000000],
    ['Admin Hadi Kusuma', 'Admin', '', '081200000008', 'hadi@klinikfarma.id', 'Lengkap', '2023-01-01', 7000000],
    ['Owner Ibu Lina Marlina', 'Owner', '', '081200000009', 'lina@klinikfarma.id', 'Lengkap', '2020-01-01', 25000000],
    ['Asisten Maya Sari', 'Staff', '', '081200000010', 'maya@klinikfarma.id', 'Pagi', '2024-06-01', 3500000],
  ].map((s, i) => ({ id: id('Staff', i), full_name: `${marker}${s[0]}`, role: s[1], license_number: s[2], phone: s[3], email: s[4], shift: s[5], hire_date: s[6], salary: s[7], is_active: true }));

  const queue = Array.from({ length: 30 }, (_, i) => {
    const day = Math.floor(i / 5);
    const patient = patients[i % patients.length];
    const statuses = ['Menunggu', 'Pemeriksaan', 'Selesai Periksa', 'Di Apotek', 'Kasir', 'Selesai'];
    return { id: id('QueueEntry', i), queue_number: `${marker}Q-${daysAgo(day).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`, patient_id: patient.id, patient_name: patient.full_name, visit_type: 'Poliklinik', status: day === 0 ? pick(statuses, i) : 'Selesai', loket: pick(['Poli Umum', 'Poli Anak', 'Poli Gigi'], i), priority: i % 7 === 0, complaint: pick(['Demam dan batuk', 'Sakit kepala', 'Nyeri ulu hati', 'Pusing', 'Mual muntah', 'Gatal-gatal', 'Nyeri pinggang'], i), doctor_name: 'dr. Andini Pratama, Sp.PD', check_in_time: daysAgoIso(day, 8 + (i % 4)), visit_date: daysAgo(day) };
  });

  const medicalRecords = Array.from({ length: 20 }, (_, i) => {
    const day = Math.floor(i / 3);
    const patient = patients[i % patients.length];
    const diagnoses = ['Acute Upper Respiratory Tract Infection', 'Essential Hypertension', 'Type 2 Diabetes Mellitus', 'Gastritis', 'Common Cold', 'Migraine', 'Dermatitis'];
    const codes = ['J06.9', 'I10', 'E11.9', 'K29.7', 'J00', 'G43.9', 'L30.9'];
    return { id: id('MedicalRecord', i), patient_id: patient.id, patient_name: patient.full_name, visit_date: daysAgo(day), doctor_name: 'dr. Andini Pratama, Sp.PD', chief_complaint: pick(['Demam, batuk, pilek', 'Sakit kepala, pusing', 'Nyeri ulu hati', 'Sering haus, sering kencing', 'Gatal-gatal'], i), subjective: `Pasien datang dengan keluhan ${pick(['demam sejak 2 hari', 'sakit kepala berdenyut', 'nyeri perut bagian atas', 'sering buang air kecil', 'ruam kulit gatal'], i)}. Tidak ada riwayat penyakit kronis lain.`, vital_signs_bp: pick(['120/80', '140/90', '110/70', '130/85'], i), vital_signs_temp: pick([36.5, 37.8, 38.2, 36.8], i), vital_signs_pulse: pick([80, 88, 95, 72], i), vital_signs_weight: pick([60, 65, 70, 55], i), vital_signs_height: pick([165, 170, 160, 175], i), physical_exam: 'Tidak ada kelainan khas pada pemeriksaan fisik. Konjungtiva tidak anemis, sclera tidak ikterus.', diagnosis: `${marker}${pick(diagnoses, i)}`, diagnosis_code: pick(codes, i), procedures: [{ name: 'Pemeriksaan Umum', code: 'PEU-01', fee: 50000, quantity: 1, subtotal: 50000 }], tindakan_total: 50000, treatment_plan: pick(['Paracetamol 500mg 3x1, istirahat', 'Amlodipine 5mg 1x1, diet rendah garam', 'Metformin 500mg 2x1, diet DM', 'Omeprazole 20mg 1x1, diet lunak'], i), follow_up_date: daysAgo(-7), follow_up_instructions: 'Kontrol 1 minggu jika tidak membaik', patient_education: 'Istirahat cukup, minum air banyak' };
  });

  const prescriptions = Array.from({ length: 20 }, (_, i) => {
    const day = Math.floor(i / 3);
    const patient = patients[i % patients.length];
    const med1 = medicines[i % medicines.length];
    const med2 = medicines[(i + 1) % medicines.length];
    return { id: id('Prescription', i), prescription_number: `${marker}R${daysAgo(day).replace(/-/g, '')}${String(i + 1).padStart(3, '0')}`, patient_id: patient.id, patient_name: patient.full_name, doctor_name: 'dr. Andini Pratama, Sp.PD', prescription_date: daysAgo(day), source: 'Internal', status: day === 0 ? pick(['Baru', 'Diresepkan', 'Dispensing', 'Selesai Dispensing', 'Billed', 'Paid'], i) : 'Paid', items: [{ medicine_id: med1.id, medicine_name: med1.name, strength: med1.strength, dosage: '3x1 tablet', quantity: 10, instructions: 'Setelah makan' }, { medicine_id: med2.id, medicine_name: med2.name, strength: med2.strength, dosage: '2x1 tablet', quantity: 7, instructions: 'Sebelum makan' }] };
  });

  const transactions = Array.from({ length: 25 }, (_, i) => {
    const day = Math.floor(i / 4);
    const patient = patients[i % patients.length];
    const med = medicines[i % medicines.length];
    const quantity = randInt(1, 5, i);
    const subtotal = med.selling_price * quantity;
    return { id: id('Transaction', i), invoice_number: `${marker}INV${daysAgo(day).replace(/-/g, '')}${String(i + 1).padStart(3, '0')}`, type: i % 4 === 0 ? 'Klinik' : 'Apotek/POS', patient_id: patient.id, patient_name: patient.full_name, items: [{ medicine_id: med.id, medicine_name: med.name, quantity, price: med.selling_price, subtotal }], subtotal, consultation_fee: i % 4 === 0 ? 50000 : 0, total: subtotal + 50000, payment_method: pick(['Tunai', 'QRIS', 'Debit', 'Transfer', 'BPJS'], i), payment_status: day === 0 && i % 3 === 0 ? 'Belum Bayar' : 'Lunas', paid_amount: subtotal + 50000, cashier_name: 'Eko Prasetyo', transaction_date: daysAgo(day) };
  });

  const batches = Array.from({ length: 12 }, (_, i) => {
    const med = medicines[i % medicines.length];
    const supplier = suppliers[i % suppliers.length];
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (i % 3 === 0 ? 60 : i % 3 === 1 ? 400 : 700));
    return { id: id('StockBatch', i), medicine_id: med.id, medicine_name: med.name, batch_number: `${marker}BATCH-${String(i + 1).padStart(3, '0')}`, quantity: randInt(20, 200, i), initial_quantity: randInt(100, 300, i), expiry_date: expiry.toISOString().slice(0, 10), received_date: daysAgo(randInt(0, 7, i)), supplier_id: supplier.id, supplier_name: supplier.name, purchase_price: med.purchase_price, selling_price: med.selling_price, status: 'Aktif' };
  });

  const purchaseOrders = Array.from({ length: 10 }, (_, i) => {
    const day = Math.floor(i / 2);
    const supplier = suppliers[i % suppliers.length];
    const med = medicines[i % medicines.length];
    const quantity = randInt(50, 200, i);
    return { id: id('PurchaseOrder', i), po_number: `${marker}PO-${daysAgo(day).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`, supplier_id: supplier.id, supplier_name: supplier.name, order_date: daysAgo(day), expected_date: daysAgo(day - 3), status: pick(['Disetujui', 'Dikirim', 'Diterima', 'Diterima Sebagian', 'Menunggu Approval'], i), approval_status: i % 5 === 0 ? 'Menunggu Approval' : 'Disetujui', items: [{ medicine_id: med.id, medicine_name: med.name, quantity, unit_price: med.purchase_price, subtotal: med.purchase_price * quantity, received_quantity: i % 3 === 0 ? quantity : 0 }], total_amount: med.purchase_price * quantity, created_by: userName };
  });

  const supplierInvoices = Array.from({ length: 10 }, (_, i) => {
    const day = Math.floor(i / 2);
    const supplier = suppliers[i % suppliers.length];
    const med = medicines[i % medicines.length];
    const quantity = randInt(50, 150, i);
    const subtotal = med.purchase_price * quantity;
    const tax = Math.round(subtotal * 0.11);
    const due = new Date();
    due.setDate(due.getDate() + (i % 2 === 0 ? -3 : 14));
    const total = subtotal + tax;
    return { id: id('SupplierInvoice', i), invoice_number: `${marker}FK-${daysAgo(day).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`, supplier_id: supplier.id, supplier_name: supplier.name, invoice_date: daysAgo(day), due_date: due.toISOString().slice(0, 10), subtotal, total_discount: 0, tax_ppn: tax, total_amount: total, paid_amount: i % 4 === 0 ? total : i % 4 === 1 ? Math.round(total / 2) : 0, status: pick(['Belum Bayar', 'Sebagian Bayar', 'Lunas', 'Overdue'], i), kontrabon_status: pick(['Belum Jatuh Tempo', 'Mendekati Jatuh Tempo', 'Kontrabon', 'Selesai'], i), items: [{ medicine_id: med.id, medicine_name: med.name, quantity, batch_number: `${marker}BATCH-${String(i + 1).padStart(3, '0')}`, expiry_date: daysAgo(-365), unit_price: med.purchase_price, discount_type: 'Tidak Ada', discount_amount: 0, net_unit_price: med.purchase_price, ppn_percent: 11, ppn_amount: Math.round(med.purchase_price * quantity * 0.11), hna_baru: med.selling_price, hna_auto: true, line_total: total }], created_by: userName };
  });

  const data = {
    Supplier: suppliers,
    Medicine: medicines,
    Patient: patients,
    Staff: staff,
    QueueEntry: queue,
    MedicalRecord: medicalRecords,
    Prescription: prescriptions,
    Transaction: transactions,
    StockBatch: batches,
    PurchaseOrder: purchaseOrders,
    SupplierInvoice: supplierInvoices,
    PaymentSchedule: Array.from({ length: 10 }, (_, i) => { const supplier = suppliers[i % suppliers.length]; return { id: id('PaymentSchedule', i), schedule_number: `${marker}JB-${String(i + 1).padStart(3, '0')}`, supplier_id: supplier.id, supplier_name: supplier.name, planned_date: daysAgo(-i), amount: randInt(500000, 5000000, i), status: pick(['Terjadwal', 'Dibayar', 'Ditunda'], i), payment_method: 'Transfer' }; }),
    CashSession: Array.from({ length: 8 }, (_, i) => ({ id: id('CashSession', i), session_number: `${marker}CS-${daysAgo(i).replace(/-/g, '')}`, opened_by: userId, opened_by_name: 'Eko Prasetyo', opened_at: daysAgoIso(i, 8), closed_at: i === 0 ? undefined : daysAgoIso(i, 21), opening_cash: 500000, closing_cash: i === 0 ? 0 : 500000 + randInt(50000, 500000, i), expected_cash: i === 0 ? 0 : 500000 + randInt(50000, 500000, i), difference: i % 3 === 0 ? randInt(-20000, 20000, i) : 0, status: i === 0 ? 'Aktif' : 'Tutup', total_transactions: randInt(5, 20, i), total_cash_sales: randInt(200000, 2000000, i) })),
    Expense: Array.from({ length: 10 }, (_, i) => ({ id: id('Expense', i), expense_number: `${marker}EXP-${String(i + 1).padStart(3, '0')}`, category: pick(['Pembelian Obat', 'Gaji', 'Operasional', 'Utilitas', 'Maintenance', 'Lainnya'], i), description: pick(['Pembelian obat rutin', 'Pembayaran gaji staff', 'Listrik dan air', 'Servis AC klinik', 'ATK kantor', 'Internet'], i), amount: randInt(500000, 10000000, i), payment_method: pick(['Tunai', 'Transfer', 'Debit'], i), payee: pick(['PT Kalbe Farma', 'Staff Klinik', 'PLN', 'CV Sejuk AC', 'Toko ATK', 'Indihome'], i), expense_date: daysAgo(i), created_by: userId })),
    Appointment: Array.from({ length: 12 }, (_, i) => { const patient = patients[i % patients.length]; const day = Math.floor(i / 2) - 2; return { id: id('Appointment', i), patient_id: patient.id, patient_name: `${marker}${patient.full_name}`, doctor_name: 'dr. Andini Pratama, Sp.PD', appointment_date: daysAgo(day), time_slot: `${String(8 + (i % 5)).padStart(2, '0')}:00`, poli: 'Poli Umum', status: pick(['Terjadwalkan', 'Dikonfirmasi', 'Hadir', 'Selesai', 'No-Show', 'Perlu Reschedule'], i), source: i % 3 === 0 ? 'Portal' : i % 3 === 1 ? 'Walk-in' : 'Telepon' }; }),
    Notification: Array.from({ length: 10 }, (_, i) => ({ id: id('Notification', i), type: pick(['prescription', 'schedule_change', 'announcement', 'stock_alert', 'feedback'], i), target_role: pick(['Dokter', 'Apoteker', 'Kasir', 'Front Office', 'Admin'], i), from_user_name: 'Sistem', title: `${marker}${pick(['Resep baru menunggu dispensing', 'Jadwal dokter berubah', 'Stok obat menipis', 'Pengumuman rapat staff', 'Feedback dari farmasi'], i)}`, body: pick(['Mohon segera diproses', 'Jadwal praktik hari ini diperbarui', 'Stok Amlodipine 5mg tersisa 8', 'Rapat staff jam 16:00 di ruang rapat', 'Konfirmasi substitusi obat diperlukan'], i), priority: pick(['Normal', 'Penting', 'Mendesak'], i), is_read: i % 2 === 0, status: i % 2 === 0 ? 'Dibaca' : 'Baru' })),
    Memo: Array.from({ length: 5 }, (_, i) => ({ id: id('Memo', i), from_user_name: 'Ibu Lina Marlina (Owner)', target_role: pick(['All', 'Dokter', 'Apoteker', 'Kasir', 'Admin'], i), subject: `${marker}${pick(['Jadwal Libur Lebaran', 'Rapat Bulanan', 'Update SOP Pemeriksaan', 'Pengingat Stock Opname', 'Edukasi Pasien Baru'], i)}`, body: pick(['Klinik libur tanggal 25-27. Mohon disesuaikan jadwal praktik.', 'Rapat bulan ini jumat 16:00. Wajib hadir semua staff.', 'SOP pemeriksaan dokter diperbarui, mohon pelajari.', 'Stock opname dijadwalkan akhir bulan. Persiapkan.', 'Pasien baru wajib diberikan edukasi PIO.'], i), priority: pick(['Normal', 'Penting', 'Mendesak'], i), is_pinned: i < 2, read_by: [] })),
    ChatMessage: Array.from({ length: 10 }, (_, i) => ({ id: id('ChatMessage', i), channel: pick(['all-staff', 'dokter', 'apoteker', 'kasir'], i), sender_name: pick(['dr. Andini', 'Apoteker Dina', 'Kasir Eko', 'Admin Hadi', 'Perawat Gita'], i), sender_role: pick(['Dokter', 'Apoteker', 'Kasir', 'Admin', 'Perawat'], i), message: `${marker}${pick(['Selamat pagi semua!', 'Ada pasien yang perlu ditindak lanjuti', 'Stok obat habis, mohon PO segera', 'Kasir tutup jam 21:00 ya', 'Rapat jam 16:00 jangan lupa', 'Pasien Budi Hartono sudah selesai', 'Resep baru masuk, tolong diproses', 'Terima kasih kerja kerasnya semua', 'Ada feedback dari farmasi', 'Jadwal dokter hari ini update'], i)}`, timestamp: daysAgoIso(Math.floor(i / 2), 8 + (i % 8)) })),
    ClinicalFeedback: Array.from({ length: 5 }, (_, i) => ({ id: id('ClinicalFeedback', i), type: pick(['Substitution Suggestion', 'Pharmacy Feedback', 'Stock Alert'], i), from_name: 'Apoteker Dina Pratiwi', from_role: 'Apoteker', to_name: 'dr. Andini Pratama, Sp.PD', to_role: 'Dokter', medicine_name: pick(['Amoxicillin 500mg', 'Metformin 500mg', 'Amlodipine 5mg', 'Omeprazole 20mg', 'Salbutamol Sirup'], i), subject: `${marker}${pick(['Stok habis — substitusi', 'Konfirmasi dosis', 'Stok menipis', 'Interaksi obat', 'Alternatif tersedia'], i)}`, message: pick(['Stok kosong, mohon disubstitusi', 'Pasien ada gangguan ginjal, konfirmasi dosis', 'Stok tersisa 8 tablet', 'Cek interaksi dengan warfarin', 'Alternatif tersedia di apotek'], i), alternative_medicine_name: i % 2 === 0 ? pick(['Amoxicillin 250mg', 'Nifedipine 10mg', 'Pantoprazole 40mg'], i) : undefined, status: i === 0 ? 'Baru' : 'Dibaca' })),
    Asset: Array.from({ length: 10 }, (_, i) => ({ id: id('Asset', i), asset_code: `${marker}AST-${String(i + 1).padStart(3, '0')}`, name: pick(['Stetoskop', 'Tensimeter Digital', 'Komputer Kasir', 'AC Ruang Tunggu', 'Printer Thermal', 'Komputer Front Office', 'Nebulizer', 'Timbangan Pasien', 'Lampu LED Ruang Periksa', 'Fire Extinguisher'], i), category: pick(['Medis', 'Kantor', 'IT', 'Fasilitas', 'Lainnya'], i), location: pick(['Ruang Periksa 1', 'Kasir', 'Front Office', 'Ruang Tunggu', 'Apotek', 'Ruang Tindakan'], i), purchase_date: daysAgo(randInt(100, 500, i)), purchase_value: randInt(500000, 5000000, i), condition: pick(['Baik', 'Perlu Servis', 'Rusak'], i), last_maintenance: daysAgo(randInt(30, 90, i)), next_maintenance: daysAgo(-randInt(30, 90, i)) })),
    AuditLog: Array.from({ length: 10 }, (_, i) => ({ id: id('AuditLog', i), action: pick(['create', 'update', 'delete', 'void', 'price_change', 'payment'], i), entity: pick(['Patient', 'MedicalRecord', 'Prescription', 'Transaction', 'Medicine', 'PurchaseOrder'], i), entity_name: pick(['Budi Hartono', 'Resep R001', 'INV-001', 'Paracetamol 500mg', 'PO-001', 'MedicalRecord MR-001'], i), module: pick(['patients', 'rme', 'prescription', 'finance', 'inventory', 'purchasing'], i), description: `${marker}${pick(['Tambah pasien baru', 'Update diagnosis', 'Hapus resep', 'Void transaksi', 'Ubah harga obat', 'Pembayaran invoice', 'Approval PO', 'Stock adjustment', 'Login user', 'Role change'], i)}`, user_name: pick(['dr. Andini', 'Apoteker Dina', 'Kasir Eko', 'Admin Hadi', 'Owner Lina'], i), user_role: pick(['Dokter', 'Apoteker', 'Kasir', 'Admin', 'Owner'], i), severity: i % 5 === 0 ? 'Warning' : 'Info', timestamp: daysAgoIso(Math.floor(i / 2), 8 + (i % 8)) })),
    Anomaly: Array.from({ length: 11 }, (_, i) => ({ id: id('Anomaly', i), type: i < 6 ? pick(['stock_out_no_transaction', 'procedure_not_billed', 'unpaid_prescription', 'void_after_dispensing', 'price_change', 'cash_mismatch'], i) : pick(['price_below_target', 'price_below_minimum', 'old_stock_high_hpp', 'supplier_price_change_significant', 'invoice_receipt_mismatch'], i - 6), severity: i === 1 || i === 4 || i === 7 || i === 10 ? 'critical' : 'warning', description: `${marker}${i < 6 ? pick(['Stok keluar tanpa transaksi', 'Tindakan tidak ditagih', 'Resep belum dibayar', 'Void setelah dispensing', 'Perubahan harga tidak tercatat', 'Selisih kas'], i) : pick(['Harga jual di bawah target margin 30%', 'Harga jual di bawah Harga Minimum Aman — rugi', 'Stok lama HPP lebih tinggi dari batch baru', 'Harga beli supplier naik >20% dari faktur sebelumnya', 'Total faktur tidak sesuai dengan barang yang diterima'], i - 6)}`, related_entity: pick(['Medicine', 'MedicalRecord', 'Prescription', 'Transaction', 'Medicine', 'CashSession'], i), user_name: pick(['Kasir Eko', 'dr. Andini', 'Apoteker Dina', 'Kasir Eko', 'Apoteker Dina', 'Kasir Fitri'], i), status: i < 3 || i >= 6 ? 'Baru' : 'Dilihat', detected_at: daysAgoIso(Math.floor(i / 2), 10 + i) })),
    PriceHistory: Array.from({ length: 8 }, (_, i) => { const med = medicines[i]; const oldPrice = med.selling_price * 0.9; const hpp = med.purchase_price * 1.11; return { id: id('PriceHistory', i), medicine_id: med.id, medicine_name: `${marker}${med.name}`, old_price: Math.round(oldPrice), new_price: med.selling_price, min_safe_price: Math.round((hpp * 1.1) / 500) * 500, hpp_basis: Math.round(hpp), target_margin: 30, reason: i % 3 === 0 ? 'Penyesuaian dari faktur supplier terbaru' : i % 3 === 1 ? 'Override di bawah minimum — persetujuan owner' : 'Update harga jual rutin', changed_by_name: pick(['Apoteker Dina', 'Owner Lina', 'Admin Hadi'], i), source: pick(['faktur', 'manual', 'override'], i), below_minimum: i % 4 === 0, timestamp: daysAgoIso(Math.floor(i / 2), 9 + i) }; }),
    ClinicSetting: [
      { id: id('ClinicSetting', 0), key: 'hpp_method', label: 'Metode HPP', type: 'select', value: 'Per Batch FEFO', category: 'Penentuan Harga' },
      { id: id('ClinicSetting', 1), key: 'bonus_treatment_default', label: 'Perlakuan Bonus (default)', type: 'select', value: 'Per Faktur', category: 'Penentuan Harga' },
      { id: id('ClinicSetting', 2), key: 'ppn_in_hpp', label: 'PPN masuk dalam HPP', type: 'boolean', value: 'true', category: 'Penentuan Harga' },
      { id: id('ClinicSetting', 3), key: 'default_target_margin', label: 'Target Margin Default (%)', type: 'number', value: '30', category: 'Penentuan Harga' },
      { id: id('ClinicSetting', 4), key: 'price_rounding', label: 'Pembulatan Harga (Rp)', type: 'number', value: '500', category: 'Penentuan Harga' },
      { id: id('ClinicSetting', 5), key: 'override_roles', label: 'Role yang Boleh Override Harga Minimum', type: 'text', value: 'Owner,Admin', category: 'Penentuan Harga' },
    ],
  };

  return data;
}
