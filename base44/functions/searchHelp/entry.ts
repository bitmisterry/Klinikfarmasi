const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Cari & Bantuan — fallback LLM ketika pencocokan sinonim/istilah lokal tidak ketemu.
// Menerima query + konteks (role, halaman aktif), memanggil InvokeLLM dengan daftar
// fitur/panduan yang tersedia, mengembalikan hasil TERARAHKAN (bukan jawaban terbuka).
// LLM hanya memahami & mengarahkan — TIDAK melakukan tindakan apa pun.

const AVAILABLE_FEATURES = [
  { title: 'Tambah Pasien Baru', path: '/patients?action=new', label: 'Pelayanan › Pasien' },
  { title: 'Pendaftaran & Antrean', path: '/queue', label: 'Pelayanan › Antrean' },
  { title: 'Pemeriksaan Dokter', path: '/doctor-exam', label: 'Pelayanan › Pemeriksaan' },
  { title: 'Rekam Medis', path: '/patients', label: 'Pelayanan › Pasien' },
  { title: 'Resep & Racikan', path: '/pharmacy', label: 'Farmasi › Resep' },
  { title: 'Cetak Resep & Etiket', path: '/pharmacy', label: 'Farmasi › Resep' },
  { title: 'Buat Racikan', path: '/pharmacy', label: 'Farmasi › Resep' },
  { title: 'Daftar Obat & Barang', path: '/master-obat', label: 'Farmasi › Daftar Obat' },
  { title: 'Harga Beli / HPP Obat', path: '/master-obat', label: 'Farmasi › Daftar Obat' },
  { title: 'Stok Obat', path: '/inventory', label: 'Farmasi › Stok' },
  { title: 'Stock Opname', path: '/inventory', label: 'Farmasi › Stok › Opname' },
  { title: 'Barang Rusak / Defecta', path: '/inventory', label: 'Farmasi › Stok › Defecta' },
  { title: 'Obat Mendekati Kadaluwarsa', path: '/inventory', label: 'Farmasi › Stok › Kadaluwarsa' },
  { title: 'Pembelian & Faktur Supplier', path: '/purchasing', label: 'Farmasi › Pembelian' },
  { title: 'Input Faktur Pembelian', path: '/purchasing?action=invoice', label: 'Farmasi › Pembelian' },
  { title: 'Supplier', path: '/purchasing', label: 'Farmasi › Pembelian › Supplier' },
  { title: 'Kontrabon / Faktur Jatuh Tempo', path: '/finance', label: 'Keuangan › Utang' },
  { title: 'Utang Supplier', path: '/finance', label: 'Keuangan › Utang' },
  { title: 'Kasir / Penjualan', path: '/kasir', label: 'Keuangan › Kasir' },
  { title: 'Tutup Kas / Shift', path: '/kasir', label: 'Keuangan › Kasir' },
  { title: 'Pengaturan Pajak / PPN', path: '/settings', label: 'Pengaturan › Klinik' },
  { title: 'Pendapatan Klinik', path: '/management', label: 'Manajemen › Laporan' },
  { title: 'Jadwal Dokter', path: '/doctor-schedule', label: 'Pelayanan › Jadwal Dokter' },
  { title: 'Dokter & Staf', path: '/doctors', label: 'Manajemen › Dokter & Staf' },
  { title: 'Pengguna', path: '/hr', label: 'Pengaturan › Pengguna' },
  { title: 'Jabatan & Hak Akses', path: '/roles', label: 'Pengaturan › Jabatan' },
  { title: 'Pengaturan Klinik', path: '/settings', label: 'Pengaturan › Klinik' },
  { title: 'Kontrol Usaha', path: '/kontrol-usaha', label: 'Manajemen › Kontrol Usaha' },
  { title: 'Riwayat Aktivitas', path: '/audit-log', label: 'Manajemen › Riwayat' },
  { title: 'Komunikasi Internal', path: '/comms', label: 'Pengaturan › Komunikasi' },
  { title: 'Odontogram (Gigi)', path: '/odontogram', label: 'Pelayanan › Odontogram' },
  { title: 'Growth Chart & Imunisasi', path: '/growth-chart', label: 'Pelayanan › Growth Chart' },
  { title: 'Ruangan & Peralatan', path: '/facility', label: 'Manajemen › Fasilitas' },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const query = (body.query || '').trim();
    const currentRoute = body.currentRoute || '';
    const role = body.role || user?.data?.clinic_role || user?.clinic_role || 'Staff';

    if (!query || query.length < 2) {
      return Response.json({ results: [], source: 'llm' });
    }

    const featureList = AVAILABLE_FEATURES.map(f => `- ${f.title} (lokasi: ${f.label}, buka: ${f.path})`).join('\n');

    const prompt = `Anda adalah asisten pencarian untuk aplikasi manajemen klinik & farmasi berbahasa Indonesia.
Pengguna (jabatan: ${role}) bertanya atau mencari: "${query}"

Daftar fitur/menu/panduan yang tersedia di aplikasi:
${featureList}

Tugas Anda:
1. Pahami maksud pengguna dari bahasa sehari-hari (bisa sinonim, singkatan, atau kalimat).
2. Cocokkan dengan 1-3 fitur/panduan yang paling relevan dari daftar di atas.
3. Jika pengguna bertanya "bagaimana/cara", kategorikan sebagai "Cara Melakukan" dan berikan langkah singkat.
4. Jika pengguna menanyakan lokasi ("di mana"), kategorikan sebagai "Pertanyaan".
5. Jika cocok dengan menu/fitur langsung, kategorikan sebagai "Menu & Fitur".
6. JANGAN mengarang fitur yang tidak ada di daftar. Jika tidak ada yang cocok, kembalikan array kosong.
7. Jangan melakukan tindakan apa pun — hanya mengarahkan.

Kembalikan JSON dengan skema:
{
  "results": [
    {
      "title": "judul fitur",
      "category": "Menu & Fitur" | "Cara Melakukan" | "Pertanyaan",
      "description": "penjelasan singkat 1-2 kalimat dalam bahasa Indonesia",
      "page_path": "path tujuan",
      "page_label": "lokasi tampil",
      "action_label": "teks tombol",
      "steps": ["langkah 1", "langkah 2"] (opsional, hanya untuk Cara Melakukan)
    }
  ]
}`;

    const llmRes = await db.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                category: { type: 'string' },
                description: { type: 'string' },
                page_path: { type: 'string' },
                page_label: { type: 'string' },
                action_label: { type: 'string' },
                steps: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    });

    const data = llmRes?.results || llmRes?.data?.results || [];
    // Sanitize: only keep fields we need, validate path exists in our list
    const validPaths = new Set(AVAILABLE_FEATURES.map(f => f.path.split('?')[0]));
    const cleaned = (Array.isArray(data) ? data : []).map(r => {
      const base = (r.page_path || '').split('?')[0];
      if (!validPaths.has(base)) return null;
      return {
        title: r.title || '',
        category: ['Menu & Fitur', 'Cara Melakukan', 'Pertanyaan'].includes(r.category) ? r.category : 'Menu & Fitur',
        description: r.description || '',
        page_path: r.page_path,
        page_label: r.page_label || '',
        action_label: r.action_label || 'Buka',
        steps: Array.isArray(r.steps) ? r.steps : undefined,
        source: 'llm',
      };
    }).filter(Boolean).slice(0, 4);

    return Response.json({ results: cleaned, source: 'llm' });
  } catch (error) {
    return Response.json({ error: error.message, results: [] }, { status: 500 });
  }
}