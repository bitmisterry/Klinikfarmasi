// Prescription safety checks — allergy & drug interaction detection

/**
 * Check prescription items against patient allergies.
 * @param {Array} items - prescription items (medicine_name, active_substance, generic_name)
 * @param {Object} patient - patient record with allergies field (comma-separated string)
 * @returns {Array} warnings - array of { severity, medicine, allergen, message }
 */
export function checkAllergies(items, patient) {
  if (!patient?.allergies || !items || items.length === 0) return [];
  const allergyList = patient.allergies
    .split(/[,;]/)
    .map(a => a.trim().toLowerCase())
    .filter(Boolean);
  if (allergyList.length === 0) return [];

  const warnings = [];
  items.forEach(item => {
    const fields = [
      (item.medicine_name || '').toLowerCase(),
      (item.active_substance || '').toLowerCase(),
      (item.generic_name || '').toLowerCase(),
    ].filter(Boolean);
    allergyList.forEach(allergen => {
      if (fields.some(f => f.includes(allergen) || allergen.includes(f))) {
        warnings.push({
          type: 'allergy',
          severity: 'critical',
          medicine: item.medicine_name,
          allergen,
          message: `Alergi pasien terdeteksi: "${allergen}" terkandung dalam ${item.medicine_name}`,
        });
      }
    });
  });
  return warnings;
}

/**
 * Check drug-drug interactions among prescription items.
 * Uses Medicine.interactions field (string) to detect cross-references.
 * @param {Array} items - prescription items with medicine_id
 * @param {Array} medicines - full Medicine records from DB
 * @returns {Array} warnings - array of { severity, medicineA, medicineB, message }
 */
export function checkInteractions(items, medicines) {
  if (!items || items.length < 2 || !medicines || medicines.length === 0) return [];
  const warnings = [];
  const seen = new Set();

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const medA = medicines.find(m => m.id === items[i].medicine_id);
      const medB = medicines.find(m => m.id === items[j].medicine_id);
      if (!medA || !medB) continue;

      const interactionsA = (medA.interactions || '').toLowerCase();
      const interactionsB = (medB.interactions || '').toLowerCase();
      const nameB = (medB.name || '').toLowerCase();
      const genericB = (medB.generic_name || '').toLowerCase();
      const activeB = (medB.active_substance || '').toLowerCase();
      const nameA = (medA.name || '').toLowerCase();
      const genericA = (medA.generic_name || '').toLowerCase();
      const activeA = (medA.active_substance || '').toLowerCase();

      const matchA = nameB && (interactionsA.includes(nameB) || (genericB && interactionsA.includes(genericB)) || (activeB && interactionsA.includes(activeB)));
      const matchB = nameA && (interactionsB.includes(nameA) || (genericA && interactionsB.includes(genericA)) || (activeA && interactionsB.includes(activeA)));

      if (matchA || matchB) {
        const key = [items[i].medicine_name, items[j].medicine_name].sort().join('||');
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push({
          type: 'interaction',
          severity: 'warning',
          medicineA: items[i].medicine_name,
          medicineB: items[j].medicine_name,
          message: `Interaksi obat: ${items[i].medicine_name} ↔ ${items[j].medicine_name}`,
        });
      }
    }
  }
  return warnings;
}

/**
 * Combine allergy + interaction warnings for a prescription.
 * @returns {Array} sorted warnings (critical first)
 */
export function getPrescriptionWarnings(items, patient, medicines) {
  const allergy = checkAllergies(items, patient);
  const interactions = checkInteractions(items, medicines);
  return [...allergy, ...interactions].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return 0;
  });
}