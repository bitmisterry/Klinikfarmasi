import { hasBlockingPrescriptionFlags, parseFreeTextPrescription } from '../src/lib/freeTextPrescription.js';
import { checkAllergies } from '../src/lib/prescriptionSafety.js';
import { buildPrescriptionData, buildLabelData, classifyLabelRoute, detectLabelType, generateAdministrativeDocumentHTML, generatePrescriptionHTML } from '../src/lib/printEngine.js';
import { computeRacikan, fmtNum, fmtRupiah } from '../src/lib/racikan.js';

const medicines = [
  { id: 'pcm', name: 'Paracetamol 500 mg', generic_name: 'Paracetamol', active_substance: 'Paracetamol', strength: '500 mg', form: 'Tablet', is_active: true },
  { id: 'amx', name: 'Amoxicillin 500 mg', generic_name: 'Amoxicillin', active_substance: 'Amoxicillin', strength: '500 mg', form: 'Kapsul', is_active: true },
  { id: 'forifek', name: 'Forifek Forte 60 ml', generic_name: 'Forifek Forte', strength: '60 ml', form: 'Sirup', is_active: true },
  { id: 'proris-1', name: 'Proris 100 mg/5 ml', generic_name: 'Proris', strength: '100 mg/5 ml', form: 'Sirup', is_active: true },
  { id: 'proris-2', name: 'Proris Forte 200 mg/5 ml', generic_name: 'Proris', strength: '200 mg/5 ml', form: 'Sirup', is_active: true },
  { id: 'meptin', name: 'Meptin 4 mg', generic_name: 'Meptin', strength: '4 mg', form: 'Tablet', is_active: true },
  { id: 'opicort', name: 'Opicort 5 mg', generic_name: 'Opicort', strength: '5 mg', form: 'Tablet', is_active: true },
  { id: 'mucera', name: 'Mucera 30 mg', generic_name: 'Mucera', strength: '30 mg', form: 'Tablet', is_active: true },
];

const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(fmtNum('1,5') === '1,5', 'Formatter racikan harus menerima angka desimal dalam bentuk teks');
assert(fmtNum('2') === '2' && fmtNum('bukan-angka') === '0', 'Formatter racikan harus aman untuk data teks lama');
assert(fmtRupiah('12500') === 'Rp 12.500', 'Formatter rupiah racikan harus menerima string angka');
const legacyRacikan = computeRacikan({ jumlah_ambil: '2', kemasan_fee: '1000', jasa_racik_fee: '500', components: [{ kekuatan: '500 mg', dosis_per_racikan: '250', harga_unit: '3000' }] });
assert(legacyRacikan.total === 4500, 'Kalkulator racikan harus menormalkan nilai teks dari data lama');

const caseA = parseFreeTextPrescription('R/ Paracetamol 500 mg no. X\nS TDD PC TAB 1\nne iter', { medicines });
assert(!caseA.flags.length, 'Case A harus lolos tanpa FLAG');
assert(caseA.items[0]?.quantity === 10, 'Case A harus membaca No. X sebagai 10');
assert(caseA.items[0]?.signa?.translation === '3 kali sehari, 1 tablet, sesudah makan', 'Case A harus menerjemahkan signa');

const caseB = parseFreeTextPrescription(`R/ Forifek Forte 60 ml
Proris 2000 mg
Meptin 4 tab
Cerita 5 tab
Opicort 7 tab
Mucera 5 tab
Mfm s 3 dd 1 pc`, { medicines });
assert(caseB.racikan?.components?.length === 6, 'Case B harus membentuk enam komponen Mfm');
assert(caseB.flags.some((flag) => flag.code === 'DRUG_NOT_FOUND'), 'Case B harus menandai Cerita tidak ditemukan');
assert(caseB.flags.some((flag) => flag.code === 'DRUG_AMBIGUOUS'), 'Case B harus menandai kekuatan Proris ambigu');
assert(caseB.flags.some((flag) => flag.code === 'SIGNA_INCOMPLETE'), 'Case B harus menandai satuan signa racikan yang belum ada');
assert(caseB.review_state === 'BLOCKED', 'Resep dengan FLAG merah harus berstatus BLOCKED');
assert(caseB.line_results.some((line) => line.role === 'component' && line.status === 'unresolved'), 'Komponen racikan yang tidak ditemukan harus terlihat per baris');

const caseC = parseFreeTextPrescription('R/ Amoxicillin 500 mg no. XV\nS 3 xx dd 1 pc', { medicines });
assert(hasBlockingPrescriptionFlags(caseC), 'Case C harus diblokir');
assert(caseC.flags.some((flag) => flag.code === 'UNKNOWN_ABBREVIATION'), 'Case C harus menandai xx sebagai singkatan tidak dikenal');

const allergyCase = parseFreeTextPrescription('R/ Amoxicillin 500 mg no. XV\nS 3 dd 1 kapsul\nne iter', { medicines });
const allergyWarnings = checkAllergies(allergyCase.items, { allergies: 'Amoxicillin' });
assert(allergyWarnings.length === 1, 'Amoxicillin harus memunculkan peringatan alergi pasien');
assert(allergyWarnings[0].severity === 'critical', 'Peringatan alergi harus bersifat critical');

assert(detectLabelType({ medicine_name: 'Gentamicin Salep', form: 'Salep' }) === 'blue', 'Salep harus memakai etiket biru');
assert(detectLabelType({ medicine_name: 'Ceftriaxone', form: 'Injeksi' }) === 'white', 'Injeksi tidak boleh otomatis dianggap obat luar');
assert(detectLabelType({ medicine_name: 'Tetes Mata Antibiotik', form: 'Tetes', administration_route: 'external' }) === 'blue', 'Rute obat luar eksplisit harus selalu memakai etiket biru');
assert(classifyLabelRoute({ medicine_name: 'Vitamin Drops', form: 'Tetes' }).requiresVerification, 'Sediaan tetes tanpa rute pemakaian harus diverifikasi, bukan ditebak sebagai obat luar');
assert(detectLabelType({ medicine_name: 'Puyer Anak', form: 'Puyer', is_racikan: true }) === 'white', 'Racikan obat dalam tetap memakai etiket putih, bukan warna ketiga');

const printConfig = {
  clinic_name: 'Klinik Uji', clinic_address: 'Jl. Sehat No. 1', clinic_phone: '021-123456',
  rx_show_age: true, rx_show_weight: true, rx_show_sip: true, rx_show_allergy: true, rx_show_mr: true,
};
const labelData = buildLabelData(
  { prescription_number: 'RX-LABEL-001', patient_name: 'Pasien Uji' },
  { medicine_name: 'Paracetamol 500 mg', strength: '500 mg', dosage: '3 kali sehari, 1 tablet', quantity: 10 },
  { form: 'Tablet' },
  printConfig,
);
assert(labelData.dosage === '3 kali sehari, 1 tablet', 'Etiket harus membawa aturan pakai dari resep dokter');
const printData = buildPrescriptionData(
  { prescription_number: 'RX-UJI-001', patient_name: 'Pasien Uji', doctor_name: 'dr. Uji', digital_signature: 'dr. Uji • SIP-UJI', doctor_confirmed_at: '2026-10-22T08:00:00.000Z', original_text: 'R/ Paracetamol 500 mg No. X\nS. 3 dd tab 1 pc\nne iter', items: caseA.items },
  { full_name: 'Pasien Uji', birth_date: '2000-01-01', weight: 55, phone: '08123456789', address: 'Bandung', allergies: 'Amoxicillin', mr_number: 'RM-UJI-001' },
  { display_name: 'dr. Uji', sip_number: 'SIP-UJI', practice_address: 'Poli Umum', phone: '021-123456' },
  printConfig,
);
const prescriptionHtml = generatePrescriptionHTML(printData, printConfig, 'Normal');
assert(printData.patient.phone === '08123456789', 'Data cetak harus membawa telepon pasien');
assert(prescriptionHtml.includes('Jl. Sehat No. 1') && prescriptionHtml.includes('SIP-UJI'), 'Resep cetak harus memuat fasilitas dan SIP dokter');
assert(prescriptionHtml.includes('Telp.:') && prescriptionHtml.includes('Alergi:'), 'Resep cetak harus memuat kontak dan alergi pasien');
assert(prescriptionHtml.includes('<strong>Pro:</strong>') && prescriptionHtml.includes('Tertanda secara elektronik'), 'Resep cetak harus memuat blok Pro dan konfirmasi tanda tangan elektronik');
assert(prescriptionHtml.includes('Paracetamol 500 mg No. X') && !prescriptionHtml.includes('Interpretasi sistem:'), 'Isi cetak harus mengutamakan teks asli dokter, bukan interpretasi sistem');

const noLiquidBase = parseFreeTextPrescription('R/ Meptin 4 mg\nMfm S 3 dd 1 ml\nne iter', { medicines });
assert(noLiquidBase.flags.some((flag) => flag.code === 'MFM_LIQUID_BASE_REQUIRED'), 'Mfm tanpa basis cair harus diblokir');

const invalidMixtureUnit = parseFreeTextPrescription('R/ Forifek Forte 60 ml\nMfm S 3 dd 1 tab\nne iter', { medicines });
assert(invalidMixtureUnit.flags.some((flag) => flag.code === 'SIGNA_MIXTURE_UNIT_REQUIRED'), 'Mfm dengan satuan tablet harus diblokir');

const actualPowderRx = parseFreeTextPrescription(`R/ Proris 150mg
Aminophilin 75mg
Meptin 1/2 tab
Cerini 1/2 tab
Opicort 1 tab
M.f pulv dtd No XV
Da in cap
S 3 dd cap 1
ne iter`, { medicines });
assert(actualPowderRx.racikan?.bentuk_racikan === 'Puyer', 'M.f pulv harus dibaca sebagai racikan puyer, bukan mixtura');
assert(actualPowderRx.racikan?.quantity === 15, 'dtd No XV harus dibaca sebagai jumlah 15 racikan');
assert(actualPowderRx.racikan?.packaging === 'Da in capsulae', 'Da in cap harus disimpan sebagai instruksi kemasan');
assert(actualPowderRx.racikan?.signa?.translation === '3 kali sehari, 1 kapsul', 'Signa 3 dd cap 1 harus dibaca dengan benar');
assert(actualPowderRx.line_results.some((line) => line.role === 'compounding' && line.status === 'matched'), 'Instruksi M.f. dan jumlah racikan harus memiliki status per baris');
assert(actualPowderRx.line_results.some((line) => line.role === 'dispensing' && line.status === 'matched'), 'Da in cap harus memiliki status per baris');
assert(!actualPowderRx.translated_text.includes('4 mg 4 mg'), 'Interpretasi tidak boleh menggandakan kekuatan obat');
assert(!actualPowderRx.flags.some((flag) => flag.code === 'MFM_LIQUID_BASE_REQUIRED'), 'Puyer tidak boleh gagal hanya karena tidak memiliki basis cair');
assert(actualPowderRx.flags.some((flag) => flag.code === 'DRUG_NOT_FOUND'), 'Obat yang belum ada di formularium harus tetap diberi FLAG, bukan ditebak sistem');

const actualLiquidRx = parseFreeTextPrescription(`R/ Forifek Forte 60 ml
Proris tab 2.000mg
Meptin 5 tab
Cerini 6 tab
Mucera 5 tab
M.f.m
S 3 dd cth 1
ne iter`, { medicines });
assert(actualLiquidRx.racikan?.bentuk_racikan === 'Mixtura', 'M.f.m harus dibaca sebagai racikan mixtura');
assert(actualLiquidRx.interpretation_mode === 'assisted-loose', 'Format racikan tanpa R/ harus ditandai sebagai interpretasi bantuan format bebas');
assert(actualLiquidRx.racikan?.components?.some((component) => component.medicine_name === 'Forifek Forte 60 ml'), 'Baris obat tanpa R/ harus tetap dibaca sebagai komponen racikan');
assert(actualLiquidRx.racikan?.components?.some((component) => component.medicine_name === 'Meptin 4 mg'), 'Nama obat dengan jumlah dan bentuk sediaan harus tetap dibaca sebagai komponen racikan');
assert(actualLiquidRx.racikan?.signa?.translation === '3 kali sehari, 1 sendok teh', 'cth 1 harus dibaca sebagai satu sendok teh');
assert(actualLiquidRx.flags.some((flag) => flag.code === 'RACIKAN_QUANTITY_REVIEW'), 'Racikan tanpa dtd/No harus meminta konfirmasi jumlah di farmasi');

const doseRangeMedicine = [{ ...medicines[0], max_daily_dose: 2 }];
const doseRange = parseFreeTextPrescription('R/ Paracetamol 500 mg no. X\nS 3 dd 1 tab\nne iter', { medicines: doseRangeMedicine });
assert(doseRange.flags.some((flag) => flag.code === 'DOSE_RANGE_REVIEW' && flag.severity === 'yellow'), 'Dosis di luar rentang master harus memberi FLAG kuning');

const referralHtml = generateAdministrativeDocumentHTML({
  type: 'external_referral',
  patient: { full_name: 'Pasien Uji', mr_number: 'RM-UJI-001', birth_date: '2000-01-01', address: 'Bandung', phone: '08123456789' },
  medicalRecord: { doctor_name: 'dr. Uji', doctor_sip: 'SIP-UJI', diagnosis: 'J00', administrative_documents: { external_referral: { destination: 'RS Uji', reason: 'Perlu evaluasi lanjutan', summary: 'Ringkasan dokter' } } },
  config: printConfig,
  printedBy: 'Front Office Uji',
});
assert(referralHtml.includes('SURAT RUJUKAN') && referralHtml.includes('RS Uji') && referralHtml.includes('SIP-UJI'), 'Surat rujukan harus memakai persetujuan dokter, tujuan, dan SIP');
const envelopeHtml = generateAdministrativeDocumentHTML({ type: 'envelope', patient: { full_name: 'Pasien Uji', address: 'Bandung' }, config: printConfig, printedBy: 'Front Office Uji' });
assert(envelopeHtml.includes('Pasien Uji') && !envelopeHtml.includes('Diagnosis'), 'Amplop hanya boleh memuat data administratif pasien');

console.log('PASS resep bebas, racikan mixtura/puyer, peringatan alergi, etiket, surat Front Office, serta validasi dosis sesuai spesifikasi.');
