// @ts-nocheck -- Identity records are merged with user-configured role metadata at runtime.
const identity = (id, fullName, email, clinicRole) => ({
  id,
  full_name: fullName,
  email,
  clinic_role: clinicRole,
});

export const DEMO_IDENTITIES = Object.freeze({
  Owner: identity('local-owner', 'Demo Owner', 'demo.owner@klinikfarma.com', 'Owner'),
  Admin: identity('local-admin', 'Demo Admin', 'demo.admin@klinikfarma.com', 'Admin'),
  'Dokter Umum': identity('staff-doctor-1', 'dr. Andi Pratama', 'demo.dokterumum@klinikfarma.com', 'Dokter Umum'),
  'Dokter Spesialis Anak': identity('demo-pediatrician', 'dr. Anak Demo, Sp.A', 'demo.dokteranak@klinikfarma.com', 'Dokter Spesialis Anak'),
  'Dokter Spesialis Penyakit Dalam': identity('demo-internist', 'dr. Nabila Putri, Sp.PD', 'demo.dokterdalam@klinikfarma.com', 'Dokter Spesialis Penyakit Dalam'),
  'Dokter Gigi': identity('demo-dentist', 'drg. Demo', 'demo.doktergigi@klinikfarma.com', 'Dokter Gigi'),
  'Dokter Locum': identity('demo-locum', 'dr. Rizky Mahendra', 'demo.dokterlocum@klinikfarma.com', 'Dokter Locum'),
  Perawat: identity('demo-nurse', 'Perawat Demo', 'demo.perawat@klinikfarma.com', 'Perawat'),
  'Front Office': identity('demo-front-office', 'Front Desk Demo', 'demo.frontoffice@klinikfarma.com', 'Front Office'),
  Kasir: identity('demo-cashier', 'Kasir Demo', 'demo.kasir@klinikfarma.com', 'Kasir'),
  Apoteker: identity('staff-pharmacist-1', 'apt. Sari Wulandari', 'demo.apoteker@klinikfarma.com', 'Apoteker'),
  'Apoteker Penanggung Jawab': identity('demo-apj', 'apt. Maya Safitri, S.Farm., Apt.', 'demo.apj@klinikfarma.com', 'Apoteker Penanggung Jawab'),
  'Apoteker Pendamping': identity('demo-apoteker-pendamping', 'apt. Dimas Pratama, S.Farm., Apt.', 'demo.apotekerpendamping@klinikfarma.com', 'Apoteker Pendamping'),
  'Admin Farmasi': identity('demo-admin-farmasi', 'Admin Farmasi Demo', 'demo.adminfarmasi@klinikfarma.com', 'Admin Farmasi'),
  'TTK/Asisten Farmasi': identity('demo-ttk', 'TTK Farmasi Demo', 'demo.ttk@klinikfarma.com', 'TTK/Asisten Farmasi'),
  Finance: identity('demo-finance', 'Finance Demo', 'demo.finance@klinikfarma.com', 'Finance'),
  'Manajer Operasional': identity('demo-ops-manager', 'Manajer Operasional Demo', 'demo.opsmanager@klinikfarma.com', 'Manajer Operasional'),
  'Asisten Dokter': identity('demo-doctor-assistant', 'Asisten Dokter Demo', 'demo.asistendokter@klinikfarma.com', 'Asisten Dokter'),
  Pasien: { ...identity('demo-patient', 'Pasien Demo', 'demo.pasien@klinikfarma.com', 'Pasien'), patient_id: 'patient-local-1' },
  Staff: identity('demo-staff', 'Demo Staff', 'demo.staff@klinikfarma.com', 'Staff'),
});

const identitiesByEmail = new Map(
  Object.values(DEMO_IDENTITIES).map((entry) => [entry.email.toLowerCase(), entry]),
);

export function getDemoIdentityByRole(role) {
  if (role === 'Dokter') return DEMO_IDENTITIES['Dokter Umum'];
  return DEMO_IDENTITIES[role] || null;
}

export function getDemoIdentityByEmail(email) {
  return identitiesByEmail.get(String(email || '').trim().toLowerCase()) || null;
}

export function createDemoUser({ role, email } = {}) {
  const configured = getDemoIdentityByEmail(email) || getDemoIdentityByRole(role);
  // Email menentukan identitas, sedangkan role aktif dapat berubah melalui
  // manajemen jabatan. Login kartu demo tetap mengirimkan role eksplisit.
  const clinicRole = role || configured?.clinic_role || 'Staff';
  const resolvedEmail = configured?.email || email || 'demo.staff@klinikfarma.com';
  const id = configured?.id || `demo-${String(clinicRole).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const fullName = configured?.full_name || `Demo ${clinicRole}`;
  const patientId = configured?.patient_id || '';

  return {
    id,
    email: resolvedEmail,
    full_name: fullName,
    role: clinicRole === 'Owner' || clinicRole === 'Admin' ? 'admin' : 'user',
    clinic_role: clinicRole,
    active_role: clinicRole,
    patient_id: patientId,
    data: { clinic_role: clinicRole, active_role: clinicRole, ...(patientId ? { patient_id: patientId } : {}) },
  };
}

// Repairs legacy demo sessions that used one shared doctor ID. Only known demo
// e-mail addresses are normalized, so locally registered users are untouched.
export function normalizeDemoUser(user) {
  if (!user || typeof user !== 'object') return user;
  const configured = getDemoIdentityByEmail(user.email);
  if (!configured) return user;

  const canonical = createDemoUser({
    role: user.active_role || user.data?.active_role || user.clinic_role || user.data?.clinic_role || configured.clinic_role,
    email: configured.email,
  });
  return {
    ...user,
    ...canonical,
    data: { ...(user.data || {}), ...canonical.data },
  };
}
