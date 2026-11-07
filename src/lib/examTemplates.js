// Exam template defaults per specialization
// Used by ClinicalWorkspace to render SOAP vital fields and by DoctorManagement to configure

export const DEFAULT_EXAM_TEMPLATES = {
  'Anak': {
    visible_vital_fields: ['bp', 'temp', 'pulse', 'rr', 'weight', 'height', 'head_circumference', 'bmi'],
    show_growth_prompt: true,
    show_immunization_prompt: true,
    show_odontogram_link: false,
  },
  'Gigi': {
    visible_vital_fields: ['bp', 'temp'],
    show_growth_prompt: false,
    show_immunization_prompt: false,
    show_odontogram_link: true,
  },
  'Umum': {
    visible_vital_fields: ['bp', 'temp', 'pulse', 'rr', 'weight', 'height', 'bmi'],
    show_growth_prompt: false,
    show_immunization_prompt: false,
    show_odontogram_link: false,
  },
};

export const VITAL_FIELD_OPTIONS = [
  { key: 'bp', label: 'Tekanan Darah (mmHg)' },
  { key: 'temp', label: 'Suhu (°C)' },
  { key: 'pulse', label: 'Nadi (bpm)' },
  { key: 'rr', label: 'Frekuensi Napas' },
  { key: 'weight', label: 'Berat Badan (kg)' },
  { key: 'height', label: 'Tinggi Badan (cm)' },
  { key: 'head_circumference', label: 'Lingkar Kepala (cm)' },
  { key: 'bmi', label: 'BMI (auto)' },
];

export const VITAL_FIELD_LABELS = {
  bp: 'TD (mmHg)',
  temp: 'Suhu (°C)',
  pulse: 'Nadi',
  rr: 'RR',
  weight: 'BB (kg)',
  height: 'TB (cm)',
  head_circumference: 'Lingkar Kepala',
  bmi: 'BMI',
};

// Get effective exam template for a doctor profile
export function getExamTemplate(profile) {
  if (profile?.exam_template_config?.visible_vital_fields?.length > 0) {
    return profile.exam_template_config;
  }
  const spec = (profile?.specialization || '').toLowerCase();
  if (spec.includes('anak')) return DEFAULT_EXAM_TEMPLATES['Anak'];
  if (spec.includes('gigi')) return DEFAULT_EXAM_TEMPLATES['Gigi'];
  return DEFAULT_EXAM_TEMPLATES['Umum'];
}