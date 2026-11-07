// @ts-nocheck -- Print payloads support several document/label schemas selected at runtime.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Prescription & Label Printing Engine — shared service
// Hybrid: browser print for prescriptions (A4/A5), jsPDF for thermal labels

const DEFAULT_PRINT_CONFIG = {
  // Identitas fasilitas wajib ada pada seluruh dokumen cetak. Nilai ini juga
  // menjadi fallback untuk role yang tidak berhak membaca pengaturan klinik.
  clinic_name: 'KlinikFarma',
  clinic_address: 'Jl. Kesehatan No. 10, Bandung',
  clinic_phone: '022-7000100',
  clinic_email: '',
  prescription_paper_size: 'A5',
  label_preset: '40x30',
  label_custom_w_mm: 40,
  label_custom_h_mm: 30,
  clinic_logo_url: '',
  // Prescription field visibility
  rx_show_weight: true,
  rx_show_age: true,
  rx_show_sip: true,
  rx_show_allergy: true,
  rx_show_diagnosis: false,
  rx_show_mr: true,
  // Label field visibility
  label_show_doctor: true,
  label_show_rx_number: true,
  label_show_storage_note: true,
  label_show_pio: false,
};

const escapePrintHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

let _config = null;
let _loadingPromise = null;

export async function loadPrintConfig(force = false) {
  if (_config && !force) return _config;
  if (_loadingPromise && !force) return _loadingPromise;
  _loadingPromise = (async () => {
    try {
      const [cetak, profil] = await Promise.all([
        db.entities.ClinicSetting.filter({ category: 'Cetak' }).catch(() => []),
        db.entities.ClinicSetting.filter({ category: 'Profil' }).catch(() => []),
      ]);
      const map = {};
      [...(cetak || []), ...(profil || [])].forEach(r => { map[r.key] = r.value; });
      _config = { ...DEFAULT_PRINT_CONFIG };
      Object.keys(DEFAULT_PRINT_CONFIG).forEach(k => {
        if (map[k] !== undefined) {
          const val = map[k];
          if (typeof DEFAULT_PRINT_CONFIG[k] === 'boolean') {
            _config[k] = val === 'true';
          } else if (typeof DEFAULT_PRINT_CONFIG[k] === 'number') {
            _config[k] = Number(val) || 0;
          } else {
            _config[k] = val;
          }
        }
      });
      _config.clinic_name = map.clinic_name || DEFAULT_PRINT_CONFIG.clinic_name;
      _config.clinic_address = map.clinic_address || DEFAULT_PRINT_CONFIG.clinic_address;
      _config.clinic_phone = map.clinic_phone || DEFAULT_PRINT_CONFIG.clinic_phone;
      _config.clinic_email = map.clinic_email || DEFAULT_PRINT_CONFIG.clinic_email;
    } catch {
      _config = { ...DEFAULT_PRINT_CONFIG };
    }
    _loadingPromise = null;
    return _config;
  })();
  return _loadingPromise;
}

export function getCachedConfig() {
  return _config || { ...DEFAULT_PRINT_CONFIG };
}

// Label color follows the medication route: white for internal use and blue
// for external use. Explicit master data always overrides a heuristic.
export function classifyLabelRoute(item = {}, medicine = {}) {
  const route = String(item.administration_route || medicine.administration_route || '').trim().toLowerCase();
  if (['external', 'luar', 'obat luar', 'topical', 'topikal'].includes(route)) return { type: 'blue', requiresVerification: false, source: 'master' };
  if (['internal', 'dalam', 'obat dalam', 'oral', 'inhalasi', 'injeksi'].includes(route)) return { type: 'white', requiresVerification: false, source: 'master' };

  const form = String(medicine.form || item.form || '').trim().toLowerCase();
  const name = String(medicine.name || item.medicine_name || '').toLowerCase();
  // "Tetes" is deliberately excluded: oral drops and eye/ear/nasal drops
  // need master-data confirmation rather than an unsafe automatic guess.
  if (['salep', 'krim', 'gel', 'lotion', 'pasta', 'topikal'].includes(form)
    || ['salep', 'krim', 'gel', 'lotion', 'obat luar', 'tetes mata', 'tetes telinga', 'tetes hidung'].some((key) => name.includes(key))) {
    return { type: 'blue', requiresVerification: false, source: 'form' };
  }
  if (['tablet', 'kapsul', 'sirup', 'suspensi', 'serbuk', 'injeksi', 'suppositoria', 'puyer', 'mixtura'].includes(form)) {
    return { type: 'white', requiresVerification: false, source: 'form' };
  }
  return { type: 'white', requiresVerification: true, source: 'unverified' };
}

export function detectLabelType(item, medicine) {
  return classifyLabelRoute(item, medicine).type;
}

export function getLabelDimensions(config) {
  const preset = config?.label_preset || '40x30';
  if (preset === 'custom') {
    return { w: config?.label_custom_w_mm || 40, h: config?.label_custom_h_mm || 30 };
  }
  const parts = preset.split('x');
  return { w: Number(parts[0]) || 40, h: Number(parts[1]) || 30 };
}

export const LABEL_PRESETS = [
  { value: '30x20', label: '30 × 20 mm' },
  { value: '40x30', label: '40 × 30 mm' },
  { value: '50x30', label: '50 × 30 mm' },
  { value: '70x40', label: '70 × 40 mm' },
  { value: 'custom', label: 'Custom' },
];

// Build prescription print data from rx + patient + doctor
export function buildPrescriptionData(rx, patient, doctor, config) {
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const birthDate = patient?.birth_date || rx?.patient_birth_date;
  const age = birthDate
    ? Math.floor((Date.now() - new Date(birthDate)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const parsedPrescription = rx?.parse_result || {};
  const prescriptionItems = Array.isArray(rx?.items) && rx.items.length > 0
    ? rx.items
    : (Array.isArray(parsedPrescription.items) ? parsedPrescription.items : []);
  const racikanData = rx?.racikan_data || parsedPrescription.racikan || null;

  return {
    clinic: {
      name: config?.clinic_name || 'KlinikFarma',
      address: config?.clinic_address || '',
      phone: config?.clinic_phone || '',
      logo: config?.clinic_logo_url || '',
    },
    doctor: {
      name: doctor?.display_name || doctor?.full_name || rx?.doctor_name || '—',
      specialization: doctor?.specialization || '',
      sip: doctor?.sip_number || rx?.doctor_sip || '',
      practice_address: doctor?.practice_address || doctor?.practice_room || rx?.doctor_practice_address || '',
      phone: doctor?.phone || rx?.doctor_phone || '',
      // A prescription is finalized by the doctor before it reaches pharmacy.
      // Keep the stored confirmation data with the print payload so the paper
      // copy can state that it is the final, electronically confirmed record.
      signature_image_url: doctor?.signature_image_url || doctor?.signature_url || rx?.signature_image_url || '',
      digital_signature: rx?.digital_signature || '',
      signed_at: rx?.signed_at || rx?.doctor_confirmed_at || '',
    },
    rx: {
      number: rx?.prescription_number || '—',
      date: rx?.prescription_date
        ? new Date(rx.prescription_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
        : today,
    },
    patient: {
      name: rx?.patient_name || patient?.full_name || '—',
      mr: patient?.mr_number || rx?.patient_mr_number || '',
      age: age != null ? `${age} th` : '',
      gender: (patient?.gender || rx?.patient_gender) === 'L' ? 'L' : (patient?.gender || rx?.patient_gender) === 'P' ? 'P' : '',
      address: patient?.address || rx?.patient_address || '',
      phone: patient?.phone || rx?.patient_phone || '',
      weight: patient?.vital_signs_weight || patient?.weight || rx?.patient_weight || rx?.vital_signs_weight,
      allergies: patient?.allergies || rx?.patient_allergies || '',
    },
    items: prescriptionItems,
    is_racikan: Boolean(rx?.is_racikan || racikanData),
    racikan_data: racikanData,
    notes: rx?.notes || '',
    tebus_status: rx?.tebus_status || '',
    tebus_remaining: rx?.tebus_remaining || 0,
    tebus_notation: rx?.tebus_notation || '',
    original_text: rx?.original_text || '',
    translated_text: rx?.translated_text || '',
  };
}

// One canonical source for the usage instruction. Legacy and parsed
// prescriptions use different field names, so printing must not depend on a
// single shape being present.
export function getPrescriptionUsage(item, fallback = '') {
  const value = item?.usage_instruction
    || item?.signa?.translation
    || item?.signa
    || item?.dosage
    || item?.instructions
    || fallback;
  return String(value || '').trim();
}

// Build label data for a single item
export function buildLabelData(rx, item, medicine, config) {
  // Racikan prescriptions are represented in the prescription queue by a
  // synthetic medicine id, so there is no Medicine master record to provide
  // the label route. Preserve the route selected in the racikan worksheet;
  // internal/white is the safe application default for legacy records.
  // Older local records may not have the is_racikan flag, so recognize the
  // racikan shape as well and keep them on the canonical renderer.
  const isRacikan = Boolean(
    item?.is_racikan
      || rx?.is_racikan
      || rx?.racikan_data
      || item?.racikan_name
      || /^racikan\b/i.test(String(item?.medicine_name || ''))
  );
  const routeItem = isRacikan
    ? {
        ...item,
        administration_route: item.administration_route || rx?.racikan_data?.administration_route || rx?.administration_route || 'internal',
        form: item.form || item.bentuk_racikan || rx?.racikan_data?.bentuk_racikan || 'Puyer',
      }
    : item;
  const route = classifyLabelRoute(routeItem, medicine);
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const override = item?.label_override || {};
  const usageInstruction = override.usage_instruction || getPrescriptionUsage(item, rx?.signa);
  return {
    type: route.type,
    clinic_name: config?.clinic_name || 'KlinikFarma',
    patient_name: rx?.patient_name || '—',
    medicine_name: item?.medicine_name || '—',
    strength: item?.strength || medicine?.strength || '',
    dosage: usageInstruction,
    quantity: item?.quantity || 0,
    date: today,
    rx_number: rx?.prescription_number || '',
    doctor_name: rx?.doctor_name || '',
    storage_note: override.storage_note || '',
    pio_note: override.pio_note || '',
    is_external: route.type === 'blue',
    is_racikan: isRacikan,
    racikan_name: item?.racikan_name || item?.medicine_name || 'Racikan',
    bentuk_racikan: item?.bentuk_racikan || routeItem?.form || rx?.racikan_data?.bentuk_racikan || 'Puyer',
    jumlah: item?.jumlah_ambil ?? item?.quantity ?? 0,
    signa: usageInstruction,
    tanggal: today,
    storage_instructions: override.storage_note || '',
    route_needs_verification: route.requiresVerification,
    item_index: item?._index,
  };
}

// Build racikan label data
export function buildRacikanLabelData(racikan, computed, config) {
  const route = String(racikan?.administration_route || 'internal').toLowerCase();
  return {
    clinic_name: config?.clinic_name || 'KlinikFarma',
    patient_name: racikan?.patient_name || 'Pasien',
    racikan_name: racikan?.racikan_name || 'Racikan',
    bentuk_racikan: racikan?.bentuk_racikan || 'Puyer',
    jumlah: racikan?.jumlah_ambil || 0,
    signa: racikan?.signa || '',
    tanggal: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    rx_number: racikan?.source_prescription_id || racikan?.prescription_id || '',
    doctor_name: racikan?.doctor_name || '',
    storage_instructions: racikan?.storage_instructions || '',
    shake_well: Boolean(racikan?.shake_well),
    beyond_use_date: racikan?.beyond_use_date || '',
    is_external: ['external', 'luar', 'obat luar', 'topical', 'topikal'].includes(route),
    components: (computed?.components || []).map(c => ({
      name: c.medicine_name,
      dosis: c.dosis_label || `${c.dosis_per_racikan}mg`,
      ambil: c.kebutuhan_ambil,
    })),
  };
}

const labelHtmlText = (value = '') => escapePrintHtml(value).replace(/\r?\n/g, '<br />');

/**
 * Canonical racikan label renderer shared by preview, browser print, and PDF.
 * Keeping one markup source prevents the three outputs from drifting apart.
 */
export function buildRacikanLabelHTML(label, config) {
  const { w, h } = getLabelDimensions(config);
  const background = label?.is_external ? '#DBEAFE' : '#FFFFFF';
  const border = label?.is_external ? '#60A5FA' : '#CBD5E1';
  const accent = label?.is_external ? '#1D4ED8' : '#1E293B';
  const storage = label?.storage_instructions ? `
    <div style="font-size:5pt;line-height:1.15;font-style:italic;border-top:0.2mm solid ${border};padding-top:0.8mm;margin-top:0.7mm;color:${accent};">${labelHtmlText(label.storage_instructions)}</div>` : '';
  const shake = label?.shake_well
    ? `<div style="font-size:5pt;line-height:1.15;font-weight:700;margin-top:0.7mm;color:${accent};">Kocok dahulu sebelum digunakan.</div>`
    : '';
  const external = label?.is_external
    ? `<div style="font-size:5pt;line-height:1.15;font-weight:700;margin-top:0.7mm;color:${accent};">Obat Luar</div>`
    : '';
  const bud = label?.beyond_use_date
    ? `<div style="font-size:5pt;line-height:1.15;font-weight:700;margin-top:0.7mm;color:#BE123C;">BUD: ${labelHtmlText(label.beyond_use_date)}</div>`
    : '';

  return `<div class="racikan-label-canonical" style="width:${w}mm;height:${h}mm;box-sizing:border-box;overflow:hidden;background:${background};border:0.5mm solid ${border};padding:2mm;color:#0F172A;font-family:Inter,Arial,sans-serif;line-height:1.15;print-color-adjust:exact;-webkit-print-color-adjust:exact;">
    <div style="font-size:6.5pt;line-height:1.1;font-weight:700;text-align:center;border-bottom:0.2mm solid ${border};padding-bottom:0.8mm;color:${accent};">RACIKAN / ${labelHtmlText(String(label?.bentuk_racikan || 'Puyer').toUpperCase())}</div>
    <div style="font-size:5.5pt;line-height:1.1;font-weight:600;text-align:center;color:#475569;margin-top:0.8mm;">${labelHtmlText(label?.clinic_name || 'KlinikFarma')}</div>
    <div style="font-size:6.5pt;line-height:1.1;font-weight:700;margin-top:1mm;">${labelHtmlText(label?.patient_name || 'Pasien')}</div>
    <div style="font-size:5.5pt;line-height:1.1;margin-top:0.7mm;">${labelHtmlText(label?.racikan_name || 'Racikan')} — ${labelHtmlText(label?.bentuk_racikan || 'Puyer')}</div>
    <div style="font-size:8pt;line-height:1.1;font-weight:700;text-align:center;background:${label?.is_external ? '#BFDBFE' : '#F1F5F9'};padding:1.2mm 0.8mm;margin-top:1mm;border-radius:0.6mm;color:#0F172A;">${labelHtmlText(label?.signa || '—')}</div>
    <div style="font-size:6.5pt;line-height:1.1;font-weight:700;margin-top:1mm;">Jumlah: ${labelHtmlText(label?.jumlah ?? 0)} ${labelHtmlText(label?.bentuk_racikan || 'Puyer')}</div>
    ${storage}${shake}${external}${bud}
    <div style="font-size:4.5pt;line-height:1.1;text-align:center;border-top:0.2mm dotted #94A3B8;padding-top:0.8mm;margin-top:1mm;color:#334155;">${labelHtmlText(label?.tanggal || '')}${label?.rx_number ? ` • ${labelHtmlText(label.rx_number)}` : ''}</div>
  </div>`;
}

// Generate professional prescription HTML
export function generatePrescriptionHTML(data, config, printReason) {
  const vis = config || {};
  const showTebusInfo = printReason && printReason !== 'Normal';
  const isPartial = printReason === 'Ditebus Sebagian' || data.tebus_status === 'Sebagian';
  const isUnavailable = printReason === 'Obat Tidak Tersedia';
  const isIter = printReason === 'Iter';
  const isNotRedeemed = printReason === 'Tidak Ditebus' || data.tebus_status === 'Tidak Ditebus';

  const itemsToPrint = data.items || [];
  const racikan = data.is_racikan ? data.racikan_data : null;
  const originalPrescriptionBody = String(data.original_text || '')
    .replace(/^\s*R\s*\/\s*/i, '')
    .trim();
  const originalPrescriptionBodyHtml = escapePrintHtml(originalPrescriptionBody);

  const itemsHTML = itemsToPrint.length === 0
    ? '<p style="color:#94A3B8;font-size:12px;">Belum ada obat</p>'
    : itemsToPrint.map((it, i) => {
        const isRemaining = isPartial && data.tebus_remaining > 0 && i >= (itemsToPrint.length - data.tebus_remaining);
        const isNotAvailable = isUnavailable && (it._unavailable || false);
        const usageText = getPrescriptionUsage(it, 'Aturan pakai belum ditentukan');
        return `
          <div style="margin:6px 0;font-size:13px;${isRemaining ? 'opacity:0.5;' : ''}">
            <div style="display:flex;justify-content:space-between;gap:12px;">
              <span><strong>${i ? 'R/' : ''}</strong> ${it.medicine_name || ''} ${it.strength || ''}</span>
              <span><strong>No.</strong> ${it.quantity || 1}</span>
              ${isRemaining ? '<span style="color:#DC2626;font-size:10px;font-weight:600;">SISA — belum ditebus</span>' : ''}
              ${isNotAvailable ? '<span style="color:#DC2626;font-size:10px;font-weight:600;">TIDAK TERSEDIA</span>' : ''}
            </div>
            <div style="margin-left:20px;font-size:12px;color:#475569;">
              ${escapePrintHtml(usageText)}
            </div>
          </div>`;
      }).join('');

  const racikanHTML = racikan ? `
    <div style="margin:10px 0;padding:8px;border:1px dashed #0D9488;border-radius:4px;background:#F0FDFA;">
      <p style="font-size:12px;font-weight:700;color:#0D9488;margin:0 0 4px;">R/ RACIKAN — ${racikan.racikan_name || ''} (${racikan.bentuk_racikan || 'Puyer'})</p>
      ${(racikan.components || []).map((c, i) => `
        <div style="font-size:11px;color:#334155;margin:2px 0;">
          ${i + 1}. ${c.medicine_name || ''} ${c.dosis_label || (c.dosis_per_racikan + 'mg') || ''}
          — ambil ${c.kebutuhan_ambil || 0}
        </div>
      `).join('')}
      <div style="font-size:12px;margin-top:4px;">
        <strong>Jumlah:</strong> ${racikan.jumlah_ambil || 0} ${racikan.bentuk_racikan || ''} •
        ${escapePrintHtml(getPrescriptionUsage(racikan, 'Aturan pakai belum ditentukan'))}
      </div>
    </div>` : '';

  const iterNote = isIter && data.tebus_notation
    ? `<div style="margin:8px 0;padding:6px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:4px;font-size:11px;">
        <strong>Iter:</strong> ${data.tebus_notation} — sisa ${data.tebus_remaining} item belum diserahkan
      </div>` : '';

  const reasonBanner = showTebusInfo ? `
    <div style="margin:8px 0;padding:6px 10px;background:#F1F5F9;border:1px solid #CBD5E1;border-radius:4px;font-size:11px;">
      <strong>Status Cetak:</strong> ${printReason}
      ${isPartial ? `— ${data.tebus_remaining} item belum ditebus` : ''}
      ${isUnavailable ? '— obat tidak tersedia dicantumkan' : ''}
      ${isNotRedeemed ? '— tidak ada dispensing atau tagihan farmasi' : ''}
    </div>` : '';

  const logoHTML = data.clinic.logo
    ? `<img src="${data.clinic.logo}" style="max-height:50px;max-width:120px;object-fit:contain;" />`
    : '';
  const signatureImageHTML = data.doctor.signature_image_url
    ? `<img src="${escapePrintHtml(data.doctor.signature_image_url)}" alt="Tanda tangan dokter" style="display:block;max-width:118px;max-height:44px;object-fit:contain;margin:12px 0 3px auto;" />`
    : '';
  const confirmedAt = data.doctor.signed_at
    ? new Date(data.doctor.signed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
    : '';
  // The original free-text remains authoritative. When the parser has
  // extracted an instruction that is missing from the original text, append it
  // as a direct usage line so the printed document never loses a detected
  // signa. This also keeps legacy structured prescriptions printable.
  const hasUsageMarker = /(?:^|\n)\s*(?:s\.?|signa|sig\.?)(?:\s|:)/i.test(originalPrescriptionBody);
  const detectedUsage = itemsToPrint
    .map((item) => getPrescriptionUsage(item))
    .filter(Boolean)
    .filter((usage, index, values) => values.indexOf(usage) === index)
    .join(' • ');
  const detectedUsageHTML = !hasUsageMarker && detectedUsage
    ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #E2E8F0;font-size:12px;color:#475569;">${escapePrintHtml(detectedUsage)}</div>`
    : '';
  const prescriptionBodyHTML = originalPrescriptionBody
    ? `<pre style="white-space:pre-wrap;word-break:break-word;font:13px/1.65 'Courier New',monospace;margin:0;color:#0F172A;">${originalPrescriptionBodyHtml}</pre>${detectedUsageHTML}`
    : `${itemsHTML}${racikanHTML}`;

  return `
    <div style="max-width:600px;margin:0 auto;">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0D9488;padding-bottom:10px;margin-bottom:12px;">
        <div style="flex:1;">
          ${logoHTML}
          <h1 style="font-size:17px;margin:4px 0 2px;color:#0F172A;">${data.clinic.name}</h1>
          <p style="font-size:10px;color:#64748B;margin:0;">${data.clinic.address || ''}</p>
          <p style="font-size:10px;color:#64748B;margin:2px 0 0;">${data.clinic.phone ? 'Telp. ' + data.clinic.phone : ''}</p>
        </div>
        <div style="text-align:right;font-size:10px;color:#475569;">
          <p style="font-weight:700;font-size:12px;color:#0F172A;margin:0;">${data.doctor.name}</p>
          ${data.doctor.specialization ? `<p style="margin:1px 0 0;">${data.doctor.specialization}</p>` : ''}
          ${vis.rx_show_sip && data.doctor.sip ? `<p style="margin:1px 0 0;">SIP: ${data.doctor.sip}</p>` : ''}
          ${data.doctor.practice_address ? `<p style="margin:1px 0 0;">Praktik: ${data.doctor.practice_address}</p>` : ''}
          ${data.doctor.phone ? `<p style="margin:1px 0 0;">Telp. ${data.doctor.phone}</p>` : ''}
        </div>
      </div>

      <!-- Rx meta -->
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px;">
        <span><strong>No. Resep:</strong> ${data.rx.number}</span>
        <span><strong>Tanggal:</strong> ${data.rx.date}</span>
      </div>

      <!-- Patient -->
      <div style="font-size:11px;margin-bottom:10px;border:1px solid #E2E8F0;border-radius:4px;padding:6px 8px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;">
          <span><strong>Pro:</strong> ${data.patient.name}</span>
          ${vis.rx_show_mr && data.patient.mr ? `<span><strong>No. RM:</strong> ${data.patient.mr}</span>` : ''}
          ${vis.rx_show_age && data.patient.age ? `<span><strong>Umur:</strong> ${data.patient.age}</span>` : ''}
          ${data.patient.gender ? `<span><strong>JK:</strong> ${data.patient.gender}</span>` : ''}
          ${vis.rx_show_weight && data.patient.weight ? `<span><strong>BB:</strong> ${data.patient.weight} kg</span>` : ''}
        </div>
        ${data.patient.address ? `<div style="font-size:10px;margin-top:3px;"><strong>Alamat:</strong> ${data.patient.address}</div>` : ''}
        ${data.patient.phone ? `<div style="font-size:10px;margin-top:2px;"><strong>Telp.:</strong> ${data.patient.phone}</div>` : ''}
        ${vis.rx_show_allergy && data.patient.allergies ? `<div style="color:#DC2626;font-size:10px;margin-top:3px;"><strong>⚠ Alergi:</strong> ${data.patient.allergies}</div>` : ''}
      </div>

      ${reasonBanner}
      ${iterNote}

      <!-- Rx body -->
      <div style="border:1px solid #E2E8F0;border-radius:6px;padding:12px;min-height:180px;">
        <p style="font-size:16px;font-weight:700;color:#0D9488;margin:0 0 8px;">R/</p>
        ${prescriptionBodyHTML}
      </div>

      ${data.original_text ? `<p style="font-size:9px;color:#64748B;margin:5px 0 0;">Teks resep asli dokter, dikonfirmasi dan dikunci dalam rekam resep elektronik.</p>` : ''}

      ${data.notes ? `<p style="font-size:11px;margin-top:8px;color:#475569;"><strong>Catatan:</strong> ${data.notes}</p>` : ''}

      <!-- Signature -->
      <div style="margin-top:24px;text-align:right;">
        <p style="font-size:11px;margin:0;">${data.rx.date}</p>
        ${signatureImageHTML}
        ${!signatureImageHTML ? '<p style="font-size:10px;color:#64748B;margin:26px 0 3px;">Tertanda secara elektronik</p>' : '<p style="font-size:10px;color:#64748B;margin:2px 0 3px;">Tertanda secara elektronik</p>'}
        <p style="font-size:12px;margin:0;font-weight:600;">${data.doctor.name}</p>
        ${vis.rx_show_sip && data.doctor.sip ? `<p style="font-size:10px;color:#64748B;margin:1px 0 0;">SIP: ${data.doctor.sip}</p>` : ''}
        ${confirmedAt ? `<p style="font-size:9px;color:#64748B;margin:2px 0 0;">Dikonfirmasi: ${confirmedAt}</p>` : ''}
        ${data.doctor.digital_signature ? `<p style="font-size:9px;color:#64748B;margin:2px 0 0;">${escapePrintHtml(data.doctor.digital_signature)}</p>` : ''}
      </div>
    </div>`;
}

// Browser print for prescription
export function printPrescriptionHTML(html, paperSize = 'A5') {
  const win = window.open('', '_blank', 'width=600,height=800');
  if (!win) return;
  win.document.write(`
    <html><head><title>Cetak Resep</title>
    <style>
      @page { size: ${paperSize}; margin: 12mm; }
      * { font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { color: #0F172A; margin: 0; padding: 0; }
    </style>
    </head><body>${html}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

const documentDate = () => new Date().toLocaleDateString('id-ID', {
  day: 'numeric', month: 'long', year: 'numeric',
});

const patientAge = (patient) => {
  if (!patient?.birth_date) return '';
  return String(Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
};

// Administrative documents are printed by Front Office only after the doctor
// has stored the clinical approval in the finalized MedicalRecord. This helper
// intentionally has no editing side effects and never invents medical text.
export function generateAdministrativeDocumentHTML({ type, patient, medicalRecord, config, printedBy }) {
  const clinic = {
    name: config?.clinic_name || 'KlinikFarma',
    address: config?.clinic_address || '',
    phone: config?.clinic_phone || '',
  };
  const patientData = {
    name: patient?.full_name || medicalRecord?.patient_name || '—',
    mr: patient?.mr_number || '',
    age: patientAge(patient),
    address: patient?.address || '',
    phone: patient?.phone || '',
  };
  const doctor = {
    name: medicalRecord?.doctor_name || '—',
    sip: medicalRecord?.doctor_sip || medicalRecord?.doctor_license_number || '',
  };
  const approval = medicalRecord?.administrative_documents || {};
  const safe = (value) => escapePrintHtml(value || '—');
  const header = `
    <div style="text-align:center;border-bottom:2px solid #0D9488;padding-bottom:10px;margin-bottom:18px;">
      <h1 style="font-size:18px;margin:0;color:#0F172A;">${safe(clinic.name)}</h1>
      ${clinic.address ? `<p style="font-size:11px;color:#475569;margin:4px 0 0;">${safe(clinic.address)}</p>` : ''}
      ${clinic.phone ? `<p style="font-size:11px;color:#475569;margin:2px 0 0;">Telp. ${safe(clinic.phone)}</p>` : ''}
    </div>`;
  const patientBlock = `
    <div style="font-size:12px;line-height:1.65;margin:16px 0;">
      <p style="margin:0;"><strong>Nama:</strong> ${safe(patientData.name)}</p>
      ${patientData.mr ? `<p style="margin:0;"><strong>No. RM:</strong> ${safe(patientData.mr)}</p>` : ''}
      ${patientData.age ? `<p style="margin:0;"><strong>Umur:</strong> ${safe(patientData.age)} tahun</p>` : ''}
      ${patientData.phone ? `<p style="margin:0;"><strong>Telepon:</strong> ${safe(patientData.phone)}</p>` : ''}
      ${patientData.address ? `<p style="margin:0;"><strong>Alamat:</strong> ${safe(patientData.address)}</p>` : ''}
    </div>`;
  const signature = `<div style="margin-top:46px;text-align:right;font-size:12px;">${safe(documentDate())}<br/><br/><br/><strong>${safe(doctor.name)}</strong>${doctor.sip ? `<br/><span style="font-size:10px;color:#64748B;">SIP: ${safe(doctor.sip)}</span>` : ''}</div>`;
  const formattedDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  if (type === 'envelope') {
    return `
      <div style="width:100%;min-height:330px;padding:22mm;font-size:14px;box-sizing:border-box;">
        <div style="font-size:11px;line-height:1.5;color:#334155;">${safe(clinic.name)}<br/>${safe(clinic.address)}${clinic.phone ? `<br/>Telp. ${safe(clinic.phone)}` : ''}</div>
        <div style="margin-top:82px;margin-left:38px;line-height:1.7;">
          <div style="font-size:11px;color:#64748B;">Kepada Yth.</div>
          <div style="font-size:17px;font-weight:700;">${safe(patientData.name)}</div>
          ${patientData.address ? `<div>${safe(patientData.address)}</div>` : '<div>Alamat pasien belum dicatat</div>'}
          ${patientData.phone ? `<div>Telp. ${safe(patientData.phone)}</div>` : ''}
        </div>
        <div style="position:absolute;bottom:22mm;right:22mm;font-size:9px;color:#64748B;">Dicetak oleh ${safe(printedBy || 'Front Office')} • ${documentDate()}</div>
      </div>`;
  }

  if (type === 'sick_letter') {
    const detail = approval.sick_leave || {};
    return `
      <div style="max-width:680px;margin:0 auto;">${header}
        <h2 style="font-size:15px;text-align:center;margin:0 0 22px;">SURAT KETERANGAN ISTIRAHAT</h2>
        <p style="font-size:12px;line-height:1.75;">Yang bertanda tangan di bawah ini menerangkan bahwa pasien berikut telah diperiksa oleh dokter di ${safe(clinic.name)}.</p>
        ${patientBlock}
        <p style="font-size:12px;line-height:1.75;">Berdasarkan penilaian dokter, pasien dianjurkan beristirahat dari <strong>${safe(detail.start_date || medicalRecord?.visit_date)}</strong> sampai <strong>${safe(detail.end_date || 'tanggal yang ditetapkan dokter')}</strong>.</p>
        ${detail.notes ? `<p style="font-size:12px;line-height:1.75;"><strong>Keterangan dokter:</strong> ${safe(detail.notes)}</p>` : ''}
        <p style="font-size:12px;line-height:1.75;">Surat ini dicetak oleh Front Office berdasarkan persetujuan dokter pada rekam medis kunjungan yang telah difinalkan. Front Office tidak mengubah isi klinis surat.</p>
        <div style="margin-top:46px;text-align:right;font-size:12px;">${safe(documentDate())}<br/><br/><br/><strong>${safe(doctor.name)}</strong>${doctor.sip ? `<br/><span style="font-size:10px;color:#64748B;">SIP: ${safe(doctor.sip)}</span>` : ''}</div>
      </div>`;
  }

  if (type === 'prescription') {
    const prescription = medicalRecord?.prescription || {};
    const items = (prescription.items || []).map((item, index) => `
      <div style="margin:10px 0;font-size:12px;line-height:1.6;">
        <strong>${index + 1}. R/ ${safe(item.medicine_name)} ${safe(item.strength || item.kekuatan || '')}</strong><br/>
        <span style="margin-left:18px;">${safe(item.dosage || item.signa || item.instructions || 'Aturan pakai sesuai resep dokter')} • Jumlah ${safe(item.quantity || item.jumlah || '—')}</span>
      </div>`).join('');
    return `
      <div style="max-width:680px;margin:0 auto;">${header}
        <h2 style="font-size:15px;text-align:center;margin:0 0 14px;">RESEP OBAT</h2>
        ${patientBlock}
        <p style="font-size:11px;color:#475569;">No. Resep: ${safe(prescription.prescription_number || '—')} • Tanggal: ${safe(formattedDate(prescription.prescription_date || medicalRecord?.visit_date))}</p>
        <div style="min-height:180px;border:1px solid #CBD5E1;border-radius:6px;padding:14px;">${items || `<pre style="margin:0;white-space:pre-wrap;font:12px/1.7 Inter,Arial,sans-serif;">${safe(prescription.original_text || '—')}</pre>`}</div>
        <p style="font-size:11px;line-height:1.6;color:#475569;">Salinan resep ini dicetak Front Office berdasarkan persetujuan dokter pada Visit yang telah final. Penebusan dan etiket obat tetap diproses Farmasi.</p>
        ${signature}
      </div>`;
  }

  if (type === 'medical_summary') {
    const procedures = (medicalRecord?.procedures || []).map((item) => item.name || item.service_name).filter(Boolean).join(', ') || '—';
    return `
      <div style="max-width:680px;margin:0 auto;">${header}
        <h2 style="font-size:15px;text-align:center;margin:0 0 14px;">RESUME MEDIS</h2>
        ${patientBlock}
        <div style="font-size:12px;line-height:1.7;">
          <p><strong>Keluhan utama:</strong> ${safe(medicalRecord?.chief_complaint)}</p>
          <p><strong>Anamnesis:</strong> ${safe(medicalRecord?.subjective)}</p>
          <p><strong>Pemeriksaan:</strong> TD ${safe(medicalRecord?.vital_signs_bp)} • Suhu ${safe(medicalRecord?.vital_signs_temp)}°C • Nadi ${safe(medicalRecord?.vital_signs_pulse)} • RR ${safe(medicalRecord?.vital_signs_rr)} • BB ${safe(medicalRecord?.vital_signs_weight)} kg</p>
          <p><strong>Pemeriksaan fisik:</strong> ${safe(medicalRecord?.physical_exam)}</p>
          <p><strong>Diagnosis:</strong> ${safe(medicalRecord?.diagnosis)}</p>
          <p><strong>Tindakan:</strong> ${safe(procedures)}</p>
          <p><strong>Rencana terapi:</strong> ${safe(medicalRecord?.treatment_plan)}</p>
          <p><strong>Kontrol:</strong> ${safe(formattedDate(medicalRecord?.follow_up_date))}</p>
        </div>
        <p style="font-size:11px;line-height:1.6;color:#475569;">Resume ini hanya tersedia karena telah disetujui dokter untuk dicetak pada Visit ini.</p>
        ${signature}
      </div>`;
  }

  if (type === 'instructions') {
    return `
      <div style="max-width:680px;margin:0 auto;">${header}
        <h2 style="font-size:15px;text-align:center;margin:0 0 14px;">INSTRUKSI / ANJURAN PASIEN</h2>
        ${patientBlock}
        <div style="font-size:12px;line-height:1.75;">
          <p><strong>Rencana terapi:</strong><br/>${safe(medicalRecord?.treatment_plan)}</p>
          <p><strong>Edukasi / anjuran:</strong><br/>${safe(medicalRecord?.patient_education)}</p>
          <p><strong>Instruksi follow-up:</strong><br/>${safe(medicalRecord?.follow_up_instructions)}</p>
        </div>
        ${signature}
      </div>`;
  }

  if (type === 'control_card') {
    return `
      <div style="max-width:430px;margin:0 auto;border:2px solid #0D9488;border-radius:10px;padding:22px;">${header}
        <h2 style="font-size:15px;text-align:center;margin:0 0 14px;">KARTU KONTROL</h2>
        <p style="font-size:13px;line-height:1.75;"><strong>Pasien:</strong> ${safe(patientData.name)}<br/><strong>No. RM:</strong> ${safe(patientData.mr)}<br/><strong>Kontrol berikutnya:</strong> ${safe(formattedDate(medicalRecord?.follow_up_date))}</p>
        <p style="font-size:12px;line-height:1.7;"><strong>Instruksi:</strong><br/>${safe(medicalRecord?.follow_up_instructions || 'Datang sesuai jadwal kontrol.')}</p>
        <p style="font-size:10px;color:#64748B;margin:18px 0 0;">Dicetak Front Office berdasarkan jadwal kontrol yang disetujui dokter.</p>
      </div>`;
  }

  const detail = approval.external_referral || {};
  return `
    <div style="max-width:680px;margin:0 auto;">${header}
      <h2 style="font-size:15px;text-align:center;margin:0 0 22px;">SURAT RUJUKAN</h2>
      <p style="font-size:12px;line-height:1.75;">Kepada Yth. ${safe(detail.destination || 'Fasilitas kesehatan/dokter tujuan')}<br/>di tempat</p>
      <p style="font-size:12px;line-height:1.75;">Dengan hormat, kami rujuk pasien berikut untuk pemeriksaan atau penanganan lanjutan.</p>
      ${patientBlock}
      <p style="font-size:12px;line-height:1.75;"><strong>Diagnosis/masalah klinis:</strong> ${safe(medicalRecord?.diagnosis)}</p>
      <p style="font-size:12px;line-height:1.75;"><strong>Alasan rujukan:</strong> ${safe(detail.reason)}</p>
      ${detail.summary ? `<p style="font-size:12px;line-height:1.75;"><strong>Ringkasan klinis:</strong> ${safe(detail.summary)}</p>` : ''}
      <p style="font-size:12px;line-height:1.75;">Demikian rujukan ini dibuat. Front Office mencetak dokumen berdasarkan persetujuan dokter dan tidak mengubah diagnosis maupun alasan rujukan.</p>
      <div style="margin-top:46px;text-align:right;font-size:12px;">${safe(documentDate())}<br/><br/><br/><strong>${safe(doctor.name)}</strong>${doctor.sip ? `<br/><span style="font-size:10px;color:#64748B;">SIP: ${safe(doctor.sip)}</span>` : ''}</div>
    </div>`;
}

export function printAdministrativeDocumentHTML(html, paperSize = 'A4') {
  const win = window.open('', '_blank', 'width=760,height=900');
  if (!win) return false;
  win.document.write(`
    <html><head><title>Dokumen Klinik</title>
    <style>@page { size: ${paperSize}; margin: 16mm; } * { font-family: Inter, Arial, sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; } body { color:#0F172A; margin:0; }</style>
    </head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  return true;
}

const formatPurchaseOrderDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatPurchaseOrderCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

/**
 * Canonical Surat Pesanan renderer. The exact same HTML is used by the
 * on-screen preview, browser print, and PDF export so the three outputs do
 * not drift apart.
 */
export function generatePurchaseOrderHTML({ po = {}, supplier = {}, config = {}, printedBy = '' } = {}) {
  const safe = (value) => escapePrintHtml(value || '—');
  const clinicName = config.clinic_name || 'KlinikFarma';
  const clinicAddress = config.clinic_address || '';
  const clinicPhone = config.clinic_phone || '';
  const items = Array.isArray(po.items) ? po.items : [];
  const status = po.status || po.approval_status || 'Draft';
  // The workflow status is authoritative. Older local demo rows can contain
  // a stale approval_status while the SP is still pending.
  const approved = ['Disetujui', 'Dikirim', 'Diterima', 'Diterima Sebagian'].includes(status);
  const total = items.reduce((sum, item) => sum + Number(item.subtotal || (item.quantity || 0) * (item.unit_price || 0)), 0);
  const itemRows = items.length
    ? items.map((item, index) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      const subtotal = Number(item.subtotal || quantity * unitPrice);
      return `<tr>
        <td style="padding:8px;border:1px solid #CBD5E1;text-align:center;">${index + 1}</td>
        <td style="padding:8px;border:1px solid #CBD5E1;">${safe(item.medicine_name || item.name)}</td>
        <td style="padding:8px;border:1px solid #CBD5E1;text-align:center;">${safe(quantity)} ${safe(item.unit || '')}</td>
        <td style="padding:8px;border:1px solid #CBD5E1;text-align:right;">${formatPurchaseOrderCurrency(unitPrice)}</td>
        <td style="padding:8px;border:1px solid #CBD5E1;text-align:right;">${formatPurchaseOrderCurrency(subtotal)}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="5" style="padding:14px;border:1px solid #CBD5E1;text-align:center;color:#64748B;">Tidak ada item SP</td></tr>';

  return `<div class="purchase-order-document" style="max-width:760px;margin:0 auto;color:#0F172A;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.45;">
    <header style="border-bottom:2px solid #0D9488;padding-bottom:10px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;">
        <div>
          <h1 style="font-size:18px;margin:0 0 3px;">${safe(clinicName)}</h1>
          ${clinicAddress ? `<p style="margin:0;color:#475569;">${safe(clinicAddress)}</p>` : ''}
          ${clinicPhone ? `<p style="margin:2px 0 0;color:#475569;">Telp. ${safe(clinicPhone)}</p>` : ''}
        </div>
        <div style="text-align:right;">
          <h2 style="font-size:16px;margin:0 0 4px;">SURAT PESANAN</h2>
          <p style="margin:0;font-weight:700;">${safe(po.po_number)}</p>
          <p style="margin:2px 0 0;color:#475569;">${formatPurchaseOrderDate(po.order_date || po.created_date)}</p>
        </div>
      </div>
    </header>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
      <section style="border:1px solid #CBD5E1;border-radius:5px;padding:10px;">
        <p style="font-weight:700;margin:0 0 5px;">Kepada Supplier</p>
        <p style="margin:0;font-weight:600;">${safe(po.supplier_name || supplier.name)}</p>
        ${supplier.address ? `<p style="margin:2px 0 0;color:#475569;">${safe(supplier.address)}</p>` : ''}
        ${supplier.phone ? `<p style="margin:2px 0 0;color:#475569;">Telp. ${safe(supplier.phone)}</p>` : ''}
        ${supplier.email ? `<p style="margin:2px 0 0;color:#475569;">${safe(supplier.email)}</p>` : ''}
      </section>
      <section style="border:1px solid #CBD5E1;border-radius:5px;padding:10px;">
        <p style="font-weight:700;margin:0 0 5px;">Informasi Pengadaan</p>
        <p style="margin:0;">Status: <strong>${safe(status)}</strong></p>
        <p style="margin:2px 0 0;">Tanggal kebutuhan: ${safe(formatPurchaseOrderDate(po.expected_date))}</p>
        <p style="margin:2px 0 0;">Sumber: ${safe(po.source_type === 'Defecta' ? 'Defecta stok minimum' : 'Pengadaan manual')}</p>
      </section>
    </div>

    <p style="margin:0 0 8px;">Mohon dipenuhi sesuai rincian pesanan berikut:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <thead><tr style="background:#F1F5F9;">
        <th style="padding:8px;border:1px solid #CBD5E1;width:38px;">No.</th>
        <th style="padding:8px;border:1px solid #CBD5E1;text-align:left;">Nama Obat/Barang</th>
        <th style="padding:8px;border:1px solid #CBD5E1;">Jumlah</th>
        <th style="padding:8px;border:1px solid #CBD5E1;text-align:right;">Harga Satuan</th>
        <th style="padding:8px;border:1px solid #CBD5E1;text-align:right;">Subtotal</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr>
        <td colspan="4" style="padding:8px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">TOTAL</td>
        <td style="padding:8px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">${formatPurchaseOrderCurrency(po.total_amount || total)}</td>
      </tr></tfoot>
    </table>

    ${po.notes ? `<div style="border:1px solid #CBD5E1;border-radius:5px;padding:10px;margin-top:12px;"><strong>Catatan:</strong><br/>${safe(po.notes).replace(/\n/g, '<br/>')}</div>` : ''}
    <div style="margin-top:16px;border:1px solid ${approved ? '#A7F3D0' : '#FDE68A'};background:${approved ? '#ECFDF5' : '#FFFBEB'};border-radius:5px;padding:9px;">
      <strong>${approved ? 'SP telah disetujui' : 'SP menunggu persetujuan APJ'}</strong>
      ${po.approved_by ? ` oleh ${safe(po.approved_by)}${po.approved_date ? ` pada ${safe(formatPurchaseOrderDate(po.approved_date))}` : ''}.` : approved ? ' Dokumen ini siap dicetak atau diunduh sebagai PDF.' : ' Dokumen ini masih berupa pratinjau dan belum dapat dicetak.'}
    </div>
    <footer style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:42px;text-align:center;">
      <div><p style="margin:0 0 48px;">Dibuat oleh</p><strong>${safe(po.created_by || printedBy || 'Petugas Farmasi')}</strong><p style="margin:2px 0 0;color:#64748B;">${safe(po.created_by_role || '')}</p></div>
      <div><p style="margin:0 0 48px;">Disetujui oleh</p><strong>${safe(po.approved_by || 'Belum disetujui')}</strong><p style="margin:2px 0 0;color:#64748B;">${po.approved_by ? 'Apoteker Penanggung Jawab' : 'Approval diperlukan'}</p></div>
    </footer>
    <p style="font-size:10px;color:#64748B;margin:22px 0 0;text-align:right;">Dicetak oleh ${safe(printedBy || 'Petugas Farmasi')} • ${formatPurchaseOrderDate(new Date().toISOString())}</p>
  </div>`;
}

// Download the exact same rendered prescription markup used by the preview.
// Capturing the canonical HTML avoids the preview/PDF drift caused by a
// second, separately maintained PDF layout.
export async function downloadHTMLPDF(html, paperSize = 'A4', filename = 'Dokumen.pdf') {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const format = String(paperSize).toLowerCase() === 'a4' ? 'a4' : 'a5';
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:580px;padding:0;margin:0;background:#fff;z-index:-1;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = await html2canvas(host.firstElementChild || host, {
      backgroundColor: '#FFFFFF',
      scale: 2,
      useCORS: true,
    });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const pixelsPerMm = canvas.width / contentWidth;
    const pageCanvasHeight = Math.max(1, Math.floor((pageHeight - margin * 2) * pixelsPerMm));

    for (let offset = 0, page = 0; offset < canvas.height; offset += pageCanvasHeight, page += 1) {
      if (page > 0) doc.addPage(format, 'portrait');
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - offset);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const context = slice.getContext('2d');
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, slice.width, sliceHeight);
      doc.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, sliceHeight / pixelsPerMm);
    }

    doc.save(filename);
    return true;
  } finally {
    host.remove();
  }
}

export async function downloadPrescriptionPDF(html, paperSize = 'A5', filename = 'Resep.pdf') {
  return downloadHTMLPDF(html, paperSize, filename);
}

// Draw a single label on jsPDF document
function drawLabel(doc, label, w, h, config) {
  let y = 3;
  const margin = 2;
  const vis = config || {};

  // Background colors by type
  if (label.is_external) {
    doc.setFillColor(219, 234, 254);
    doc.rect(0, 0, w, h, 'F');
  }

  // Clinic name header
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.text(String(label.clinic_name || '').slice(0, 32), w / 2, y, { align: 'center' });
  y += 2;
  doc.setLineWidth(0.2);
  doc.line(margin, y, w - margin, y);
  y += 3;

  // Patient
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.text('Pasien:', margin, y);
  doc.setFont(undefined, 'bold');
  doc.text(String(label.patient_name).slice(0, 24), margin + 9, y);
  y += 3;

  // Medicine name
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  const medLines = doc.splitTextToSize(String(label.medicine_name).slice(0, 40), cw(w, margin));
  doc.text(medLines[0] || '', margin, y);
  y += 3;

  // Usage instruction — prominent. Do not print the internal field name
  // "Signa"; the patient should see the instruction itself.
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  const usageText = label.dosage || label.signa || label.usage_instruction || label.instructions || 'Aturan pakai belum ditentukan';
  const signaLines = doc.splitTextToSize(String(usageText), cw(w, margin));
  doc.text(signaLines, w / 2, y, { align: 'center' });
  y += 3.5 * Math.max(1, signaLines.length);

  // Quantity
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.text(`Jumlah: ${label.quantity}`, margin, y);
  y += 2.5;

  // Storage note (conditional — only if non-empty)
  if (label.storage_note && vis.label_show_storage_note !== false) {
    doc.setFontSize(6);
    const storageLines = doc.splitTextToSize(`Simpan: ${label.storage_note}`, cw(w, margin));
    doc.text(storageLines[0] || '', margin, y);
    y += 2;
  }

  // PIO note (conditional)
  if (label.pio_note && vis.label_show_pio) {
    doc.setFontSize(6);
    const pioLines = doc.splitTextToSize(`PIO: ${label.pio_note}`, cw(w, margin));
    doc.text(pioLines[0] || '', margin, y);
    y += 2;
  }

  // Footer: date + rx number + doctor
  doc.setLineWidth(0.1);
  doc.line(margin, h - 5, w - margin, h - 5);
  doc.setFontSize(5);
  doc.text(label.date, margin, h - 3);
  if (vis.label_show_rx_number !== false && label.rx_number) {
    doc.text(`No: ${label.rx_number}`, w - margin, h - 3, { align: 'right' });
  }
  if (vis.label_show_doctor && label.doctor_name) {
    doc.text(String(label.doctor_name).slice(0, 20), w / 2, h - 1.5, { align: 'center' });
  }
}

function cw(w, margin) { return w - margin * 2; }

// Generate multi-label PDF
export async function generateLabelsPDF(labels, config) {
  const { jsPDF } = await import('jspdf');
  const { w, h } = getLabelDimensions(config);
  const orientation = w >= h ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: [w, h] });
  const html2canvas = labels.some((label) => label.is_racikan)
    ? (await import('html2canvas')).default
    : null;

  for (const [idx, label] of labels.entries()) {
    if (idx > 0) doc.addPage([w, h], orientation);
    if (!label.is_racikan) {
      drawLabel(doc, label, w, h, config);
      continue;
    }

    // Racikan labels must use the same HTML renderer as their on-screen
    // preview. Render it into the PDF page instead of the legacy generic
    // jsPDF layout, which previously caused the preview/print mismatch.
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;padding:0;margin:0;background:#fff;z-index:-1;';
    host.innerHTML = buildRacikanLabelHTML(label, config);
    document.body.appendChild(host);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await html2canvas(host.firstElementChild, { backgroundColor: null, scale: 3, useCORS: true });
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    } finally {
      host.remove();
    }
  }

  return doc;
}

// Save labels PDF
export async function saveLabelsPDF(labels, config, filename) {
  const doc = await generateLabelsPDF(labels, config);
  doc.save(filename || `Etiket-${Date.now()}.pdf`);
}

// Print labels via jsPDF (opens PDF in new window for printing)
export async function printLabelsPDF(labels, config) {
  const doc = await generateLabelsPDF(labels, config);
  const blobUrl = doc.output('bloburl');
  const win = window.open(blobUrl, '_blank');
  if (win) {
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }
}

export async function generateRacikanLabelPDF(label, config) {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const { w, h } = getLabelDimensions(config);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;padding:0;margin:0;background:#fff;z-index:-1;';
  host.innerHTML = buildRacikanLabelHTML(label, config);
  document.body.appendChild(host);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = await html2canvas(host.firstElementChild, { backgroundColor: null, scale: 3, useCORS: true });
    const orientation = w >= h ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'mm', format: [w, h] });
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    return doc;
  } finally {
    host.remove();
  }
}

export async function printRacikanLabelPDF(label, config) {
  return printRacikanLabel(label, config);
}

// Print the canonical HTML label. Browser print preserves the same layout,
// dimensions, background, and text wrapping that the user sees in preview.
export function printRacikanLabel(label, config) {
  const { w, h } = getLabelDimensions(config);
  const win = window.open('', '_blank', 'width=500,height=500');
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><title>Etiket Racikan</title><style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0;padding:0;background:#fff}body{display:flex;align-items:flex-start;justify-content:flex-start}.racikan-label-canonical{display:block}@media screen{body{padding:12px;background:#fff}}</style></head><body>${buildRacikanLabelHTML(label, config)}</body></html>`);
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 300);
  return true;
}

export async function saveRacikanLabelPDF(label, config, filename) {
  const doc = await generateRacikanLabelPDF(label, config);
  doc.save(filename || `Label-Racikan-${Date.now()}.pdf`);
}

// Audit log for print actions
export async function logPrintAction({ user, prescriptionNumber, printReason, documentType, details }) {
  try {
    await db.entities.AuditLog.create({
      action: 'print',
      entity: 'Prescription',
      description: `Mencetak ${documentType}${prescriptionNumber ? ' ' + prescriptionNumber : ''}${printReason ? ' — Alasan: ' + printReason : ''}`,
      user_name: user?.full_name || user?.email || 'System',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ prescriptionNumber, printReason, documentType, details: details || {} }),
    });
  } catch (e) { console.error('Audit log failed:', e); }
}
