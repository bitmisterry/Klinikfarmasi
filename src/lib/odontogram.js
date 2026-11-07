// Odontogram constants — FDI notation, conditions, surfaces

export const TOOTH_CONDITIONS = {
  Sehat: { label: 'Sehat', color: '#FFFFFF', border: '#94A3B8', icon: '○' },
  Karies: { label: 'Karies', color: '#EF4444', border: '#DC2626', icon: '●' },
  Tambal: { label: 'Tambal', color: '#3B82F6', border: '#2563EB', icon: '◆' },
  Crown: { label: 'Crown', color: '#F59E0B', border: '#D97706', icon: '♔' },
  'Perawatan Saluran': { label: 'Perawatan Saluran', color: '#8B5CF6', border: '#7C3AED', icon: 'RTC' },
  Dicabut: { label: 'Dicabut', color: '#94A3B8', border: '#64748B', icon: 'X' },
  Hilang: { label: 'Hilang', color: '#E2E8F0', border: '#CBD5E1', icon: '–' },
  Implant: { label: 'Implant', color: '#10B981', border: '#059669', icon: 'I' },
};

export const TOOTH_SURFACES = ['Oklusal', 'Bukkal', 'Lingual/Palatal', 'Mesial', 'Distal'];

// FDI notation — Adult teeth (quadrants 1-4)
export const ADULT_TEETH = {
  upperRight: [
    { number: '18', type: 'Molar', name: 'Molar ke-3' },
    { number: '17', type: 'Molar', name: 'Molar ke-2' },
    { number: '16', type: 'Molar', name: 'Molar ke-1' },
    { number: '15', type: 'Premolar', name: 'Premolar ke-2' },
    { number: '14', type: 'Premolar', name: 'Premolar ke-1' },
    { number: '13', type: 'Canine', name: 'Gigi Taring' },
    { number: '12', type: 'Incisor', name: 'Insisivus Lateral' },
    { number: '11', type: 'Incisor', name: 'Insisivus Sentral' },
  ],
  upperLeft: [
    { number: '21', type: 'Incisor', name: 'Insisivus Sentral' },
    { number: '22', type: 'Incisor', name: 'Insisivus Lateral' },
    { number: '23', type: 'Canine', name: 'Gigi Taring' },
    { number: '24', type: 'Premolar', name: 'Premolar ke-1' },
    { number: '25', type: 'Premolar', name: 'Premolar ke-2' },
    { number: '26', type: 'Molar', name: 'Molar ke-1' },
    { number: '27', type: 'Molar', name: 'Molar ke-2' },
    { number: '28', type: 'Molar', name: 'Molar ke-3' },
  ],
  lowerLeft: [
    { number: '31', type: 'Incisor', name: 'Insisivus Sentral' },
    { number: '32', type: 'Incisor', name: 'Insisivus Lateral' },
    { number: '33', type: 'Canine', name: 'Gigi Taring' },
    { number: '34', type: 'Premolar', name: 'Premolar ke-1' },
    { number: '35', type: 'Premolar', name: 'Premolar ke-2' },
    { number: '36', type: 'Molar', name: 'Molar ke-1' },
    { number: '37', type: 'Molar', name: 'Molar ke-2' },
    { number: '38', type: 'Molar', name: 'Molar ke-3' },
  ],
  lowerRight: [
    { number: '41', type: 'Incisor', name: 'Insisivus Sentral' },
    { number: '42', type: 'Incisor', name: 'Insisivus Lateral' },
    { number: '43', type: 'Canine', name: 'Gigi Taring' },
    { number: '44', type: 'Premolar', name: 'Premolar ke-1' },
    { number: '45', type: 'Premolar', name: 'Premolar ke-2' },
    { number: '46', type: 'Molar', name: 'Molar ke-1' },
    { number: '47', type: 'Molar', name: 'Molar ke-2' },
    { number: '48', type: 'Molar', name: 'Molar ke-3' },
  ],
};

// FDI notation — Primary teeth (quadrants 5-8)
export const CHILD_TEETH = {
  upperRight: [
    { number: '55', type: 'Molar', name: 'Molar ke-2' },
    { number: '54', type: 'Molar', name: 'Molar ke-1' },
    { number: '53', type: 'Canine', name: 'Gigi Taring' },
    { number: '52', type: 'Incisor', name: 'Insisivus Lateral' },
    { number: '51', type: 'Incisor', name: 'Insisivus Sentral' },
  ],
  upperLeft: [
    { number: '61', type: 'Incisor', name: 'Insisivus Sentral' },
    { number: '62', type: 'Incisor', name: 'Insisivus Lateral' },
    { number: '63', type: 'Canine', name: 'Gigi Taring' },
    { number: '64', type: 'Molar', name: 'Molar ke-1' },
    { number: '65', type: 'Molar', name: 'Molar ke-2' },
  ],
  lowerLeft: [
    { number: '71', type: 'Incisor', name: 'Insisivus Sentral' },
    { number: '72', type: 'Incisor', name: 'Insisivus Lateral' },
    { number: '73', type: 'Canine', name: 'Gigi Taring' },
    { number: '74', type: 'Molar', name: 'Molar ke-1' },
    { number: '75', type: 'Molar', name: 'Molar ke-2' },
  ],
  lowerRight: [
    { number: '81', type: 'Incisor', name: 'Insisivus Sentral' },
    { number: '82', type: 'Incisor', name: 'Insisivus Lateral' },
    { number: '83', type: 'Canine', name: 'Gigi Taring' },
    { number: '84', type: 'Molar', name: 'Molar ke-1' },
    { number: '85', type: 'Molar', name: 'Molar ke-2' },
  ],
};

export function getToothInfo(number) {
  const all = [
    ...ADULT_TEETH.upperRight, ...ADULT_TEETH.upperLeft,
    ...ADULT_TEETH.lowerLeft, ...ADULT_TEETH.lowerRight,
    ...CHILD_TEETH.upperRight, ...CHILD_TEETH.upperLeft,
    ...CHILD_TEETH.lowerLeft, ...CHILD_TEETH.lowerRight,
  ];
  return all.find(t => t.number === number);
}

export function isPrimaryTooth(number) {
  return number.startsWith('5') || number.startsWith('6') || number.startsWith('7') || number.startsWith('8');
}