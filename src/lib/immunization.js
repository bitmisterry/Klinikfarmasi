// Indonesian Immunization Schedule (Kemenkes RI / IDAI)

export const VACCINE_TYPES = {
  'Hep B': { label: 'Hepatitis B', color: 'bg-blue-100 text-blue-700 border-blue-300', doses: 4 },
  'BCG': { label: 'BCG', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', doses: 1 },
  'Polio': { label: 'Polio', color: 'bg-teal-100 text-teal-700 border-teal-300', doses: 5 },
  'DPT-HB': { label: 'DPT-HB (Combo)', color: 'bg-purple-100 text-purple-700 border-purple-300', doses: 4 },
  'IPV': { label: 'IPV (Polio Inactivated)', color: 'bg-cyan-100 text-cyan-700 border-cyan-300', doses: 2 },
  'MR': { label: 'MR (Campak-Rubella)', color: 'bg-amber-100 text-amber-700 border-amber-300', doses: 2 },
  'DPT': { label: 'DPT Booster', color: 'bg-rose-100 text-rose-700 border-rose-300', doses: 1 },
  'DT': { label: 'DT', color: 'bg-indigo-100 text-indigo-700 border-indigo-300', doses: 1 },
  'TD': { label: 'TD (Tetanus-Difteri)', color: 'bg-slate-100 text-slate-700 border-slate-300', doses: 1 },
  'HPV': { label: 'HPV', color: 'bg-pink-100 text-pink-700 border-pink-300', doses: 2 },
  'Rotavirus': { label: 'Rotavirus', color: 'bg-orange-100 text-orange-700 border-orange-300', doses: 3 },
  'PCV': { label: 'PCV (Pneumokokus)', color: 'bg-lime-100 text-lime-700 border-lime-300', doses: 3 },
  'Varicella': { label: 'Varicella', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', doses: 2 },
};

// Schedule: age in months → vaccines due
export const IMMUNIZATION_SCHEDULE = [
  { ageMonths: 0, ageLabel: 'Saat lahir', vaccines: [
    { type: 'Hep B', dose: 1, label: 'Hep B 0' },
    { type: 'BCG', dose: 1, label: 'BCG' },
    { type: 'Polio', dose: 1, label: 'Polio 0' },
  ]},
  { ageMonths: 1, ageLabel: '1 bulan', vaccines: [
    { type: 'Hep B', dose: 2, label: 'Hep B 1' },
  ]},
  { ageMonths: 2, ageLabel: '2 bulan', vaccines: [
    { type: 'DPT-HB', dose: 1, label: 'DPT-HB 1' },
    { type: 'Polio', dose: 2, label: 'Polio 1' },
    { type: 'Rotavirus', dose: 1, label: 'Rotavirus 1' },
    { type: 'PCV', dose: 1, label: 'PCV 1' },
  ]},
  { ageMonths: 3, ageLabel: '3 bulan', vaccines: [
    { type: 'DPT-HB', dose: 2, label: 'DPT-HB 2' },
    { type: 'Polio', dose: 3, label: 'Polio 2' },
    { type: 'Rotavirus', dose: 2, label: 'Rotavirus 2' },
    { type: 'PCV', dose: 2, label: 'PCV 2' },
  ]},
  { ageMonths: 4, ageLabel: '4 bulan', vaccines: [
    { type: 'DPT-HB', dose: 3, label: 'DPT-HB 3' },
    { type: 'Polio', dose: 4, label: 'Polio 3' },
    { type: 'IPV', dose: 1, label: 'IPV 1' },
    { type: 'Rotavirus', dose: 3, label: 'Rotavirus 3' },
    { type: 'PCV', dose: 3, label: 'PCV 3' },
  ]},
  { ageMonths: 6, ageLabel: '6 bulan', vaccines: [
    { type: 'Hep B', dose: 3, label: 'Hep B 2' },
    { type: 'IPV', dose: 2, label: 'IPV 2' },
  ]},
  { ageMonths: 9, ageLabel: '9 bulan', vaccines: [
    { type: 'MR', dose: 1, label: 'MR 1' },
  ]},
  { ageMonths: 18, ageLabel: '18 bulan', vaccines: [
    { type: 'DPT-HB', dose: 4, label: 'DPT-HB Booster' },
    { type: 'Polio', dose: 5, label: 'Polio Booster' },
    { type: 'MR', dose: 2, label: 'MR 2' },
  ]},
  { ageMonths: 72, ageLabel: '6-7 tahun', vaccines: [
    { type: 'DT', dose: 1, label: 'DT' },
  ]},
  { ageMonths: 120, ageLabel: '10-13 tahun', vaccines: [
    { type: 'TD', dose: 1, label: 'TD' },
    { type: 'HPV', dose: 1, label: 'HPV 1 (perempuan)' },
  ]},
];

// Calculate next immunization due based on birth date and administered vaccines
export function calculateNextDue(birthDate, administeredVaccines) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  const ageMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

  const administered = new Set((administeredVaccines || []).map(v => `${v.vaccine_type}-${v.dose_number}`));

  // Find the next due vaccine
  for (const sched of IMMUNIZATION_SCHEDULE) {
    if (sched.ageMonths > ageMonths + 1) {
      const dueVaccines = sched.vaccines.filter(v => !administered.has(`${v.type}-${v.dose}`));
      if (dueVaccines.length > 0) {
        const dueDate = new Date(birth);
        dueDate.setMonth(dueDate.getMonth() + sched.ageMonths);
        return {
          ageMonths: sched.ageMonths,
          ageLabel: sched.ageLabel,
          vaccines: dueVaccines,
          dueDate: dueDate.toISOString().split('T')[0],
        };
      }
    }
  }

  // Check for overdue vaccines
  for (const sched of IMMUNIZATION_SCHEDULE) {
    if (sched.ageMonths <= ageMonths) {
      const overdueVaccines = sched.vaccines.filter(v => !administered.has(`${v.type}-${v.dose}`));
      if (overdueVaccines.length > 0) {
        const dueDate = new Date(birth);
        dueDate.setMonth(dueDate.getMonth() + sched.ageMonths);
        return {
          ageMonths: sched.ageMonths,
          ageLabel: sched.ageLabel,
          vaccines: overdueVaccines,
          dueDate: dueDate.toISOString().split('T')[0],
          overdue: true,
        };
      }
    }
  }

  return null;
}

export function getAgeInMonths(birthDate) {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

export function getAgeLabel(months) {
  if (months < 1) return 'Baru lahir';
  if (months < 12) return `${months} bulan`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return remaining > 0 ? `${years} tahun ${remaining} bulan` : `${years} tahun`;
}