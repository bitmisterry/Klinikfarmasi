// @ts-nocheck -- Pharmacy helpers accept multiple legacy and current persisted record shapes.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


/**
 * FEFO Allocation: allocate quantity across batches ordered by expiry date ascending.
 * Returns array of { batch, quantity } allocations, or { error, shortfall } if insufficient.
 */
export async function allocateFEFO(medicine_id, quantity) {
  const batches = await db.entities.StockBatch.filter(
    { medicine_id, status: 'Aktif', quantity: { $gt: 0 } },
    'expiry_date',
    100
  );
  const sorted = (batches || []).sort((a, b) =>
    new Date(a.expiry_date) - new Date(b.expiry_date)
  );
  let remaining = quantity;
  const allocations = [];
  for (const batch of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    allocations.push({ batch, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) {
    // Fallback: no batches but medicine has stock_on_hand — allow dispensing without batch tracking
    if (sorted.length === 0) {
      const med = await db.entities.Medicine.get(medicine_id);
      if ((med.stock_on_hand || 0) >= quantity) {
        return {
          allocations: [{
            batch: { id: null, batch_number: 'N/A', expiry_date: null, quantity: med.stock_on_hand },
            quantity,
          }],
        };
      }
    }
    return { error: 'insufficient', shortfall: remaining, allocations };
  }
  return { allocations };
}

/**
 * Process FEFO dispensing for a cart of items.
 * For each item: allocate batches (FEFO), reduce batch quantities, reduce medicine stock_on_hand,
 * record StockMovement per batch, return batch allocation for transaction items.
 *
 * @param {Array} cart - [{ medicine_id, medicine_name, quantity, price, subtotal }]
 * @param {Object} txnRef - { transaction_id, invoice_number, preview_only? }
 * @param {String} userName
 * @returns { success, itemsWithBatches, errors }
 */
export async function processFEFODispensing(cart, txnRef, userName = 'Sistem') {
  const allocationPlan = [];
  const errors = [];
  const virtualBatchQty = new Map();
  const virtualMedicineQty = new Map();

  // Preflight every line first. No stock is changed unless the whole cart is valid.
  for (const item of cart) {
    const medicine = await db.entities.Medicine.get(item.medicine_id);
    if (!medicine) {
      errors.push({ medicine_name: item.medicine_name, message: `Master obat ${item.medicine_name} tidak ditemukan` });
      continue;
    }
    if (txnRef?.reference_type === 'OTC' && ['Obat Keras', 'Narkotika/Psikotropika', 'Narkotika', 'Psikotropika', 'Prekursor'].includes(medicine.category)) {
      errors.push({ medicine_name: item.medicine_name, message: `${item.medicine_name} tidak boleh dijual melalui jalur OTC` });
      continue;
    }

    const batches = (await db.entities.StockBatch.filter(
      { medicine_id: item.medicine_id, status: 'Aktif', quantity: { $gt: 0 } },
      'expiry_date',
      100
    )).filter((batch) => !['TIDAK_LAYAK', 'Tidak Layak'].includes(batch.vaccine_status || batch.status_vaksin));
    let remaining = Number(item.quantity || 0);
    const allocations = [];
    for (const batch of batches) {
      if (remaining <= 0) break;
      const available = virtualBatchQty.has(batch.id) ? virtualBatchQty.get(batch.id) : Number(batch.quantity || 0);
      const take = Math.min(available, remaining);
      if (take > 0) {
        allocations.push({ batch, quantity: take });
        virtualBatchQty.set(batch.id, available - take);
        remaining -= take;
      }
    }
    if (remaining > 0 && batches.length === 0) {
      const available = virtualMedicineQty.has(medicine.id)
        ? virtualMedicineQty.get(medicine.id)
        : Number(medicine.stock_on_hand || 0);
      const take = Math.min(available, remaining);
      if (take > 0) {
        allocations.push({ batch: { id: null, batch_number: 'N/A', expiry_date: null, quantity: available, purchase_price: medicine.purchase_price || 0 }, quantity: take });
        virtualMedicineQty.set(medicine.id, available - take);
        remaining -= take;
      }
    }
    if (remaining > 0) {
      errors.push({
        medicine_name: item.medicine_name,
        shortfall: remaining,
        message: `Stok tidak cukup untuk ${item.medicine_name} (kurang ${remaining})`,
      });
      continue;
    }
    allocationPlan.push({ item, medicine, allocations });
  }

  if (errors.length > 0) return { success: false, itemsWithBatches: [], errors };

  // FEFO determines not only which stock leaves, but also the price source.
  // The POS always records the batch price actually used, never a stale cart
  // value. A preview uses this same allocation plan without mutating stock.
  const pricedByItem = new Map();
  for (const plan of allocationPlan) {
    const saleSubtotal = plan.allocations.reduce((sum, allocation) => {
      const batchPrice = Number(allocation.batch.selling_price || plan.medicine.selling_price || plan.item.price || 0);
      return sum + (batchPrice * Number(allocation.quantity || 0));
    }, 0);
    const quantity = Number(plan.item.quantity || 0);
    pricedByItem.set(plan.item, {
      price: quantity > 0 ? Math.round(saleSubtotal / quantity) : 0,
      subtotal: Math.round(saleSubtotal),
      price_source: 'FEFO Batch',
      batch_pricing: plan.allocations.map((allocation) => ({
        batch_id: allocation.batch.id || '', batch_number: allocation.batch.batch_number || 'N/A',
        quantity: allocation.quantity, selling_price: Number(allocation.batch.selling_price || plan.medicine.selling_price || plan.item.price || 0),
        hpp_per_unit: Number(allocation.batch.hpp_per_unit || allocation.batch.purchase_price || plan.medicine.hpp_per_unit || plan.medicine.purchase_price || 0),
      })),
    });
  }
  if (txnRef?.preview_only) {
    return {
      success: true,
      itemsWithBatches: allocationPlan.map((plan) => ({ ...plan.item, ...pricedByItem.get(plan.item) })),
      errors: [],
    };
  }

  const itemsWithBatches = [];
  for (const plan of allocationPlan) {
    const { item, medicine, allocations } = plan;
    for (const a of allocations) {
      if (a.batch.id) {
        const currentBatch = await db.entities.StockBatch.get(a.batch.id);
        const newQty = Number(currentBatch?.quantity || 0) - a.quantity;
        await db.entities.StockBatch.update(a.batch.id, {
          quantity: newQty,
          status: newQty <= 0 ? 'Habis' : 'Aktif',
        });
      }
      // Record stock movement
      await db.entities.StockMovement.create({
        medicine_id: item.medicine_id,
        medicine_name: item.medicine_name,
        type: txnRef?.reference_type === 'OTC' ? 'OUT_OTC' : 'OUT_RESEP',
        quantity: -a.quantity,
        cost_unit: a.batch.purchase_price || medicine.purchase_price || 0,
        batch_number: a.batch.batch_number || '',
        reference_type: txnRef?.reference_type || 'Prescription',
        reference_id: txnRef.transaction_id,
        reference_number: txnRef.invoice_number,
        notes: `Dispensing ${txnRef.invoice_number}`,
        user_name: userName,
        timestamp: new Date().toISOString(),
      });
    }

    // Reduce medicine aggregate stock
    const med = await db.entities.Medicine.get(item.medicine_id);
    const newStock = Math.max(0, Number(med.stock_on_hand || 0) - Number(item.quantity || 0));
    await db.entities.Medicine.update(item.medicine_id, { stock_on_hand: newStock });
    if (newStock <= Number(med.min_stock || 0)) {
      const openAlerts = await db.entities.Notification.filter({ type: 'low_stock', related_id: item.medicine_id, is_read: false });
      if (!(openAlerts || []).length) {
        await db.entities.Notification.create({
          type: 'low_stock',
          target_role: 'Apoteker',
          title: `Stok menipis: ${med.name}`,
          body: `Sisa stok ${newStock} ${med.unit || 'unit'} (minimum ${med.min_stock || 0}). Tinjau Defecta/Pengadaan.`,
          priority: newStock <= 0 ? 'Mendesak' : 'Penting',
          related_entity: 'Medicine',
          related_id: med.id,
          is_read: false,
          action_label: 'Buka Inventori',
          action_type: 'navigate',
          action_payload: JSON.stringify({ path: '/inventory', medicine_id: med.id }),
        });
      }
    }

    // Collect batch info for transaction line item
    const batchNumbers = allocations.map(a => a.batch.batch_number).join(', ');
    const earliestExpiry = allocations.length > 0
      ? allocations[0].batch.expiry_date
      : null;

    const resolvedPrice = pricedByItem.get(item) || { price: item.price || 0, subtotal: item.subtotal || 0, price_source: 'Master Obat', batch_pricing: [] };
    itemsWithBatches.push({
      ...item,
      ...resolvedPrice,
      batch_number: batchNumbers,
      batch_expiry: earliestExpiry,
      batches: allocations.map(a => ({
        batch_number: a.batch.batch_number,
        expiry_date: a.batch.expiry_date,
        quantity: a.quantity,
      })),
    });
  }

  return { success: true, itemsWithBatches, errors: [] };
}

/**
 * Check prescription items for drug interactions and duplicate active substances.
 * Returns array of warnings [{ type, message, items }]
 */
export function checkPrescriptionFlags(items, medicines) {
  const warnings = [];
  if (!items || items.length === 0) return warnings;

  // Map items to medicine records
  const meds = items
    .map(it => medicines.find(m => m.id === it.medicine_id))
    .filter(Boolean);

  // Duplicate active substance
  const substanceMap = {};
  meds.forEach(m => {
    const sub = (m.active_substance || '').toLowerCase().trim();
    if (!sub) return;
    if (!substanceMap[sub]) substanceMap[sub] = [];
    substanceMap[sub].push(m.name);
  });
  Object.entries(substanceMap).forEach(([sub, names]) => {
    if (names.length > 1) {
      warnings.push({
        type: 'duplicate_substance',
        severity: 'warning',
        message: `Duplikasi zat aktif: ${names.join(', ')} (${sub})`,
      });
    }
  });

  // Simple interaction check: for each pair, check if one's interactions string contains the other's active_substance or name
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      const a = meds[i], b = meds[j];
      const aInter = (a.interactions || '').toLowerCase();
      const bInter = (b.interactions || '').toLowerCase();
      const aSub = (a.active_substance || '').toLowerCase().trim();
      const bSub = (b.active_substance || '').toLowerCase().trim();
      const aName = (a.name || '').toLowerCase().trim();
      const bName = (b.name || '').toLowerCase().trim();

      if (aSub && bInter.includes(aSub)) {
        warnings.push({
          type: 'interaction',
          severity: 'critical',
          message: `${b.name} berinteraksi dengan ${a.name} (zat aktif ${aSub})`,
        });
      } else if (bSub && aInter.includes(bSub)) {
        warnings.push({
          type: 'interaction',
          severity: 'critical',
          message: `${a.name} berinteraksi dengan ${b.name} (zat aktif ${bSub})`,
        });
      } else if (aName && bInter.includes(aName)) {
        warnings.push({
          type: 'interaction',
          severity: 'critical',
          message: `${b.name} berinteraksi dengan ${a.name}`,
        });
      } else if (bName && aInter.includes(bName)) {
        warnings.push({
          type: 'interaction',
          severity: 'critical',
          message: `${a.name} berinteraksi dengan ${b.name}`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Record a stock movement (for PO received, adjustment, opname, retur).
 */
export async function recordStockMovement({
  medicine_id, medicine_name, type, quantity, balance_after,
  batch_number, reference_type, reference_id, reference_number, notes, user_name
}) {
  return db.entities.StockMovement.create({
    medicine_id, medicine_name, type, quantity, balance_after,
    batch_number, reference_type, reference_id, reference_number,
    notes, user_name: user_name || 'Sistem',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get stock card (movement history) for a medicine, sorted by timestamp desc.
 */
export async function getStockCard(medicine_id) {
  const movements = await db.entities.StockMovement.filter(
    { medicine_id },
    '-timestamp',
    200
  );
  return movements || [];
}

/**
 * Record a substitution rule (manual or auto-learned from transaction).
 * Checks if an identical rule already exists before creating.
 */
export async function recordSubstitution(fromMed, toMed, ruleType = 'AutoLearned', createdBy = 'Sistem') {
  if (!fromMed?.id || !toMed?.id || fromMed.id === toMed.id) return null;
  const existing = await db.entities.SubstitutionRule.filter({
    from_medicine_id: fromMed.id,
    to_medicine_id: toMed.id,
  });
  if (existing && existing.length > 0) return existing[0];
  return db.entities.SubstitutionRule.create({
    from_medicine_id: fromMed.id,
    from_medicine_name: fromMed.name,
    to_medicine_id: toMed.id,
    to_medicine_name: toMed.name,
    rule_type: ruleType,
    priority: ruleType === 'Manual' ? 10 : 5,
    is_active: true,
    created_by: createdBy,
  });
}

/**
 * Get substitution recommendations for a medicine.
 * Returns { clinical, broader, rules } — clinical = same active substance + strength + form,
 * broader = same active substance, rules = from SubstitutionRule entity.
 */
/**
 * Convert a clinical dose (mg/mcg) to number of dispensing units based on medicine strength.
 * @param {number} doseMg - dose in mg (convert mcg to mg first)
 * @param {string} strength - e.g. "500mg", "250 mg/5ml", "1mg"
 * @param {string} form - Tablet, Kapsul, Sirup, etc.
 * @returns {{ units: number, is_odd_fraction: boolean, strength_mg: number, per_unit_mg: number }}
 */
export function convertDoseToUnits(doseMg, strength, form) {
  if (!doseMg || !strength) return { units: 0, is_odd_fraction: false, strength_mg: 0, per_unit_mg: 0 };

  // Parse strength — handle "500mg", "250 mg/5ml", "1mg/ml", "0.5mg"
  const s = String(strength).toLowerCase().replace(/\s/g, '');
  let perUnitMg = 0;

  // Pattern: "Xmg/ymL" or "Xmg/ym" (liquid concentration)
  const liquidMatch = s.match(/([\d.]+)\s*mg\s*\/\s*([\d.]+)\s*m(?:l)?/);
  if (liquidMatch) {
    const totalMg = parseFloat(liquidMatch[1]);
    const totalMl = parseFloat(liquidMatch[2]);
    if (totalMl > 0) perUnitMg = totalMg / totalMl; // mg per 1ml
  } else {
    // Pattern: "Xmg" or "Xmcg"
    const solidMatch = s.match(/([\d.]+)\s*(mg|mcg)/);
    if (solidMatch) {
      perUnitMg = parseFloat(solidMatch[1]);
      if (solidMatch[2] === 'mcg') perUnitMg = perUnitMg / 1000; // convert mcg to mg
    }
  }

  if (perUnitMg <= 0) return { units: 0, is_odd_fraction: false, strength_mg: 0, per_unit_mg: 0 };

  const units = doseMg / perUnitMg;
  // Round to 2 decimal places for comparison
  const rounded = Math.round(units * 100) / 100;
  // Odd fraction = not a multiple of 0.5 (e.g. 7.25, 3.33, 1.1)
  const remainder = rounded % 0.5;
  const is_odd_fraction = Math.abs(remainder) > 0.01 && Math.abs(remainder - 0.5) > 0.01;

  return {
    units: rounded,
    is_odd_fraction,
    strength_mg: perUnitMg,
    per_unit_mg: perUnitMg,
  };
}

/**
 * Generate defecta list — medicines at or below min_stock that need reordering.
 * Returns array of { medicine, needed_qty, suggested_qty } sorted by urgency.
 */
export async function generateDefectaList() {
  const medicines = await db.entities.Medicine.list();
  const defecta = (medicines || [])
    .filter(m => (m.stock_on_hand || 0) <= (m.min_stock || 0))
    .map(m => {
      const needed = Math.max(0, (m.min_stock || 0) - (m.stock_on_hand || 0));
      // Suggest 2x min_stock or min_stock + needed, whichever is larger
      const suggested = Math.max((m.min_stock || 0) * 2, (m.min_stock || 0) + needed);
      return {
        medicine: m,
        needed_qty: needed,
        suggested_qty: suggested,
        is_narcotic: m.category === 'Narkotika/Psikotropika',
      };
    })
    .sort((a, b) => {
      // Out of stock first, then narcotic, then by name
      const aOut = (a.medicine.stock_on_hand || 0) <= 0;
      const bOut = (b.medicine.stock_on_hand || 0) <= 0;
      if (aOut !== bOut) return aOut ? -1 : 1;
      if (a.is_narcotic !== b.is_narcotic) return a.is_narcotic ? -1 : 1;
      return a.medicine.name.localeCompare(b.medicine.name);
    });
  return defecta;
}

/**
 * Get SIPNAP monthly recap — aggregate narcotic transactions for a given month.
 * @param {string} yearMonth - "2026-09" format
 * @returns {{ items: [{medicine_name, quantity, total}], total_qty, total_value, narcotic_count }}
 */
export async function getSipnapMonthlyRecap(yearMonth) {
  const startDate = `${yearMonth}-01`;
  const [year, month] = yearMonth.split('-');
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate().toString().padStart(2, '0');
  const endDate = `${yearMonth}-${lastDay}`;

  const transactions = await db.entities.Transaction.filter({
    transaction_date: { $gte: startDate, $lte: endDate },
    payment_status: { $in: ['Lunas', 'Belum Bayar'] },
  }, '-transaction_date', 500);

  const medicines = await db.entities.Medicine.list();
  const narcoticMap = {};
  for (const m of (medicines || [])) {
    if (m.category === 'Narkotika/Psikotropika') narcoticMap[m.id] = m;
  }

  // Load related prescriptions for retention + doctor info
  const prescriptionIds = new Set();
  for (const txn of (transactions || [])) {
    if (txn.prescription_id) prescriptionIds.add(txn.prescription_id);
  }
  const prescriptions = prescriptionIds.size > 0
    ? await db.entities.Prescription.filter({ id: { $in: [...prescriptionIds] } }, '-prescription_date', 200)
    : [];
  const prescriptionMap = {};
  for (const p of (prescriptions || [])) {
    prescriptionMap[p.id] = p;
  }

  const recap = {};
  const lines = [];
  let totalQty = 0;
  let totalValue = 0;

  for (const txn of (transactions || [])) {
    const rx = txn.prescription_id ? prescriptionMap[txn.prescription_id] : null;
    for (const item of (txn.items || [])) {
      const med = narcoticMap[item.medicine_id];
      if (!med) continue;
      const key = item.medicine_id;
      if (!recap[key]) {
        recap[key] = {
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          form: med.form,
          strength: med.strength,
          quantity: 0,
          total: 0,
          transaction_count: 0,
        };
      }
      recap[key].quantity += (item.quantity || 0);
      recap[key].total += (item.subtotal || 0);
      recap[key].transaction_count += 1;
      totalQty += (item.quantity || 0);
      totalValue += (item.subtotal || 0);

      lines.push({
        date: txn.transaction_date,
        invoice_number: txn.invoice_number,
        prescription_number: rx?.prescription_number || '-',
        medicine_name: item.medicine_name,
        form: med.form,
        strength: med.strength,
        quantity_out: item.quantity || 0,
        unit: med.unit,
        stock_remaining: med.stock_on_hand || 0,
        patient_name: txn.patient_name || '-',
        doctor_name: rx?.doctor_name || '-',
        unit_price: item.price || 0,
        subtotal: item.subtotal || 0,
      });
    }
  }

  const items = Object.values(recap).sort((a, b) => b.quantity - a.quantity);
  lines.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    items,
    lines,
    total_qty: totalQty,
    total_value: totalValue,
    narcotic_count: items.length,
    period: yearMonth,
  };
}

/**
 * Get prescription retention log — prescriptions grouped by retention category.
 * Narkotika = 5 years retention, Standar = 2 years retention.
 * @param {string} [yearMonth] - optional filter by prescription month
 * @returns {{ entries, narcotic_count, standard_count, due_destruction_count }}
 */
export async function getPrescriptionRetentionLog(yearMonth) {
  let filter = {};
  if (yearMonth) {
    const startDate = `${yearMonth}-01`;
    const [year, month] = yearMonth.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate().toString().padStart(2, '0');
    const endDate = `${yearMonth}-${lastDay}`;
    filter = { prescription_date: { $gte: startDate, $lte: endDate } };
  }

  const prescriptions = await db.entities.Prescription.filter(filter, '-prescription_date', 500);
  const medicines = await db.entities.Medicine.list();
  const narcoticIds = new Set((medicines || []).filter(m => m.category === 'Narkotika/Psikotropika').map(m => m.id));

  const today = new Date();
  const entries = [];
  let narcoticCount = 0;
  let standardCount = 0;
  let dueDestructionCount = 0;

  for (const rx of (prescriptions || [])) {
    let category = rx.retention_category || 'Standar';
    const hasNarcoticItem = (rx.items || []).some(it => narcoticIds.has(it.medicine_id));
    if (hasNarcoticItem && category !== 'Narkotika') category = 'Narkotika';

    const retentionYears = category === 'Narkotika' ? 5 : 2;
    const rxDate = rx.prescription_date ? new Date(rx.prescription_date) : null;
    const retentionEndDate = rxDate ? new Date(rxDate.getFullYear() + retentionYears, rxDate.getMonth(), rxDate.getDate()) : null;
    const daysUntilDestruction = retentionEndDate ? Math.ceil((retentionEndDate - today) / (1000 * 60 * 60 * 24)) : null;

    let status = 'Dalam Retensi';
    if (daysUntilDestruction !== null && daysUntilDestruction <= 0) {
      status = 'Siap Musnah';
      dueDestructionCount++;
    } else if (daysUntilDestruction !== null && daysUntilDestruction <= 90) {
      status = 'Mendekati Jatuh Tempo';
    }

    if (category === 'Narkotika') narcoticCount++; else standardCount++;

    entries.push({
      id: rx.id,
      prescription_number: rx.prescription_number,
      prescription_date: rx.prescription_date,
      patient_name: rx.patient_name,
      doctor_name: rx.doctor_name,
      source: rx.source,
      retention_category: category,
      retention_years: retentionYears,
      retention_end_date: retentionEndDate ? retentionEndDate.toISOString().split('T')[0] : null,
      days_until_destruction: daysUntilDestruction,
      status,
      has_narcotic: hasNarcoticItem,
      item_count: (rx.items || []).length,
      physical_scan_url: rx.physical_scan_url,
    });
  }

  return {
    entries: entries.sort((a, b) => (b.prescription_date || '').localeCompare(a.prescription_date || '')),
    narcotic_count: narcoticCount,
    standard_count: standardCount,
    due_destruction_count: dueDestructionCount,
  };
}

export async function getSubstitutionRecommendations(medicine, allMedicines) {
  if (!medicine?.id || !allMedicines) return { clinical: [], broader: [], rules: [] };

  const clinical = allMedicines.filter(m =>
    m.id !== medicine.id &&
    m.active_substance &&
    medicine.active_substance &&
    m.active_substance.toLowerCase() === medicine.active_substance.toLowerCase() &&
    (m.strength || '').toLowerCase() === (medicine.strength || '').toLowerCase() &&
    (m.form || '') === (medicine.form || '')
  );

  const broader = allMedicines.filter(m =>
    m.id !== medicine.id &&
    m.active_substance &&
    medicine.active_substance &&
    m.active_substance.toLowerCase() === medicine.active_substance.toLowerCase() &&
    !clinical.find(c => c.id === m.id)
  );

  const rules = await db.entities.SubstitutionRule.filter({ from_medicine_id: medicine.id });

  return { clinical, broader, rules: (rules || []).filter(r => r.is_active) };
}
