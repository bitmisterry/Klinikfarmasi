// @ts-nocheck -- Entity and role matrices are dynamic localStorage configuration.
// Pure access-policy helpers shared by the UI RBAC and localStorage data layer.
// No database imports belong here: the data adapter must be able to enforce
// these rules without creating a circular dependency.

export const DOCTOR_ROLES = new Set([
  'Dokter',
  'Dokter Umum',
  'Dokter Spesialis Anak',
  'Dokter Spesialis Penyakit Dalam',
  'Dokter Gigi',
  'Dokter Locum',
]);

export const normalizeClinicRole = (role) => String(role || 'Staff').trim() || 'Staff';
export const isDoctorRole = (role) => DOCTOR_ROLES.has(normalizeClinicRole(role));

const COMMON_READ = [
  'Notification', 'Memo', 'ChatMessage', 'SearchGuide', 'SearchTerm', 'Role',
];

const ROLE_READ_ENTITIES = {
  Owner: [
    'User', 'Transaction', 'Payment', 'CashSession', 'Expense', 'Medicine', 'StockBatch',
    'StockMovement', 'PurchaseOrder', 'SupplierInvoice', 'SupplierReturn', 'SupplierCreditNote', 'Supplier', 'PaymentSchedule',
    'Anomaly', 'QueueEntry', 'Visit', 'MedicalRecord', 'Prescription', 'Staff', 'DoctorProfile',
    'DoctorSchedule', 'Schedule', 'ScheduleChangeRequest', 'Asset', 'AuditLog', 'Document', 'RequiredDocument',
    'ClinicSetting', 'PriceHistory', 'TindakanMaster', 'RacikanConfig', 'InternalRequest',
  ],
  Admin: [
    'User', 'Staff', 'Role', 'AuditLog', 'ClinicSetting', 'RequiredDocument',
    'Document', 'SearchGuide', 'SearchTerm', 'Notification', 'Memo', 'InternalRequest', 'Medicine', 'PriceHistory',
  ],
  Dokter: [
    'Patient', 'QueueEntry', 'Visit', 'ClinicalRecord', 'MedicalRecord', 'Prescription',
    'Order', 'Medicine', 'DoctorProfile', 'DoctorSchedule', 'ExamTemplate',
    'PrescriptionTemplate', 'DoctorChecklist', 'ScheduleChangeRequest', 'InternalRequest',
    'ClinicalFeedback', 'TindakanMaster', 'Document', 'RacikanTemplate', 'RacikanConfig',
    'PrescriptionAbbreviation',
  ],
  Perawat: ['Patient', 'QueueEntry', 'Visit', 'ClinicalRecord', 'DoctorProfile', 'DoctorSchedule'],
  'Front Office': ['Patient', 'Appointment', 'QueueEntry', 'Visit', 'DoctorProfile', 'DoctorSchedule', 'FamilyAccount'],
  Kasir: ['Patient', 'QueueEntry', 'Visit', 'Prescription', 'Order', 'Transaction', 'Payment', 'CashSession', 'Medicine'],
  Apoteker: [
    'Patient', 'QueueEntry', 'Visit', 'Prescription', 'Order', 'Medicine', 'StockBatch',
    'StockMovement', 'PurchaseOrder', 'SupplierInvoice', 'SupplierReturn', 'Supplier',
    'Transaction', 'Payment', 'RacikanTemplate', 'RacikanConfig', 'SubstitutionRule',
    'InternalRequest', 'ClinicalFeedback', 'PrescriptionAbbreviation',
  ],
  'Apoteker Penanggung Jawab': [
    'Patient', 'QueueEntry', 'Visit', 'Prescription', 'Order', 'Medicine', 'StockBatch',
    'StockMovement', 'PurchaseOrder', 'SupplierInvoice', 'SupplierReturn', 'Supplier', 'PaymentSchedule',
    'Transaction', 'Payment', 'RacikanTemplate', 'RacikanConfig', 'SubstitutionRule',
    'InternalRequest', 'ClinicalFeedback', 'PriceHistory', 'Document', 'PrescriptionAbbreviation',
  ],
  'Apoteker Pendamping': [
    'Patient', 'QueueEntry', 'Visit', 'Prescription', 'Order', 'Medicine', 'StockBatch',
    'StockMovement', 'RacikanTemplate', 'RacikanConfig', 'SubstitutionRule', 'InternalRequest', 'PrescriptionAbbreviation',
  ],
  'Admin Farmasi': [
    'Medicine', 'StockBatch', 'StockMovement', 'PurchaseOrder', 'SupplierInvoice', 'SupplierReturn', 'Supplier',
    'PaymentSchedule', 'InternalRequest', 'Document', 'Notification',
    'PrescriptionAbbreviation',
  ],
  'TTK/Asisten Farmasi': [
    'Patient', 'QueueEntry', 'Visit', 'Prescription', 'Order', 'Medicine', 'StockBatch',
    'StockMovement', 'RacikanTemplate', 'RacikanConfig',
  ],
  'Manajer Operasional': [
    'Asset', 'Staff', 'Schedule', 'ScheduleChangeRequest', 'DoctorProfile', 'DoctorSchedule', 'Document',
    'RequiredDocument', 'AuditLog', 'QueueEntry', 'Visit',
  ],
  Finance: [
    'Transaction', 'Payment', 'CashSession', 'Expense', 'PurchaseOrder',
    'SupplierInvoice', 'SupplierReturn', 'SupplierCreditNote', 'Supplier', 'PaymentSchedule', 'Medicine', 'StockBatch',
    'Document', 'AuditLog',
  ],
  'Asisten Dokter': ['Patient', 'QueueEntry', 'Visit', 'ClinicalRecord', 'DoctorProfile', 'DoctorSchedule'],
  Staff: [],
  Pasien: ['Patient', 'Appointment', 'Visit', 'MedicalRecord', 'Prescription', 'Transaction', 'Payment'],
};

const ROLE_WRITE_ENTITIES = {
  // Owner adalah otoritas pengelola jabatan dan hak akses. Matriks role
  // disimpan lokal dan dipakai langsung oleh nav/guard seluruh aplikasi.
  Owner: ['Role', 'ClinicSetting', 'InternalRequest'],
  Admin: ['User', 'Role', 'ClinicSetting', 'RequiredDocument', 'SearchGuide', 'SearchTerm', 'Document', 'InternalRequest'],
  Dokter: [
    'ExamTemplate', 'PrescriptionTemplate', 'DoctorChecklist', 'DoctorProfile',
    'ScheduleChangeRequest', 'InternalRequest', 'ClinicalFeedback',
  ],
  // Data intake klinis hanya boleh ditulis lewat fungsi saveIntake yang
  // memvalidasi visit aktif, membuat versi append-only, dan menulis audit.
  Perawat: [],
  'Front Office': ['Patient', 'Appointment', 'FamilyAccount'],
  Kasir: ['Transaction', 'Payment', 'CashSession'],
  Apoteker: [
    'Prescription', 'Order', 'Medicine', 'StockBatch', 'StockMovement', 'PurchaseOrder',
    'SupplierInvoice', 'SupplierReturn', 'Transaction', 'Payment',
    'RacikanTemplate', 'RacikanConfig', 'SubstitutionRule', 'InternalRequest', 'ClinicalFeedback',
  ],
  'Apoteker Penanggung Jawab': [
    'Prescription', 'Order', 'Medicine', 'StockBatch', 'StockMovement', 'PurchaseOrder',
    'SupplierInvoice', 'SupplierReturn', 'Supplier', 'PaymentSchedule', 'Expense', 'Transaction', 'Payment',
    'RacikanTemplate', 'RacikanConfig', 'SubstitutionRule', 'InternalRequest', 'ClinicalFeedback', 'Document', 'PrescriptionAbbreviation',
  ],
  'Apoteker Pendamping': ['Prescription', 'Order', 'Medicine', 'StockBatch', 'StockMovement', 'RacikanTemplate', 'RacikanConfig', 'SubstitutionRule', 'InternalRequest'],
  'Admin Farmasi': ['Medicine', 'StockBatch', 'StockMovement', 'PurchaseOrder', 'SupplierInvoice', 'SupplierReturn', 'Supplier', 'PaymentSchedule', 'InternalRequest', 'Document', 'PrescriptionAbbreviation'],
  'TTK/Asisten Farmasi': [],
  'Manajer Operasional': ['Asset', 'Staff', 'Schedule', 'DoctorProfile', 'DoctorSchedule', 'Document'],
  Finance: ['Transaction', 'Payment', 'CashSession', 'Expense', 'PurchaseOrder', 'SupplierInvoice', 'SupplierReturn', 'SupplierCreditNote', 'PaymentSchedule', 'Document'],
  'Asisten Dokter': [],
  Staff: [],
  Pasien: ['Appointment'],
};

const COMMON_WRITE = new Set(['Notification', 'Memo', 'ChatMessage']);

const inheritedRole = (role) => {
  const normalized = normalizeClinicRole(role);
  if (isDoctorRole(normalized)) return 'Dokter';
  return normalized;
};

export function canReadEntity(role, entity) {
  const normalized = normalizeClinicRole(role);
  const base = inheritedRole(normalized);
  if (COMMON_READ.includes(entity)) return true;
  if (ROLE_READ_ENTITIES[base]?.includes(entity)) return true;
  if (normalized === 'Dokter Gigi' && ['OdontogramRecord', 'TreatmentPlan'].includes(entity)) return true;
  if (normalized === 'Dokter Spesialis Anak' && ['GrowthRecord', 'ImmunizationRecord', 'FamilyAccount'].includes(entity)) return true;
  return false;
}

export function canMutateEntity(role, entity, action = 'update') {
  const normalized = normalizeClinicRole(role);
  const base = inheritedRole(normalized);
  if (entity === 'AuditLog' && action === 'create') return true;
  // Owner remains an observer at the data layer as well as in the UI. Common
  // collaboration entities are intentionally excluded here so a hidden or
  // direct call cannot bypass the Owner's change-request workflow.
  if (normalized === 'Owner' && COMMON_WRITE.has(entity)) return false;
  if (COMMON_WRITE.has(entity)) return true;
  if (ROLE_WRITE_ENTITIES[base]?.includes(entity)) return true;
  if (normalized === 'Dokter Gigi' && ['OdontogramRecord', 'TreatmentPlan'].includes(entity)) return true;
  if (normalized === 'Dokter Spesialis Anak' && ['GrowthRecord', 'ImmunizationRecord'].includes(entity)) return true;
  return false;
}

const FUNCTION_ROLES = {
  registerPatient: ['Front Office'],
  registerVisit: ['Front Office'],
  callVisit: ['Front Office'],
  returnVisitToWaiting: ['Front Office'],
  confirmVisitArrival: ['Front Office'],
  listFrontOfficeApprovedDocuments: ['Front Office'],
  getFrontOfficeDocumentData: ['Front Office'],
  saveIntake: ['Perawat', 'Asisten Dokter'],
  acceptVisit: [...DOCTOR_ROLES],
  completeExam: [...DOCTOR_ROLES],
  calculateDoctorRemuneration: [...DOCTOR_ROLES],
  submitScheduleChange: [...DOCTOR_ROLES],
  approveScheduleChange: ['Owner', 'Manajer Operasional'],
  submitOwnerChangeRequest: ['Owner'],
  reviewOwnerChangeRequest: ['Admin'],
  runAnomalyScan: ['Admin'],
  // Konfigurasi harga menyatakan Owner dan Admin sebagai pemegang otoritas
  // override. Keduanya harus memakai fungsi terlacak yang sama.
  changeSellingPrice: ['Owner', 'Admin'],
  voidInvoice: ['Finance'],
  syncRoleAssignments: ['Owner', 'Admin'],
  createSupplierReturn: ['Apoteker', 'Admin Farmasi'],
  approveSupplierReturn: ['Apoteker Penanggung Jawab'],
  processSupplierReturn: ['Apoteker', 'Admin Farmasi'],
  cancelSupplierReturn: ['Finance', 'Apoteker Penanggung Jawab'],
  recordSupplierCreditNote: ['Finance'],
  reconcileSupplierReturn: ['Finance'],
  closeSupplierReturn: ['Finance'],
  processInvoice: ['Apoteker', 'Apoteker Penanggung Jawab', 'Admin Farmasi'],
  refreshEncounterClosure: ['Apoteker', 'Apoteker Penanggung Jawab', 'Apoteker Pendamping', 'Kasir'],
  seedAllDemoData: ['Owner', 'Admin'],
};

export function canInvokeFunction(role, name) {
  if (['logAudit', 'searchHelp', 'fetchDrugInfoSummary'].includes(name)) return true;
  const allowed = FUNCTION_ROLES[name];
  if (!allowed) return false;
  return allowed.includes(normalizeClinicRole(role));
}

const FRONT_OFFICE_PATIENT_FIELDS = new Set([
  'full_name', 'nik', 'gender', 'birth_date', 'phone', 'email', 'address',
  'insurance_type', 'bpjs_number', 'insurance_number', 'guardian_name',
  'guardian_relation', 'guardian_phone', 'emergency_contact', 'mr_number',
  'branch_id', 'is_active',
]);
const NURSE_PATIENT_FIELDS = new Set(['allergies', 'allergy_verified_at']);
const CASHIER_PAYMENT_FIELDS = new Set([
  'cash_point', 'invoice_status', 'payment_method', 'payment_status', 'paid_amount',
  'change_amount', 'paid_at', 'cashier_id', 'cashier_name', 'cash_session_id',
]);
const PHARMACY_RX_FIELDS = new Set([
  'status', 'workflow_status', 'received_at', 'verified_at', 'dispensed_at',
  'dispensed_by', 'transaction_id', 'tebus_status', 'tebus_notation',
  'tebus_remaining', 'pio_recorded', 'physical_scan_url', 'retention_category',
  'returned_to_doctor', 'return_reason', 'unavailable_items', 'items',
  'verified_by', 'verified_by_id', 'verification_note', 'verification_flags_snapshot',
]);

const assertOnlyFields = (payload, allowed, message) => {
  const invalid = Object.keys(payload || {}).filter((key) => !allowed.has(key));
  if (invalid.length) throw new Error(`${message}: ${invalid.join(', ')}`);
};

const samePrescriptionContent = (beforeItems = [], afterItems = []) => {
  if (beforeItems.length !== afterItems.length) return false;
  const protectedFields = ['medicine_id', 'medicine_name', 'strength', 'dosage', 'quantity', 'instructions', 'is_racikan', 'racikan_template_id'];
  return beforeItems.every((beforeItem, index) => protectedFields.every((field) =>
    JSON.stringify(beforeItem?.[field] ?? null) === JSON.stringify(afterItems[index]?.[field] ?? null)));
};

export function assertFieldPolicy({ role, entity, action, payload = {}, before = null }) {
  const normalized = normalizeClinicRole(role);
  // Owner is strictly read-only for operational entities. Purchase order
  // changes must be requested from Admin/Operations, never written directly.
  if (normalized === 'Front Office' && entity === 'Patient') {
    assertOnlyFields(payload, FRONT_OFFICE_PATIENT_FIELDS, 'Front Office hanya boleh mengubah identitas, kontak, penjamin, dan wali pasien');
  }
  if (['Perawat', 'Asisten Dokter'].includes(normalized) && entity === 'Patient') {
    assertOnlyFields(payload, NURSE_PATIENT_FIELDS, 'Perawat hanya boleh menambahkan verifikasi alergi pasien');
  }
  if (normalized === 'Manajer Operasional' && entity === 'Staff') {
    const forbidden = ['salary', 'gaji', 'wage', 'remuneration', 'remuneration_nominal', 'remuneration_percent'];
    const attempted = forbidden.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
    if (attempted.length) throw new Error('Manajer Operasional tidak dapat melihat atau mengubah data gaji/remunerasi');
  }
  if (normalized === 'Manajer Operasional' && entity === 'DoctorProfile') {
    const forbidden = ['salary', 'gaji', 'wage', 'remuneration', 'remuneration_scheme', 'remuneration_nominal', 'remuneration_percent', 'remuneration_per_tindakan'];
    const attempted = forbidden.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
    if (attempted.length) throw new Error('Manajer Operasional tidak dapat melihat atau mengubah gaji/margin/jasa dokter');
  }
  if (isDoctorRole(normalized) && entity === 'DoctorProfile') {
    const forbidden = ['staff_id', 'management_roles', 'employment_status', 'join_date', 'salary', 'gaji', 'wage', 'remuneration', 'remuneration_scheme', 'remuneration_nominal', 'remuneration_percent', 'remuneration_per_tindakan'];
    const attempted = forbidden.filter((field) => Object.prototype.hasOwnProperty.call(payload, field)
      && JSON.stringify(payload[field] ?? null) !== JSON.stringify(before?.[field] ?? null));
    if (attempted.length) throw new Error('Dokter hanya boleh mengubah identitas profesional dan preferensi praktik miliknya sendiri');
  }
  if (isDoctorRole(normalized) && entity === 'Prescription' && action === 'update') {
    throw new Error('Resep yang sudah dikonfirmasi dokter bersifat terkunci. Perubahan harus dibuat sebagai revisi resep baru yang tercatat.');
  }
  if (normalized === 'Kasir' && entity === 'Transaction') {
    if (action === 'create') throw new Error('Tagihan harus terbentuk otomatis dari tindakan dokter atau farmasi; Kasir tidak dapat membuat harga/tagihan manual');
    assertOnlyFields(payload, CASHIER_PAYMENT_FIELDS, 'Kasir hanya boleh memproses metode dan status pembayaran');
  }
  if (['Apoteker', 'Apoteker Penanggung Jawab', 'Apoteker Pendamping', 'Admin Farmasi', 'TTK/Asisten Farmasi'].includes(normalized) && entity === 'Prescription') {
    if (action === 'create' && payload.source !== 'Eksternal') {
      throw new Error('Farmasi tidak dapat membuat atau mengubah resep dokter; resep internal harus dikirim oleh dokter');
    }
    if (action === 'update') {
      assertOnlyFields(payload, PHARMACY_RX_FIELDS, 'Farmasi hanya boleh memverifikasi, memberi status, mencatat PIO/etiket, atau mengembalikan resep ke dokter');
      if (payload.items && !samePrescriptionContent(before?.items || [], payload.items)) {
        throw new Error('Isi resep dokter tidak boleh diubah oleh farmasi. Tandai tidak tersedia dan kembalikan ke dokter untuk substitusi.');
      }
    }
  }
  if (entity === 'PrescriptionAbbreviation') {
    const draftFields = new Set(['abbreviation', 'aliases', 'standard_meaning', 'context', 'approval_status', 'submitted_by', 'submitted_at', 'approved_by', 'approved_at', 'notes']);
    if (normalized === 'Admin Farmasi') {
      assertOnlyFields(payload, draftFields, 'Admin Farmasi hanya boleh mengelola usulan kamus singkatan');
      if (payload.approval_status && payload.approval_status !== 'Diajukan') {
        throw new Error('Entri kamus baru/perubahan dari Admin Farmasi harus berstatus Diajukan sampai disetujui APJ');
      }
    }
    if (normalized === 'Apoteker Penanggung Jawab') {
      assertOnlyFields(payload, draftFields, 'APJ hanya boleh meninjau dan menyetujui kamus singkatan');
    }
  }
  if (['Apoteker', 'Apoteker Penanggung Jawab', 'Apoteker Pendamping', 'Admin Farmasi', 'TTK/Asisten Farmasi'].includes(normalized) && entity === 'Medicine') {
    if (action === 'create' || action === 'delete') {
      throw new Error('Master obat bersifat terpusat; farmasi mencatat stok melalui batch, penerimaan, dispensing, dan stock movement');
    }
    const allowed = new Set(['stock_on_hand', 'shelf_location', 'min_stock', 'is_active', 'last_stock_opname', 'updated_from_batch']);
    if (payload.updated_from_batch === true) allowed.add('purchase_price');
    assertOnlyFields(payload, allowed, 'Farmasi hanya boleh memperbarui atribut stok. Isi master, harga jual, dan HPP manual memerlukan otorisasi terpisah');
  }
  if (normalized === 'Apoteker' && entity === 'PurchaseOrder') {
    const forbidden = ['approval_status', 'approved_by', 'approved_date'];
    const attempted = forbidden.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
    if (attempted.length || ['Disetujui', 'Dibatalkan'].includes(payload.status)) {
      throw new Error('Apoteker dapat mengajukan, mengirim, dan menerima pengadaan; approval atau pembatalan PO dilakukan APJ');
    }
  }
  if (normalized === 'Apoteker' && entity === 'Supplier') {
    throw new Error('Apoteker hanya dapat menggunakan data supplier yang tersedia; perubahan master supplier dilakukan APJ/Admin Farmasi');
  }
  if (normalized === 'Apoteker' && entity === 'Payment') {
    if (action !== 'create' || payload.cash_point !== 'farmasi') {
      throw new Error('Apoteker hanya dapat mencatat pembayaran langsung untuk transaksi OTC di titik farmasi');
    }
    assertOnlyFields(payload, new Set(['invoice_id', 'visit_id', 'cash_point', 'amount', 'method', 'status', 'reference', 'paid_at']), 'Data pembayaran farmasi tidak valid');
  }
  if (normalized === 'Apoteker' && entity === 'Transaction') {
    if (action === 'create' && !['farmasi', 'Apotek/POS'].includes(payload.cash_point) && payload.type !== 'Apotek/POS' && payload.type !== 'Resep') {
      throw new Error('Apoteker hanya dapat membentuk tagihan yang bersumber dari dispensing/penjualan farmasi');
    }
    if (action !== 'create' && payload.cash_point && payload.cash_point !== 'farmasi') {
      throw new Error('Apoteker tidak dapat mengubah tagihan layanan klinik');
    }
  }
  if (normalized === 'Apoteker' && entity === 'SupplierInvoice' && action === 'update') {
    if (payload.status === 'Batal' || Object.prototype.hasOwnProperty.call(payload, 'paid_amount')) {
      throw new Error('Pembatalan faktur atau perubahan pembayaran supplier dilakukan APJ/Finance dengan alasan dan audit');
    }
  }
}

const omit = (record, fields) => {
  const copy = { ...record };
  fields.forEach((field) => delete copy[field]);
  return copy;
};

const FINANCIAL_SECRET_FIELDS = [
  'purchase_price', 'hpp', 'cost', 'margin', 'margin_percent', 'target_margin',
  'min_safe_price', 'remuneration_scheme', 'remuneration_nominal',
  'remuneration_percent', 'remuneration_per_tindakan', 'salary', 'gaji',
];
const CLINICAL_FIELDS = [
  'chief_complaint', 'subjective', 'objective', 'physical_exam', 'diagnosis',
  'diagnosis_code', 'treatment_plan', 'patient_education', 'notes', 'allergies',
  'vital_signs_bp', 'vital_signs_temp', 'vital_signs_pulse', 'vital_signs_rr',
];

export function sanitizeRecordForRole(role, entity, record) {
  if (!record) return record;
  const normalized = normalizeClinicRole(role);
  let result = { ...record };

  if (isDoctorRole(normalized) || ['Front Office', 'Perawat', 'Asisten Dokter', 'Kasir', 'Manajer Operasional'].includes(normalized)) {
    result = omit(result, FINANCIAL_SECRET_FIELDS);
  }
  if (['Front Office', 'Kasir'].includes(normalized) && entity === 'Patient') {
    result = omit(result, ['allergies', 'blood_type', 'notes', 'medical_notes']);
  }
  if (['Apoteker', 'TTK/Asisten Farmasi'].includes(normalized) && entity === 'Patient') {
    result = omit(result, ['address', 'nik', 'insurance_number', 'bpjs_number', 'notes']);
  }
  if (normalized === 'Manajer Operasional' && ['Staff', 'DoctorProfile'].includes(entity)) {
    result = omit(result, FINANCIAL_SECRET_FIELDS);
  }
  if (normalized === 'Owner' && ['QueueEntry', 'Visit', 'Prescription'].includes(entity)) {
    result = omit(result, [...CLINICAL_FIELDS, 'items', 'original_text', 'patient_name']);
  }
  if (normalized === 'Owner' && entity === 'MedicalRecord') {
    result = omit(result, [...CLINICAL_FIELDS, 'patient_id', 'patient_name', 'prescriptionItems', 'racikanData']);
  }
  if (normalized === 'Manajer Operasional' && ['QueueEntry', 'Visit'].includes(entity)) {
    result = omit(result, [...CLINICAL_FIELDS, 'patient_name', 'patient_id']);
  }
  return result;
}
