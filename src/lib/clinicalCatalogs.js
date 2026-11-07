// Quick-pick clinical catalogues are intentionally separated by the doctor's
// specialty. They help with data entry only: doctors can always enter a
// clinically appropriate diagnosis or custom procedure when it is not listed.

export const CLINICAL_SPECIALTIES = {
  UMUM: 'umum',
  ANAK: 'anak',
  GIGI: 'gigi',
  PENYAKIT_DALAM: 'penyakit_dalam',
};

export const CLINICAL_CATALOGS = {
  [CLINICAL_SPECIALTIES.UMUM]: {
    label: 'Dokter Umum',
    placeholders: {
      chiefComplaint: 'Contoh: demam, batuk, dan pilek sejak 3 hari',
      subjective: 'Riwayat keluhan, obat yang telah dikonsumsi, dan faktor risiko pasien…',
      physicalExam: 'Contoh: keadaan umum, THT, paru, abdomen, dan ekstremitas…',
      diagnosis: 'Contoh: Nasofaringitis akut',
      diagnosisCode: 'Contoh kode ICD-10: J00',
      treatmentPlan: 'Contoh: terapi simptomatik, edukasi, dan kontrol bila memburuk…',
      templateName: 'Contoh: ISPA Dewasa',
      diagnosisTag: 'Contoh: ISPA atau Hipertensi',
    },
    icd10: [
      { code: 'J00', desc: 'Nasofaringitis akut (common cold)' },
      { code: 'J02', desc: 'Faringitis akut' },
      { code: 'J03', desc: 'Tonsilitis akut' },
      { code: 'J11', desc: 'Influenza' },
      { code: 'J20', desc: 'Bronkitis akut' },
      { code: 'J45', desc: 'Asma' },
      { code: 'K30', desc: 'Dispepsia' },
      { code: 'K29', desc: 'Gastritis' },
      { code: 'A09', desc: 'Diare dan gastroenteritis' },
      { code: 'L20', desc: 'Dermatitis atopik' },
      { code: 'M54', desc: 'Nyeri punggung' },
      { code: 'R51', desc: 'Sakit kepala' },
      { code: 'N39', desc: 'Infeksi saluran kemih' },
    ],
    procedures: [
      { name: 'Konsultasi Dokter Umum', code: 'UMU-001', fee: 50000 },
      { name: 'Pemeriksaan Fisik Lanjutan', code: 'UMU-002', fee: 35000 },
      { name: 'Injeksi Intramuskular (IM)', code: 'UMU-003', fee: 25000 },
      { name: 'Injeksi Intravena (IV)', code: 'UMU-004', fee: 30000 },
      { name: 'Nebulizer', code: 'UMU-005', fee: 40000 },
      { name: 'Perawatan Luka Kecil', code: 'UMU-006', fee: 35000 },
      { name: 'Perawatan Luka Besar', code: 'UMU-007', fee: 75000 },
      { name: 'EKG 12 Lead', code: 'UMU-008', fee: 80000 },
      { name: 'Cek Gula Darah Sewaktu', code: 'UMU-009', fee: 15000 },
      { name: 'Pemberian Oksigen', code: 'UMU-010', fee: 25000 },
    ],
  },
  [CLINICAL_SPECIALTIES.ANAK]: {
    label: 'Dokter Spesialis Anak',
    placeholders: {
      chiefComplaint: 'Contoh: demam dan batuk pada anak sejak 2 hari',
      subjective: 'Awitan keluhan, asupan makan/minum, BAK, imunisasi, dan riwayat tumbuh kembang…',
      physicalExam: 'Contoh: keadaan umum anak, status hidrasi, THT, paru, dan tumbuh kembang…',
      diagnosis: 'Contoh: Demam, tidak spesifik',
      diagnosisCode: 'Contoh kode ICD-10: R50.9',
      treatmentPlan: 'Contoh: terapi sesuai berat badan, hidrasi, tanda bahaya, dan jadwal kontrol…',
      templateName: 'Contoh: Demam Anak',
      diagnosisTag: 'Contoh: Demam Anak atau ISPA Anak',
    },
    icd10: [
      { code: 'Z00.1', desc: 'Pemeriksaan kesehatan rutin anak' },
      { code: 'Z23', desc: 'Kebutuhan imunisasi' },
      { code: 'R50.9', desc: 'Demam, tidak spesifik' },
      { code: 'J06.9', desc: 'Infeksi saluran napas atas akut' },
      { code: 'J21.9', desc: 'Bronkiolitis akut' },
      { code: 'J45', desc: 'Asma anak' },
      { code: 'A09', desc: 'Diare dan gastroenteritis' },
      { code: 'K59.0', desc: 'Konstipasi' },
      { code: 'L20', desc: 'Dermatitis atopik' },
      { code: 'R62.5', desc: 'Keterlambatan perkembangan' },
      { code: 'E44.1', desc: 'Malnutrisi ringan' },
      { code: 'D50.9', desc: 'Anemia defisiensi besi' },
    ],
    procedures: [
      { name: 'Konsultasi Dokter Anak', code: 'ANK-001', fee: 60000 },
      { name: 'Pemeriksaan Tumbuh Kembang', code: 'ANK-002', fee: 75000 },
      { name: 'Skrining Perkembangan Anak', code: 'ANK-003', fee: 75000 },
      { name: 'Konseling Gizi Anak', code: 'ANK-004', fee: 50000 },
      { name: 'Pelayanan Imunisasi', code: 'ANK-005', fee: 40000 },
      { name: 'Nebulizer Anak', code: 'ANK-006', fee: 40000 },
      { name: 'Pemeriksaan Bilirubin Neonatus', code: 'ANK-007', fee: 50000 },
      { name: 'Observasi Anak', code: 'ANK-008', fee: 60000 },
    ],
  },
  [CLINICAL_SPECIALTIES.GIGI]: {
    label: 'Dokter Gigi',
    placeholders: {
      chiefComplaint: 'Contoh: sakit gigi kanan bawah atau gusi bengkak',
      subjective: 'Lokasi gigi, intensitas nyeri, pemicu panas/dingin, dan riwayat perawatan gigi…',
      physicalExam: 'Contoh: kondisi intraoral, gigi #48, karies/perkusi, gingiva, dan oklusi…',
      diagnosis: 'Contoh: Karies dentin',
      diagnosisCode: 'Contoh kode ICD-10: K02.1',
      treatmentPlan: 'Contoh: odontogram, rencana tambal/scaling/cabut, dan edukasi kebersihan mulut…',
      templateName: 'Contoh: Karies Dentin',
      diagnosisTag: 'Contoh: Karies atau Gingivitis',
    },
    icd10: [
      { code: 'K02.1', desc: 'Karies dentin' },
      { code: 'K02.9', desc: 'Karies gigi, tidak spesifik' },
      { code: 'K04.0', desc: 'Pulpitis' },
      { code: 'K04.7', desc: 'Abses periapikal tanpa sinus' },
      { code: 'K05.1', desc: 'Gingivitis kronis' },
      { code: 'K05.3', desc: 'Periodontitis kronis' },
      { code: 'K01.1', desc: 'Gigi impaksi' },
      { code: 'K08.1', desc: 'Kehilangan gigi' },
      { code: 'K00.6', desc: 'Gangguan erupsi gigi' },
      { code: 'K12.0', desc: 'Stomatitis aftosa rekuren' },
      { code: 'S03.0', desc: 'Dislokasi sendi temporomandibular' },
      { code: 'Z01.2', desc: 'Pemeriksaan gigi dan jaringan penunjang' },
    ],
    procedures: [
      { name: 'Konsultasi Dokter Gigi', code: 'GGI-001', fee: 75000 },
      { name: 'Pemeriksaan Gigi dan Odontogram', code: 'GGI-002', fee: 50000 },
      { name: 'Scaling', code: 'GGI-003', fee: 250000 },
      { name: 'Tambal Gigi Sementara', code: 'GGI-004', fee: 150000 },
      { name: 'Tambal Gigi Komposit', code: 'GGI-005', fee: 300000 },
      { name: 'Pencabutan Gigi Sulung', code: 'GGI-006', fee: 150000 },
      { name: 'Pencabutan Gigi Permanen Sederhana', code: 'GGI-007', fee: 300000 },
      { name: 'Aplikasi Topikal Fluor', code: 'GGI-008', fee: 100000 },
      { name: 'Perawatan Darurat Nyeri Gigi', code: 'GGI-009', fee: 100000 },
      { name: 'Foto Rontgen Periapikal', code: 'GGI-010', fee: 75000 },
    ],
  },
  [CLINICAL_SPECIALTIES.PENYAKIT_DALAM]: {
    label: 'Dokter Spesialis Penyakit Dalam',
    placeholders: {
      chiefComplaint: 'Contoh: kontrol tekanan darah atau gula darah tinggi',
      subjective: 'Keluhan utama, komorbid, obat rutin, kepatuhan terapi, dan hasil pemeriksaan sebelumnya…',
      physicalExam: 'Contoh: keadaan umum, jantung-paru, abdomen, edema, dan pemeriksaan terkait komorbid…',
      diagnosis: 'Contoh: Hipertensi esensial',
      diagnosisCode: 'Contoh kode ICD-10: I10',
      treatmentPlan: 'Contoh: evaluasi terapi rutin, pemeriksaan penunjang, perubahan gaya hidup, dan kontrol…',
      templateName: 'Contoh: Kontrol Hipertensi',
      diagnosisTag: 'Contoh: Hipertensi atau Diabetes',
    },
    icd10: [
      { code: 'I10', desc: 'Hipertensi esensial' },
      { code: 'E11', desc: 'Diabetes melitus tipe 2' },
      { code: 'E78.5', desc: 'Hiperlipidemia, tidak spesifik' },
      { code: 'I25.9', desc: 'Penyakit jantung iskemik kronis' },
      { code: 'I50.9', desc: 'Gagal jantung, tidak spesifik' },
      { code: 'N18.9', desc: 'Penyakit ginjal kronis, tidak spesifik' },
      { code: 'K21.9', desc: 'Penyakit refluks gastroesofageal' },
      { code: 'K29', desc: 'Gastritis' },
      { code: 'E03.9', desc: 'Hipotiroidisme, tidak spesifik' },
      { code: 'D64.9', desc: 'Anemia, tidak spesifik' },
      { code: 'J44.9', desc: 'Penyakit paru obstruktif kronis' },
      { code: 'M10.9', desc: 'Gout, tidak spesifik' },
    ],
    procedures: [
      { name: 'Konsultasi Penyakit Dalam', code: 'PD-001', fee: 150000 },
      { name: 'Interpretasi EKG 12 Lead', code: 'PD-002', fee: 100000 },
      { name: 'Pemeriksaan Gula Darah Sewaktu', code: 'PD-003', fee: 15000 },
      { name: 'Pemeriksaan HbA1c', code: 'PD-004', fee: 150000 },
      { name: 'Spirometri', code: 'PD-005', fee: 150000 },
      { name: 'Konseling Diabetes', code: 'PD-006', fee: 75000 },
      { name: 'Konseling Hipertensi', code: 'PD-007', fee: 75000 },
      { name: 'Observasi Rawat Jalan', code: 'PD-008', fee: 100000 },
    ],
  },
};

export function getClinicalSpecialty({ specialization = '', role = '' } = {}) {
  const source = `${specialization} ${role}`.toLowerCase();
  if (source.includes('gigi')) return CLINICAL_SPECIALTIES.GIGI;
  if (source.includes('anak') || source.includes('pediatr')) return CLINICAL_SPECIALTIES.ANAK;
  if (source.includes('penyakit dalam') || source.includes('intern')) return CLINICAL_SPECIALTIES.PENYAKIT_DALAM;
  return CLINICAL_SPECIALTIES.UMUM;
}

export function getClinicalCatalog(context) {
  return CLINICAL_CATALOGS[getClinicalSpecialty(context)];
}
