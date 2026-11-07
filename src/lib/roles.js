const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Dynamic RBAC — reads permission matrix from Role entity (cached in AuthContext)
// Falls back to DEFAULT_ROLE_PERMISSIONS when roles not yet loaded (demo mode, loading)

// Backward-compat exports — used by StaffAccessPanel and other legacy components
export const CLINIC_ROLES = ['Owner', 'Admin', 'Dokter', 'Dokter Umum', 'Dokter Spesialis Anak', 'Dokter Spesialis Penyakit Dalam', 'Dokter Gigi', 'Dokter Locum', 'Apoteker', 'Apoteker Penanggung Jawab', 'Apoteker Pendamping', 'Admin Farmasi', 'TTK/Asisten Farmasi', 'Front Office', 'Kasir', 'Finance', 'Perawat', 'Manajer Operasional', 'Asisten Dokter', 'Staff', 'Pasien'];

export const ROLE_DESCRIPTIONS = {
  Owner: 'Pemilik — monitoring strategis, approval kebijakan, dan audit; operasional harian read-only',
  Admin: 'Administrator sistem — konfigurasi, pengguna, role, dan audit teknis',
  Dokter: 'Dokter — pemeriksaan, rekam medis & resep',
  'Dokter Umum': 'Dokter Umum — pemeriksaan umum, RME & resep',
  'Dokter Spesialis Anak': 'Dokter Spesialis Anak — pemeriksaan anak, imunisasi & tumbuh kembang',
  'Dokter Spesialis Penyakit Dalam': 'Dokter Spesialis Penyakit Dalam — diagnistik & penanganan penyakit kronis',
  'Dokter Gigi': 'Dokter Gigi — pemeriksaan & tindakan gigi',
  'Dokter Locum': 'Dokter Locum — dokter tamu/part-time, akses terbatas',
  Apoteker: 'Apoteker/Farmasis — dispensing, stok, pembelian & racikan',
  'Apoteker Penanggung Jawab': 'APJ — pengawasan kefarmasian, SIPNAP, pengadaan, pemusnahan, dan approval farmasi',
  'Apoteker Pendamping': 'Apoteker Pendamping — screening resep, dispensing, etiket, dan stok sesuai delegasi APJ',
  'Admin Farmasi': 'Admin Farmasi — administrasi pengadaan, inventori, dokumen, dan laporan tanpa akses rekam medis',
  'TTK/Asisten Farmasi': 'TTK — asisten farmasi, dispensing dasar',
  'Front Office': 'Front Office — registrasi pasien & antrean',
  Kasir: 'Kasir — POS, transaksi & kas',
  Finance: 'Finance — keuangan, utang/piutang & pembayaran',
  Perawat: 'Perawat — input vital sign, persiapan pasien & bantuan tindakan',
  'Manajer Operasional': 'Manajer Operasional — supervisi harian, maintenance alat & SDM non-medis',
  'Asisten Dokter': 'Asisten Dokter — tugas administratif untuk dokter tertentu (sub-akun)',
  Staff: 'Staf umum — dasar (dashboard & antrean)',
  Pasien: 'Pasien — portal pasien (rekam medis, janji temu, billing)',
};

export const MODULE_KEYS = {
  '/': 'dashboard',
  '/patients': 'patients',
  '/queue': 'queue',
  '/nurse/intake': 'intake',
  '/doctor': 'rme',
  '/doctor-exam': 'rme',
  '/doctor/assistant': 'queue',
  '/doctor/exam': 'rme',
  '/doctor/patients': 'patients',
  '/doctor/history': 'rme',
  '/doctor/schedule': 'doctor_schedule',
  '/doctor/requests': 'rme',
  '/doctor/jasa': 'rme',
  '/doctor/profile': 'rme',
  '/doctor/templates': 'rme',
  '/doctor/comms': 'comms',
  '/pharmacy': 'prescription',
  '/master-obat': 'master_obat',
  '/inventory': 'inventory',
  '/purchasing': 'purchasing',
  '/finance': 'finance',
  '/management': 'management',
  '/hr': 'hr',
  '/schedule': 'schedule',
  '/facility': 'facility',
  '/settings': 'settings',
  '/kasir': 'cashier',
  '/doctor-schedule': 'doctor_schedule',
  '/schedule-approvals': 'schedule_approval',
  '/comms': 'comms',
  '/roles': 'user_role',
  '/audit-log': 'audit_log',
  '/doctors': 'doctor_management',
  '/odontogram': 'odontogram',
  '/growth-chart': 'growth_chart',
  '/front-desk': 'front_desk',
  '/front-desk/documents': 'front_desk_documents',
  '/ops-manager': 'ops_manager',
  '/kontrol-usaha': 'kontrol_usaha',
  '/documents': 'documents',
  '/required-documents': 'required_documents',
  '/search-help-settings': 'search_help',
  '/uat-center': 'uat_center',
};

export const MODULE_LABELS = {
  dashboard: 'Dashboard',
  patients: 'Pasien',
  queue: 'Antrean',
  intake: 'Intake Perawat',
  rme: 'Rekam Medis',
  prescription: 'Resep & Racikan',
  master_obat: 'Master Obat',
  inventory: 'Inventory',
  purchasing: 'Pembelian',
  finance: 'Finance',
  cashier: 'Kasir',
  management: 'Laporan & Kontrol',
  hr: 'Manajemen Staff',
  schedule: 'Jadwal Shift',
  doctor_schedule: 'Jadwal Dokter',
  schedule_approval: 'Persetujuan Cuti',
  doctor_management: 'Manajemen Dokter',
  facility: 'Fasilitas & Aset',
  settings: 'Pengaturan',
  comms: 'Komunikasi Internal',
  user_role: 'User & Role',
  audit_log: 'Audit Log',
  odontogram: 'Odontogram',
  growth_chart: 'Growth Chart & Imunisasi',
  front_desk: 'Front Desk',
  front_desk_documents: 'Dokumen Disetujui Dokter',
  ops_manager: 'Manajer Operasional',
  kontrol_usaha: 'Kontrol Usaha',
  documents: 'Dokumen',
  required_documents: 'Dokumen Wajib',
  search_help: 'Pengaturan Cari & Bantuan',
  uat_center: 'Pusat UAT & Backup Lokal',
};

export const ACTION_LABELS = {
  view: 'Lihat',
  create: 'Tambah',
  edit: 'Edit',
  delete: 'Hapus',
  approve: 'Approve',
};

export const ADVANCED_PERMISSIONS = [
  { key: 'void_transaction', label: 'Void Transaksi' },
  { key: 'refund', label: 'Refund' },
  { key: 'price_override', label: 'Price Override' },
  { key: 'stock_adjustment', label: 'Stock Adjustment' },
  { key: 'view_hpp', label: 'Lihat HPP' },
  { key: 'view_rme', label: 'Lihat RME' },
  { key: 'edit_prescription', label: 'Ubah Resep' },
  { key: 'approve_purchase', label: 'Approve Pembelian' },
  { key: 'post_payment', label: 'Posting Pembayaran' },
  { key: 'manage_users_roles', label: 'Kelola User/Role' },
];

const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'];

function viewOnly(modules) {
  const r = {};
  modules.forEach(m => { r[m] = { view: true, create: false, edit: false, delete: false, approve: false }; });
  return r;
}

function partialPerms(modules, actions) {
  const r = {};
  modules.forEach(m => {
    r[m] = Object.fromEntries(ALL_ACTIONS.map(a => [a, actions.includes(a)]));
  });
  return r;
}

const DOCTOR_BASE = {
  ...partialPerms(['dashboard', 'rme', 'comms'], ['view', 'create', 'edit']),
  ...viewOnly(['patients', 'queue']),
  ...partialPerms(['doctor_schedule'], ['view', 'create']),
};

// Mandatory maximum access for built-in roles. Dynamic role configuration may
// remove access, but must never grant a built-in role more than this ceiling.
export const DEFAULT_ROLE_PERMISSIONS = {
  Owner: {
    ...viewOnly(['dashboard', 'management', 'finance', 'purchasing', 'master_obat', 'doctor_management', 'doctor_schedule', 'schedule', 'facility', 'audit_log', 'documents', 'kontrol_usaha']),
    ...partialPerms(['schedule_approval'], ['view', 'approve']),
    // Owner mengelola jabatan dan matriks hak akses klinik. Perubahan ini
    // disimpan oleh adapter localStorage dan menjadi sumber akses seluruh UI.
    ...partialPerms(['user_role'], ['view', 'create', 'edit', 'delete', 'approve']),
    // Pengaturan Klinik adalah konfigurasi tingkat klinik yang dapat dikelola
    // langsung oleh Owner, bukan data operasional pasien.
    ...partialPerms(['settings'], ['view', 'create', 'edit', 'delete', 'approve']),
    ...partialPerms(['uat_center'], ['view', 'create', 'edit', 'approve']),
  },
  Admin: {
    ...viewOnly(['dashboard', 'audit_log', 'master_obat']),
    ...partialPerms(['settings', 'user_role', 'required_documents', 'search_help', 'uat_center'], ['view', 'create', 'edit', 'delete', 'approve']),
  },
  Dokter: DOCTOR_BASE,
  'Dokter Umum': DOCTOR_BASE,
  'Dokter Spesialis Penyakit Dalam': DOCTOR_BASE,
  'Dokter Locum': {
    ...partialPerms(['dashboard', 'patients', 'queue', 'rme', 'comms'], ['view', 'create']),
    ...viewOnly(['doctor_schedule']),
  },
  'Dokter Gigi': {
    ...DOCTOR_BASE,
    ...partialPerms(['odontogram'], ['view', 'create', 'edit']),
  },
  'Dokter Spesialis Anak': {
    ...DOCTOR_BASE,
    ...partialPerms(['growth_chart'], ['view', 'create', 'edit']),
  },
  Apoteker: {
    ...partialPerms(['dashboard', 'prescription', 'inventory', 'purchasing', 'comms'], ['view', 'create', 'edit']),
    ...viewOnly(['master_obat']),
  },
  'Apoteker Penanggung Jawab': {
    ...partialPerms(['dashboard', 'prescription', 'inventory', 'purchasing', 'comms', 'documents'], ['view', 'create', 'edit', 'approve']),
    ...viewOnly(['master_obat']),
  },
  'Apoteker Pendamping': {
    ...partialPerms(['dashboard', 'prescription', 'inventory', 'comms'], ['view', 'create', 'edit']),
    ...viewOnly(['master_obat', 'purchasing']),
  },
  'Admin Farmasi': {
    ...partialPerms(['dashboard', 'inventory', 'purchasing', 'documents', 'comms'], ['view', 'create', 'edit']),
    ...viewOnly(['master_obat', 'prescription']),
  },
  'TTK/Asisten Farmasi': {
    ...viewOnly(['dashboard', 'prescription', 'inventory', 'master_obat', 'comms']),
  },
  'Front Office': {
    ...partialPerms(['dashboard', 'patients', 'queue', 'front_desk', 'front_desk_documents', 'comms'], ['view', 'create', 'edit']),
    ...viewOnly(['doctor_schedule']),
  },
  Perawat: {
    ...partialPerms(['dashboard', 'queue', 'intake'], ['view', 'create']),
    ...viewOnly(['comms']),
  },
  'Manajer Operasional': {
    ...partialPerms(['dashboard', 'facility', 'schedule', 'hr', 'doctor_management', 'doctor_schedule', 'comms', 'ops_manager', 'documents'], ['view', 'create', 'edit']),
    ...partialPerms(['schedule_approval'], ['view', 'approve']),
    ...viewOnly(['audit_log']),
  },
  Kasir: {
    ...partialPerms(['dashboard', 'cashier', 'comms'], ['view', 'create', 'edit']),
  },
  Finance: {
    ...partialPerms(['dashboard', 'finance', 'purchasing', 'cashier', 'comms', 'documents'], ['view', 'create', 'edit', 'approve']),
  },
  'Asisten Dokter': {
    ...partialPerms(['dashboard', 'queue', 'intake', 'doctor_schedule', 'comms'], ['view', 'create']),
  },
  Staff: viewOnly(['dashboard', 'comms']),
  Pasien: viewOnly(['dashboard']),
};

export const DEFAULT_ADVANCED_PERMISSIONS = {
  Owner: ['view_hpp', 'manage_users_roles'],
  Admin: ['manage_users_roles'],
  Dokter: ['view_rme', 'edit_prescription'],
  'Dokter Umum': ['view_rme', 'edit_prescription'],
  'Dokter Spesialis Anak': ['view_rme', 'edit_prescription'],
  'Dokter Spesialis Penyakit Dalam': ['view_rme', 'edit_prescription'],
  'Dokter Gigi': ['view_rme', 'edit_prescription'],
  'Dokter Locum': ['view_rme', 'edit_prescription'],
  // Apoteker menjalankan dispensing, stok, dan pengadaan operasional. Approval
  // pembelian/HPP tetap berada pada APJ/otoritas keuangan.
  Apoteker: ['stock_adjustment'],
  'Apoteker Penanggung Jawab': ['stock_adjustment', 'approve_purchase', 'view_hpp'],
  'Apoteker Pendamping': ['stock_adjustment'],
  'Admin Farmasi': ['approve_purchase', 'view_hpp'],
  'TTK/Asisten Farmasi': [],
  'Front Office': [],
  Perawat: [],
  'Manajer Operasional': [],
  Kasir: [],
  Finance: ['post_payment', 'approve_purchase', 'view_hpp'],
  'Asisten Dokter': [],
  Staff: [],
  Pasien: [],
};

export const ROLE_COLORS = {
  Owner: 'purple',
  Admin: 'teal',
  Dokter: 'blue',
  'Dokter Umum': 'blue',
  'Dokter Spesialis Anak': 'emerald',
  'Dokter Spesialis Penyakit Dalam': 'purple',
  'Dokter Gigi': 'teal',
  'Dokter Locum': 'amber',
  Apoteker: 'emerald',
  'Apoteker Penanggung Jawab': 'emerald',
  'Apoteker Pendamping': 'teal',
  'Admin Farmasi': 'slate',
  'TTK/Asisten Farmasi': 'amber',
  'Front Office': 'slate',
  'Manajer Operasional': 'indigo',
  Kasir: 'rose',
  Finance: 'teal',
  'Asisten Dokter': 'indigo',
};

export function getClinicRole(user) {
  return user?.data?.clinic_role || user?.clinic_role || 'Staff';
}

// Management roles — additional administrative roles assigned to a doctor.
// Source of truth is DoctorProfile.management_roles; this helper reads a
// synced copy from user.data for synchronous access in the UI.
export function getManagementRoles(user) {
  return user?.data?.management_roles || user?.management_roles || [];
}

export function hasManagementRole(user) {
  return getManagementRoles(user).length > 0;
}

// Check module permission using dynamic role entity, with fallback to defaults
export function hasPermission(clinicRole, module, action, roles) {
  const defPerms = DEFAULT_ROLE_PERMISSIONS[clinicRole];
  const configuredRole = roles?.find(r => r.name === clinicRole && r.is_active);
  const configuredPermissions = configuredRole?.permissions;
  const hasConfiguredMatrix = configuredPermissions && Object.keys(configuredPermissions).length > 0;

  // Built-in roles have a non-negotiable maximum from the requirement. A
  // configured matrix may make them stricter, never broader.
  if (defPerms) {
    const allowedByCeiling = defPerms[module]?.[action] === true;
    if (!allowedByCeiling) return false;
    if (hasConfiguredMatrix) return configuredPermissions?.[module]?.[action] === true;
    return true;
  }

  // Custom roles start from zero (least privilege) and only receive explicit grants.
  return hasConfiguredMatrix && configuredPermissions?.[module]?.[action] === true;
}

export function hasAdvancedPermission(clinicRole, permKey, roles) {
  const defAdvs = DEFAULT_ADVANCED_PERMISSIONS[clinicRole];
  const configuredRole = roles?.find(r => r.name === clinicRole && r.is_active);
  const configured = configuredRole?.advanced_permissions;
  if (defAdvs) {
    if (!defAdvs.includes(permKey)) return false;
    return Array.isArray(configured) && configured.length > 0 ? configured.includes(permKey) : true;
  }
  return Array.isArray(configured) && configured.includes(permKey);
}

export function canAccess(path, clinicRole, roles) {
  const cleanPath = String(path || '/').split('?')[0].replace(/\/$/, '') || '/';
  const module = MODULE_KEYS[cleanPath];
  if (!module) return false;
  return hasPermission(clinicRole, module, 'view', roles);
}

export function canPerform(path, clinicRole, action, roles) {
  const cleanPath = String(path || '/').split('?')[0].replace(/\/$/, '') || '/';
  const module = MODULE_KEYS[cleanPath];
  if (!module) return false;
  return hasPermission(clinicRole, module, action, roles);
}

export function getAccessibleNav(navGroups, clinicRole, roles) {
  return navGroups
    .map(g => ({
      ...g,
      items: g.items.filter((item) => {
        // A module permission controls the broad capability.  A navigation
        // item may additionally be scoped to a specific built-in role so
        // role-specific workflows do not collapse into the same sidebar.
        if (Array.isArray(item.roles) && !item.roles.includes(clinicRole)) return false;
        if (Array.isArray(item.excludeRoles) && item.excludeRoles.includes(clinicRole)) return false;
        return canAccess(item.path, clinicRole, roles);
      }),
    }))
    .filter(g => g.items.length > 0);
}

export function isAdmin(clinicRole) {
  return clinicRole === 'Owner' || clinicRole === 'Admin';
}

// Client-side helper to log audit entries via backend function
export async function logAuditAction(opts) {
  try {
    await db.functions.invoke('logAudit', opts);
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}
