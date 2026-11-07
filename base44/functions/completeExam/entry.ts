const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      record,          // MedicalRecord fields
      prescriptionItems, // array of prescription items
      isRacikan,       // boolean
      racikanData,     // racikan template if racikan
      queue_entry_id,
      follow_up_date,
      follow_up_instructions,
    } = body;

    if (!record || !record.patient_name || !record.diagnosis) {
      return Response.json({ error: 'Diagnosis dan nama pasien wajib' }, { status: 400 });
    }

    const doctorId = record.doctor_id || user.id;
    const doctorName = record.doctor_name || user.full_name || 'Dokter';
    if (body.mode === 'revise') {
      const medicalRecordId = body.medical_record_id || record.medical_record_id;
      if (!medicalRecordId) return Response.json({ error: 'Rekam medis yang akan dikoreksi tidak ditemukan' }, { status: 400 });
      const existingRecord = await db.entities.MedicalRecord.get(medicalRecordId);
      if (!existingRecord || !existingRecord.finalized) return Response.json({ error: 'Hanya rekam medis yang sudah difinalkan yang dapat dikoreksi' }, { status: 400 });
      if (existingRecord.doctor_id !== user.id) return Response.json({ error: 'Koreksi hanya dapat dilakukan oleh dokter yang membuat pemeriksaan' }, { status: 403 });
      const revisionReason = String(body.revision_reason || record.revision_reason || '').trim();
      if (!revisionReason) return Response.json({ error: 'Alasan koreksi wajib dicatat' }, { status: 400 });
      const revisionFields = [
        'chief_complaint', 'subjective', 'physical_exam', 'diagnosis', 'diagnosis_code',
        'treatment_plan', 'follow_up_date', 'follow_up_instructions', 'patient_education', 'notes',
      ];
      const patch: Record<string, unknown> = {};
      for (const field of revisionFields) if (Object.prototype.hasOwnProperty.call(record, field)) patch[field] = record[field];
      patch.version = Number(existingRecord.version || 1) + 1;
      patch.revised_at = new Date().toISOString();
      patch.revised_by = user.id;
      patch.revised_by_name = doctorName;
      patch.revision_reason = revisionReason;
      const revisedRecord = await db.entities.MedicalRecord.update(existingRecord.id, patch);
      try {
        await db.functions.invoke('logAudit', {
          action: 'update',
          entity: 'MedicalRecord',
          entity_id: existingRecord.id,
          entity_name: existingRecord.patient_name,
          module: 'rme',
          description: `Koreksi RME setelah finalisasi: ${revisionReason}`,
          user_id: user.id,
          user_name: doctorName,
          user_role: user.data?.clinic_role || 'Dokter',
          severity: 'Info',
          timestamp: new Date().toISOString(),
        });
      } catch {}
      return Response.json({
        success: true,
        revised: true,
        medical_record_id: revisedRecord.id,
        medical_record: revisedRecord,
        next_status: 'Selesai Periksa',
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const isAssistant = !!(record.doctor_id && record.doctor_id !== user.id);
    const tindakanTotal = (record.procedures || []).reduce((s: number, p: any) => s + (p.subtotal || 0), 0);

    // 1. Save Medical Record (RME)
    const med = await db.entities.MedicalRecord.create({
      ...record,
      doctor_id: doctorId,
      doctor_name: doctorName,
      visit_date: record.visit_date || today,
      bmi: record.bmi || null,
      tindakan_total: tindakanTotal,
    });

    const results: any = { medical_record_id: med.id };

    // 2. Create combined Prescription (non-racikan items + racikan in one)
    const hasNonRacikan = prescriptionItems && prescriptionItems.length > 0;
    const hasRacikan = !!racikanData;

    if (hasNonRacikan || hasRacikan) {
      const rxNumber = `R${today.replace(/-/g, '')}${String(Date.now()).slice(-3)}`;
      const combinedItems = [...(prescriptionItems || [])];

      // If racikan data exists, create RacikanTemplate and add racikan item to same prescription
      if (hasRacikan) {
        const tpl = await db.entities.RacikanTemplate.create({
          ...racikanData,
          patient_id: record.patient_id,
          patient_name: record.patient_name,
          workflow_status: 'Review Farmasi',
        });
        results.racikan_template_id = tpl.id;

        combinedItems.push({
          medicine_id: `racikan-${tpl.id}`,
          medicine_name: `${racikanData.racikan_name || 'Racikan'} (${racikanData.bentuk_racikan || 'Puyer'})`,
          form: racikanData.bentuk_racikan || 'Puyer',
          administration_route: racikanData.administration_route || 'internal',
          dosage: racikanData.signa || '',
          quantity: racikanData.jumlah_ambil || 0,
          instructions: racikanData.notes || '',
          is_racikan: true,
          racikan_template_id: tpl.id,
        });
      }

      const rx = await db.entities.Prescription.create({
        prescription_number: rxNumber,
        patient_id: record.patient_id,
        patient_name: record.patient_name,
        queue_entry_id: queue_entry_id,
        doctor_id: doctorId,
        doctor_name: doctorName,
        prescription_date: today,
        source: 'Internal',
        status: 'Diresepkan',
        is_racikan: hasRacikan,
        racikan_template_id: results.racikan_template_id || undefined,
        items: combinedItems,
      });
      results.prescription_id = rx.id;
    }

    // 4. Create Appointment for follow-up (kontrol)
    if (follow_up_date) {
      const appt = await db.entities.Appointment.create({
        patient_id: record.patient_id,
        patient_name: record.patient_name,
        doctor_id: doctorId,
        doctor_name: doctorName,
        appointment_date: follow_up_date,
        time_slot: '',
        poli: record.poli || '',
        status: 'Terjadwalkan',
        source: 'Walk-in',
        notes: `Kontrol ulang. ${follow_up_instructions || ''}`.trim(),
      });
      results.appointment_id = appt.id;
    }

    // 5. Update QueueEntry status
    const hasRx = !!results.prescription_id;
    const nextStatus = hasRx ? 'Di Apotek' : 'Kasir';
    if (queue_entry_id) {
      await db.entities.QueueEntry.update(queue_entry_id, {
        status: nextStatus,
        prescription_id: results.prescription_id,
        doctor_id: doctorId,
        doctor_name: doctorName,
        check_out_time: new Date().toISOString(),
      });
    }

    // 6. Create Transaction with tindakan charges (so Kasir doesn't re-input)
    if (tindakanTotal > 0 || !hasRx) {
      const invNumber = `INV${today.replace(/-/g, '')}${String(Date.now()).slice(-3)}`;
      const tx = await db.entities.Transaction.create({
        invoice_number: invNumber,
        type: 'Klinik',
        patient_id: record.patient_id,
        patient_name: record.patient_name,
        queue_entry_id: queue_entry_id,
        prescription_id: results.prescription_id,
        items: [],
        subtotal: 0,
        consultation_fee: 0,
        other_fees: 0,
        total: tindakanTotal,
        payment_status: 'Belum Bayar',
        cashier_id: '',
        cashier_name: '',
        transaction_date: today,
      });
      results.transaction_id = tx.id;
    }

    // 7. Notifications to Pharmacy and Cashier
    if (hasRx) {
      await db.entities.Notification.create({
        type: 'prescription',
        target_role: 'Apoteker',
        title: `Resep baru: ${record.patient_name}`,
        body: `Resep dari ${doctorName} untuk ${record.patient_name} — siap dispensing`,
        priority: 'Normal',
        related_entity: 'Prescription',
        related_id: results.prescription_id,
        action_label: 'Buka Apotek',
        action_type: 'navigate',
        action_payload: JSON.stringify({ path: '/pharmacy' }),
      });
    }

    if (results.transaction_id) {
      await db.entities.Notification.create({
        type: 'billing',
        target_role: 'Kasir',
        title: `Tagihan baru: ${record.patient_name}`,
        body: `Tindakan ${doctorName} — Rp ${tindakanTotal.toLocaleString('id-ID')}`,
        priority: 'Normal',
        related_entity: 'Transaction',
        related_id: results.transaction_id,
        action_label: 'Buka Kasir',
        action_type: 'navigate',
        action_payload: JSON.stringify({ path: '/kasir' }),
      });
    }

    // 8. Audit log
    try {
      await db.functions.invoke('logAudit', {
        action: 'create',
        entity: 'MedicalRecord',
        entity_id: med.id,
        entity_name: record.patient_name,
        module: 'rme',
        description: `Pemeriksaan selesai: ${record.diagnosis}${tindakanTotal > 0 ? ` (tindakan Rp ${tindakanTotal.toLocaleString('id-ID')})` : ''}${hasRx ? ' + resep ke farmasi' : ''}${follow_up_date ? ` + kontrol ${follow_up_date}` : ''}${isAssistant ? ' (diinput oleh asisten)' : ''}`,
        user_id: user.id,
        user_name: doctorName,
        user_role: user.data?.clinic_role || 'Dokter',
        severity: 'Info',
        timestamp: new Date().toISOString(),
      });
    } catch {}

    return Response.json({
      success: true,
      ...results,
      next_status: nextStatus,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
