import assert from 'node:assert/strict';
import { createServer } from 'vite';

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const results = [];
const check = (condition, message) => {
  assert.ok(condition, message);
  results.push(`PASS ${message}`);
};
const denied = async (operation, message) => {
  let rejected = false;
  try { await operation(); } catch { rejected = true; }
  check(rejected, message);
};

try {
  const { canAccess, hasPermission } = await server.ssrLoadModule('/src/lib/roles.js');
  const { normalizeDemoUser } = await server.ssrLoadModule('/src/lib/demoIdentities.js');
  const { db } = await server.ssrLoadModule('/src/api/localDb.js');

  const migratedDoctor = normalizeDemoUser({
    id: '6ab0d48b645c8099d852de3a',
    email: 'demo.dokterumum@klinikfarma.com',
    full_name: 'dr. Demo Pratama, Sp.GP',
    clinic_role: 'Dokter Umum',
    data: { clinic_role: 'Dokter Umum' },
  });
  check(migratedDoctor.id === 'staff-doctor-1' && migratedDoctor.full_name === 'dr. Andi Pratama', 'Sesi dokter demo lama otomatis dimigrasikan ke identitas dokter seed');

  check(canAccess('/finance', 'Owner') && canAccess('/audit-log', 'Owner'), 'Owner mendapat dashboard strategis, finance, dan audit');
  check(!hasPermission('Owner', 'patients', 'edit') && !canAccess('/doctor', 'Owner') && canAccess('/settings', 'Owner') && canAccess('/master-obat', 'Owner') && !canAccess('/hr', 'Owner'), 'Owner tidak mengerjakan data operasional/RME, tetapi dapat mengelola konfigurasi dan override harga jual');
  check(canAccess('/front-desk', 'Front Office') && !canAccess('/finance', 'Front Office') && !canAccess('/doctor', 'Front Office'), 'Front Office hanya mendapat pendaftaran/antrean tanpa finance dan RME');
  check(canAccess('/nurse/intake', 'Perawat') && !canAccess('/doctor', 'Perawat'), 'Perawat mendapat intake tanpa diagnosis/RME dokter');
  check(canAccess('/kasir', 'Kasir') && !canAccess('/finance', 'Kasir') && !canAccess('/queue', 'Kasir'), 'Kasir hanya mendapat penagihan harian tanpa laporan strategis');
  check(canAccess('/pharmacy', 'Apoteker') && !canAccess('/doctor', 'Apoteker'), 'Apoteker mendapat resep/stok tanpa rekam medis');
  check(canAccess('/pharmacy', 'Apoteker Penanggung Jawab') && canAccess('/inventory', 'Apoteker Penanggung Jawab'), 'APJ mengelola dispensing dan inventori farmasi');
  check(canAccess('/pharmacy', 'Apoteker Pendamping') && !hasPermission('Apoteker Pendamping', 'purchasing', 'create'), 'Apoteker Pendamping membantu dispensing tanpa hak pengadaan');
  check(canAccess('/inventory', 'Admin Farmasi') && !canAccess('/doctor', 'Admin Farmasi'), 'Admin Farmasi mengelola inventori tanpa akses rekam medis');
  check(canAccess('/odontogram', 'Dokter Gigi') && !canAccess('/growth-chart', 'Dokter Gigi'), 'Dokter Gigi mendapat odontogram terpisah');
  check(canAccess('/growth-chart', 'Dokter Spesialis Anak') && !canAccess('/odontogram', 'Dokter Spesialis Anak'), 'Dokter Anak mendapat growth chart dan imunisasi terpisah');
  check(canAccess('/facility', 'Manajer Operasional') && !canAccess('/finance', 'Manajer Operasional') && !canAccess('/doctor', 'Manajer Operasional'), 'Manajer Operasional mendapat fasilitas/SDM tanpa finance dan RME');

  const loginAliases = { manajer: 'opsmanager' };
  const login = async (role) => db.auth.loginViaEmailPassword(`demo.${loginAliases[role] || role}@klinikfarma.com`, 'Demo1234!');

  const seededPatientIds = [
    'patient-seed-general-active', 'patient-seed-general-history',
    'patient-seed-pediatric-active', 'patient-seed-pediatric-history',
    'patient-seed-internal-active', 'patient-seed-internal-history',
    'patient-seed-dental-active', 'patient-seed-dental-history',
    'patient-seed-locum-active', 'patient-seed-locum-history',
  ];
  await login('frontoffice');
  const frontOfficeSeedPatients = (await db.entities.Patient.list()).filter((patient) => seededPatientIds.includes(patient.id));
  check(frontOfficeSeedPatients.length === 10, 'Front Office melihat sepuluh pasien seed dokter sebagai data pasien klinik yang sama');
  check((await db.entities.Appointment.list()).filter((row) => row.id.startsWith('appointment-seed-')).length === 5, 'Janji temu pasien aktif terhubung ke lima dokter');

  await login('perawat');
  const nurseSeedQueues = (await db.entities.QueueEntry.list()).filter((row) => row.id.startsWith('queue-seed-') && row.id.endsWith('-active'));
  check(nurseSeedQueues.length === 5 && nurseSeedQueues.every((row) => row.intake_record_id), 'Perawat melihat intake aktif pasien seed milik setiap dokter');

  await login('dokterumum');
  check(Boolean(await db.entities.Patient.get('patient-seed-general-active')) && Boolean(await db.entities.MedicalRecord.get('medical-record-seed-general-history')), 'Dokter Umum memiliki pasien aktif dan riwayat pasien seed sendiri');
  check(!(await db.entities.Patient.get('patient-seed-dental-active')), 'Dokter Umum tidak melihat pasien Dokter Gigi yang tidak dirujuk kepadanya');

  await login('dokteranak');
  check(Boolean(await db.entities.Patient.get('patient-seed-pediatric-active')) && Boolean(await db.entities.MedicalRecord.get('medical-record-seed-pediatric-history')), 'Dokter Anak memiliki pasien aktif dan riwayat pasien seed sendiri');
  check((await db.entities.FamilyAccount.list()).some((family) => (family.member_patient_ids || []).includes('patient-seed-pediatric-active')), 'Pasien seed Dokter Anak terhubung ke akun orang tua/wali');
  check((await db.entities.GrowthRecord.list()).filter((row) => row.id.startsWith('growth-seed-pediatric-')).length === 2, 'Pasien seed Dokter Anak terhubung ke growth chart dan imunisasi');

  await login('dokterdalam');
  check(Boolean(await db.entities.Patient.get('patient-seed-internal-active')) && Boolean(await db.entities.MedicalRecord.get('medical-record-seed-internal-history')), 'Dokter Penyakit Dalam memiliki pasien aktif dan riwayat pasien seed sendiri');

  await login('doktergigi');
  check(Boolean(await db.entities.Patient.get('patient-seed-dental-active')) && Boolean(await db.entities.MedicalRecord.get('medical-record-seed-dental-history')), 'Dokter Gigi memiliki pasien aktif dan riwayat pasien seed sendiri');
  check((await db.entities.OdontogramRecord.list()).filter((row) => row.id.startsWith('odontogram-seed-dental-')).length === 2, 'Pasien seed Dokter Gigi terhubung ke odontogram dan rencana perawatan bertahap');

  await login('dokterlocum');
  check(Boolean(await db.entities.Patient.get('patient-seed-locum-active')) && Boolean(await db.entities.MedicalRecord.get('medical-record-seed-locum-history')), 'Dokter Locum memiliki pasien aktif dan riwayat pasien seed sendiri');

  await login('apoteker');
  check((await db.entities.Prescription.list()).filter((row) => row.id.startsWith('prescription-seed-')).length === 5, 'Farmasi menerima resep terelasi dari seluruh dokter seed');

  await login('kasir');
  check((await db.entities.Transaction.list()).filter((row) => row.id.startsWith('transaction-seed-')).length === 10, 'Kasir menerima tagihan klinik dan farmasi dari seluruh pasien dokter seed');

  await login('owner');
  const ownerRecords = await db.entities.MedicalRecord.list();
  if (ownerRecords.length) {
    check(!('diagnosis' in ownerRecords[0]) && !('patient_id' in ownerRecords[0]), 'Owner hanya membaca metrik RME yang sudah disanitasi');
  }
  await denied(() => db.entities.Patient.update('patient-local-1', { phone: '0800000000' }), 'Owner ditolak saat mengubah pasien operasional');
  await denied(() => db.entities.Medicine.update('medicine-paracetamol', { selling_price: 1 }), 'Owner tidak dapat mengubah harga jual langsung tanpa fungsi override terlacak');
  const ownerRequestResponse = await db.functions.invoke('submitOwnerChangeRequest', {
    subject: 'Usulan penyesuaian harga layanan vaksin',
    message: 'Mohon Admin meninjau penyesuaian kebijakan harga vaksin untuk periode berikutnya.',
    scope: 'Kebijakan harga',
    priority: 'Penting',
  });
  const ownerRequest = (ownerRequestResponse.data || ownerRequestResponse).request;
  check(ownerRequest?.status === 'Baru' && ownerRequest?.to_role === 'Admin', 'Owner meneruskan permintaan perubahan ke Admin tanpa mengedit data langsung');

  await login('admin');
  const reviewedOwnerRequest = await db.functions.invoke('reviewOwnerChangeRequest', {
    request_id: ownerRequest.id,
    action: 'approve',
    review_notes: 'Disetujui untuk ditindaklanjuti pada master harga oleh Admin.',
  });
  check((reviewedOwnerRequest.data || reviewedOwnerRequest).request?.status === 'Disetujui Admin', 'Admin dapat meninjau dan mencatat keputusan atas permintaan Owner');

  await login('frontoffice');
  await denied(() => db.entities.MedicalRecord.create({ patient_id: 'patient-local-1', diagnosis: 'Tidak sah' }), 'Front Office ditolak menulis rekam medis');
  await denied(() => db.functions.invoke('registerPatient', {
    full_name: 'Anak Tanpa Wali', birth_date: '2020-01-01', gender: 'L',
  }), 'Pasien anak ditolak bila data wali tidak lengkap');
  const childResponse = await db.functions.invoke('registerPatient', {
    full_name: 'Anak Integrasi Role',
    birth_date: '2020-01-01',
    gender: 'P',
    phone: '081290000001',
    guardian_name: 'Ibu Integrasi',
    guardian_relation: 'Ibu',
    guardian_phone: '081290000002',
  });
  const childResult = childResponse.data || childResponse;
  check(Boolean(childResult.patient?.id && childResult.family_account_id), 'Pendaftaran pasien anak otomatis membuat tautan akun keluarga');
  const pediatricSchedule = await db.entities.DoctorSchedule.get('schedule-pediatrician-1');
  check(Boolean(pediatricSchedule), 'Jadwal dokter anak tersedia untuk dipilih Front Office');
  const visitPayload = {
    queue_number: 'A-ROLE-001',
    patient_id: childResult.patient.id,
    patient_name: childResult.patient.full_name,
    visit_type: 'Kunjungan Baru',
    poli: 'Poli Anak',
    doctor_id: 'demo-pediatrician',
    doctor_name: 'dr. Anak Demo, Sp.A',
    schedule_id: pediatricSchedule.id,
    complaint: 'Demam dua hari',
    visit_date: new Date().toISOString().slice(0, 10),
  };
  const visitResponse = await db.functions.invoke('registerVisit', visitPayload);
  const queue = (visitResponse.data || visitResponse).queue;
  const repeatedVisit = await db.functions.invoke('registerVisit', visitPayload);
  const repeatedVisitData = repeatedVisit.data || repeatedVisit;
  check(repeatedVisitData.duplicate_prevented === true && repeatedVisitData.queue?.id === queue.id, 'Klik ulang registrasi tidak membuat Visit atau antrean ganda');
  await db.functions.invoke('callVisit', { queue_entry_id: queue.id });
  await db.functions.invoke('confirmVisitArrival', { queue_entry_id: queue.id });
  check((await db.entities.QueueEntry.get(queue.id)).status === 'Menunggu Intake', 'Front Office menyerahkan pasien yang hadir ke intake perawat');

  await login('perawat');
  await denied(() => db.entities.ClinicalRecord.create({ patient_id: childResult.patient.id, diagnosis: 'Tidak sah' }), 'Perawat ditolak menulis diagnosis melalui API generik');
  await db.functions.invoke('saveIntake', {
    queue_entry_id: queue.id,
    complaint: 'Demam dua hari',
    allergy: 'Amoxicillin',
    allergy_verified: true,
    sterile_equipment_ready: true,
    room_ready: true,
    vital_signs_temp: 38.1,
    vital_signs_weight: 20,
    vital_signs_height: 112,
  });
  check((await db.entities.QueueEntry.get(queue.id)).status === 'Siap Dokter', 'Perawat hanya menambahkan intake dan meneruskan pasien ke dokter');

  await login('dokteranak');
  const assignedPatient = await db.entities.Patient.get(childResult.patient.id);
  const prescribedMedicine = await db.entities.Medicine.get('medicine-amoxicillin');
  check(Boolean(assignedPatient), 'Dokter Anak hanya dapat membuka pasien yang ditugaskan');
  check(Boolean(prescribedMedicine?.stock_on_hand > 0), 'Obat seed tersedia untuk menguji jalur resep sampai pembayaran');
  const growth = await db.entities.GrowthRecord.create({
    patient_id: childResult.patient.id,
    patient_name: childResult.patient.full_name,
    visit_date: new Date().toISOString().slice(0, 10),
    age_months: 81,
    gender: 'P',
    weight: 20,
    height: 112,
    doctor_id: 'demo-pediatrician',
    doctor_name: 'dr. Anak Demo, Sp.A',
  });
  check(Boolean(growth.id), 'Growth chart tersimpan pada ID pasien yang juga terhubung ke akun wali');
  await db.functions.invoke('acceptVisit', { queue_entry_id: queue.id, doctor_id: 'demo-pediatrician', doctor_name: 'dr. Anak Demo, Sp.A' });
  const allergyPrescriptionRecord = {
    patient_id: childResult.patient.id,
    patient_name: childResult.patient.full_name,
    diagnosis: 'Febris observasi',
    diagnosis_code: 'R50.9',
    chief_complaint: 'Demam dua hari',
    physical_exam: 'Suhu meningkat',
    treatment_plan: 'Observasi dan evaluasi gigi',
    patient_education: 'Cukup istirahat dan minum sesuai anjuran dokter.',
    follow_up_date: '2026-10-28',
    follow_up_instructions: 'Kontrol bila demam belum membaik atau sesuai jadwal.',
    procedures: [],
    prescriptionText: 'R/ Amoxicillin 500 mg no. II\nS TDD PC TAB 1\nne iter',
    prescriptionConfirmed: true,
    prescriptionConfirmedAt: new Date().toISOString(),
    internal_referral: {
      target_doctor_id: 'demo-dentist',
      target_doctor_name: 'drg. Demo',
      reason: 'Evaluasi fokus infeksi gigi',
      clinical_summary: 'Keluhan demam disertai nyeri gigi.',
    },
    administrative_documents: {
      prescription_print: { approved: true },
      sick_leave: { approved: true, start_date: '2026-10-21', end_date: '2026-10-22', notes: 'Istirahat dan kontrol bila keluhan berlanjut.' },
      external_referral: { approved: true, destination: 'Poli Anak RS Uji', reason: 'Perlu evaluasi lanjutan', summary: 'Riwayat demam dua hari dan nyeri gigi.' },
      medical_summary: { approved: true },
      instructions: { approved: true },
      control_card: { approved: true },
    },
  };
  const medicalRecordsBeforeRejectedAllergy = (await db.entities.MedicalRecord.filter({ encounter_id: queue.visit_id || queue.encounter_id })).length;
  await denied(
    () => db.functions.invoke('completeExam', { queue_entry_id: queue.id, record: allergyPrescriptionRecord }),
    'Resep dengan alergi Amoxicillin ditolak sebelum dokter memberi alasan dan konfirmasi',
  );
  check(
    (await db.entities.MedicalRecord.filter({ encounter_id: queue.visit_id || queue.encounter_id })).length === medicalRecordsBeforeRejectedAllergy,
    'Penolakan alergi tidak meninggalkan rekam medis atau kunjungan setengah tersimpan',
  );
  const examResponse = await db.functions.invoke('completeExam', {
    queue_entry_id: queue.id,
    record: {
      ...allergyPrescriptionRecord,
      prescriptionAllergyAcknowledged: true,
      prescriptionAllergyOverrideReason: 'Alergi telah diverifikasi; dokter menetapkan terapi setelah pertimbangan klinis.',
    },
  });
  const exam = examResponse.data || examResponse;
  check(Boolean(exam.medical_record_id && exam.internal_referral_id && exam.prescription_id && exam.transaction_id), 'Pemeriksaan menghasilkan RME, rujukan beralasan, resep, dan tagihan otomatis');
  const allergyPrescription = await db.entities.Prescription.get(exam.prescription_id);
  check(allergyPrescription.allergy_warnings?.length === 1 && Boolean(allergyPrescription.allergy_override_reason), 'Resep tersimpan bersama peringatan alergi dan alasan klinis dokter');

  await login('frontoffice');
  check((await db.entities.MedicalRecord.list()).length === 0, 'Front Office tetap tidak dapat menelusuri rekam medis pasien');
  const approvedDocumentQueue = (await db.functions.invoke('listFrontOfficeApprovedDocuments')).data;
  const childApprovedDocuments = approvedDocumentQueue.documents.filter((item) => item.patient_id === childResult.patient.id);
  check(childApprovedDocuments.length === 6 && childApprovedDocuments.every((item) => item.medical_record_id && item.visit_id && !Object.hasOwn(item, 'diagnosis')), 'Front Office menerima antrean enam dokumen yang disetujui sebagai metadata tanpa isi RME');
  const queuedSickLetter = childApprovedDocuments.find((item) => item.document_type === 'sick_letter');
  const queuedSickLetterData = (await db.functions.invoke('getFrontOfficeDocumentData', { patient_id: childResult.patient.id, medical_record_id: queuedSickLetter.medical_record_id, type: queuedSickLetter.document_type })).data;
  check(queuedSickLetterData.medical_record?.id === queuedSickLetter.medical_record_id, 'Front Office membuka dokumen dari antrean dengan verifikasi ulang pada Visit/RME yang sama');
  const sickLetterResponse = await db.functions.invoke('getFrontOfficeDocumentData', { patient_id: childResult.patient.id, type: 'sick_letter' });
  const sickLetter = sickLetterResponse.data || sickLetterResponse;
  check(sickLetter.medical_record?.administrative_documents?.sick_leave?.approved && sickLetter.medical_record?.doctor_name, 'Front Office hanya menerima payload cetak surat istirahat yang sudah disetujui dokter');
  const referralLetterResponse = await db.functions.invoke('getFrontOfficeDocumentData', { patient_id: childResult.patient.id, type: 'external_referral' });
  const referralLetter = referralLetterResponse.data || referralLetterResponse;
  check(referralLetter.medical_record?.administrative_documents?.external_referral?.destination === 'Poli Anak RS Uji', 'Surat rujukan Front Office memakai tujuan yang disetujui dokter pada Visit yang sama');
  const prescriptionDocument = (await db.functions.invoke('getFrontOfficeDocumentData', { patient_id: childResult.patient.id, type: 'prescription' })).data;
  check(Boolean(prescriptionDocument?.medical_record?.prescription?.original_text), 'Front Office hanya menerima salinan resep yang telah disetujui dokter pada Visit yang sama');
  const medicalSummaryDocument = (await db.functions.invoke('getFrontOfficeDocumentData', { patient_id: childResult.patient.id, type: 'medical_summary' })).data;
  check(medicalSummaryDocument?.medical_record?.diagnosis === 'Febris observasi' && medicalSummaryDocument.medical_record?.chief_complaint === 'Demam dua hari', 'Resume medis hanya tersedia sebagai payload cetak setelah persetujuan dokter');
  const instructionsDocument = (await db.functions.invoke('getFrontOfficeDocumentData', { patient_id: childResult.patient.id, type: 'instructions' })).data;
  check(Boolean(instructionsDocument?.medical_record?.patient_education), 'Instruksi atau anjuran hanya tersedia setelah persetujuan dokter');
  const controlCardDocument = (await db.functions.invoke('getFrontOfficeDocumentData', { patient_id: childResult.patient.id, type: 'control_card' })).data;
  check(controlCardDocument?.medical_record?.follow_up_date === '2026-10-28', 'Kartu kontrol memakai jadwal kontrol yang disetujui dokter pada Visit yang sama');
  const envelopeResponse = await db.functions.invoke('getFrontOfficeDocumentData', { patient_id: childResult.patient.id, type: 'envelope' });
  check(!(envelopeResponse.data || envelopeResponse).medical_record, 'Amplop Front Office tidak meminta data rekam medis');
  await denied(() => db.functions.invoke('getFrontOfficeDocumentData', { patient_id: 'patient-local-1', type: 'sick_letter' }), 'Front Office tidak dapat mencetak surat sakit tanpa persetujuan dokter');

  await login('doktergigi');
  const referredRecord = await db.entities.MedicalRecord.get(exam.medical_record_id);
  check(referredRecord?.diagnosis === 'Febris observasi', 'Dokter tujuan dapat membaca RME dokter lain hanya melalui rujukan internal');
  const odontogram = await db.entities.OdontogramRecord.create({
    patient_id: childResult.patient.id,
    patient_name: childResult.patient.full_name,
    tooth_number: '75',
    condition: 'Karies',
    doctor_id: 'demo-dentist',
    doctor_name: 'drg. Demo',
  });
  check(Boolean(odontogram.id), 'Dokter Gigi mencatat odontogram terpisah dengan ID pasien yang sama');
  await denied(() => db.entities.DoctorProfile.update('doctor-profile-pediatrician', { phone: '0800' }), 'Dokter ditolak mengubah profil dokter lain');

  await login('apoteker');
  const prescription = await db.entities.Prescription.get(exam.prescription_id);
  if (prescription.items?.length) {
    const changedItems = prescription.items.map((item, index) => index === 0 ? { ...item, quantity: Number(item.quantity || 1) + 1 } : item);
    await denied(() => db.entities.Prescription.update(prescription.id, { items: changedItems }), 'Apoteker ditolak mengubah isi resep dokter');
  }
  check((await db.entities.MedicalRecord.list()).length === 0, 'Apoteker tidak dapat membaca rekam medis di luar resep');
  const pharmacyInvoice = await db.entities.Transaction.create({
    invoice_number: `FARMASI-ROLE-${Date.now()}`,
    type: 'Resep',
    cash_point: 'farmasi',
    invoice_status: 'POSTED',
    payment_status: 'Belum Bayar',
    encounter_id: queue.visit_id || queue.encounter_id,
    visit_id: queue.visit_id || queue.encounter_id,
    queue_entry_id: queue.id,
    prescription_id: prescription.id,
    patient_id: childResult.patient.id,
    patient_name: childResult.patient.full_name,
    items: [{ medicine_id: prescribedMedicine.id, medicine_name: prescribedMedicine.name, quantity: 2, price: prescribedMedicine.selling_price, subtotal: prescribedMedicine.selling_price * 2 }],
    subtotal: prescribedMedicine.selling_price * 2,
    total: prescribedMedicine.selling_price * 2,
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  await db.entities.Prescription.update(prescription.id, { status: 'Selesai Dispensing', workflow_status: 'DISPENSED', transaction_id: pharmacyInvoice.id, dispensed_at: new Date().toISOString() });
  const prescriptionOrders = await db.entities.Order.filter({ source_id: prescription.id });
  for (const order of prescriptionOrders) await db.entities.Order.update(order.id, { status: 'DISPENSED', completed_at: new Date().toISOString() });
  await db.functions.invoke('refreshEncounterClosure', { queue_entry_id: queue.id, prescription_id: prescription.id, pharmacy_transaction_id: pharmacyInvoice.id });
  const readyForCashier = await db.entities.QueueEntry.get(queue.id);
  check(readyForCashier.status === 'Kasir' && (await db.entities.Visit.get(queue.visit_id || queue.encounter_id)).status === 'READY_TO_CLOSE', 'Farmasi menyelesaikan dispensing dan mengirim tagihan resep belum bayar ke Kasir');

  await login('kasir');
  await denied(() => db.entities.Transaction.create({ total: 1, patient_id: childResult.patient.id }), 'Kasir ditolak membuat tagihan/harga manual');
  const clinicInvoice = await db.entities.Transaction.get(exam.transaction_id);
  await denied(() => db.entities.Transaction.update(clinicInvoice.id, { total: 1 }), 'Kasir ditolak mengubah total dari master/tindakan dokter');
  const visitInvoices = await db.entities.Transaction.filter({ visit_id: queue.visit_id || queue.encounter_id });
  for (const invoice of visitInvoices) {
    await db.entities.Transaction.update(invoice.id, { invoice_status: 'PAID', payment_status: 'Lunas', payment_method: 'Tunai', paid_amount: invoice.total, paid_at: new Date().toISOString() });
  }
  const finalClosure = await db.functions.invoke('refreshEncounterClosure', { queue_entry_id: queue.id });
  const finalQueue = (finalClosure.data || finalClosure).queue;
  check(finalQueue.status === 'Selesai' && (await db.entities.Visit.get(queue.visit_id || queue.encounter_id)).status === 'CLOSED', 'Kasir melunasi tagihan klinik dan farmasi lalu sistem menutup kunjungan');
  const repeatedClosure = await db.functions.invoke('refreshEncounterClosure', { queue_entry_id: queue.id });
  check((repeatedClosure.data || repeatedClosure).already_closed === true, 'Refresh atau retry penutupan tidak mengubah Visit Closed menjadi transaksi baru');

  await login('manajer');
  const staff = await db.entities.Staff.list();
  check(staff.every((row) => !('salary' in row) && !('remuneration_nominal' in row)), 'Manajer Operasional tidak melihat gaji atau jasa dokter');
  await denied(() => db.entities.Staff.update(staff[0].id, { salary: 999999999 }), 'Manajer Operasional ditolak mengubah gaji');
  check((await db.entities.MedicalRecord.list()).length === 0, 'Manajer Operasional tidak dapat membaca rekam medis pasien');

  // UAT frontend/localStorage: retur supplier, sumber batch, approval APJ,
  // pengurangan stok, tugas Finance, dan jejak audit memakai data yang sama.
  await login('apoteker');
  const returnMedicine = await db.entities.Medicine.get('medicine-paracetamol');
  const returnMedicineStockBefore = Number(returnMedicine.stock_on_hand || 0);
  const returnInvoice = await db.entities.SupplierInvoice.create({
    invoice_number: `UAT-FK-${Date.now()}`, supplier_id: 'supplier-local-1', supplier_name: 'PT Sehat Sentosa',
    invoice_date: new Date().toISOString().slice(0, 10), status: 'Diterima', total_amount: 12000,
    items: [{ medicine_id: returnMedicine.id, medicine_name: returnMedicine.name, quantity: 12, unit_price: 1000, subtotal: 12000 }],
  });
  const returnBatch = await db.entities.StockBatch.create({
    medicine_id: returnMedicine.id, medicine_name: returnMedicine.name, invoice_id: returnInvoice.id,
    invoice_number: returnInvoice.invoice_number, batch_number: `UAT-BATCH-${Date.now()}`, quantity: 12,
    initial_quantity: 12, cost_per_unit: 1000, status: 'Aktif', expiry_date: '2027-12-31',
  });
  const returnCreated = (await db.functions.invoke('createSupplierReturn', {
    invoice_id: returnInvoice.id, reason: 'UAT barang rusak saat penerimaan', notes: 'Uji lintas-role lokal',
    items: [{ batch_id: returnBatch.id, return_quantity: 2 }],
  })).data?.supplier_return;
  check(returnCreated?.status === 'Menunggu Approval' && returnCreated.items?.[0]?.batch_id === returnBatch.id, 'Apoteker mengajukan retur dengan tautan faktur dan batch sumber yang benar');

  await login('apj');
  const returnApproved = (await db.functions.invoke('approveSupplierReturn', { return_id: returnCreated.id, action: 'approve', notes: 'Batch dan alasan valid.' })).data?.supplier_return;
  check(returnApproved?.status === 'Disetujui' && returnApproved.approved_by_id, 'APJ menyetujui retur dan keputusan tersimpan');

  await login('apoteker');
  const returnProcessed = (await db.functions.invoke('processSupplierReturn', { return_id: returnCreated.id })).data?.supplier_return;
  const processedBatch = await db.entities.StockBatch.get(returnBatch.id);
  const processedMedicine = await db.entities.Medicine.get(returnMedicine.id);
  const processedInvoice = await db.entities.SupplierInvoice.get(returnInvoice.id);
  const returnMovements = await db.entities.StockMovement.filter({ reference_id: returnCreated.id });
  check(returnProcessed?.status === 'Menunggu Nota Kredit' && processedBatch.quantity === 10 && processedMedicine.stock_on_hand === returnMedicineStockBefore - 2 && processedInvoice.return_status === 'Retur Diproses' && returnMovements.length === 1, 'Retur yang disetujui mengurangi batch dan stok satu kali serta masuk antrean nota kredit Finance');

  await login('finance');
  check(Boolean(await db.entities.SupplierReturn.get(returnCreated.id)) && (await db.entities.Notification.list()).some((row) => row.related_id === returnCreated.id), 'Finance menerima data retur dan notifikasi tindak lanjut nota kredit');
  await denied(() => db.functions.invoke('processSupplierReturn', { return_id: returnCreated.id }), 'Finance tidak dapat memproses retur yang merupakan kewenangan farmasi');
  const creditResult = (await db.functions.invoke('recordSupplierCreditNote', {
    return_id: returnCreated.id,
    credit_note_number: `CN-UAT-${Date.now()}`,
    credit_note_date: new Date().toISOString().slice(0, 10),
    amount: returnCreated.total_amount,
    settlement_method: 'Potong Utang Berjalan',
    notes: 'UAT nota kredit supplier',
  })).data;
  check(creditResult.supplier_return.status === 'Nota Kredit Diterima' && creditResult.invoice.credit_note_amount === returnCreated.total_amount, 'Finance mencatat nota kredit dan nilai bersih faktur diperbarui');
  const reconciled = (await db.functions.invoke('reconcileSupplierReturn', {
    return_id: returnCreated.id,
    reconciliation_reference: `JRN-UAT-${Date.now()}`,
    notes: 'UAT rekonsiliasi utang',
  })).data?.supplier_return;
  check(reconciled.status === 'Direkonsiliasi', 'Finance merekonsiliasi nota kredit terhadap faktur/utang');
  const closedReturn = (await db.functions.invoke('closeSupplierReturn', { return_id: returnCreated.id, notes: 'UAT selesai' })).data?.supplier_return;
  check(closedReturn.status === 'Selesai' && closedReturn.status_history.at(-1).status === 'Selesai', 'Finance menutup retur setelah rekonsiliasi dan timeline tersimpan lengkap');

  await login('owner');
  const priceBeforeOwner = (await db.entities.Medicine.get(returnMedicine.id)).selling_price;
  await db.functions.invoke('changeSellingPrice', { medicine_id: returnMedicine.id, new_price: priceBeforeOwner + 100, reason: 'UAT override Owner' });
  const ownerPriceHistory = (await db.entities.PriceHistory.filter({ medicine_id: returnMedicine.id })).at(-1);
  check(ownerPriceHistory?.authority === 'Owner override' && ownerPriceHistory.new_price === priceBeforeOwner + 100, 'Owner memakai satu jalur override harga yang menyimpan histori dan otoritas');

  const targetRole = await db.entities.Role.get('role-pharmacy-admin');
  const originalMembers = targetRole.user_ids || [];
  await db.functions.invoke('syncRoleAssignments', { role_id: targetRole.id, user_ids: [...originalMembers, 'demo-ttk'] });
  const syncedTtk = await db.entities.User.get('demo-ttk');
  const rolesAfterAssignment = await db.entities.Role.list();
  check(syncedTtk.clinic_role === 'Admin Farmasi' && rolesAfterAssignment.filter((role) => (role.user_ids || []).includes('demo-ttk')).length === 1, 'Jabatan & Hak Akses menyinkronkan User.clinic_role dan keanggotaan Role tanpa duplikasi');
  await db.auth.loginViaEmailPassword('demo.ttk@klinikfarma.com', 'Demo1234!');
  check((await db.auth.me()).clinic_role === 'Admin Farmasi', 'Login ulang membaca User.clinic_role terbaru, bukan role statis kartu demo');
  await login('owner');
  await db.functions.invoke('syncRoleAssignments', { role_id: targetRole.id, user_ids: originalMembers });
  await db.functions.invoke('syncRoleAssignments', { role_id: 'role-pharmacy-assistant', user_ids: ['demo-ttk'] });

  await login('admin');
  const priceBeforeAdmin = (await db.entities.Medicine.get(returnMedicine.id)).selling_price;
  await db.functions.invoke('changeSellingPrice', { medicine_id: returnMedicine.id, new_price: priceBeforeAdmin + 100, reason: 'UAT kebijakan Admin' });
  const adminPriceHistory = (await db.entities.PriceHistory.filter({ medicine_id: returnMedicine.id })).at(-1);
  check(adminPriceHistory?.authority === 'Admin price management' && adminPriceHistory.new_price === priceBeforeAdmin + 100, 'Admin memakai kebijakan override harga yang sama dengan Owner');

  await db.auth.loginViaEmailPassword('demo.finance@klinikfarma.com', 'Demo1234!');
  check((await db.auth.me()).clinic_role === 'Finance', 'Akun demo Finance tersedia untuk UAT');
  await db.auth.loginViaEmailPassword('demo.ttk@klinikfarma.com', 'Demo1234!');
  check((await db.auth.me()).clinic_role === 'TTK/Asisten Farmasi', 'Akun demo TTK/Asisten Farmasi tersedia untuk UAT');
  await db.auth.loginViaEmailPassword('demo.asistendokter@klinikfarma.com', 'Demo1234!');
  check((await db.auth.me()).clinic_role === 'Asisten Dokter', 'Akun demo Asisten Dokter tersedia untuk UAT');
  await db.auth.loginViaEmailPassword('demo.pasien@klinikfarma.com', 'Demo1234!');
  check((await db.auth.me()).clinic_role === 'Pasien', 'Akun demo Pasien tersedia untuk UAT');

  await denied(() => db.functions.invoke('fungsiYangSalahNama', {}), 'Nama fungsi lokal yang tidak dikenali menghasilkan error eksplisit');

  await login('owner');
  const deniedEvents = (await db.entities.AuditLog.list()).filter((entry) => String(entry.action).startsWith('denied_'));
  check(deniedEvents.length >= 7, 'Percobaan akses terlarang di seluruh modul tercatat pada audit trail');

  console.log(results.join('\n'));
  console.log(`\n${results.length} pemeriksaan integrasi role berhasil.`);
} finally {
  await server.close();
}
