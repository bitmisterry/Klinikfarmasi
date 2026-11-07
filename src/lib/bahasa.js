// Standar Bahasa Pekerjaan — pemetaan istilah teknis ke bahasa pengguna
// Digunakan di seluruh UI. Istilah industri (SIP, STR, RME, Resep, Racikan, Etiket,
// Signa, Batch, ED, Kartu Stok, Stock Opname, Kontrabon, Faktur, PIO) tetap dipakai.

export const BAHASA = {
  // Portal & Workspace
  doctorPortal: 'Dokter',
  doctorWorkspace: 'Pemeriksaan Dokter',
  doctorAssistantPortal: 'Asisten Dokter',
  pharmacyWorkspace: 'Farmasi',
  // Data
  masterDrug: 'Daftar Obat & Barang',
  smartDrugSearch: 'Cari Obat',
  pharmacyIntelligence: 'Informasi Obat',
  pio: 'Informasi Obat',
  liveStock: 'Stok Saat Ini',
  substitutionIntelligence: 'Obat Pengganti',
  // Notifikasi
  targetedNotification: 'Pemberitahuan',
  // Kontrol
  controlEngine: 'Kontrol Usaha',
  exception: 'Perlu Diperiksa',
  auditLog: 'Riwayat Aktivitas',
  // Role & User
  rolePermission: 'Jabatan & Hak Akses',
  customRole: 'Buat Jabatan Baru',
  userManagement: 'Pengguna',
  // Inventory
  stockAdjustment: 'Penyesuaian Stok',
  defect: 'Barang Rusak / Bermasalah',
  procurement: 'Pengadaan / Pembelian',
  // Finance
  billing: 'Tagihan',
  payment: 'Pembayaran',
  // Clinical
  teleconsultation: 'Konsultasi Online',
  medicalRecord: 'Rekam Medis',
  prescription: 'Resep',
  dispensing: 'Penyiapan Obat',
  followUp: 'Tindak Lanjut / Kontrol',
  // Action
  quickAction: 'Akses Cepat',
  needAttention: 'Perlu Perhatian',
};

// Status warna standar — hanya 4 warna status
export const STATUS_COLORS = {
  green: { dot: '🟢', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Tersedia / Selesai' },
  yellow: { dot: '🟡', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Perlu Perhatian' },
  red: { dot: '🔴', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Masalah / Terlambat' },
  gray: { dot: '⚪', text: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Tidak Aktif / Habis' },
};

// Helper untuk stok obat
export function getStockStatus(stock, minStock = 0) {
  if (stock <= 0) return 'gray';
  if (stock <= minStock) return 'red';
  if (stock <= minStock * 1.5) return 'yellow';
  return 'green';
}

export function getStockLabel(status) {
  const labels = { green: 'Tersedia', yellow: 'Menipis', red: 'Hampir Habis', gray: 'Habis' };
  return labels[status] || 'Tersedia';
}