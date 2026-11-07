// Deterministic cross-role demo data. Every patient is a single shared record
// referenced by Front Office, Nurse, the assigned Doctor, Pharmacy, Cashier,
// Owner reports, and the specialty module where applicable.

const BRANCH_ID = 'main-clinic';

const dateMinus = (date, days) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};

const at = (date, time) => `${date}T${time}:00.000Z`;

const doctorSeeds = [
  {
    key: 'general',
    prefix: 'U',
    doctor_id: 'staff-doctor-1',
    doctor_name: 'dr. Andi Pratama',
    poli: 'Poli Umum',
    active: {
      patient_id: 'patient-seed-general-active',
      full_name: 'Raka Pratama',
      mr_number: 'RM-SEED-U-001',
      birth_date: '1992-04-18',
      gender: 'L',
      phone: '081311110101',
      complaint: 'Demam, batuk, dan nyeri tenggorokan sejak dua hari',
      allergy: 'Tidak ada',
    },
    history: {
      patient_id: 'patient-seed-general-history',
      full_name: 'Maya Anindita',
      mr_number: 'RM-SEED-U-002',
      birth_date: '1988-09-23',
      gender: 'P',
      phone: '081311110102',
      complaint: 'Nyeri ulu hati setelah makan',
      diagnosis: 'Dispepsia',
      diagnosis_code: 'K30',
      procedure: 'Pemeriksaan Umum',
      procedure_code: 'TND-001',
      procedure_fee: 50000,
      treatment_plan: 'Modifikasi pola makan dan terapi simptomatik',
      medicine_id: 'medicine-remote-6',
      medicine_name: 'Omeprazole 20mg',
      dosage: '1x1 kapsul',
      quantity: 10,
      medicine_price: 6000,
    },
  },
  {
    key: 'pediatric',
    prefix: 'A',
    doctor_id: 'demo-pediatrician',
    doctor_name: 'dr. Anak Demo, Sp.A',
    poli: 'Poli Anak',
    active: {
      patient_id: 'patient-seed-pediatric-active',
      full_name: 'Alya Putri Ramadhani',
      mr_number: 'RM-SEED-A-001',
      birth_date: '2019-06-12',
      gender: 'P',
      phone: '081322220101',
      complaint: 'Demam ringan dan nafsu makan berkurang',
      allergy: 'Alergi udang',
      guardian_name: 'Nadia Ramadhani',
      guardian_relation: 'Ibu',
      guardian_phone: '081322229901',
    },
    history: {
      patient_id: 'patient-seed-pediatric-history',
      full_name: 'Naufal Akbar',
      mr_number: 'RM-SEED-A-002',
      birth_date: '2022-02-03',
      gender: 'L',
      phone: '081322220102',
      complaint: 'Batuk pilek tanpa sesak',
      diagnosis: 'Nasofaringitis akut',
      diagnosis_code: 'J00',
      procedure: 'Konsultasi Anak',
      procedure_code: 'TND-ANAK-001',
      procedure_fee: 60000,
      treatment_plan: 'Terapi simptomatik dan pemantauan suhu',
      medicine_id: 'medicine-paracetamol',
      medicine_name: 'Paracetamol 500 mg',
      dosage: '3x1/2 tablet',
      quantity: 10,
      medicine_price: 500,
      guardian_name: 'Siti Akbar',
      guardian_relation: 'Ibu',
      guardian_phone: '081322229902',
    },
  },
  {
    key: 'internal',
    prefix: 'PD',
    doctor_id: 'demo-internist',
    doctor_name: 'dr. Nabila Putri, Sp.PD',
    poli: 'Poli Penyakit Dalam',
    active: {
      patient_id: 'patient-seed-internal-active',
      full_name: 'Surya Kurniawan',
      mr_number: 'RM-SEED-PD-001',
      birth_date: '1975-03-14',
      gender: 'L',
      phone: '081344440101',
      complaint: 'Gula darah sering tinggi dan cepat lelah',
      allergy: 'Alergi sulfonamida',
    },
    history: {
      patient_id: 'patient-seed-internal-history',
      full_name: 'Ratna Kusumawati',
      mr_number: 'RM-SEED-PD-002',
      birth_date: '1968-12-08',
      gender: 'P',
      phone: '081344440102',
      complaint: 'Kontrol tekanan darah tinggi',
      diagnosis: 'Hipertensi esensial',
      diagnosis_code: 'I10',
      procedure: 'Konsultasi Penyakit Dalam',
      procedure_code: 'TND-PD-001',
      procedure_fee: 150000,
      treatment_plan: 'Monitoring tekanan darah dan evaluasi terapi rutin',
      medicine_id: 'medicine-paracetamol',
      medicine_name: 'Paracetamol 500 mg',
      dosage: '3x1 tablet bila nyeri',
      quantity: 6,
      medicine_price: 500,
    },
  },
  {
    key: 'dental',
    prefix: 'G',
    doctor_id: 'demo-dentist',
    doctor_name: 'drg. Demo',
    poli: 'Poli Gigi',
    active: {
      patient_id: 'patient-seed-dental-active',
      full_name: 'Dimas Saputra',
      mr_number: 'RM-SEED-G-001',
      birth_date: '1996-11-07',
      gender: 'L',
      phone: '081333330101',
      complaint: 'Gigi geraham kanan bawah berlubang dan nyeri',
      allergy: 'Tidak ada',
    },
    history: {
      patient_id: 'patient-seed-dental-history',
      full_name: 'Larasati Dewi',
      mr_number: 'RM-SEED-G-002',
      birth_date: '1990-01-19',
      gender: 'P',
      phone: '081333330102',
      complaint: 'Karang gigi dan gusi mudah berdarah',
      diagnosis: 'Gingivitis kronis',
      diagnosis_code: 'K05.1',
      procedure: 'Scaling Gigi',
      procedure_code: 'TND-GIGI-001',
      procedure_fee: 250000,
      treatment_plan: 'Scaling tahap pertama dan kontrol periodontal',
      medicine_id: 'medicine-paracetamol',
      medicine_name: 'Paracetamol 500 mg',
      dosage: '3x1 tablet bila nyeri',
      quantity: 6,
      medicine_price: 500,
    },
  },
  {
    key: 'locum',
    prefix: 'L',
    doctor_id: 'demo-locum',
    doctor_name: 'dr. Rizky Mahendra',
    poli: 'Poli Umum Sore',
    active: {
      patient_id: 'patient-seed-locum-active',
      full_name: 'Fajar Nugraha',
      mr_number: 'RM-SEED-L-001',
      birth_date: '2001-07-21',
      gender: 'L',
      phone: '081355550101',
      complaint: 'Pusing dan badan terasa lemas sejak pagi',
      allergy: 'Tidak ada',
    },
    history: {
      patient_id: 'patient-seed-locum-history',
      full_name: 'Indah Permatasari',
      mr_number: 'RM-SEED-L-002',
      birth_date: '1994-05-30',
      gender: 'P',
      phone: '081355550102',
      complaint: 'Batuk pilek selama tiga hari',
      diagnosis: 'Infeksi saluran napas atas akut',
      diagnosis_code: 'J06.9',
      procedure: 'Pemeriksaan Dokter Locum',
      procedure_code: 'TND-L-001',
      procedure_fee: 50000,
      treatment_plan: 'Terapi simptomatik, hidrasi, dan istirahat cukup',
      medicine_id: 'medicine-paracetamol',
      medicine_name: 'Paracetamol 500 mg',
      dosage: '3x1 tablet sesudah makan',
      quantity: 10,
      medicine_price: 500,
    },
  },
];

export function buildDoctorPatientSeed({ today }) {
  const historyDate = dateMinus(today, 3);
  const result = {
    Patient: [], QueueEntry: [], Visit: [], Appointment: [], ClinicalRecord: [],
    MedicalRecord: [], Prescription: [], Order: [], Transaction: [],
    FamilyAccount: [], GrowthRecord: [], ImmunizationRecord: [],
    OdontogramRecord: [], TreatmentPlan: [], Notification: [], AuditLog: [],
  };

  for (const [doctorIndex, doctor] of doctorSeeds.entries()) {
    const activeHour = String(8 + doctorIndex).padStart(2, '0');
    const activeQueueId = `queue-seed-${doctor.key}-active`;
    const activeVisitId = `visit-seed-${doctor.key}-active`;
    const activeIntakeId = `clinical-seed-${doctor.key}-active`;
    const activeAppointmentId = `appointment-seed-${doctor.key}-active`;
    const historyQueueId = `queue-seed-${doctor.key}-history`;
    const historyVisitId = `visit-seed-${doctor.key}-history`;
    const historyIntakeId = `clinical-seed-${doctor.key}-history`;
    const medicalRecordId = `medical-record-seed-${doctor.key}-history`;
    const prescriptionId = `prescription-seed-${doctor.key}-history`;
    const clinicInvoiceId = `transaction-seed-${doctor.key}-clinic`;
    const pharmacyInvoiceId = `transaction-seed-${doctor.key}-pharmacy`;
    const activeNumber = `${doctor.prefix}-90${doctorIndex * 2 + 1}`;
    const historyNumber = `${doctor.prefix}-90${doctorIndex * 2 + 2}`;

    for (const patient of [doctor.active, doctor.history]) {
      result.Patient.push({
        id: patient.patient_id,
        mr_number: patient.mr_number,
        full_name: patient.full_name,
        nik: `327301${doctorIndex + 1}0${patient === doctor.active ? '01' : '02'}90000${doctorIndex + 1}`,
        birth_date: patient.birth_date,
        gender: patient.gender,
        phone: patient.phone,
        email: '',
        address: 'Bandung, Jawa Barat',
        blood_type: ['O', 'A', 'B', 'AB'][doctorIndex % 4],
        allergies: patient.allergy || 'Tidak ada',
        insurance_type: patient === doctor.active ? 'BPJS' : 'Umum',
        bpjs_number: patient === doctor.active ? `000-SEED-${doctor.prefix}-001` : '',
        guardian_name: patient.guardian_name || '',
        guardian_relation: patient.guardian_relation || '',
        guardian_phone: patient.guardian_phone || '',
        branch_id: BRANCH_ID,
        seed_owner_doctor_id: doctor.doctor_id,
        seed_owner_doctor_name: doctor.doctor_name,
      });
    }

    result.Appointment.push({
      id: activeAppointmentId,
      patient_id: doctor.active.patient_id,
      patient_name: doctor.active.full_name,
      doctor_id: doctor.doctor_id,
      doctor_name: doctor.doctor_name,
      appointment_date: today,
      time_slot: `${String(9 + doctorIndex).padStart(2, '0')}:00`,
      poli: doctor.poli,
      status: 'Hadir',
      notes: doctor.active.complaint,
      source: 'Telepon',
      queue_entry_id: activeQueueId,
      visit_id: activeVisitId,
      encounter_id: activeVisitId,
      checked_in_at: at(today, `${activeHour}:30`),
    });

    result.QueueEntry.push(
      {
        id: activeQueueId, queue_number: activeNumber,
        patient_id: doctor.active.patient_id, patient_name: doctor.active.full_name,
        visit_type: doctor.key === 'dental' ? 'Pemeriksaan Gigi' : 'Poliklinik',
        status: 'Siap Dokter', workflow_status: 'INTAKE_DONE', loket: doctor.poli,
        doctor_id: doctor.doctor_id, doctor_name: doctor.doctor_name,
        schedule_id: `schedule-${doctor.key === 'general' ? 'doctor' : doctor.key === 'pediatric' ? 'pediatrician' : 'dentist'}-1`,
        appointment_id: activeAppointmentId, complaint: doctor.active.complaint,
        priority: doctor.key === 'pediatric', channel: 'telepon', payer_type: 'BPJS',
        handoff_to: doctor.doctor_name, check_in_time: at(today, `${activeHour}:30`),
        arrived_at: at(today, `${activeHour}:35`), intake_record_id: activeIntakeId,
        vital_signs_recorded_by: 'Perawat Demo', vital_signs_recorded_at: at(today, `${activeHour}:45`),
        vital_signs_bp: doctor.key === 'pediatric' ? '100/65' : '120/80',
        vital_signs_temp: doctor.key === 'pediatric' ? 37.8 : 36.8,
        vital_signs_pulse: doctor.key === 'pediatric' ? 96 : 78,
        vital_signs_rr: doctor.key === 'pediatric' ? 22 : 18,
        vital_signs_weight: doctor.key === 'pediatric' ? 21.4 : 62,
        vital_signs_height: doctor.key === 'pediatric' ? 118 : 168,
        visit_date: today, encounter_id: activeVisitId, visit_id: activeVisitId,
        branch_id: BRANCH_ID, created_date: at(today, `${activeHour}:30`),
      },
      {
        id: historyQueueId, queue_number: historyNumber,
        patient_id: doctor.history.patient_id, patient_name: doctor.history.full_name,
        visit_type: doctor.key === 'dental' ? 'Tindakan Gigi' : 'Kontrol',
        status: 'Kasir', workflow_status: 'READY_TO_CLOSE', loket: doctor.poli,
        doctor_id: doctor.doctor_id, doctor_name: doctor.doctor_name,
        complaint: doctor.history.complaint, priority: false, channel: 'walk-in', payer_type: 'Umum',
        handoff_to: 'Kasir', check_in_time: at(historyDate, '08:15'),
        intake_record_id: historyIntakeId, prescription_id: prescriptionId,
        clinical_invoice_id: clinicInvoiceId, pharmacy_transaction_id: pharmacyInvoiceId,
        visit_date: historyDate, encounter_id: historyVisitId, visit_id: historyVisitId,
        branch_id: BRANCH_ID, created_date: at(historyDate, '08:15'),
      },
    );

    result.Visit.push(
      {
        id: activeVisitId, encounter_number: activeNumber, queue_entry_id: activeQueueId,
        patient_id: doctor.active.patient_id, patient_name: doctor.active.full_name,
        doctor_id: doctor.doctor_id, doctor_name: doctor.doctor_name, poli: doctor.poli,
        visit_type: 'Poliklinik', status: 'INTAKE_DONE', branch_id: BRANCH_ID,
        registered_at: at(today, `${activeHour}:30`), arrived_at: at(today, `${activeHour}:35`),
        handoff_to: doctor.doctor_name,
        status_history: [
          { from: null, to: 'WAITING', at: at(today, `${activeHour}:30`), actor: 'Front Desk Demo' },
          { from: 'CALLED', to: 'INTAKE_DONE', at: at(today, `${activeHour}:45`), actor: 'Perawat Demo' },
        ],
      },
      {
        id: historyVisitId, encounter_number: historyNumber, queue_entry_id: historyQueueId,
        patient_id: doctor.history.patient_id, patient_name: doctor.history.full_name,
        doctor_id: doctor.doctor_id, doctor_name: doctor.doctor_name, poli: doctor.poli,
        visit_type: 'Kontrol', status: 'READY_TO_CLOSE', branch_id: BRANCH_ID,
        registered_at: at(historyDate, '08:15'), completed_at: at(historyDate, '09:20'),
        handoff_to: 'Kasir',
        status_history: [
          { from: null, to: 'WAITING', at: at(historyDate, '08:15'), actor: 'Front Desk Demo' },
          { from: 'IN_SERVICE', to: 'COMPLETED', at: at(historyDate, '09:20'), actor: doctor.doctor_name },
          { from: 'COMPLETED', to: 'READY_TO_CLOSE', at: at(historyDate, '09:45'), actor: 'Apoteker Demo' },
        ],
      },
    );

    result.ClinicalRecord.push(
      {
        id: activeIntakeId, visit_id: activeVisitId, encounter_id: activeVisitId,
        queue_entry_id: activeQueueId, patient_id: doctor.active.patient_id,
        patient_name: doctor.active.full_name, record_type: 'intake',
        complaint: doctor.active.complaint, allergy: doctor.active.allergy || 'Tidak ada',
        allergy_verified: true, sterile_equipment_ready: true, room_ready: true,
        vital_signs_bp: doctor.key === 'pediatric' ? '100/65' : '120/80',
        vital_signs_temp: doctor.key === 'pediatric' ? 37.8 : 36.8,
        vital_signs_pulse: doctor.key === 'pediatric' ? 96 : 78,
        vital_signs_rr: doctor.key === 'pediatric' ? 22 : 18,
        vital_signs_weight: doctor.key === 'pediatric' ? 21.4 : 62,
        vital_signs_height: doctor.key === 'pediatric' ? 118 : 168,
        author_user_id: 'demo-nurse', author_name: 'Perawat Demo',
        recorded_at: at(today, `${activeHour}:45`), version: 1,
      },
      {
        id: historyIntakeId, visit_id: historyVisitId, encounter_id: historyVisitId,
        queue_entry_id: historyQueueId, patient_id: doctor.history.patient_id,
        patient_name: doctor.history.full_name, record_type: 'intake',
        complaint: doctor.history.complaint, allergy: 'Tidak ada', allergy_verified: true,
        sterile_equipment_ready: true, room_ready: true, vital_signs_bp: '118/78',
        vital_signs_temp: 36.7, vital_signs_pulse: 76, vital_signs_rr: 18,
        author_user_id: 'demo-nurse', author_name: 'Perawat Demo',
        recorded_at: at(historyDate, '08:30'), version: 1,
      },
    );

    const procedure = {
      id: `procedure-seed-${doctor.key}`, code: doctor.history.procedure_code,
      name: doctor.history.procedure, fee: doctor.history.procedure_fee,
      quantity: 1, subtotal: doctor.history.procedure_fee,
    };
    result.MedicalRecord.push({
      id: medicalRecordId, patient_id: doctor.history.patient_id,
      patient_name: doctor.history.full_name, visit_id: historyVisitId,
      encounter_id: historyVisitId, queue_entry_id: historyQueueId,
      doctor_id: doctor.doctor_id, doctor_name: doctor.doctor_name,
      visit_date: historyDate, chief_complaint: doctor.history.complaint,
      subjective: doctor.history.complaint, physical_exam: 'Keadaan umum baik, tanda vital stabil',
      diagnosis: doctor.history.diagnosis, diagnosis_code: doctor.history.diagnosis_code,
      treatment_plan: doctor.history.treatment_plan, patient_education: 'Kontrol sesuai jadwal dan kembali bila keluhan memburuk',
      procedures: [procedure], tindakan_total: doctor.history.procedure_fee,
      finalized: true, finalized_at: at(historyDate, '09:20'), version: 1, branch_id: BRANCH_ID,
    });

    const medicineSubtotal = doctor.history.quantity * doctor.history.medicine_price;
    result.Prescription.push({
      id: prescriptionId, prescription_number: `R-SEED-${doctor.prefix}-001`,
      patient_id: doctor.history.patient_id, patient_name: doctor.history.full_name,
      encounter_id: historyVisitId, visit_id: historyVisitId, queue_entry_id: historyQueueId,
      doctor_id: doctor.doctor_id, doctor_name: doctor.doctor_name,
      prescription_date: historyDate, source: 'Internal', status: 'Selesai Dispensing',
      workflow_status: 'DISPENSED', signed_at: at(historyDate, '09:20'),
      verified_at: at(historyDate, '09:30'), dispensed_at: at(historyDate, '09:40'),
      dispensed_by: 'apt. Sari Wulandari', version: 1, is_immutable: true,
      items: [{
        medicine_id: doctor.history.medicine_id, medicine_name: doctor.history.medicine_name,
        dosage: doctor.history.dosage, quantity: doctor.history.quantity,
        instructions: 'Sesudah makan', unit_price: doctor.history.medicine_price,
        subtotal: medicineSubtotal,
      }],
      branch_id: BRANCH_ID,
    });

    result.Order.push(
      {
        id: `order-seed-${doctor.key}-procedure`, visit_id: historyVisitId,
        encounter_id: historyVisitId, queue_entry_id: historyQueueId,
        patient_id: doctor.history.patient_id, order_type: 'procedure', destination: 'Kasir Klinik',
        source_id: medicalRecordId, service_code: procedure.code, service_name: procedure.name,
        amount: procedure.subtotal, ordering_user: doctor.doctor_id,
        status: 'COMPLETED', completed_at: at(historyDate, '09:20'), branch_id: BRANCH_ID,
      },
      {
        id: `order-seed-${doctor.key}-prescription`, visit_id: historyVisitId,
        encounter_id: historyVisitId, queue_entry_id: historyQueueId,
        patient_id: doctor.history.patient_id, order_type: 'prescription', destination: 'Farmasi',
        source_id: prescriptionId, ordering_user: doctor.doctor_id,
        status: 'HANDED_TO_PATIENT', sent_at: at(historyDate, '09:20'),
        completed_at: at(historyDate, '09:40'), branch_id: BRANCH_ID,
      },
    );

    result.Transaction.push(
      {
        id: clinicInvoiceId, invoice_number: `KLINIK-SEED-${doctor.prefix}-001`,
        type: 'Klinik', cash_point: 'klinik', encounter_id: historyVisitId,
        visit_id: historyVisitId, patient_id: doctor.history.patient_id,
        patient_name: doctor.history.full_name, queue_entry_id: historyQueueId,
        prescription_id: prescriptionId, source_type: 'MedicalRecord', source_id: medicalRecordId,
        items: [{ source_type: 'procedure', source_id: procedure.id, name: procedure.name, quantity: 1, price: procedure.fee, subtotal: procedure.subtotal }],
        subtotal: procedure.subtotal, consultation_fee: procedure.subtotal, other_fees: 0,
        total: procedure.subtotal, payment_status: 'Belum Bayar', invoice_status: 'POSTED',
        transaction_date: historyDate, branch_id: BRANCH_ID,
      },
      {
        id: pharmacyInvoiceId, invoice_number: `FARMASI-SEED-${doctor.prefix}-001`,
        type: 'Farmasi', cash_point: 'farmasi', encounter_id: historyVisitId,
        visit_id: historyVisitId, patient_id: doctor.history.patient_id,
        patient_name: doctor.history.full_name, queue_entry_id: historyQueueId,
        prescription_id: prescriptionId, source_type: 'Prescription', source_id: prescriptionId,
        items: [{ medicine_id: doctor.history.medicine_id, name: doctor.history.medicine_name, quantity: doctor.history.quantity, price: doctor.history.medicine_price, subtotal: medicineSubtotal }],
        subtotal: medicineSubtotal, total: medicineSubtotal, payment_status: 'Belum Bayar',
        invoice_status: 'POSTED', transaction_date: historyDate, branch_id: BRANCH_ID,
      },
    );

    result.AuditLog.push({
      id: `audit-seed-${doctor.key}-patient-relation`, action: 'seed_link', entity: 'Visit',
      entity_id: historyVisitId, description: `${doctor.history.full_name} terhubung ke ${doctor.doctor_name}, Perawat, Farmasi, dan Kasir`,
      user_id: 'local-owner', user_name: 'Demo Owner', user_role: 'Owner',
      module: 'seed', severity: 'Info', timestamp: at(historyDate, '09:45'),
    });
  }

  const pediatric = doctorSeeds.find((doctor) => doctor.key === 'pediatric');
  for (const [index, patient] of [pediatric.active, pediatric.history].entries()) {
    result.FamilyAccount.push({
      id: `family-account-seed-pediatric-${index + 1}`,
      family_name: `Keluarga ${patient.guardian_name}`,
      parent_name: patient.guardian_name, parent_phone: patient.guardian_phone,
      parent_relation: patient.guardian_relation, parent_email: '',
      address: 'Bandung, Jawa Barat', member_patient_ids: [patient.patient_id],
      child_patient_ids: [patient.patient_id], child_names: [patient.full_name], is_active: true,
    });
    result.GrowthRecord.push({
      id: `growth-seed-pediatric-${index + 1}`, patient_id: patient.patient_id,
      patient_name: patient.full_name, visit_date: index === 0 ? today : historyDate,
      age_months: index === 0 ? 88 : 56, gender: patient.gender,
      weight: index === 0 ? 21.4 : 16.8, height: index === 0 ? 118 : 103,
      head_circumference: index === 0 ? 51 : 49, bmi: index === 0 ? 15.4 : 15.8,
      nutrition_status: 'Normal', doctor_id: pediatric.doctor_id,
      doctor_name: pediatric.doctor_name, notes: 'Terhubung ke akun keluarga dan kunjungan pasien anak',
    });
    result.ImmunizationRecord.push({
      id: `immunization-seed-pediatric-${index + 1}`, patient_id: patient.patient_id,
      patient_name: patient.full_name, vaccine_type: index === 0 ? 'MR' : 'DPT-HB-Hib',
      vaccine_label: index === 0 ? 'MR Lanjutan' : 'DPT-HB-Hib Booster', dose_number: index === 0 ? 2 : 4,
      administered_date: index === 0 ? historyDate : dateMinus(today, 30),
      age_at_administration: index === 0 ? '7 tahun' : '4 tahun',
      doctor_id: pediatric.doctor_id, doctor_name: pediatric.doctor_name,
      batch_number: `VAC-SEED-${index + 1}`, manufacturer: 'Bio Farma',
      site: 'Lengan Kiri', next_due_date: dateMinus(today, -180),
      status: 'Terkonfirmasi', notes: 'Kartu vaksinasi digital seed terintegrasi',
    });
  }

  const dentist = doctorSeeds.find((doctor) => doctor.key === 'dental');
  for (const [index, patient] of [dentist.active, dentist.history].entries()) {
    const tooth = index === 0 ? '46' : '16';
    result.OdontogramRecord.push({
      id: `odontogram-seed-dental-${index + 1}`, patient_id: patient.patient_id,
      patient_name: patient.full_name, tooth_number: tooth, tooth_type: 'Molar',
      arch: index === 0 ? 'Lower' : 'Upper', condition: index === 0 ? 'Karies' : 'Tambal',
      surfaces: ['O'], treatment_date: index === 0 ? today : historyDate,
      doctor_id: dentist.doctor_id, doctor_name: dentist.doctor_name,
      notes: index === 0 ? 'Karies oklusal, perlu restorasi' : 'Tambalan komposit dalam kondisi baik',
    });
    result.TreatmentPlan.push({
      id: `treatment-plan-seed-dental-${index + 1}`, patient_id: patient.patient_id,
      patient_name: patient.full_name, doctor_id: dentist.doctor_id,
      doctor_name: dentist.doctor_name, plan_name: index === 0 ? 'Restorasi Gigi 46' : 'Perawatan Periodontal',
      plan_type: 'Gigi Multi-Sesi', sessions: [
        { session_number: 1, description: index === 0 ? 'Preparasi dan tambal sementara gigi 46' : 'Scaling rahang atas', tooth_numbers: [tooth], estimated_cost: 250000, status: index === 0 ? 'Dijadwalkan' : 'Selesai', scheduled_date: index === 0 ? dateMinus(today, -7) : historyDate, completed_date: index === 0 ? '' : historyDate },
        { session_number: 2, description: index === 0 ? 'Evaluasi dan restorasi permanen' : 'Evaluasi periodontal', tooth_numbers: [tooth], estimated_cost: 200000, status: 'Dijadwalkan', scheduled_date: dateMinus(today, -14) },
      ],
      total_estimate: 450000, total_paid: index === 0 ? 0 : 250000,
      status: 'Aktif', notes: 'Rencana bertahap terhubung ke odontogram dan ID pasien yang sama',
    });
  }

  result.Notification.push(
    {
      id: 'notification-seed-pharmacy-doctor-patients', target_role: 'Apoteker',
      type: 'prescription', title: 'Resep pasien dokter terintegrasi',
      body: 'Tersedia resep seed dari Dokter Umum, Dokter Anak, dan Dokter Gigi untuk verifikasi alur farmasi.',
      priority: 'Normal', related_entity: 'Prescription', is_read: false,
      action_label: 'Buka Apotek', action_type: 'navigate', action_payload: JSON.stringify({ path: '/pharmacy' }),
    },
    {
      id: 'notification-seed-cashier-doctor-patients', target_role: 'Kasir',
      type: 'billing', title: 'Tagihan kunjungan dokter siap diproses',
      body: 'Tagihan klinik dan farmasi pasien seed tersedia dengan harga dari tindakan dan resep.',
      priority: 'Normal', related_entity: 'Transaction', is_read: false,
      action_label: 'Buka Kasir', action_type: 'navigate', action_payload: JSON.stringify({ path: '/kasir' }),
    },
  );

  return result;
}

export default buildDoctorPatientSeed;
