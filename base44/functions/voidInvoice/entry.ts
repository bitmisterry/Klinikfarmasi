import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { invoice_id, reason } = body;

    if (!invoice_id) return Response.json({ error: 'invoice_id wajib' }, { status: 400 });
    if (!reason || !reason.trim()) return Response.json({ error: 'Alasan pembatalan wajib' }, { status: 400 });

    const db = db.asServiceRole.entities;
    const actor = user.full_name || user.email || 'Sistem';

    const inv = await db.SupplierInvoice.get(invoice_id);
    if (!inv) return Response.json({ error: 'Faktur tidak ditemukan' }, { status: 404 });
    if (inv.status === 'Batal') return Response.json({ error: 'Faktur sudah dibatalkan' }, { status: 400 });
    if (inv.paid_amount > 0) return Response.json({ error: 'Faktur sudah dibayar sebagian/lunas — tidak dapat dibatalkan' }, { status: 400 });

    // Rollback stok: kurangi qty dari StockBatch & Medicine, hapus batch murni dari faktur ini
    const today = new Date().toISOString().split('T')[0];
    const movements = [];

    for (const item of (inv.items || [])) {
      if (!item.medicine_id) continue;
      const totalReceived = (item.quantity || 0) + (item.bonus_quantity || 0);
      if (totalReceived <= 0) continue;

      // Cari batch yang dibuat/diupdate oleh faktur ini
      const batches = await db.StockBatch.filter({
        medicine_id: item.medicine_id,
        invoice_number: inv.invoice_number,
      });

      for (const batch of (batches || [])) {
        const newQty = (batch.quantity || 0) - totalReceived;
        if (newQty <= 0) {
          // Hapus batch (batch murni dari faktur ini)
          await db.StockBatch.delete(batch.id);
        } else {
          await db.StockBatch.update(batch.id, {
            quantity: newQty,
            initial_quantity: Math.max(0, (batch.initial_quantity || 0) - totalReceived),
            status: 'Retur',
          });
        }
      }

      // Rollback Medicine stock
      const med = await db.Medicine.get(item.medicine_id);
      if (med) {
        const newStock = Math.max(0, (med.stock_on_hand || 0) - totalReceived);
        await db.Medicine.update(item.medicine_id, { stock_on_hand: newStock });
        movements.push({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          type: 'Keluar',
          quantity: totalReceived,
          balance_after: newStock,
          batch_number: item.batch_number || '',
          reference_type: 'Retur',
          reference_number: inv.invoice_number,
          notes: `Pembatalan faktur ${inv.invoice_number}: ${reason}`,
          user_name: actor,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Tulis StockMovement
    for (const m of movements) {
      await db.StockMovement.create(m);
    }

    // Update faktur ke Batal
    await db.SupplierInvoice.update(invoice_id, {
      status: 'Batal',
      notes: (inv.notes || '') + ` | DIBATALKAN (${today}): ${reason}`,
    });

    // AuditLog
    await db.AuditLog.create({
      action: 'void',
      entity: 'SupplierInvoice',
      entity_name: inv.invoice_number,
      module: 'purchasing',
      description: `Faktur ${inv.invoice_number} DIBATALKAN: ${reason} — stok dikembalikan (${movements.length} item)`,
      old_value: JSON.stringify({ status: inv.status, total_amount: inv.total_amount }),
      new_value: JSON.stringify({ status: 'Batal', reason, rolled_back_items: movements.length }),
      user_name: actor,
      severity: 'Critical',
      timestamp: new Date().toISOString(),
    });

    // Anomaly: void setelah dispensing (jika ada transaksi memakai batch ini — deteksi silang)
    // Untuk sederhana, catat anomaly invoice_receipt_mismatch jika ada selisih
    await db.Anomaly.create({
      type: 'invoice_receipt_mismatch',
      severity: 'warning',
      description: `Faktur ${inv.invoice_number} dibatalkan oleh ${actor}. Stok ${movements.length} item dikembalikan ke supplier.`,
      evidence_json: JSON.stringify({ invoice_id, reason, rolled_back_items: movements.length, user: actor }),
      related_entity: 'SupplierInvoice',
      related_id: invoice_id,
      user_id: user.id,
      user_name: actor,
      status: 'Baru',
      detected_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, rolled_back_items: movements.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}