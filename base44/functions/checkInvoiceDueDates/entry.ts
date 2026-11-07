const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

/**
 * Check all supplier invoices for due date proximity.
 * Updates kontrabon_status and days_until_due.
 * Creates notifications for invoices within H-7 (Mendekati Jatuh Tempo) and overdue (Kontrabon).
 * Should be called daily via scheduled workflow.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today + 'T00:00:00');

    // Get all unpaid or partially paid invoices
    const invoices = await db.asServiceRole.entities.SupplierInvoice.filter({
      status: { $in: ['Belum Bayar', 'Sebagian Bayar', 'Overdue'] },
    }, '-due_date', 500);

    const results = { checked: 0, updated: 0, notified: 0, kontrabon: 0, mendekati: 0 };

    for (const inv of (invoices || [])) {
      results.checked++;
      if (!inv.due_date) continue;

      const dueDate = new Date(inv.due_date + 'T00:00:00');
      const diffMs = dueDate.getTime() - todayDate.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let kontrabonStatus = inv.kontrabon_status || 'Belum Jatuh Tempo';
      let invoiceStatus = inv.status;

      if (daysUntil < 0) {
        // Overdue
        kontrabonStatus = 'Kontrabon';
        invoiceStatus = 'Overdue';
        results.kontrabon++;
      } else if (daysUntil <= 7) {
        // Approaching due date (H-7)
        kontrabonStatus = 'Mendekati Jatuh Tempo';
        results.mendekati++;
      } else {
        kontrabonStatus = 'Belum Jatuh Tempo';
      }

      // Only update if status changed
      const needsUpdate = kontrabonStatus !== inv.kontrabon_status || invoiceStatus !== inv.status || inv.days_until_due !== daysUntil;

      if (needsUpdate) {
        await db.asServiceRole.entities.SupplierInvoice.update(inv.id, {
          kontrabon_status: kontrabonStatus,
          days_until_due: daysUntil,
          status: invoiceStatus,
        });
        results.updated++;
      }

      // Create notification for approaching/overdue invoices (only if not already notified)
      if (kontrabonStatus === 'Mendekati Jatuh Tempo' || kontrabonStatus === 'Kontrabon') {
        const existingNotif = await db.asServiceRole.entities.Notification.filter({
          related_entity: 'SupplierInvoice',
          related_id: inv.id,
          type: kontrabonStatus === 'Kontrabon' ? 'kontrabon' : 'invoice_due_soon',
        }, '-created_date', 1);

        if (!existingNotif || existingNotif.length === 0) {
          const body = kontrabonStatus === 'Kontrabon'
            ? `Faktur ${inv.invoice_number} dari ${inv.supplier_name} sudah jatuh tempo ${Math.abs(daysUntil)} hari lalu. Segera proses kontrabon.`
            : `Faktur ${inv.invoice_number} dari ${inv.supplier_name} jatuh tempo dalam ${daysUntil} hari (Rp ${(inv.total_amount || 0).toLocaleString('id-ID')}).`;

          await db.asServiceRole.entities.Notification.create({
            title: kontrabonStatus === 'Kontrabon' ? 'Faktur Overdue — Proses Kontrabon' : 'Faktur Jatuh Tempo H-' + daysUntil,
            body,
            type: kontrabonStatus === 'Kontrabon' ? 'kontrabon' : 'invoice_due_soon',
            related_entity: 'SupplierInvoice',
            related_id: inv.id,
            target_role: 'Apoteker',
            priority: kontrabonStatus === 'Kontrabon' ? 'Mendesak' : 'Penting',
            is_read: false,
          });
          results.notified++;
        }
      }
    }

    // Also check fully paid invoices — mark as Selesai
    const paidInvoices = await db.asServiceRole.entities.SupplierInvoice.filter({
      status: 'Lunas',
      kontrabon_status: { $nin: ['Selesai'] },
    }, '-due_date', 100);

    for (const inv of (paidInvoices || [])) {
      await db.asServiceRole.entities.SupplierInvoice.update(inv.id, {
        kontrabon_status: 'Selesai',
      });
      results.updated++;
    }

    // Audit log
    await db.asServiceRole.entities.AuditLog.create({
      action: 'update',
      entity: 'SupplierInvoice',
      module: 'finance',
      description: `Cek jatuh tempo faktur: ${results.checked} diperiksa, ${results.updated} diperbarui, ${results.notified} notifikasi dibuat (${results.mendekati} mendekati, ${results.kontrabon} kontrabon)`,
      user_name: user.full_name || user.email || 'Sistem',
      severity: 'Info',
      timestamp: new Date().toISOString(),
    });

    return Response.json({ ok: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}