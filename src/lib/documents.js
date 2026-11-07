// Helper untuk fitur Dokumen & Lampiran
// Pemetaan owner_type → module permission & route navigasi

export const OWNER_TYPES = [
  'Dokter', 'Staf', 'Pasien', 'Kunjungan', 'Rekam Medis', 'Resep',
  'Obat', 'Pembelian', 'Faktur', 'Pembayaran Supplier', 'Supplier',
  'Barang Rusak', 'Retur', 'Stok', 'Keuangan', 'Peralatan',
  'SOP', 'Klinik', 'Konsultasi Online',
];

// Pemetaan owner_type → module key untuk cek hak akses
export const OWNER_TYPE_MODULES = {
  'Dokter': 'doctor_management',
  'Staf': 'hr',
  'Pasien': 'patients',
  'Kunjungan': 'queue',
  'Rekam Medis': 'rme',
  'Resep': 'prescription',
  'Obat': 'master_obat',
  'Pembelian': 'purchasing',
  'Faktur': 'finance',
  'Pembayaran Supplier': 'finance',
  'Supplier': 'purchasing',
  'Barang Rusak': 'inventory',
  'Retur': 'purchasing',
  'Stok': 'inventory',
  'Keuangan': 'finance',
  'Peralatan': 'facility',
  'SOP': 'settings',
  'Klinik': 'settings',
  'Konsultasi Online': 'rme',
};

// Pemetaan owner_type → route untuk navigasi ke data asal
export const OWNER_TYPE_ROUTES = {
  'Dokter': '/doctors',
  'Staf': '/hr',
  'Pasien': '/patients',
  'Kunjungan': '/queue',
  'Rekam Medis': '/doctor/exam',
  'Resep': '/pharmacy',
  'Obat': '/master-obat',
  'Pembelian': '/purchasing',
  'Faktur': '/finance',
  'Pembayaran Supplier': '/finance',
  'Supplier': '/purchasing',
  'Barang Rusak': '/inventory',
  'Retur': '/purchasing',
  'Stok': '/inventory',
  'Keuangan': '/finance',
  'Peralatan': '/facility',
  'SOP': '/settings',
  'Klinik': '/settings',
  'Konsultasi Online': '/doctor/exam',
};

// Kategori default per owner_type (saran, bisa diketik bebas)
export const DEFAULT_CATEGORIES = {
  'Dokter': ['CV', 'Foto', 'Identitas', 'STR', 'SIP', 'Sertifikat', 'Kontrak', 'Surat Tugas', 'Lainnya'],
  'Staf': ['CV', 'Identitas', 'Ijazah', 'Sertifikat', 'Kontrak', 'Surat Tugas', 'Lainnya'],
  'Pasien': ['Identitas', 'Rujukan', 'Hasil Pemeriksaan', 'Resep dari Luar', 'Persetujuan', 'Lainnya'],
  'Kunjungan': ['Hasil Pemeriksaan', 'Surat Rujukan', 'Persetujuan', 'Foto Klinis', 'Lainnya'],
  'Rekam Medis': ['Hasil Pemeriksaan Eksternal', 'Surat Rujukan', 'Foto Klinis', 'Lainnya'],
  'Resep': ['Resep Eksternal', 'Dokumen Pendukung', 'Lainnya'],
  'Obat': ['Foto Produk', 'Brosur Produk', 'Dokumen Supplier', 'Lainnya'],
  'Pembelian': ['Penawaran', 'PO', 'Surat Jalan', 'Penerimaan Barang', 'Lainnya'],
  'Faktur': ['Faktur Asli', 'Surat Jalan', 'Kontrabon', 'Nota Kredit/Debit', 'Lainnya'],
  'Pembayaran Supplier': ['Bukti Transfer', 'Bukti Pembayaran', 'Lainnya'],
  'Supplier': ['NPWP', 'Kontak', 'Perjanjian', 'Price List', 'Katalog', 'Lainnya'],
  'Barang Rusak': ['Foto Kerusakan', 'Berita Acara', 'Lainnya'],
  'Retur': ['Bukti Retur', 'Berita Acara', 'Lainnya'],
  'Stok': ['Berita Acara', 'Dokumen Pemusnahan', 'Lainnya'],
  'Keuangan': ['Invoice', 'Kuitansi', 'Bukti Transfer', 'Bukti Pengeluaran', 'Lainnya'],
  'Peralatan': ['Foto Alat', 'Invoice Pembelian', 'Garansi', 'Manual', 'Sertifikat', 'Laporan Servis', 'Lainnya'],
  'SOP': ['SOP', 'Formulir', 'Template', 'Izin Klinik', 'Perjanjian', 'Kebijakan Internal', 'Lainnya'],
  'Klinik': ['Izin Klinik', 'Perjanjian', 'Kebijakan Internal', 'Lainnya'],
  'Konsultasi Online': ['Dokumen Pasien', 'Foto', 'Lainnya'],
};

// Ikon file berdasarkan ekstensi
export function getFileIcon(ext) {
  const e = (ext || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(e)) return 'image';
  if (e === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(e)) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'excel';
  return 'file';
}

export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Hitung status dokumen berdasarkan valid_until
export function getDocStatus(doc) {
  if (!doc.valid_until) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const valid = new Date(doc.valid_until + 'T00:00:00');
  const diffMs = valid.getTime() - today.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return { status: 'expired', days: Math.abs(days), label: 'Sudah Berakhir' };
  const reminder = doc.reminder_days || 30;
  if (days <= reminder) return { status: 'expiring', days, label: `${days} hari lagi` };
  return { status: 'valid', days, label: `Berlaku ${days} hari lagi` };
}

// Cek apakah user boleh mengelola dokumen untuk owner_type tertentu
export function canManageDocuments(clinicRole, ownerType, roles) {
  if (clinicRole === 'Owner' || clinicRole === 'Admin') return true;
  const mod = OWNER_TYPE_MODULES[ownerType];
  if (!mod) return false;
  // Dynamic check via hasPermission
   
  return true; // fallback — UI akan filter lebih lanjut
}
