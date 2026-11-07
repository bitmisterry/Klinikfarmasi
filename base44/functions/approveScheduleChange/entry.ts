const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only Owner or Manajer Operasional can approve schedule/cuti requests.
    const role = user.data?.clinic_role || user.role;
    if (role !== 'Owner' && role !== 'Manajer Operasional') {
      return Response.json({ error: 'Hanya Owner atau Manajer Operasional yang dapat menyetujui' }, { status: 403 });
    }

    const body = await req.json();
    const { request_id, action, review_notes, reschedule_action } = body;

    if (!request_id || !action) {
      return Response.json({ error: 'request_id dan action wajib' }, { status: 400 });
    }

    const request = await db.entities.ScheduleChangeRequest.get(request_id);
    if (!request) return Response.json({ error: 'Request tidak ditemukan' }, { status: 404 });

    const newStatus = action === 'approve' ? 'Disetujui' : 'Ditolak';

    await db.entities.ScheduleChangeRequest.update(request_id, {
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || '',
      reschedule_action: reschedule_action || 'Notifikasi Pasien',
    });

    // If approved and there are impacted appointments, handle them
    let rescheduled = 0;
    let notified = 0;

    if (action === 'approve' && request.impacted_appointments && request.impacted_appointments.length > 0) {
      const action_type = reschedule_action || 'Notifikasi Pasien';

      for (const appt of request.impacted_appointments) {
        // Mark appointment as needing reschedule
        await db.entities.Appointment.update(appt.appointment_id, {
          status: 'Perlu Reschedule',
          notes: `Dokter ${request.request_type} ${request.affected_date}. ${action_type === 'Reschedule Otomatis' ? 'Reschedule otomatis.' : 'Mohon hubungi pasien untuk reschedule.'}`,
        });

        if (action_type === 'Reschedule Otomatis') {
          rescheduled++;
        }

        // Notify front office
        await db.entities.Notification.create({
          type: 'appointment_impacted',
          target_role: 'Front Office',
          title: `Janji temu terdampak: ${appt.patient_name}`,
          body: `Pasien ${appt.patient_name} (jam ${appt.time_slot || '-'}) terdampak ${request.request_type} dr. ${request.doctor_name}. ${action_type === 'Reschedule Otomatis' ? 'Mohon hubungi pasien untuk reschedule.' : 'Mohon informasikan ke pasien.'}`,
          priority: 'Penting',
          related_entity: 'Appointment',
          related_id: appt.appointment_id,
          action_label: 'Lihat',
          action_type: 'navigate',
          action_payload: JSON.stringify({ path: '/patients' }),
        });

        // Notify patient directly if they have a user account
        const apptFull = await db.entities.Appointment.get(appt.appointment_id).catch(() => null);
        if (apptFull?.patient_user_id) {
          await db.entities.Notification.create({
            type: 'appointment_impacted',
            target_role: 'Pasien',
            target_user_id: apptFull.patient_user_id,
            title: `Janji temu Anda perlu dijadwalkan ulang`,
            body: `Janji temu dengan dr. ${request.doctor_name} pada ${new Date(request.affected_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} jam ${appt.time_slot || '-'} terdampak. Silakan hubungi klinik untuk reschedule.`,
            priority: 'Penting',
            related_entity: 'Appointment',
            related_id: appt.appointment_id,
            action_label: 'Reschedule',
            action_type: 'navigate',
            action_payload: JSON.stringify({ path: '/portal/booking' }),
          });
        }
        notified++;
      }
    }

    // Notify the doctor
    await db.entities.Notification.create({
      type: 'schedule_change',
      target_role: 'Dokter',
      target_user_id: request.doctor_id,
      title: `Pengajuan ${newStatus}: ${request.request_type}`,
      body: `Pengajuan ${request.request_type} tanggal ${request.affected_date} telah ${newStatus.toLowerCase()} oleh ${user.full_name}.`,
      priority: 'Normal',
      related_entity: 'ScheduleChangeRequest',
      related_id: request_id,
    });

    // Audit log
    try {
      await db.functions.invoke('logAudit', {
        action: action === 'approve' ? 'approve' : 'update',
        entity: 'ScheduleChangeRequest',
        entity_id: request_id,
        entity_name: `${request.doctor_name} — ${request.request_type}`,
        module: 'doctor_schedule',
        description: `Pengajuan ${request.request_type} dr. ${request.doctor_name} (${request.affected_date}) ${newStatus.toLowerCase()}. ${notified} pasien terdampak.`,
        user_id: user.id,
        user_name: user.full_name,
        user_role: role,
        severity: 'Warning',
        timestamp: new Date().toISOString(),
      });
    } catch {}

    return Response.json({
      success: true,
      status: newStatus,
      rescheduled,
      notified,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
