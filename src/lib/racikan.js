// Smart Racikan Calculator — math + rounding + pricing helpers

// Racikan lama dapat tersimpan dari form browser sebagai string (mis. "1,5"
// atau "2"). Seluruh perhitungan dan tampilan harus menormalkannya terlebih
// dahulu agar riwayat pasien tidak merusak halaman ketika data lama dibuka.
export function toFiniteNumber(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
    if (!normalized) return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Parse kekuatan string like "500mg", "500 mg", "10mg/5ml" → numeric mg
export function parseKekuatan(kekuatan) {
  if (!kekuatan) return 0;
  const match = String(kekuatan).toLowerCase().match(/([\d.]+)\s*mg/);
  return match ? parseFloat(match[1]) : 0;
}

// Fraction presets → multiplier
export const FRACTIONS = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '1': 1,
};

// Convert fraction to mg based on kekuatan
export function fractionToMg(fraction, kekuatanMg) {
  const mult = FRACTIONS[fraction] ?? 0;
  return mult * kekuatanMg;
}

// Core formula: Dosis per Racikan × Jumlah Ambil ÷ Kekuatan per Unit
export function calcKebutuhan(dosisPerRacikan, jumlahAmbil, kekuatanMg) {
  const dose = toFiniteNumber(dosisPerRacikan);
  const quantity = toFiniteNumber(jumlahAmbil);
  const strength = toFiniteNumber(kekuatanMg);
  if (!strength || strength <= 0) return 0;
  return (dose * quantity) / strength;
}

// Apply rounding rule
export function applyPembulatan(kebutuhanTeoritis, rule) {
  const value = toFiniteNumber(kebutuhanTeoritis);
  if (!value || value <= 0) return 0;
  switch (rule) {
    case 'ceil': return Math.ceil(value);
    case 'floor': return Math.floor(value);
    case 'round': return Math.round(value);
    case 'precision1': return Math.round(value * 10) / 10;
    default: return Math.ceil(value);
  }
}

// Format number for display — show integers without decimals, decimals with comma
export function fmtNum(n) {
  const value = toFiniteNumber(n);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace('.', ',');
}

// Format currency
export function fmtRupiah(n) {
  return 'Rp ' + toFiniteNumber(n).toLocaleString('id-ID');
}

// Compute full racikan worksheet state
export function computeRacikan(racikan) {
  const { components = [], jumlah_ambil = 0, kemasan_fee = 0, jasa_racik_fee = 0 } = racikan;
  const quantity = toFiniteNumber(jumlah_ambil);
  const packagingFee = toFiniteNumber(kemasan_fee);
  const compoundingFee = toFiniteNumber(jasa_racik_fee);
  let obatTotal = 0;
  const computed = (Array.isArray(components) ? components : []).map(c => {
    const kekuatanMg = parseKekuatan(c.kekuatan);
    const teoritis = calcKebutuhan(c.dosis_per_racikan, quantity, kekuatanMg);
    const ambil = c.kebutuhan_ambil_override != null
      ? toFiniteNumber(c.kebutuhan_ambil_override)
      : applyPembulatan(teoritis, c.pembulatan_rule || 'ceil');
    const subtotal = ambil * toFiniteNumber(c.harga_unit);
    obatTotal += subtotal;
    return { ...c, kekuatan_mg: kekuatanMg, kebutuhan_teoritis: teoritis, kebutuhan_ambil: ambil, subtotal };
  });
  const total = obatTotal + packagingFee + compoundingFee;
  return { components: computed, obat_total: obatTotal, kemasan_fee: packagingFee, jasa_racik_fee: compoundingFee, total };
}

// Build cart item for racikan (for PharmacyPOS cart integration)
export function racikanToCartItem(racikan, computed) {
  return {
    is_racikan: true,
    medicine_id: `racikan-${Date.now()}`,
    medicine_name: racikan.racikan_name || 'Racikan',
    bentuk_racikan: racikan.bentuk_racikan,
    quantity: 1,
    price: computed.total,
    subtotal: computed.total,
    components: computed.components,
    kemasan_fee: computed.kemasan_fee,
    jasa_racik_fee: computed.jasa_racik_fee,
    jumlah_resep: racikan.jumlah_resep,
    jumlah_ambil: racikan.jumlah_ambil,
    signa: racikan.signa,
  };
}

// Build FEFO cart from racikan components (for stock dispensing)
export function racikanToFEFOCart(computed) {
  return computed.components.map(c => ({
    medicine_id: c.medicine_id,
    medicine_name: c.medicine_name,
    quantity: c.kebutuhan_ambil,
    price: c.harga_unit,
    subtotal: c.subtotal,
    stock: c.stock || 0,
    product_type: c.product_type || 'Obat',
  })).filter(i => i.medicine_id && i.quantity > 0);
}

// Validation & Safety — decision-support warnings (never auto-block)
export function validateRacikan(racikan, patient, medicines) {
  const warnings = [];
  const comps = racikan.components || [];
  if (comps.length === 0) return warnings;

  // 1. Allergy check — match active_substance vs patient.allergies
  if (patient?.allergies) {
    const allergyText = patient.allergies.toLowerCase();
    comps.forEach(c => {
      const sub = (c.active_substance || '').toLowerCase().trim();
      const name = (c.medicine_name || '').toLowerCase().trim();
      if (sub && (allergyText.includes(sub) || (name && allergyText.includes(name)))) {
        warnings.push({
          type: 'allergy',
          severity: 'critical',
          message: `⚠ Alergi pasien terdeteksi: ${c.medicine_name} (${sub}) cocok dengan alergi "${patient.allergies}"`,
        });
      }
    });
  }

  // 2. Duplicate active substance across components
  const substanceMap = {};
  comps.forEach(c => {
    const sub = (c.active_substance || '').toLowerCase().trim();
    if (!sub) return;
    if (!substanceMap[sub]) substanceMap[sub] = [];
    substanceMap[sub].push(c.medicine_name);
  });
  Object.entries(substanceMap).forEach(([sub, names]) => {
    if (names.length > 1) {
      warnings.push({
        type: 'duplicate_substance',
        severity: 'warning',
        message: `⚠ Duplikasi kandungan: ${names.join(', ')} (zat aktif ${sub})`,
      });
    }
  });

  // 3. Interaction check — reuse logic from pharmacy.js pattern
  const medsWithInteractions = comps.map(c => {
    const med = medicines?.find(m => m.id === c.medicine_id);
    return med ? { ...med, _racikan_name: c.medicine_name } : null;
  }).filter(Boolean);
  for (let i = 0; i < medsWithInteractions.length; i++) {
    for (let j = i + 1; j < medsWithInteractions.length; j++) {
      const a = medsWithInteractions[i], b = medsWithInteractions[j];
      const aInter = (a.interactions || '').toLowerCase();
      const bInter = (b.interactions || '').toLowerCase();
      const aSub = (a.active_substance || '').toLowerCase().trim();
      const bSub = (b.active_substance || '').toLowerCase().trim();
      if (aSub && bInter.includes(aSub)) {
        warnings.push({ type: 'interaction', severity: 'critical', message: `⚠ Interaksi: ${b.name} berinteraksi dengan ${a.name} (zat aktif ${aSub})` });
      } else if (bSub && aInter.includes(bSub)) {
        warnings.push({ type: 'interaction', severity: 'critical', message: `⚠ Interaksi: ${a.name} berinteraksi dengan ${b.name} (zat aktif ${bSub})` });
      }
    }
  }

  // 4. Stock check — kebutuhan_ambil vs stock
  const computed = computeRacikan(racikan);
  computed.components.forEach(c => {
    if (c.kebutuhan_ambil > (c.stock || 0)) {
      warnings.push({
        type: 'stock',
        severity: 'critical',
        message: `⚠ Stok tidak mencukupi: ${c.medicine_name} butuh ${fmtNum(c.kebutuhan_ambil)}, stok ${c.stock || 0}`,
      });
    }
  });

  // 5. Unit compatibility — dosis unit vs kekuatan unit
  computed.components.forEach(c => {
    if (c.dosis_per_racikan > 0 && c.kekuatan_mg === 0 && c.kekuatan) {
      warnings.push({
        type: 'unit_mismatch',
        severity: 'warning',
        message: `⚠ Periksa konversi dosis: ${c.medicine_name} kekuatan "${c.kekuatan}" tidak terdeteksi sebagai mg — dosis mungkin perlu konversi manual`,
      });
    }
  });

  return warnings;
}

// Generate label data object for printing
export function generateLabelData(racikan, computed, config) {
  return {
    facility_name: config?.facility_name || 'Klinik & Apotek',
    label_header: config?.label_template || '',
    patient_name: racikan.patient_name || 'Pasien',
    racikan_name: racikan.racikan_name || 'Racikan',
    bentuk_racikan: racikan.bentuk_racikan || 'Puyer',
    jumlah: racikan.jumlah_ambil || 0,
    signa: racikan.signa || '',
    tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    instruksi: racikan.notes || '',
    components: computed.components.map(c => ({
      name: c.medicine_name,
      dosis: c.dosis_label || `${c.dosis_per_racikan}mg`,
      ambil: c.kebutuhan_ambil,
    })),
    total: computed.total,
  };
}

// Compare old racikan template vs new worksheet — returns diff
export function compareRacikan(oldTemplate, newRacikan) {
  const oldComps = (oldTemplate?.components || []).map(c => ({ ...c }));
  const newComps = (newRacikan?.components || []).map(c => ({ ...c }));
  const oldMap = {};
  oldComps.forEach(c => { oldMap[c.medicine_id] = c; });
  const newMap = {};
  newComps.forEach(c => { newMap[c.medicine_id] = c; });

  const added = newComps.filter(c => !oldMap[c.medicine_id]);
  const removed = oldComps.filter(c => !newMap[c.medicine_id]);
  const changed = newComps.filter(c => {
    const old = oldMap[c.medicine_id];
    if (!old) return false;
    return (old.dosis_per_racikan !== c.dosis_per_racikan) ||
           (old.kebutuhan_ambil !== c.kebutuhan_ambil) ||
           (old.dosis_label !== c.dosis_label);
  }).map(c => ({
    medicine_name: c.medicine_name,
    old_dosis: oldMap[c.medicine_id]?.dosis_label || '-',
    new_dosis: c.dosis_label || '-',
    old_ambil: oldMap[c.medicine_id]?.kebutuhan_ambil ?? '-',
    new_ambil: c.kebutuhan_ambil ?? '-',
  }));

  const jumlahChanged = (oldTemplate?.jumlah_ambil || 0) !== (newRacikan?.jumlah_ambil || 0);
  const signaChanged = (oldTemplate?.signa || '') !== (newRacikan?.signa || '');

  return { added, removed, changed, jumlahChanged, signaChanged, hasDiff: added.length > 0 || removed.length > 0 || changed.length > 0 || jumlahChanged || signaChanged };
}

// Append adjustment to audit log string
export function appendAdjustment(existingLog, entry) {
  let arr = [];
  try { arr = existingLog ? JSON.parse(existingLog) : []; } catch {}
  arr.push({ ...entry, timestamp: new Date().toISOString() });
  return JSON.stringify(arr);
}
