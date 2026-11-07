const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Shared Procurement-to-Pay logic: goods receipt, invoice, payment helpers

/**
 * Receive goods from a Purchase Order — creates StockBatch, StockMovement, updates Medicine stock.
 * @param {Object} po - PurchaseOrder record
 * @param {Array} receivedItems - [{ medicine_id, medicine_name, quantity, batch_number, expiry_date, unit_price, selling_price }]
 * @param {Object} supplier - Supplier record (for StockBatch)
 * @param {string} userName - current user name for audit
 */
export async function receiveGoods(po, receivedItems, supplier, userName = 'Sistem') {
  if (!po?.id || !['Dikirim', 'Diterima Sebagian'].includes(po.status)) {
    throw new Error('Penerimaan hanya dapat dilakukan untuk PO yang sudah dikirim dan belum selesai diterima.');
  }
  const today = new Date().toISOString().split('T')[0];
  const movements = [];
  let totalReceivedQty = 0;

  for (const item of receivedItems) {
    if (!item.quantity || item.quantity <= 0) continue;
    const poItem = (po.items || []).find((line) => line.medicine_id === item.medicine_id);
    const remainingOrdered = Math.max(0, Number(poItem?.quantity || 0) - Number(poItem?.received_quantity || 0));
    if (!poItem || Number(item.quantity) > remainingOrdered) {
      throw new Error(`Qty terima ${item.medicine_name} melebihi sisa PO (${remainingOrdered}).`);
    }
    if (!String(item.batch_number || '').trim() || !item.expiry_date) {
      throw new Error(`Nomor batch dan expired wajib untuk ${item.medicine_name}.`);
    }

    // 1. Create StockBatch
    const batch = await db.entities.StockBatch.create({
      medicine_id: item.medicine_id,
      medicine_name: item.medicine_name,
      batch_number: item.batch_number || `BATCH-${Date.now()}`,
      quantity: item.quantity,
      initial_quantity: item.quantity,
      expiry_date: item.expiry_date,
      received_date: today,
      supplier_id: supplier?.id || po.supplier_id,
      supplier_name: supplier?.name || po.supplier_name,
      purchase_price: item.unit_price || 0,
      hna_per_unit: item.unit_price || 0,
      hpp_per_unit: item.unit_price || 0,
      selling_price: item.selling_price || 0,
      pricing_status: 'Menunggu Faktur',
      purchase_order_id: po.id,
      purchase_order_number: po.po_number,
      status: 'Aktif',
    });

    // 2. Create StockMovement (Masuk)
    const med = await db.entities.Medicine.get(item.medicine_id);
    const newStock = (med.stock_on_hand || 0) + item.quantity;
    await db.entities.StockMovement.create({
      medicine_id: item.medicine_id,
      medicine_name: item.medicine_name,
      type: 'Masuk',
      quantity: item.quantity,
      balance_after: newStock,
      batch_number: batch.batch_number,
      reference_type: 'PurchaseOrder',
      reference_id: po.id,
      reference_number: po.po_number,
      notes: `Penerimaan PO ${po.po_number}`,
      source_type: 'Penerimaan PO',
      user_name: userName,
      timestamp: new Date().toISOString(),
    });

    // 3. Update aggregate stock. Final HNA/HPP/harga jual ditetapkan ketika
    // invoice supplier direkonsiliasi, therefore this step never changes price.
    await db.entities.Medicine.update(item.medicine_id, {
      stock_on_hand: newStock,
      purchase_price: item.unit_price || med.purchase_price || 0,
      updated_from_batch: true,
    });

    movements.push({ medicine_name: item.medicine_name, quantity: item.quantity, batch: batch.batch_number });
    totalReceivedQty += item.quantity;
  }

  // 4. Update PO items' received_quantity + status
  const updatedItems = po.items.map((poi) => {
    const recv = receivedItems.find((r) => r.medicine_id === poi.medicine_id);
    const prevRecv = poi.received_quantity || 0;
    return { ...poi, received_quantity: prevRecv + (recv?.quantity || 0) };
  });

  const allReceived = updatedItems.every((it) => (it.received_quantity || 0) >= (it.quantity || 0));
  const anyReceived = updatedItems.some((it) => (it.received_quantity || 0) > 0);

  await db.entities.PurchaseOrder.update(po.id, {
    items: updatedItems,
    status: allReceived ? 'Diterima' : anyReceived ? 'Diterima Sebagian' : po.status,
    received_date: allReceived ? today : po.received_date,
  });

  // 5. Audit log
  await db.entities.AuditLog.create({
    action: 'create',
    entity: 'StockBatch',
    entity_name: po.po_number,
    module: 'purchasing',
    description: `Penerimaan barang PO ${po.po_number}: ${movements.length} item, total ${totalReceivedQty} unit`,
    new_value: JSON.stringify(movements),
    user_name: userName,
    severity: 'Info',
    timestamp: new Date().toISOString(),
  });

  return { movements, totalReceivedQty, poStatus: allReceived ? 'Diterima' : 'Diterima Sebagian' };
}

/**
 * Create a supplier invoice linked to a PO.
 */
export async function createSupplierInvoice(invoiceData, userName = 'Sistem') {
  const total = (invoiceData.subtotal || 0) + (invoiceData.tax_ppn || 0) + (invoiceData.other_charges || 0);
  const inv = await db.entities.SupplierInvoice.create({
    ...invoiceData,
    total_amount: total,
    paid_amount: 0,
    status: 'Belum Bayar',
  });

  await db.entities.AuditLog.create({
    action: 'create',
    entity: 'SupplierInvoice',
    entity_name: inv.invoice_number,
    module: 'purchasing',
    description: `Faktur supplier ${inv.invoice_number} dari ${inv.supplier_name} — Rp ${total.toLocaleString('id-ID')}`,
    new_value: JSON.stringify({ total, po_number: inv.po_number, due_date: inv.due_date }),
    user_name: userName,
    severity: 'Info',
    timestamp: new Date().toISOString(),
  });

  return inv;
}

/**
 * Schedule a payment for a supplier invoice.
 */
export async function schedulePayment(scheduleData, userName = 'Sistem') {
  const sched = await db.entities.PaymentSchedule.create({
    ...scheduleData,
    status: 'Terjadwal',
  });

  await db.entities.AuditLog.create({
    action: 'create',
    entity: 'PaymentSchedule',
    entity_name: sched.schedule_number,
    module: 'finance',
    description: `Jadwal bayar ${sched.schedule_number} untuk ${sched.supplier_name} — Rp ${sched.amount.toLocaleString('id-ID')} (${sched.planned_date})`,
    user_name: userName,
    severity: 'Info',
    timestamp: new Date().toISOString(),
  });

  return sched;
}

/**
 * Mark a scheduled payment as paid — updates PaymentSchedule, SupplierInvoice paid_amount + status, creates Expense.
 */
export async function markPaymentPaid(schedule, userName = 'Sistem') {
  const today = new Date().toISOString().split('T')[0];

  // 1. Update payment schedule
  await db.entities.PaymentSchedule.update(schedule.id, {
    status: 'Dibayar',
    paid_date: today,
  });

  // 2. Update supplier invoice
  if (schedule.invoice_id) {
    const inv = await db.entities.SupplierInvoice.get(schedule.invoice_id);
    const newPaid = (inv.paid_amount || 0) + schedule.amount;
    const newStatus = newPaid >= inv.total_amount ? 'Lunas' : 'Sebagian Bayar';
    await db.entities.SupplierInvoice.update(inv.id, {
      paid_amount: newPaid,
      status: newStatus,
    });
  }

  // 3. Create Expense record
  await db.entities.Expense.create({
    expense_number: `EXP${Date.now().toString().slice(-6)}`,
    category: 'Pembelian Obat',
    description: `Pembayaran ke ${schedule.supplier_name} — ${schedule.invoice_number || schedule.po_number || schedule.schedule_number}`,
    amount: schedule.amount,
    payment_method: schedule.payment_method || 'Transfer',
    payee: schedule.supplier_name,
    expense_date: today,
    created_by: userName,
  });

  // 4. Audit log
  await db.entities.AuditLog.create({
    action: 'payment',
    entity: 'PaymentSchedule',
    entity_name: schedule.schedule_number,
    module: 'finance',
    description: `Pembayaran ${schedule.schedule_number} ke ${schedule.supplier_name} — Rp ${schedule.amount.toLocaleString('id-ID')} (${schedule.payment_method})`,
    new_value: JSON.stringify({ paid_date: today, method: schedule.payment_method, reference: schedule.reference_number }),
    user_name: userName,
    severity: 'Warning',
    timestamp: new Date().toISOString(),
  });

  return { paidDate: today };
}

/**
 * Void a supplier invoice — rollback stock, mark Batal, via backend function.
 */
export async function voidInvoice(invoiceId, reason, userName = 'Sistem') {
  const res = await db.functions.invoke('voidInvoice', { invoice_id: invoiceId, reason, userName });
  return res.data;
}

/**
 * Change selling price with Harga Minimum Aman protection — via backend function.
 */
export async function changeSellingPrice(medicineId, newPrice, reason) {
  const res = await db.functions.invoke('changeSellingPrice', { medicine_id: medicineId, new_price: newPrice, reason });
  return res.data;
}

/**
 * Check for overdue invoices and update their status.
 */
export async function checkOverdueInvoices() {
  const today = new Date().toISOString().split('T')[0];
  const invoices = await db.entities.SupplierInvoice.filter({ status: { $in: ['Belum Bayar', 'Sebagian Bayar'] } });
  const overdue = [];
  for (const inv of invoices) {
    if (inv.due_date && inv.due_date < today) {
      await db.entities.SupplierInvoice.update(inv.id, { status: 'Overdue' });
      overdue.push(inv.invoice_number);
    }
  }
  return overdue;
}
