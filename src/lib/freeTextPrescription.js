// @ts-nocheck -- Clinical free-text parser intentionally builds heterogeneous interpretation records.
// Deterministic interpreter for the free-text prescription workflow.
// It intentionally never changes a doctor's wording. The output is an
// interpretation to be reviewed by the doctor and later by pharmacy.

const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100 };

const normalize = (value = '') => String(value)
  .toLowerCase()
  .replace(/[.,;:]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const title = (value = '') => String(value).replace(/\b\w/g, (char) => char.toUpperCase());

export const normalizePrescriptionText = (value = '') => String(value)
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .trim();

export const romanToNumber = (value) => {
  const source = String(value || '').trim().toUpperCase();
  if (!/^[IVXLC]+$/.test(source)) return null;
  return [...source].reduce((total, char, index) => {
    const current = ROMAN_VALUES[char];
    const next = ROMAN_VALUES[source[index + 1]] || 0;
    return total + (current < next ? -current : current);
  }, 0);
};

const numberFrom = (value) => {
  const source = String(value || '').trim();
  if (/^\d+(?:[.,]\d+)?$/.test(source)) return Number(source.replace(',', '.'));
  if (/^\d+(?:[.,]\d+)?\/\d+(?:[.,]\d+)?$/.test(source)) {
    const [numerator, denominator] = source.split('/').map((part) => Number(part.replace(',', '.')));
    return denominator ? numerator / denominator : null;
  }
  return romanToNumber(source);
};

// Common prescription conventions used in Indonesia.  This is intentionally a
// recognition dictionary, not a dosing authority: the original doctor's text
// remains authoritative and ambiguous entries are left for pharmacist review.
const defaultDictionary = [
  ['R/', 'R/', 'recipe'], ['Rp', 'R/', 'recipe'], ['Recipe', 'R/', 'recipe'],
  ['S', 'S', 'signa'], ['S.', 'S', 'signa'], ['Signa', 'S', 'signa'],
  ['No', 'No', 'quantity'], ['No.', 'No', 'quantity'], ['N', 'No', 'quantity'], ['#', 'No', 'quantity'],
  ['M.f.', 'M.f.', 'misce fac'], ['M.f', 'M.f.', 'misce fac'], ['Mfm', 'M.f.m.', 'misce fac mixtura'], ['Mf', 'M.f.', 'misce fac'],
  ['Misce', 'misce', 'campur'], ['Fiat', 'fiat', 'buat menjadi'], ['Fac', 'fac', 'buat'],
  ['D.t.d.', 'dtd', 'da tales doses'], ['Dtd', 'dtd', 'da tales doses'], ['Div.', 'div', 'bagi menjadi'],
  ['Da', 'da', 'berikan'], ['Da in', 'da in', 'berikan dalam'], ['aa', 'aa', 'ana / masing-masing sama banyak'],
  ['ad', 'ad', 'hingga jumlah'], ['q.s.', 'qs', 'quantum satis / secukupnya'], ['qs', 'qs', 'secukupnya'],
  ['ad lib.', 'ad lib', 'secukupnya sesuai kebutuhan'], ['pro', 'pro', 'untuk pasien'],
  ['dd', 'dd', 'kali sehari'], ['TDD', 'tid', 'ter in die / 3 kali sehari'], ['T.i.d.', 'tid', '3 kali sehari'], ['tid', 'tid', '3 kali sehari'],
  ['BID', 'bid', 'bis in die / 2 kali sehari'], ['B.i.d.', 'bid', '2 kali sehari'], ['bid', 'bid', '2 kali sehari'],
  ['QID', 'qid', 'quater in die / 4 kali sehari'], ['Q.i.d.', 'qid', '4 kali sehari'], ['qid', 'qid', '4 kali sehari'],
  ['QD', 'qd', 'quaque die / 1 kali sehari'], ['q.d.', 'qd', '1 kali sehari'], ['qd', 'qd', '1 kali sehari'],
  ['QOD', 'qod', 'setiap dua hari'], ['q.o.d.', 'qod', 'setiap dua hari'], ['qod', 'qod', 'setiap dua hari'],
  ['Sdd', 'sdd', 'semel die / 1 kali sehari'], ['S.d.d.', 'sdd', 'semel de die / 1 kali sehari'], ['Semel de die', 'sdd', '1 kali sehari'],
  ['Bd', 'bd', 'bis de die / 2 kali sehari'], ['B.d.', 'bd', '2 kali sehari'], ['Bdd', 'bdd', 'bis de die / 2 kali sehari'], ['B.d.d.', 'bdd', 'bis de die / 2 kali sehari'], ['Bis de die', 'bdd', '2 kali sehari'],
  ['T.d.d.', 'tdd', 'ter de die / 3 kali sehari'], ['Ter de die', 'tdd', '3 kali sehari'],
  ['Q.d.d.', 'qdd', 'quarter de die / 4 kali sehari'], ['Quarter de die', 'qdd', '4 kali sehari'],
  ['Q4H', 'q4h', 'setiap 4 jam'], ['Q6H', 'q6h', 'setiap 6 jam'], ['Q8H', 'q8h', 'setiap 8 jam'], ['Q12H', 'q12h', 'setiap 12 jam'],
  ['Stat', 'stat', 'segera / sekarang'], ['Cito', 'cito', 'segera'], ['SNS', 'sns', 'si necesse sit / bila perlu'], ['S.N.S.', 'sns', 'bila perlu'], ['Si necesse sit', 'sns', 'bila perlu'],
  ['SOS', 'sos', 'bila perlu segera'], ['S.O.S.', 'sos', 'bila perlu segera'],
  ['PRN', 'prn', 'pro re nata / bila perlu'], ['P.R.N.', 'prn', 'bila perlu'], ['HS', 'hs', 'hora somni / sebelum tidur'], ['H.s.', 'hs', 'sebelum tidur'],
  ['Mane', 'mane', 'pagi hari'], ['Nocte', 'nocte', 'malam hari'], ['Vespere', 'vesp', 'sore hari'],
  ['PC', 'pc', 'post cibum / sesudah makan'], ['P.C.', 'pc', 'sesudah makan'], ['post cibum', 'pc', 'sesudah makan'], ['post coenam', 'pc', 'sesudah makan'],
  ['AC', 'ac', 'ante cibum / sebelum makan'], ['A.C.', 'ac', 'sebelum makan'], ['ante cibum', 'ac', 'sebelum makan'], ['ante coenam', 'ac', 'sebelum makan'],
  ['P.O.', 'po', 'per os / melalui mulut'], ['Per os', 'po', 'melalui mulut'],
  ['O.D.', 'od', 'oculus dexter / mata kanan'], ['O.S.', 'os', 'oculus sinister / mata kiri'], ['O.U.', 'ou', 'oculi uterque / kedua mata'],
  ['A.D.', 'ad', 'auris dextra / telinga kanan'], ['A.S.', 'as', 'auris sinistra / telinga kiri'],
  ['Tab', 'tablet', 'tablet'], ['Tablet', 'tablet', 'tablet'], ['Tabs', 'tablet', 'tablet'],
  ['Cap', 'kapsul', 'capsula / kapsul'], ['Caps', 'kapsul', 'capsulae / kapsul'], ['Capsulae', 'kapsul', 'kapsul'], ['Kapsul', 'kapsul', 'kapsul'],
  ['Pulv', 'pulvis', 'serbuk/puyer'], ['Pulv.', 'pulvis', 'serbuk/puyer'], ['Pulveres', 'pulveres', 'serbuk terbagi'], ['Puyer', 'puyer', 'puyer'],
  ['C', 'sendok makan', 'cochlear / sendok makan'], ['C.', 'sendok makan', 'cochlear / sendok makan'], ['Cth', 'sendok teh', 'cochleare theae / sendok teh'], ['C.th.', 'sendok teh', 'cochleare theae / sendok teh'], ['Cochlear theae', 'sendok teh', 'sendok teh'], ['Sdt', 'sendok teh', 'sendok teh'], ['Sdm', 'sendok makan', 'sendok makan'],
  ['Q.s.', 'qs', 'quantum satis / secukupnya'], ['Quantum satis', 'qs', 'secukupnya'],
  ['Syr', 'sirup', 'syrup / sirup'], ['Sir', 'sirup', 'sirup'], ['Susp', 'suspensi', 'suspensio / suspensi'], ['Sol', 'larutan', 'solutio / larutan'],
  ['Gtt', 'tetes', 'guttae / tetes'], ['Guttae', 'tetes', 'tetes'], ['Drg', 'dragee', 'dragee'], ['Pil', 'pil', 'pilula'],
  ['Ung', 'salep', 'unguentum / salep'], ['Ungt.', 'salep', 'unguentum / salep'], ['Unguentum', 'salep', 'salep'], ['Oint', 'salep', 'salep'], ['Cr', 'krim', 'cremor / krim'], ['Lotion', 'losio', 'losio'],
  ['Supp', 'suppositoria', 'suppositoria'], ['Ov', 'ovula', 'ovula'], ['Amp', 'ampul', 'ampulla / ampul'], ['Vial', 'vial', 'vial'],
  ['Fl', 'botol', 'flacon / botol'], ['Fls', 'botol', 'flacones / botol'], ['Neb', 'nebulisasi', 'nebulisasi'], ['Inh', 'inhalasi', 'inhalasi'],
  ['PO', 'per oral', 'per os / melalui mulut'], ['P.O.', 'per oral', 'per oral'], ['Per os', 'per oral', 'melalui mulut'],
  ['IM', 'intramuskular', 'intramuskular'], ['I.M.', 'intramuskular', 'intramuskular'], ['IV', 'intravena', 'intravena'], ['I.V.', 'intravena', 'intravena'],
  ['SC', 'subkutan', 'subkutan'], ['S.C.', 'subkutan', 'subkutan'], ['SL', 'sublingual', 'sublingual'], ['S.L.', 'sublingual', 'sublingual'],
  ['Top', 'topikal', 'topikal'], ['Ad us. ext.', 'pemakaian luar', 'ad usum externum / obat luar'], ['Ad usum externum', 'pemakaian luar', 'obat luar'],
  ['Ad us. int.', 'pemakaian dalam', 'ad usum internum / obat dalam'], ['Ad usum internum', 'pemakaian dalam', 'obat dalam'],
  ['Iter', 'iter', 'pengulangan resep'], ['Ne iter', 'ne iter', 'tidak boleh diulang'],
];

const dictionaryMap = (dictionary = []) => {
  const records = [
    ...defaultDictionary.map(([abbreviation, canonical, meaning]) => ({ abbreviation, canonical, meaning, approval_status: 'Disetujui' })),
    ...(dictionary || []),
  ];
  return records
    .filter((entry) => !entry.approval_status || entry.approval_status === 'Disetujui')
    .reduce((map, entry) => {
      const canonical = entry.standard_meaning || entry.canonical || entry.meaning || entry.abbreviation;
      [entry.abbreviation, ...(Array.isArray(entry.aliases) ? entry.aliases : String(entry.aliases || '').split(','))]
        .filter(Boolean)
        .forEach((alias) => { map[normalize(alias)] = canonical; });
      return map;
    }, {});
};

const addFlag = (flags, severity, code, message, line = null) => {
  const id = `${code}-${line || 'all'}`;
  if (!flags.some((flag) => flag.id === id)) flags.push({ id, severity, code, message, line, resolved: false });
};

const medicineBase = (medicine) => normalize(
  medicine.generic_name || medicine.active_substance || medicine.name || ''
).replace(/\b\d+(?:[.,]\d+)?\s*(mg|mcg|g|ml|%|iu|unit)\b/g, '').trim();

const lineWithoutQuantity = (line) => String(line || '')
  .replace(/\b(?:n|no\.?)\s*[ivxlc\d.,]+\b/ig, '')
  .trim();

const parseQuantity = (line) => {
  const matches = [...String(line || '').matchAll(/(?:\b(?:n|no\.?|d\.?t\.?d\.?)|#)\s*([ivxlc\d]+(?:[.,/]?[ivxlc\d]+)*)/ig)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const quantity = numberFrom(matches[index][1]);
    if (quantity !== null) return quantity;
  }
  return null;
};

const parseStrength = (line) => {
  const match = String(line || '').match(/\b(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|ml|%|iu|unit)(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(mg|mcg|g|ml|%|iu|unit))?\b/i);
  return match ? `${match[1].replace(',', '.')} ${match[2].toLowerCase()}` : '';
};

const looseMedicineName = (line) => normalize(line)
  .replace(/\b(?:n|no\.?)\s*[ivxlc\d.,]+\b/ig, ' ')
  .replace(/(?:\b\d+\s*\/\s*\d+|\b\d+(?:[.,]\d+)?)\s*(?:mg|mcg|g|ml|%|iu|unit|tab(?:let)?s?|cap(?:s|sule)?|kapsul|sirup|syr|suspensi|susp|puyer|pulv(?:eres)?|pulvis|capsulae|dragee|amp(?:ul)?|vial|fls?|botol)\b/ig, ' ')
  .replace(/\b(?:tab(?:let)?s?|cap(?:s|sule)?|kapsul|sirup|syr|suspensi|susp|puyer|pulv(?:eres)?|pulvis|capsulae|dragee|amp(?:ul)?|vial|fls?|botol)\b/ig, ' ')
  .replace(/[\/\\]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const looseQuantity = (line) => {
  const fracMatch = String(line || '').match(/\b(\d+)\s*\/\s*(\d+)\s*(?:tab(?:let)?|cap(?:s|sule)?|kapsul|botol|sachet|tube|strip|ml)\b/i);
  if (fracMatch) {
    const den = Number(fracMatch[2]);
    return den ? Number(fracMatch[1]) / den : null;
  }
  const match = String(line || '').match(/\b(\d+(?:[.,]\d+)?)\s*(?:tab(?:let)?|cap(?:s|sule)?|kapsul|botol|sachet|tube|strip|ml)\b/i);
  if (match) return Number(match[1].replace(',', '.'));
  const trailing = String(line || '').match(/\b(\d+(?:[.,]\d+)?)\s*$/);
  return trailing ? Number(trailing[1].replace(',', '.')) : null;
};

const FRACTION_UNICODE = {
  '1/2': '½',
  '1/4': '¼',
  '3/4': '¾',
  '1/3': '⅓',
  '2/3': '⅔',
};

const parseComponentDose = (line, matchedMedicineStrength = '') => {
  const text = String(line || '').trim();
  const mgMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|ml|%|iu|unit)\b/i);
  if (mgMatch) {
    const val = parseFloat(mgMatch[1].replace(',', '.'));
    const unit = mgMatch[2].toLowerCase();
    return {
      dosis_mode: unit === 'mg' ? 'mg' : 'unit',
      dosis_per_racikan: val,
      dosis_label: `${val} ${unit}`,
      unit,
    };
  }
  const fracMatch = text.match(/\b(\d+\/\d+)\s*(?:tab(?:let)?|cap(?:s|sule)?|kapsul|bungkus|pulv)?\b/i);
  if (fracMatch) {
    const fracStr = fracMatch[1];
    const [num, den] = fracStr.split('/').map(Number);
    const fracVal = den ? num / den : 1;
    const label = FRACTION_UNICODE[fracStr] || fracStr;
    const medMg = parseFloat(String(matchedMedicineStrength || '').match(/([\d.]+)\s*mg/i)?.[1] || 0);
    return {
      dosis_mode: 'pecahan',
      dosis_label: label,
      dosis_per_racikan: medMg ? fracVal * medMg : fracVal,
      unit: 'tab',
    };
  }
  const wholeTabMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:tab(?:let)?|cap(?:s|sule)?|kapsul)\b/i);
  if (wholeTabMatch) {
    const count = parseFloat(wholeTabMatch[1].replace(',', '.'));
    const medMg = parseFloat(String(matchedMedicineStrength || '').match(/([\d.]+)\s*mg/i)?.[1] || 0);
    return {
      dosis_mode: 'mg',
      dosis_label: `${count} tab`,
      dosis_per_racikan: medMg ? count * medMg : count,
      unit: 'tab',
    };
  }
  return {
    dosis_mode: 'mg',
    dosis_label: '',
    dosis_per_racikan: 0,
    unit: '',
  };
};

const isLikelyLooseMedicineLine = (line) => {
  const value = String(line || '').trim();
  if (!value || /^(?:s(?:igna)?\.?|m\.?\s*f\.?|misce\b|da\s+in|pro\b|rp\.?\/?|recipe\b|alamat\b|umur\b|nama\b|tanggal\b)/i.test(value)) return false;
  return /[a-z]/i.test(value) && /\d/.test(value);
};

const isRecipeLine = (line) => /^(?:r\/|rp\.?\/?|recipe\b)\s*/i.test(String(line || '').trim());

const editDistance = (left, right) => {
  const a = String(left || '');
  const b = String(right || '');
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
};

const medicineNames = (medicine) => [
  medicine.name,
  medicine.generic_name,
  medicine.active_substance,
  ...(Array.isArray(medicine.aliases) ? medicine.aliases : String(medicine.aliases || '').split(',')),
].filter(Boolean).map(normalize);

const candidateScore = (typedName, medicine) => {
  const typed = normalize(typedName);
  const names = medicineNames(medicine);
  return Math.max(...names.map((name) => {
    if (name === typed) return 1;
    if (name.includes(typed) || typed.includes(name)) return 0.82;
    const distance = editDistance(name, typed);
    return 1 - (distance / Math.max(name.length, typed.length, 1));
  }));
};

const candidateNames = (typedName, medicines) => [...(medicines || [])]
  .filter((medicine) => medicine.is_active !== false)
  .map((medicine) => ({ medicine, score: candidateScore(typedName, medicine) }))
  .filter(({ score }) => score >= 0.58)
  .sort((left, right) => right.score - left.score)
  .slice(0, 4)
  .map(({ medicine }) => medicine.name);

export const formatMedicineLabel = (medicineName, strength = '') => {
  const name = String(medicineName || '').trim();
  const normalizedName = normalize(name);
  const normalizedStrength = normalize(strength);
  const compactName = normalizedName.replace(/\s+/g, '');
  const compactStrength = normalizedStrength.replace(/\s+/g, '');
  if (!name || !normalizedStrength || normalizedName.includes(normalizedStrength) || compactName.includes(compactStrength)) return name;
  return `${name} ${strength}`.trim();
};

const matchMedicine = (rawLine, medicines, flags, lineNumber, { component = false, isLiquidMixture = false, loose = false, validateAgainstFormulary = true, collectValidationFlags = true } = {}) => {
  const quantityRemoved = lineWithoutQuantity(rawLine);
  const typed = normalize(quantityRemoved);
  const typedStrength = parseStrength(rawLine);
  const withoutStrength = typed.replace(/\b\d+(?:[.,]\d+)?\s*(mg|mcg|g|ml|%|iu|unit)\b/g, '').trim();
  const looseName = looseMedicineName(quantityRemoved);
  const reportFlag = (...args) => collectValidationFlags && addFlag(flags, ...args);
  const inferredQuantity = !parseQuantity(rawLine) ? looseQuantity(rawLine) : null;
  const quantity = component ? null : (parseQuantity(rawLine) ?? ((!validateAgainstFormulary || loose) ? inferredQuantity : null));

  // In the doctor's workspace the original prescription is authoritative. Do
  // not query or match the pharmacy formulary here; pharmacy performs that
  // verification later during dispensing.
  if (!validateAgainstFormulary) {
    return {
      medicine_id: '',
      medicine_name: looseName || quantityRemoved,
      active_substance: '',
      strength: typedStrength,
      form: '',
      min_daily_dose: null,
      max_daily_dose: null,
      quantity,
      raw: rawLine,
      source_line: lineNumber,
      match_status: 'unverified',
      match_confidence: null,
      candidate_medicines: [],
      unresolved_reason: 'Dicatat dari teks dokter; verifikasi produk dan ketersediaan dilakukan farmasi.',
    };
  }
  const typedVariants = [typed, withoutStrength, looseName].filter((value) => value.length >= 3);
  const candidates = medicines.filter((medicine) => {
    const names = medicineNames(medicine);
    return names.some((name) => typedVariants.some((variant) => name === variant || variant.includes(name) || name.includes(variant)));
  });
  let viable = candidates.filter((medicine) => medicine.is_active !== false);

  // If in component mode (solid racikan like pulveres/kapsul), prefer solid form (Tablet/Kapsul) if available
  if (component && !isLiquidMixture && viable.length > 1) {
    const solidProducts = viable.filter((m) => /tablet|kapsul|kaplet/i.test(m.form || ''));
    if (solidProducts.length > 0) {
      viable = solidProducts;
    }
  }

  // Deduplicate viable medicines by name/substance, strength and form
  const seenViableKeys = new Set();
  viable = viable.filter((m) => {
    const key = `${normalize(m.name || m.generic_name || m.active_substance)}|${normalize(m.strength || '').replace(/\s/g, '')}|${normalize(m.form || '')}`;
    if (seenViableKeys.has(key)) return false;
    seenViableKeys.add(key);
    return true;
  });

  if (!viable.length) {
    const suggestions = candidateNames(looseName || withoutStrength, medicines);
    reportFlag('red', 'DRUG_NOT_FOUND', `Obat "${quantityRemoved}" tidak ditemukan di formularium${suggestions.length ? `. Pilihan yang mungkin: ${suggestions.join(', ')}` : ''}. Dokter harus memilih atau menulis ulang.`, lineNumber);
    return {
      medicine_name: quantityRemoved,
      strength: typedStrength,
      quantity: component ? null : (parseQuantity(rawLine) ?? (loose ? inferredQuantity : null)),
      raw: rawLine,
      source_line: lineNumber,
      match_status: 'unmatched',
      match_confidence: 0,
      candidate_medicines: suggestions,
      unresolved_reason: 'Nama obat belum cocok dengan formularium yang aktif.',
      unmatched: true,
    };
  }
  const baseMatches = viable.filter((medicine) => medicineBase(medicine) === normalize(withoutStrength) || normalize(medicine.generic_name || '').includes(withoutStrength));
  const exactNameMatches = viable.filter((medicine) => [medicine.name, medicine.generic_name, medicine.active_substance]
    .filter(Boolean).map(normalize).includes(typed));
  const selected = typedStrength
    ? viable.filter((medicine) => normalize(medicine.strength).replace(/\s/g, '') === normalize(typedStrength).replace(/\s/g, ''))
    : viable;
  const selectionPool = exactNameMatches.length ? exactNameMatches : selected;
  if (typedStrength && selected.length === 0) {
    if (!component) {
      reportFlag('red', 'STRENGTH_MISMATCH', `Kekuatan "${typedStrength}" pada "${quantityRemoved}" tidak cocok dengan kekuatan formularium yang tersedia. Sistem menampilkan kandidat untuk ditinjau, tetapi tidak menganggapnya benar secara otomatis.`, lineNumber);
    }
  }
  const distinctPoolProducts = new Set(selectionPool.map((medicine) => `${normalize(medicine.generic_name || medicine.active_substance || medicine.name)}|${normalize(medicine.strength).replace(/\s/g, '')}`));
  const distinctViableProducts = new Set(viable.map((medicine) => `${normalize(medicine.generic_name || medicine.active_substance || medicine.name)}|${normalize(medicine.strength).replace(/\s/g, '')}`));
  const isAmbiguous = component
    ? (isLiquidMixture ? (distinctPoolProducts.size > 1 || distinctViableProducts.size > 1) : distinctPoolProducts.size > 1)
    : (distinctPoolProducts.size > 1 || (typedStrength && selected.length === 0 && distinctViableProducts.size > 1));

  if (isAmbiguous) {
    reportFlag('red', 'DRUG_AMBIGUOUS', `"${quantityRemoved}" memiliki lebih dari satu kecocokan formularium. Dokter harus memilih produk/kekuatan yang tepat.`, lineNumber);
  }
  const distinctStrengths = [...new Set((baseMatches.length ? baseMatches : viable).map((medicine) => normalize(medicine.strength)).filter(Boolean))];
  if (!typedStrength && distinctStrengths.length > 1 && !component) {
    reportFlag('red', 'STRENGTH_REQUIRED', `Kekuatan obat untuk "${quantityRemoved}" belum disebutkan, sedangkan tersedia beberapa kekuatan.`, lineNumber);
  }
  const medicine = selectionPool[0] || viable[0];
  if (inferredQuantity !== null && !component) {
    reportFlag('yellow', 'QUANTITY_INFERRED_REVIEW', `Jumlah ${inferredQuantity} untuk "${quantityRemoved}" dibaca dari format bebas. Farmasi wajib mengonfirmasi jumlah sebelum dispensing.`, lineNumber);
  }
  const candidateProducts = [...new Set(viable.map((item) => formatMedicineLabel(item.name, item.strength)))].slice(0, 4);
  const matchStatus = typedStrength && selected.length === 0 && !component
    ? 'strength_mismatch'
    : isAmbiguous
      ? 'ambiguous'
      : 'matched';
  const matchConfidence = matchStatus === 'matched' ? 1 : (exactNameMatches.length ? 0.62 : 0.48);
  const unresolvedReason = matchStatus === 'strength_mismatch'
    ? `Kekuatan ${typedStrength} belum cocok dengan produk formularium.`
    : matchStatus === 'ambiguous'
      ? 'Lebih dari satu produk atau kekuatan cocok; pilihan tidak boleh ditebak otomatis.'
      : '';

  const doseInfo = component ? parseComponentDose(rawLine, medicine.strength) : null;

  return {
    medicine_id: medicine.id,
    medicine_name: medicine.name,
    active_substance: medicine.active_substance || medicine.generic_name || '',
    strength: medicine.strength || typedStrength,
    form: medicine.form || medicine.unit || '',
    min_daily_dose: Number(medicine.min_daily_dose ?? medicine.dose_min ?? medicine.minimum_daily_dose) || null,
    max_daily_dose: Number(medicine.max_daily_dose ?? medicine.dose_max ?? medicine.maximum_daily_dose) || null,
    quantity: component ? null : (parseQuantity(rawLine) ?? inferredQuantity),
    raw: rawLine,
    source_line: lineNumber,
    match_status: matchStatus,
    match_confidence: matchConfidence,
    candidate_medicines: candidateProducts,
    unresolved_reason: unresolvedReason,
    ...(doseInfo ? {
      dosis_per_racikan: doseInfo.dosis_per_racikan,
      dosis_mode: doseInfo.dosis_mode,
      dosis_label: doseInfo.dosis_label,
    } : {}),
  };
};

const parseSigna = (line, dictionary, flags, lineNumber, isLiquidMixture, collectValidationFlags = true) => {
  const reportFlag = (...args) => collectValidationFlags && addFlag(flags, ...args);
  const raw = String(line || '').replace(/^\s*(?:mfm\s+)?s(?:igna)?\.?\s*/i, '').trim();
  const lower = normalize(raw);
  const tokens = lower.split(' ').filter(Boolean);
  const canonical = tokens.map((token) => dictionary[token] || token);
  const frequencyPatterns = [
    { pattern: /\b(?:t\s*i\s*d|tid|tdd|ter\s+in\s+die)\b/i, times: 3 },
    { pattern: /\b(?:t\s*d\s*d|tdd|ter\s+de\s+die)\b/i, times: 3 },
    { pattern: /\b(?:b\s*i\s*d|bid|b\s*d(?:\s*d)?|bdd|bis\s+(?:de|in)\s+die)\b/i, times: 2 },
    { pattern: /\b(?:q\s*i\s*d|qid|q\s*d\s*d|qdd|quater\s+in\s+die|quarter\s+de\s+die)\b/i, times: 4 },
    { pattern: /\b(?:q\s*d|qd|s\s*d\s*d|sdd|semel\s+(?:de\s+)?die|quaque\s+die)\b/i, times: 1 },
    { pattern: /\b(?:q\s*o\s*d|qod|every\s+other\s+day)\b/i, times: null, label: 'setiap dua hari' },
    { pattern: /\b(?:s\s*n\s*s|sns|si\s+necesse\s+sit|s\s*o\s*s|sos|p\s*r\s*n|prn)\b/i, times: null, label: '' },
    { pattern: /\bq\s*4\s*h\b|\bq4h\b/i, times: 6 },
    { pattern: /\bq\s*6\s*h\b|\bq6h\b/i, times: 4 },
    { pattern: /\bq\s*8\s*h\b|\bq8h\b/i, times: 3 },
    { pattern: /\bq\s*12\s*h\b|\bq12h\b/i, times: 2 },
    { pattern: /\b(\d+)\s*(?:x|dd)\b/i, times: 'capture' },
  ];
  const frequency = frequencyPatterns.find(({ pattern }) => pattern.test(lower));
  const frequencyCapture = lower.match(/\b(\d+)\s*(?:x|dd)\b/i);
  const timesPerDay = frequency?.times === 'capture'
    ? Number(frequencyCapture?.[1])
    : (frequency?.times ?? null);
  const doseUnitPattern = 'tablet|tab|kapsul|cap|caps?|sendok\\s+makan|sendok\\s+teh|sdm|sdt|cth|c\\s+th|cochlear(?:e)?(?:\\s+theae)?|c|ml|tetes|gtt|unit|ue|pulv|puyer|bungkus|sachet|ungt?|unguentum|salep';
  const doseMatch = lower.match(new RegExp(`(?:\\b(?:dd|x)\\b\\s*)?(\\d+(?:[.,]\\d+)?(?:\\/\\d+(?:[.,]\\d+)?)?)\\s*(${doseUnitPattern})\\b`, 'i'))
    || lower.match(new RegExp(`\\b(${doseUnitPattern})\\s*(\\d+(?:[.,]\\d+)?(?:\\/\\d+(?:[.,]\\d+)?)?)(?:\\s+|$)`, 'i'))
    || lower.match(/\b(?:dd|x|tid|bid|qid|qd|sdd|bdd|qdd|q\s*\d+\s*h)\s+(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?))(?:\s+|$)/i);
  const bareDoseMatch = lower.match(/(?:\b(?:tid|bid|qid|qd|sdd|bdd|qdd|q\s*\d+\s*h|\d+\s*x|\d+\s*dd)\b)\s*(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?))/i);
  const unitMap = {
    tab: 'tablet', tablet: 'tablet', tabs: 'tablet', cap: 'kapsul', caps: 'kapsul', capsule: 'kapsul', kapsul: 'kapsul',
    sdt: 'sendok teh', cth: 'sendok teh', 'c th': 'sendok teh', cochlear: 'sendok makan', cochleare: 'sendok makan', 'cochlear theae': 'sendok teh', c: 'sendok makan', sdm: 'sendok makan', ue: 'unit', ml: 'ml', tetes: 'tetes', gtt: 'tetes',
    pulv: 'puyer', puyer: 'puyer', bungkus: 'bungkus', sachet: 'sachet',
    ung: 'salep', ungt: 'salep', unguentum: 'salep', salep: 'salep',
  };
  const unitFirst = doseMatch?.[2] && /^(tablet|tab|kapsul|cap|caps?|sendok|sdm|sdt|cth|c\s+th|c|cochlear|ml|tetes|gtt|unit|ue|pulv|puyer|bungkus|sachet|ungt?|unguentum|salep)/i.test(doseMatch[1]);
  const doseValue = unitFirst ? doseMatch[2] : doseMatch?.[1] || bareDoseMatch?.[1];
  const unitValue = unitFirst ? doseMatch[1] : doseMatch?.[2];
  const dose = doseValue ? numberFrom(doseValue) : null;
  const unit = unitValue ? (unitMap[unitValue.toLowerCase()] || unitValue.toLowerCase()) : '';
  const quantityInstruction = /\b(?:q\s*s|qs|quantum\s+satis)\b/i.test(lower) ? 'secukupnya' : '';
  const meal = /\b(?:pc|p\s+c|post\s+cibum|sesudah\s+makan)\b/.test(lower)
    ? 'sesudah makan'
    : /\b(?:ac|a\s+c|ante\s+cibum|ante\s+coenam|sebelum\s+makan)\b/.test(lower)
      ? 'sebelum makan'
      : /\b(?:pc|post\s+coenam)\b/.test(lower)
        ? 'sesudah makan'
        : /\b(?:prn|p\s+r\s+n|s\s+o\s+s|sos|s\s+n\s+s|sns|si\s+necesse\s+sit|bila\s+perlu)\b/.test(lower)
        ? 'bila perlu'
          : /\b(?:hs|h\s+s|hora\s+somni|sebelum\s+tidur)\b/.test(lower)
            ? 'sebelum tidur'
            : /\bmane\b|\bpagi\b/.test(lower)
              ? 'pagi hari'
              : /\b(?:vespere|vesp|sore)\b/.test(lower)
                ? 'sore hari'
                : /\bnocte\b|\bmalam\b/.test(lower)
                  ? 'malam hari'
                  : '';
  const routePatterns = [
    { pattern: /\b(?:p\s*o|per\s+os|per\s+oral|oral)\b/i, label: 'melalui mulut' },
    { pattern: /\b(?:o\s*d|od|oculus\s+dexter|mata\s+kanan)\b/i, label: 'mata kanan' },
    { pattern: /\b(?:o\s*s|os|oculus\s+sinister|mata\s+kiri)\b/i, label: 'mata kiri' },
    { pattern: /\b(?:o\s*u|ou|oculi\s+uterque|kedua\s+mata)\b/i, label: 'kedua mata' },
    { pattern: /\b(?:a\s*d|auris\s+dextra|telinga\s+kanan)\b/i, label: 'telinga kanan' },
    { pattern: /\b(?:a\s*s|auris\s+sinistra|telinga\s+kiri)\b/i, label: 'telinga kiri' },
    { pattern: /\b(?:i\s*m|intramuskular)\b/i, label: 'intramuskular' },
    { pattern: /\b(?:i\s*v|intravena)\b/i, label: 'intravena' },
    { pattern: /\b(?:s\s*c|subkutan)\b/i, label: 'subkutan' },
    { pattern: /\b(?:s\s*l|sublingual)\b/i, label: 'sublingual' },
    { pattern: /\b(?:ad\s+us\s+ext|ad\s+usum\s+externum|pemakaian\s+luar|topikal)\b/i, label: 'pemakaian luar' },
    { pattern: /\b(?:ad\s+us\s+int|ad\s+usum\s+internum|pemakaian\s+dalam)\b/i, label: 'pemakaian dalam' },
  ];
  const route = routePatterns.find(({ pattern }) => pattern.test(lower))?.label || '';
  const knownWords = new Set([
    's', 'signa', 'mfm', 'misce', 'fac', 'fiat', 'mixtura', 'pulv', 'pulveres', 'pulvis', 'puyer', 'dd', 'tid', 'tdd', 't', 'bid', 'bd', 'bdd', 'b', 'qid', 'qdd', 'qd', 'sdd', 'qod',
    'q4h', 'q6h', 'q8h', 'q12h', 'stat', 'cito', 'sos', 'sns', 'si', 'necesse', 'sit', 'prn', 'hs', 'mane', 'vespere', 'vesp', 'nocte', 'pc', 'p', 'c', 'ac', 'a', 'ante', 'post', 'cibum', 'coenam', 'semel', 'ter', 'bis', 'quater',
    'tab', 'tabs', 'tablet', 'cap', 'caps', 'capsule', 'kapsul', 'sendok', 'makan', 'teh', 'sdm', 'sdt', 'cth', 'th', 'cochlear', 'cochleare', 'theae', 'ml', 'tetes', 'gtt', 'unit', 'ue', 'pulv', 'puyer', 'bungkus', 'sachet', 'ung', 'ungt', 'unguentum', 'salep',
    'x', 'kali', 'sehari', 'sesudah', 'sebelum', 'bila', 'perlu', 'tidur', 'pagi', 'malam', 'sore', 'ter', 'in', 'die', 'other', 'day',
    'q', 'i', 'd', 'r', 'n', 'ne', 'iter', 'o', 'u', 'a', 's', 'p', 'v', 'ad', 'os', 'od', 'ou', 'as', 'im', 'iv', 'sc', 'sl', 'po', 'per', 'oral', 'oculus', 'oculi', 'auris', 'dexter', 'sinister', 'uterque', 'mata', 'kanan', 'kiri', 'telinga', 'melalui', 'mulut', 'topikal', 'pemakaian', 'luar', 'dalam',
  ]);
  tokens.forEach((token) => {
    if (!knownWords.has(token) && !dictionary[token] && !/^\d+(?:[.,]\d+)?$/.test(token)) {
      reportFlag('red', 'UNKNOWN_ABBREVIATION', `Singkatan "${token}" tidak ada pada kamus singkatan yang disetujui. Sistem tidak menafsirkan singkatan tersebut.`, lineNumber);
    }
  });
  if ((!frequency && !timesPerDay && !route) || (!dose && !quantityInstruction) || (!unit && !quantityInstruction)) {
    reportFlag('red', 'SIGNA_INCOMPLETE', `Signa harus memuat frekuensi, jumlah, dan satuan${isLiquidMixture ? ' cair (ml/sendok teh/sendok makan)' : ''}; sistem tidak akan melengkapi otomatis.`, lineNumber);
  }
  if (isLiquidMixture && unit && !['ml', 'sendok teh', 'sendok makan', 'sdt', 'sdm'].includes(unit)) {
    reportFlag('red', 'SIGNA_MIXTURE_UNIT_REQUIRED', 'Signa racikan mixtura harus menggunakan satuan cair (ml, sendok teh, atau sendok makan).', lineNumber);
  }
  const translation = [
    timesPerDay ? `${timesPerDay} kali sehari` : (frequency?.label || ''),
    dose ? `${dose}${unit ? ` ${unit}` : ' dosis'}` : '',
    quantityInstruction,
    meal,
    route,
  ].filter(Boolean).join(', ');
  return { raw, times_per_day: timesPerDay, dose, unit, meal, route, quantity_instruction: quantityInstruction, translation, recognized_tokens: canonical };
};

const compoundingInstruction = (line = '') => {
  const compact = String(line).toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(?:m\.?\s*f\.?\s*m\.?|mfm|misce\s+fac\s+mixtura)\b/i.test(compact)) {
    return { bentuk_racikan: 'Mixtura', label: 'Misce fac mixtura', is_liquid: true, shake_well: true };
  }
  if (/^(?:m\.?\s*f\.?\s*pulv(?:\.?|eres)?|misce\s+fac\s+(?:pulv(?:eres)?|puyer))\b/i.test(compact)) {
    return { bentuk_racikan: 'Puyer', label: 'Misce fac pulveres', is_liquid: false, shake_well: false };
  }
  if (/^(?:m\.?\s*f\.?\s*cap(?:s|sulae)?\.?|misce\s+fac\s+capsulae?)\b/i.test(compact)) {
    return { bentuk_racikan: 'Kapsul', label: 'Misce fac capsulae', is_liquid: false, shake_well: false };
  }
  return null;
};

const dispensingInstruction = (line = '') => {
  const value = String(line).trim();
  if (/^da\s+in\s+cap/i.test(value)) return 'Da in capsulae';
  if (/^da\s+in\s+chart/i.test(value)) return 'Da in chartae';
  return '';
};

const iterFrom = (text) => {
  const source = normalize(text);
  if (/\bne iter\b/.test(source)) return 'Ne Iter';
  const match = source.match(/\biter\s*(\d+)?\b/);
  return match ? `Iter${match[1] ? ` ${match[1]}` : ''}` : '';
};

const buildTranslation = (items, racikan) => {
  const parts = [];
  const regularItems = (items || []).filter((item) => !item.is_racikan);
  if (regularItems.length) {
    parts.push(regularItems.map((item) => `${formatMedicineLabel(item.medicine_name, item.strength)} — ${item.quantity ?? '?'} ${item.form || 'unit'}; ${item.signa?.translation || 'signa belum lengkap'}.`).join('\n'));
  }
  if (racikan) {
    const componentText = racikan.components.map((component) => formatMedicineLabel(component.medicine_name, component.dosis_label || component.strength || '')).join('; ');
    parts.push(`Racikan ${racikan.bentuk_racikan}: ${componentText}. ${racikan.subscriptio}. Signa: ${racikan.signa.translation || racikan.signa.raw || 'belum lengkap'}.`);
  }
  return parts.join('\n\n');
};

const lineResult = (lineNumber, raw, role, status, message = '', extra = {}) => ({
  line_number: lineNumber,
  raw,
  role,
  status,
  message,
  ...extra,
});

const itemLineResult = (item, role = 'medicine') => {
  if (item.unmatched || item.match_status === 'unmatched') {
    return lineResult(item.source_line, item.raw, role, 'unresolved', item.unresolved_reason, {
      candidate_medicines: item.candidate_medicines || [],
    });
  }
  if (item.match_status === 'strength_mismatch' || item.match_status === 'ambiguous') {
    return lineResult(item.source_line, item.raw, role, 'review', item.unresolved_reason, {
      candidate_medicines: item.candidate_medicines || [],
    });
  }
  if (item.match_status === 'unverified') {
    return lineResult(item.source_line, item.raw, role, 'matched', 'Nama dan kekuatan dicatat dari teks dokter; verifikasi produk dilakukan farmasi.', {
      candidate_medicines: [],
    });
  }
  return lineResult(item.source_line, item.raw, role, 'matched', 'Obat dan kekuatan cocok dengan formularium.', {
    candidate_medicines: item.candidate_medicines || [],
  });
};

const splitRecipeBlocks = (lines) => {
  const blocks = [];
  let currentBlock = [];

  for (const line of lines) {
    if (isRecipeLine(line.value)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }
  return blocks;
};

export function parseFreeTextPrescription(originalText, {
  medicines = [],
  dictionary = [],
  validateAgainstFormulary = true,
  collectValidationFlags = true,
} = {}) {
  const original_text = String(originalText || '');
  const normalized_text = normalizePrescriptionText(original_text);
  const flags = [];
  if (!normalized_text) return {
    original_text, normalized_text, items: [], racikan: null, flags,
    parser_state: 'EMPTY', review_state: 'EMPTY', line_results: [], iter_type: '', translated_text: '',
  };
  const lines = normalized_text.split('\n').map((value, index) => ({ value: value.trim(), number: index + 1 })).filter((line) => line.value);
  const abbreviations = dictionaryMap(dictionary);
  const blocks = splitRecipeBlocks(lines);

  const items = [];
  let racikan = null;
  let assistedLoose = false;
  const line_results = [];
  const reportFlag = (...args) => collectValidationFlags && addFlag(flags, ...args);

  for (const block of blocks) {
    const mfmIndex = block.findIndex((line) => Boolean(compoundingInstruction(line.value)));
    const isMixture = mfmIndex >= 0;

    if (isMixture) {
      const compounding = compoundingInstruction(block[mfmIndex].value);
      const mfmLine = block[mfmIndex];
      const signaLine = block.find((line) => /^(?:mfm\s+)?s(?:igna)?\.?\s*/i.test(line.value));
      const dispensingLine = block.find((line) => dispensingInstruction(line.value));
      const packaging = dispensingLine ? dispensingInstruction(dispensingLine.value) : '';

      const components = [];
      block.slice(0, mfmIndex).forEach((line) => {
        const raw = line.value.replace(/^(?:r\/|rp\.?\/?|recipe\b)\s*/i, '').trim();
        if (!raw || /^(?:r\/|rp\.?\/?|recipe\b)$/i.test(raw)) return;
        if (!isRecipeLine(line.value) && !isLikelyLooseMedicineLine(raw)) return;
        const loose = !isRecipeLine(line.value);
        assistedLoose = assistedLoose || loose;
        const component = matchMedicine(raw, medicines, flags, line.number, { component: true, isLiquidMixture: compounding.is_liquid, loose, validateAgainstFormulary, collectValidationFlags });
        components.push(component);
        line_results.push(itemLineResult(component, 'component'));
      });

      if (!components.length) reportFlag('red', 'MFM_COMPONENT_REQUIRED', 'Instruksi racikan ditemukan tetapi tidak ada komponen racikan yang dapat diproses.', mfmIndex + 1);
      const hasLiquidBase = components.some((component) => /(?:sirup|suspensi|eliksir|mixtura|drops?|cair)/i.test(component.form || '') || /\bml\b/i.test(component.strength || ''));
      if (compounding.is_liquid && components.length && !hasLiquidBase) {
        reportFlag('red', 'MFM_LIQUID_BASE_REQUIRED', 'Racikan mixtura memerlukan komponen atau basis cair yang jelas. Sistem tidak akan menebak basis racikan.', mfmIndex + 1);
      }

      const mixtureSigna = parseSigna(signaLine?.value || '', abbreviations, flags, signaLine?.number || mfmLine.number, compounding.is_liquid, collectValidationFlags);
      if (!signaLine) reportFlag('red', 'SIGNA_REQUIRED', 'Signa racikan belum ditulis setelah instruksi pembuatan.', mfmLine.number);
      const quantity = parseQuantity(mfmLine.value) || (dispensingLine ? parseQuantity(dispensingLine.value) : null);
      if (!quantity) reportFlag('yellow', 'RACIKAN_QUANTITY_REVIEW', 'Jumlah racikan (dtd No. / No.) belum terbaca. Farmasi wajib mengonfirmasi jumlah sebelum menyiapkan dan menagihkan racikan.', mfmLine.number);

      line_results.push(lineResult(mfmLine.number, mfmLine.value, 'compounding', quantity ? 'matched' : 'review', quantity ? `Instruksi ${compounding.label} dan jumlah ${quantity} terbaca.` : 'Instruksi pembuatan terbaca, tetapi jumlah racikan belum jelas.'));
      if (signaLine) line_results.push(lineResult(signaLine.number, signaLine.value, 'signa', mixtureSigna.translation ? 'matched' : 'unresolved', mixtureSigna.translation ? 'Aturan pakai terbaca.' : 'Aturan pakai belum lengkap.'));
      if (dispensingLine) line_results.push(lineResult(dispensingLine.number, dispensingLine.value, 'dispensing', packaging ? 'matched' : 'review', packaging ? 'Instruksi kemasan terbaca.' : 'Instruksi kemasan belum dikenali.'));

      racikan = {
        racikan_name: `Racikan ${compounding.bentuk_racikan}`,
        bentuk_racikan: compounding.bentuk_racikan,
        components,
        signa: mixtureSigna,
        quantity,
        packaging,
        storage_instructions: 'Simpan sesuai instruksi farmasi pada etiket.',
        shake_well: compounding.shake_well,
        beyond_use_date: '',
        subscriptio: compounding.label,
      };

      items.push({
        medicine_id: '',
        medicine_name: `Racikan ${compounding.bentuk_racikan}`,
        strength: '',
        form: compounding.bentuk_racikan,
        quantity: quantity || 1,
        dosage: mixtureSigna.translation,
        instructions: mixtureSigna.meal,
        is_racikan: true,
        components,
      });
    } else {
      let current = null;
      block.forEach((line) => {
        if (/^(?:iter|ne\s+iter)\b/i.test(line.value)) return;
        if (isRecipeLine(line.value)) {
          if (current) items.push(current);
          current = matchMedicine(line.value.replace(/^(?:r\/|rp\.?\/?|recipe\b)\s*/i, ''), medicines, flags, line.number, { validateAgainstFormulary, collectValidationFlags });
          current.line = line.number;
          line_results.push(itemLineResult(current));
          return;
        }
        if (/^s(?:igna)?\.?\s*/i.test(line.value)) {
          if (!current) {
            reportFlag('red', 'SIGNA_WITHOUT_DRUG', 'Signa ditemukan tanpa baris R/ obat sebelumnya.', line.number);
            return;
          }
          current.signa = parseSigna(line.value, abbreviations, flags, line.number, false, collectValidationFlags);
          line_results.push(lineResult(line.number, line.value, 'signa', current.signa.translation ? 'matched' : 'unresolved', current.signa.translation ? 'Aturan pakai terbaca.' : 'Aturan pakai belum lengkap.'));
          return;
        }
        if (isLikelyLooseMedicineLine(line.value)) {
          if (current) items.push(current);
          assistedLoose = true;
          current = matchMedicine(line.value, medicines, flags, line.number, { loose: true, validateAgainstFormulary, collectValidationFlags });
          current.line = line.number;
          line_results.push(itemLineResult(current));
        }
      });
      if (current) items.push(current);
    }
  }

  if (!items.length) reportFlag('yellow', 'PARSER_NEEDS_PHARMACIST', 'Format resep belum dapat dipisahkan menjadi item. Teks asli tetap dapat dikirim sebagai resep yang perlu pemeriksaan apoteker.', null);

  items.filter((it) => !it.is_racikan).forEach((item) => {
    if (item.unmatched) return;
    if (item.quantity === null) reportFlag('red', 'QUANTITY_REQUIRED', `Jumlah/No. untuk "${item.medicine_name}" belum terbaca. Subscriptio tidak dibuat otomatis.`, item.line);
    if (!item.signa) reportFlag('red', 'SIGNA_REQUIRED', `Signa untuk "${item.medicine_name}" belum ditulis.`, item.line);
    const dailyDose = item.signa?.times_per_day && item.signa?.dose ? item.signa.times_per_day * item.signa.dose : null;
    if (dailyDose && ((item.min_daily_dose && dailyDose < item.min_daily_dose) || (item.max_daily_dose && dailyDose > item.max_daily_dose))) {
      reportFlag('yellow', 'DOSE_RANGE_REVIEW', `Dosis harian ${item.medicine_name} (${dailyDose} ${item.signa.unit}/hari) berada di luar rentang referensi formularium dan perlu ditinjau dokter/apoteker.`, item.line);
    }
  });

  const iter_type = iterFrom(normalized_text);
  const parser_state = items.length || racikan ? 'PARSED' : 'NEEDS_PHARMACIST_CHECK';
  if (assistedLoose) {
    reportFlag('yellow', 'LOOSE_FORMAT_REVIEW', 'Resep dibaca dari format teks bebas/non-standar. Teks asli dipertahankan dan seluruh item, jumlah, kekuatan, serta signa wajib diverifikasi oleh dokter/apoteker.', null);
  }
  const review_state = !collectValidationFlags
    ? 'READY_FOR_DOCTOR_CONFIRMATION'
    : flags.some((flag) => flag.severity === 'red')
    ? 'BLOCKED'
    : flags.length || assistedLoose
      ? 'NEEDS_PHARMACIST_REVIEW'
      : 'READY_FOR_DOCTOR_CONFIRMATION';

  return {
    original_text,
    normalized_text,
    items,
    racikan,
    flags,
    parser_state,
    review_state,
    line_results: line_results.sort((left, right) => (left.line_number || 0) - (right.line_number || 0)),
    interpretation_mode: assistedLoose ? 'assisted-loose' : 'structured',
    iter_type,
    translated_text: buildTranslation(items, racikan),
  };
}

export const hasBlockingPrescriptionFlags = (result) => (result?.flags || []).some((flag) => flag.severity === 'red');

export const formatPrescriptionFlag = (flag) => `${flag.severity === 'red' ? 'FLAG MERAH' : 'FLAG KUNING'} • ${title(flag.code.replace(/_/g, ' '))}: ${flag.message}`;
