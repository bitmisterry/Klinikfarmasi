const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { doctor_id, doctor_name, period_start, period_end } = body;

    if (!doctor_name) {
      return Response.json({ error: 'doctor_name wajib' }, { status: 400 });
    }

    // Get doctor profile for remuneration scheme
    let profile: any = null;
    if (doctor_id) {
      const profiles = await db.entities.DoctorProfile.filter({ user_id: doctor_id }).catch(() => []);
      profile = (profiles || [])[0];
    }
    if (!profile && doctor_name) {
      const profiles = await db.entities.DoctorProfile.filter({ full_name: doctor_name }).catch(() => []);
      profile = (profiles || [])[0];
    }

    // Get medical records for this doctor in the period
    const records = await db.entities.MedicalRecord.filter({
      doctor_id: doctor_id,
      visit_date: { $gte: period_start, $lte: period_end },
    }).catch(() => []);

    const myRecords = (records || []).filter((r: any) =>
      r.doctor_id === doctor_id || r.doctor_name === doctor_name
    );

    const consultationCount = myRecords.length;
    const tindakanCount = myRecords.reduce((s: number, r: any) => s + ((r.procedures || []).length), 0);
    const tindakanTotal = myRecords.reduce((s: number, r: any) => s + (r.tindakan_total || 0), 0);

    // Calculate remuneration based on scheme
    let remuneration = 0;
    let breakdown: any = {};

    if (profile) {
      const scheme = profile.remuneration_scheme || 'Nominal per Konsultasi';
      switch (scheme) {
        case 'Nominal per Konsultasi':
          remuneration = consultationCount * (profile.remuneration_nominal || 0);
          breakdown = { scheme, consultations: consultationCount, rate: profile.remuneration_nominal || 0 };
          break;
        case 'Persentase':
          remuneration = tindakanTotal * ((profile.remuneration_percent || 0) / 100);
          breakdown = { scheme, tindakan_total: tindakanTotal, percent: profile.remuneration_percent || 0 };
          break;
        case 'Per Tindakan':
          remuneration = tindakanCount * (profile.remuneration_per_tindakan || 0);
          breakdown = { scheme, tindakan_count: tindakanCount, rate: profile.remuneration_per_tindakan || 0 };
          break;
        case 'Kombinasi':
          const consultPart = consultationCount * (profile.remuneration_nominal || 0);
          const tindakanPart = tindakanTotal * ((profile.remuneration_percent || 0) / 100);
          remuneration = consultPart + tindakanPart;
          breakdown = { scheme, consult_part: consultPart, tindakan_part: tindakanPart };
          break;
        default:
          remuneration = 0;
          breakdown = { scheme: 'Manual' };
      }
    } else {
      // Default: nominal per consultation
      breakdown = { scheme: 'default', note: 'No DoctorProfile found' };
    }

    // Performance metrics
    const newPatients = new Set(myRecords.filter((r: any) => r.patient_id).map((r: any) => r.patient_id)).size;
    const followUps = myRecords.filter((r: any) => r.follow_up_date).length;

    return Response.json({
      success: true,
      period_start,
      period_end,
      doctor_name,
      scheme: profile?.remuneration_scheme || 'N/A',
      metrics: {
        consultations: consultationCount,
        tindakan_count: tindakanCount,
        tindakan_total: tindakanTotal,
        unique_patients: newPatients,
        follow_ups: followUps,
      },
      remuneration,
      breakdown,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}