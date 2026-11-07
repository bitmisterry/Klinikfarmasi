const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      doctor_id,
      doctor_name,
      request_type,
      affected_date,
      affected_date_end,
      reason,
      new_start_time,
      new_end_time,
      preview,
    } = body;

    if (!doctor_name || !request_type || !affected_date) {
      return Response.json({ error: 'doctor_name, request_type, affected_date wajib' }, { status: 400 });
    }

    // Detect impacted appointments
    const dateRange = affected_date_end
      ? { appointment_date: { $gte: affected_date, $lte: affected_date_end } }
      : { appointment_date: affected_date };

    const appointments = await db.entities.Appointment.filter({
      ...dateRange,
      status: { $in: ['Terjadwalkan', 'Dikonfirmasi'] },
    }).catch(() => []);

    const impacted = (appointments || [])
      .filter((a: any) => !a.doctor_id || a.doctor_id === doctor_id || a.doctor_name === doctor_name)
      .map((a: any) => ({
        appointment_id: a.id,
        patient_name: a.patient_name,
        time_slot: a.time_slot,
      }));

    // Preview mode — return impacted list without creating a request
    if (preview) {
      return Response.json({
        preview: true,
        impacted_count: impacted.length,
        impacted_appointments: impacted,
      });
    }

    // Create the change request
    const request = await db.entities.ScheduleChangeRequest.create({
      doctor_id,
      doctor_name,
      request_type,
      affected_date,
      affected_date_end: affected_date_end || null,
      reason: reason || '',
      new_start_time: new_start_time || null,
      new_end_time: new_end_time || null,
      impacted_appointments: impacted,
      impacted_count: impacted.length,
      status: 'Diajukan',
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
    });

    // Notify both authorized approver roles. Admin is intentionally excluded.
    for (const target_role of ['Owner', 'Manajer Operasional']) {
      await db.entities.Notification.create({
        type: 'schedule_change',
        target_role,
        title: `Persetujuan ${request_type}: ${doctor_name}`,
        body: `${doctor_name} mengajukan ${request_type} untuk ${affected_date}${affected_date_end ? ` s/d ${affected_date_end}` : ''}. ${impacted.length} pasien terdampak.`,
        priority: impacted.length > 0 ? 'Penting' : 'Normal',
        related_entity: 'ScheduleChangeRequest',
        related_id: request.id,
        action_label: 'Buka persetujuan',
        action_type: 'navigate',
        action_payload: JSON.stringify({ path: '/schedule-approvals' }),
      });
    }

    // Audit log
    try {
      await db.functions.invoke('logAudit', {
        action: 'create',
        entity: 'ScheduleChangeRequest',
        entity_id: request.id,
        entity_name: `${doctor_name} — ${request_type}`,
        module: 'doctor_schedule',
        description: `Dokter ${doctor_name} mengajukan ${request_type} tanggal ${affected_date}. ${impacted.length} pasien terdampak.`,
        user_id: user.id,
        user_name: user.full_name || doctor_name,
        user_role: user.data?.clinic_role || 'Dokter',
        severity: impacted.length > 0 ? 'Warning' : 'Info',
        timestamp: new Date().toISOString(),
      });
    } catch {}

    return Response.json({
      success: true,
      request_id: request.id,
      impacted_count: impacted.length,
      impacted_appointments: impacted,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
