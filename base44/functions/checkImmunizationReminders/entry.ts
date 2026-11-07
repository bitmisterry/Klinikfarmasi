const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

const IMMUNIZATION_SCHEDULE = [
  { ageMonths: 0, ageLabel: 'Saat lahir', vaccines: [{ type: 'Hep B', dose: 1, label: 'Hep B 0' }, { type: 'BCG', dose: 1, label: 'BCG' }, { type: 'Polio', dose: 1, label: 'Polio 0' }] },
  { ageMonths: 1, ageLabel: '1 bulan', vaccines: [{ type: 'Hep B', dose: 2, label: 'Hep B 1' }] },
  { ageMonths: 2, ageLabel: '2 bulan', vaccines: [{ type: 'DPT-HB', dose: 1, label: 'DPT-HB 1' }, { type: 'Polio', dose: 2, label: 'Polio 1' }] },
  { ageMonths: 3, ageLabel: '3 bulan', vaccines: [{ type: 'DPT-HB', dose: 2, label: 'DPT-HB 2' }, { type: 'Polio', dose: 3, label: 'Polio 2' }] },
  { ageMonths: 4, ageLabel: '4 bulan', vaccines: [{ type: 'DPT-HB', dose: 3, label: 'DPT-HB 3' }, { type: 'Polio', dose: 4, label: 'Polio 3' }, { type: 'IPV', dose: 1, label: 'IPV 1' }] },
  { ageMonths: 6, ageLabel: '6 bulan', vaccines: [{ type: 'Hep B', dose: 3, label: 'Hep B 2' }, { type: 'IPV', dose: 2, label: 'IPV 2' }] },
  { ageMonths: 9, ageLabel: '9 bulan', vaccines: [{ type: 'MR', dose: 1, label: 'MR 1' }] },
  { ageMonths: 18, ageLabel: '18 bulan', vaccines: [{ type: 'DPT-HB', dose: 4, label: 'DPT-HB Booster' }, { type: 'Polio', dose: 5, label: 'Polio Booster' }, { type: 'MR', dose: 2, label: 'MR 2' }] },
];

function getAgeInMonths(birthDate) {
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role for scheduled task (no user context)
    const patients = await db.asServiceRole.entities.Patient.list();
    const now = new Date();

    // Filter children (under 18)
    const children = (patients || []).filter(p => {
      if (!p.birth_date) return false;
      const ageYears = (now - new Date(p.birth_date)) / (365.25 * 24 * 60 * 60 * 1000);
      return ageYears < 18;