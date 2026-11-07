// Central navigation config — single source of truth for sidebar, mobile nav, and search.
// Paths must exist in App.jsx routes AND in MODULE_KEYS (roles.js) for permission filtering.
import {
  LayoutDashboard, Clock, Stethoscope, User, CalendarDays, Pill, Package,
  Receipt, Wallet, BarChart3, Building2, AlertTriangle, FileText, Users,
  Shield, Settings, Search, ScrollText, FlaskConical, Baby, Activity,
  MessageSquare, ClipboardCheck, CalendarClock, Contact, Network,
  Home, History, Bell, Briefcase, Layers, CreditCard,
  TestTube2,
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    label: 'Beranda',
    items: [{ label: 'Beranda', path: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Pelayanan',
    items: [
      { label: 'Pendaftaran & Antrean', path: '/queue', icon: Clock, excludeRoles: ['Perawat'] },
      { label: 'Intake Perawat', path: '/nurse/intake', icon: ClipboardCheck },
      { label: 'Front Desk', path: '/front-desk', icon: Contact },
      { label: 'Dokumen Disetujui', path: '/front-desk/documents', icon: FileText, roles: ['Front Office'] },
      { label: 'Pemeriksaan', path: '/doctor/exam', icon: Stethoscope },
      { label: 'Pasien', path: '/patients', icon: User },
      { label: 'Jadwal Dokter', path: '/doctor-schedule', icon: CalendarDays },
      { label: 'Persetujuan Cuti', path: '/schedule-approvals', icon: ClipboardCheck, roles: ['Owner', 'Manajer Operasional'] },
      { label: 'Odontogram', path: '/odontogram', icon: Activity },
      { label: 'Tumbuh Kembang & Imunisasi', path: '/growth-chart', icon: Baby },
    ],
  },
  {
    label: 'Farmasi',
    items: [
      { label: 'Resep & Racikan', path: '/pharmacy', icon: Pill, excludeRoles: ['Admin Farmasi'] },
      { label: 'Stok', path: '/inventory', icon: Package },
      { label: 'Pembelian', path: '/purchasing', icon: Receipt, excludeRoles: ['Apoteker Pendamping'] },
      // Pharmacy roles share the master modules, but their operational
      // responsibility must remain visible in the navigation as well.
      { label: 'Approval Pengadaan', path: '/purchasing?tab=po', icon: Shield, roles: ['Apoteker Penanggung Jawab'] },
      { label: 'SIPNAP & Obat Khusus', path: '/pharmacy?tab=sipnap', icon: ScrollText, roles: ['Apoteker', 'Apoteker Penanggung Jawab'] },
      { label: 'Pemusnahan Obat', path: '/pharmacy?tab=pemusnahan', icon: AlertTriangle, roles: ['Apoteker', 'Apoteker Penanggung Jawab', 'Admin Farmasi'] },
      { label: 'Penerimaan & Faktur', path: '/purchasing?tab=receipt', icon: Package, roles: ['Admin Farmasi'] },
      { label: 'Daftar Obat & Barang', path: '/master-obat', icon: FlaskConical },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      { label: 'Kasir', path: '/kasir', icon: Receipt },
      { label: 'Keuangan & Utang', path: '/finance', icon: Wallet },
    ],
  },
  {
    label: 'Manajemen',
    items: [
      { label: 'Dokter & Staf', path: '/doctors', icon: Stethoscope },
      { label: 'Jadwal Shift', path: '/schedule', icon: CalendarClock },
      { label: 'Ruangan & Peralatan', path: '/facility', icon: Building2 },
      { label: 'Manajer Operasional', path: '/ops-manager', icon: ClipboardCheck },
      { label: 'Laporan', path: '/management', icon: BarChart3 },
      { label: 'Kontrol Usaha', path: '/kontrol-usaha', icon: AlertTriangle },
      { label: 'Dokumen', path: '/documents', icon: FileText },
      { label: 'Komunikasi Internal', path: '/comms', icon: MessageSquare },
      { label: 'Riwayat Aktivitas', path: '/audit-log', icon: ScrollText },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { label: 'Pengguna', path: '/hr', icon: Users },
      { label: 'Jabatan & Hak Akses', path: '/roles', icon: Shield },
      { label: 'Dokumen Wajib', path: '/required-documents', icon: FileText },
      { label: 'Pengaturan Klinik', path: '/settings', icon: Settings },
      { label: 'Cari & Bantuan', path: '/search-help-settings', icon: Search },
      { label: 'Pusat UAT', path: '/uat-center', icon: TestTube2, roles: ['Owner', 'Admin'] },
    ],
  },
];

// Mobile bottom nav — 5 quick destinations, filtered by permission
export const MOBILE_NAV = [
  { label: 'Beranda', path: '/', icon: LayoutDashboard },
  { label: 'Antrean', path: '/queue', icon: Clock },
  { label: 'Farmasi', path: '/pharmacy', icon: Pill },
  { label: 'Kontrol', path: '/kontrol-usaha', icon: AlertTriangle },
  { label: 'Dokumen', path: '/documents', icon: FileText },
];

// ── Doctor Portal sidebar ────────────────────────────────
export const DOCTOR_PORTAL_NAV = [
  {
    label: 'Utama',
    items: [{ label: 'Beranda', path: '/doctor', icon: Home }],
  },
  {
    label: 'Pasien',
    items: [
      { label: 'Pasien Saya', path: '/doctor/patients', icon: Users },
      { label: 'Riwayat Kunjungan', path: '/doctor/history', icon: History },
    ],
  },
  {
    label: 'Pemeriksaan',
    items: [
      { label: 'Pemeriksaan', path: '/doctor/exam', icon: Stethoscope },
      { label: 'Resep & Racikan', path: '/doctor/exam?tab=resep', icon: FlaskConical },
      { label: 'Odontogram', path: '/odontogram', icon: Activity, roles: ['Dokter Gigi'] },
      { label: 'Tumbuh Kembang & Imunisasi', path: '/growth-chart', icon: Baby, roles: ['Dokter Spesialis Anak'] },
      { label: 'Template Pemeriksaan', path: '/doctor/templates', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Jadwal & Pemberitahuan',
    items: [
      { label: 'Jadwal Praktik', path: '/doctor/schedule', icon: CalendarDays },
      { label: 'Pemberitahuan', path: '/doctor/requests', icon: Bell },
    ],
  },
  {
    label: 'Komunikasi',
    items: [
      { label: 'Live Chat', path: '/doctor/comms', icon: MessageSquare },
      { label: 'Memo Internal', path: '/doctor/comms?tab=memo', icon: FileText },
    ],
  },
  {
    label: 'Saya',
    items: [
      { label: 'Profil', path: '/doctor/profile', icon: User },
      { label: 'Jasa Saya', path: '/doctor/jasa', icon: Wallet },
    ],
  },
];

export const DOCTOR_MANAGEMENT_NAV = [
  {
    label: 'Manajemen',
    items: [
      { label: 'Manajemen Dokter', path: '/doctors', icon: Stethoscope, module: 'doctor_management' },
      { label: 'Jadwal Dokter', path: '/doctor-schedule', icon: CalendarDays, module: 'doctor_schedule' },
      { label: 'Laporan & Kontrol', path: '/management', icon: Activity, module: 'management' },
      { label: 'Manajemen Staff', path: '/hr', icon: Briefcase, module: 'hr' },
    ],
  },
];

export const DOCTOR_ASSISTANT_NAV = [
  {
    label: 'Beranda',
    items: [{ label: 'Beranda', path: '/doctor/assistant', icon: Home }],
  },
  {
    label: 'Pasien',
    items: [
      { label: 'Pasien Saya', path: '/doctor/patients', icon: Users },
      { label: 'Riwayat', path: '/doctor/history', icon: History },
    ],
  },
  {
    label: 'Jadwal',
    items: [{ label: 'Jadwal', path: '/doctor/schedule', icon: CalendarDays }],
  },
  {
    label: 'Aktivitas',
    items: [{ label: 'Permintaan/Notifikasi', path: '/doctor/requests', icon: Bell }],
  },
  {
    label: 'Komunikasi',
    items: [{ label: 'Live Chat', path: '/doctor/comms', icon: MessageSquare }],
  },
];

export const DOCTOR_MOBILE_NAV = [
  { label: 'Beranda', path: '/doctor', icon: Home },
  { label: 'Periksa', path: '/doctor/exam', icon: Stethoscope },
  { label: 'Jadwal', path: '/doctor/schedule', icon: CalendarDays },
  { label: 'Notif', path: '/doctor/requests', icon: Bell },
];

export const ASSISTANT_MOBILE_NAV = [
  { label: 'Beranda', path: '/doctor/assistant', icon: Home },
  { label: 'Pasien', path: '/doctor/patients', icon: Users },
  { label: 'Jadwal', path: '/doctor/schedule', icon: CalendarDays },
  { label: 'Notif', path: '/doctor/requests', icon: Bell },
];

// ── Patient Portal nav ──────────────────────────────────
export const PATIENT_PORTAL_NAV = [
  { label: 'Beranda', path: '/portal', icon: Home },
  { label: 'Rekam Medis', path: '/portal/records', icon: FileText },
  { label: 'Janji Temu', path: '/portal/booking', icon: CalendarDays },
  { label: 'Tagihan', path: '/portal/billing', icon: CreditCard },
];

// Flatten all nav items for quick lookups (search, breadcrumbs)
export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
