import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { calcHppPerUnit, calcProtectedMinSafePrice, parsePricingSettings } from '../../shared/pricing.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { invoice, items, userName } = body;

    if (!invoice?.invoice_number || !invoice?.supplier_name) {
      return Response.json({ error: 'Nomor faktur & supplier wajib' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return Response.json({ error: 'Minimal 1 item wajib' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const actor = userName || user.full_name || user.email || 'Sistem';
    const db = db.asServiceRole.entities;

    // Load pengaturan Penentuan Harga
    const settingsRecs = await db.ClinicSetting.filter({ category: 'Penentuan Harga' });
    const settings = parsePricingSettings(settingsRecs || []);
    const ppnInHpp = settings.ppn_in_hpp === 'true';
    const rounding = settings.price_rounding || 500;
    const defaultMargin = settings.default_target_margin || 30;
    const bonusTreatment = invoice.bonus_treatment || (settings.bonus_treatment_default === 'Prorata' ? 'Prorata' : 'Gratis');

    const warnings = [];
    const priceHistoryEntries = [];
    const computed = {}; // idx -> { hppPerUnit, minSafePrice, sellingPrice, protected }

    // 1. Process each item: hitung HPP, Harga Minimum Aman (dengan perlindungan stok lama), update batch & obat
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item.medicine_id || !item.quantity || item.quantity <= 0) continue;

      const targetMargin = item.target_margin || defaultMargin;
      const bonusQty = Math.max(0, item.bonus_quantity || 0);
      const itemWithBonus = { ...item, bonus_quantity: bonusQty, bonus_treatment: bonusTreatment };
      const hppPerUnit = calcHppPerUnit(itemWithBonus, ppnInHpp);

      // Cek stok lama (batch aktif lain untuk obat yang sama, bukan batch yang akan diupdate)
      let activeBatches = [];
      if (item.batch_number) {
        activeBatches = await db.StockBatch.filter({
          medicine_id: item.medicine_id,
          status: 'Aktif',
        });
        // Kecualikan batch yang sedang diupdate (match by batch_number)
        activeBatches = (activeBatches || []).filter(b => b.batch_number !== item.batch_number);
      }
      const protection = calcProtectedMinSafePrice(hppPerUnit, targetMargin, rounding, activeBatches);
      const minSafePrice = protection.minSafePrice;

      // Harga jual: pakai hna_baru dari input, tapi pastikan ≥ minSafePrice yang dilindungi
      let sellingPrice = item.hna_baru || 0;
      let priceProtected = false;
      if (sellingPrice > 0 && sellingPrice < minSafePrice) {
        // Harga di bawah batas — naikkan ke Harga Minimum Aman (perlindungan otomatis)
        sellingPrice = minSafePrice;
        priceProtected = true;
        warnings.push(`${item.medicine_name}: harga jual dinaikkan ke Harga Minimum Aman Rp ${minSafePrice.toLocaleString('id-ID')} (masih ada stok lama HPP lebih tinggi)`);
      }
      computed[idx] = { hppPerUnit, minSafePrice, sellingPrice, protected: protection.protected };

      // a. Find existing StockBatch (from goods receipt) or create new (manual invoice)
      let batch = null;
      if (item.batch_number) {
        const existing = await db.StockBatch.filter({
          medicine_id: item.medicine_id,
          batch_number: item.batch_number
        });
        batch = (existing || [])[0];
      }

      const totalReceived = (item.quantity || 0) + bonusQty;

      if (batch) {
        // From PO — update batch prices to net values from invoice + HPP
        await db.StockBatch.update(batch.id, {
          purchase_price: item.net_unit_price,
          selling_price: sellingPrice,
          hpp_per_unit: hppPerUnit,
          source_invoice_id: null,
          invoice_id: invoice._id || null,
          invoice_number: invoice.invoice_number,
          quantity: (batch.quantity || 0) + totalReceived,
          initial_quantity: (batch.initial_quantity || 0) + totalReceived,
        });
      } else {
        // Manual invoice — create new StockBatch + StockMovement + update stock
        batch = await db.StockBatch.create({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          batch_number: item.batch_number || `BATCH-${Date.now()}`,
          quantity: totalReceived,
          initial_quantity: totalReceived,
          expiry_date: item.expiry_date,
          received_date: today,
          supplier_id: invoice.supplier_id || null,
          supplier_name: invoice.supplier_name,
          purchase_price: item.net_unit_price,
          selling_price: sellingPrice,
          hpp_per_unit: hppPerUnit,
          is_bonus: false,
          source_invoice_id: null,
          invoice_id: invoice._id || null,
          invoice_number: invoice.invoice_number,
          status: 'Aktif',
        });

        // StockMovement (Masuk)
        const med = await db.Medicine.get(item.medicine_id);
        const newStock = (med?.stock_on_hand || 0) + totalReceived;
        await db.StockMovement.create({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          type: 'Masuk',
          quantity: totalReceived,
          balance_after: newStock,
          batch_number: batch.batch_number,
          reference_type: 'PurchaseOrder',
          reference_number: invoice.invoice_number,
          notes: `Faktur ${invoice.invoice_number} (manual)`,
          user_name: actor,
          timestamp: new Date().toISOString(),
        });

        // Update Medicine stock
        await db.Medicine.update(item.medicine_id, { stock_on_hand: newStock });
      }

      // b. Update Medicine: Harga Jual (hanya jika ≥ minSafePrice), min_safe_price, price_protection_active
      //    JANGAN timpa purchase_price blind — biarkan sebagai HPP referensi terkini.
      const med = await db.Medicine.get(item.medicine_id);
      const oldPrice = med?.selling_price || 0;
      const medUpdate = {
        min_safe_price: minSafePrice,
        price_protection_active: protection.protected,
        target_margin_default: targetMargin,
      };
      if (sellingPrice > 0 && sellingPrice >= minSafePrice) {
        medUpdate.selling_price = sellingPrice;
      }
      // Simpan HPP referensi terkini (net sebelum PPN) — bukan satu-satunya sumber HPP
      if (item.net_unit_price > 0) {
        medUpdate.purchase_price = item.net_unit_price;
      }
      if (medUpdate.selling_price && medUpdate.purchase_price > 0) {
        medUpdate.margin_percent = ((medUpdate.selling_price - medUpdate.purchase_price) / medUpdate.purchase_price) * 100;
      }
      await db.Medicine.update(item.medicine_id, medUpdate);

      // c. PriceHistory untuk perubahan harga
      if (sellingPrice > 0 && sellingPrice !== oldPrice) {
        priceHistoryEntries.push({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          old_price: oldPrice,
          new_price: sellingPrice,
          min_safe_price: minSafePrice,
          hpp_basis: protection.protected ? protection.highestOldHpp : hppPerUnit,
          target_margin: targetMargin,
          reason: priceProtected ? 'Harga dinaikkan ke Harga Minimum Aman (perlindungan stok lama)' : (item.price_reason || ''),
          changed_by_name: actor,
          changed_by_id: user.id,
          source: 'faktur',
          reference_id: invoice._id || null,
          below_minimum: sellingPrice < minSafePrice,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. Calculate totals (dari nilai faktur asli — tidak diubah oleh harga jual)
    const subtotal = items.reduce((s, it) => s + (it.unit_price || 0) * (it.quantity || 0), 0);
    const total_discount = items.reduce((s, it) => s + (it.discount_amount || 0) * (it.quantity || 0), 0);
    const tax_ppn = items.reduce((s, it) => s + (it.ppn_amount || 0), 0);
    const other_charges = invoice.other_charges || 0;
    const total_amount = subtotal - total_discount + tax_ppn + other_charges;

    // 2b. Validasi selisih total aplikasi vs total yang diinput user (jika ada)
    if (invoice.total_amount && Math.abs(invoice.total_amount - total_amount) / Math.max(1, invoice.total_amount) > 0.01) {
      warnings.push(`Selisih total aplikasi (Rp ${total_amount.toLocaleString('id-ID')}) vs faktur input (Rp ${(invoice.total_amount || 0).toLocaleString('id-ID')}) > 1%. Faktur disimpan persis sesuai input, periksa kembali.`);
    }

    // 3. Create SupplierInvoice (nilai faktur asli tetap, item diperkaya dengan HPP/margin/min_safe_price)
    const inv = await db.SupplierInvoice.create({
      invoice_number: invoice.invoice_number,
      supplier_id: invoice.supplier_id || null,
      supplier_name: invoice.supplier_name,
      po_id: invoice.po_id || null,
      po_number: invoice.po_number || '',
      invoice_date: invoice.invoice_date || today,
      due_date: invoice.due_date || null,
      bonus_treatment: bonusTreatment,
      subtotal,
      total_discount,
      tax_ppn,
      other_charges,
      total_amount,
      paid_amount: 0,
      status: 'Belum Bayar',
      items: items.map((it, idx) => {
        const c = computed[idx] || {};
        return {
          medicine_id: it.medicine_id,
          medicine_name: it.medicine_name,
          quantity: it.quantity,
          bonus_quantity: Math.max(0, it.bonus_quantity || 0),
          total_received: (it.quantity || 0) + Math.max(0, it.bonus_quantity || 0),
          batch_number: it.batch_number || '',
          expiry_date: it.expiry_date || null,
          unit_price: it.unit_price || 0,
          discount_type: it.discount_type || 'Tidak Ada',
          discount_value: it.discount_value || 0,
          discount_amount: it.discount_amount || 0,
          net_unit_price: it.net_unit_price || 0,
          ppn_percent: it.ppn_percent || 0,
          ppn_amount: it.ppn_amount || 0,
          hpp_per_unit: c.hppPerUnit || 0,
          target_margin: it.target_margin || defaultMargin,
          min_safe_price: c.minSafePrice || 0,
          hna_baru: c.sellingPrice || it.hna_baru || 0,
          hna_auto: it.hna_auto !== false,
          line_total: it.line_total || 0,
        };
      }),
      notes: invoice.notes || '',
      created_by: actor,
    });

    // 4. Tulis PriceHistory
    for (const ph of priceHistoryEntries) {
      ph.reference_id = inv.id;
      await db.PriceHistory.create(ph);
    }

    // 5. Audit log
    await db.AuditLog.create({
      action: 'create',
      entity: 'SupplierInvoice',
      entity_name: inv.invoice_number,
      module: 'purchasing',
      description: `Faktur ${inv.invoice_number} dari ${inv.supplier_name} — Rp ${total_amount.toLocaleString('id-ID')} (${items.length} item, ${invoice.po_id ? 'dari PO' : 'manual'})`,
      new_value: JSON.stringify({ total_amount, subtotal, total_discount, tax_ppn, items: items.length, price_protected: priceHistoryEntries.filter(p => p.below_minimum).length }),
      user_name: actor,
      severity: 'Warning',
      timestamp: new Date().toISOString(),
    });

    return Response.json({ ok: true, invoice: inv, warnings, priceChanges: priceHistoryEntries.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}