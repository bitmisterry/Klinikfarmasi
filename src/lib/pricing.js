const db = globalThis.__B44_DB__ || { entities: new Proxy({}, { get: () => ({ filter: async () => [] }) }) };

// Central source of truth for purchasing pricing. HNA is the acquisition
// price after a line discount; HPP includes allocable taxes and charges.
export const PRICING_DEFINITION = {
  hna: 'Harga Netto Apotek per unit setelah diskon, sebelum PPN dan biaya faktur.',
  hpp: 'HNA ditambah PPN dan alokasi biaya faktur, dibagi unit yang dapat dijual.',
  marginMethod: 'Gross Margin',
  sellingPrice: 'Harga jual dibulatkan ke atas dari HPP / (1 - margin%).',
};

const number = (value) => Math.max(0, Number(value) || 0);

export function roundUpTo(value, rounding = 500) {
  const safeValue = number(value);
  const safeRounding = number(rounding);
  return safeRounding ? Math.ceil(safeValue / safeRounding) * safeRounding : Math.round(safeValue);
}

export function calcHppPerUnit(item, ppnInHpp = true) {
  const qty = Math.max(1, number(item.quantity));
  const bonus = number(item.bonus_quantity);
  const hna = number(item.hna_per_unit ?? item.net_unit_price);
  const ppn = ppnInHpp ? number(item.ppn_amount) : 0;
  const charges = number(item.allocated_other_charges);
  const divisor = item.bonus_treatment === 'Prorata' ? qty + bonus : qty;
  return divisor > 0 ? (hna * qty + ppn + charges) / divisor : 0;
}

export function calcMinSafePriceBase(hppPerUnit, targetMarginPct, rounding = 500) {
  const hpp = number(hppPerUnit);
  if (!hpp) return 0;
  const factor = 1 - Math.min(99, number(targetMarginPct)) / 100;
  return roundUpTo(hpp / Math.max(0.01, factor), rounding);
}

export function calculateSellingPriceFromHpp(hppPerUnit, targetMarginPct, rounding = 500) {
  return calcMinSafePriceBase(hppPerUnit, targetMarginPct, rounding);
}

export function calcProtectedMinSafePrice(newHpp, targetMarginPct, rounding, activeBatches = []) {
  const baseMin = calcMinSafePriceBase(newHpp, targetMarginPct, rounding);
  const oldStock = (activeBatches || []).filter((batch) =>
    number(batch.quantity) > 0 && number(batch.hpp_per_unit ?? batch.purchase_price) > number(newHpp));
  if (!oldStock.length) return { minSafePrice: baseMin, protected: false, highestOldHpp: 0, oldStockValue: 0, basis: 'batch_baru' };
  const highestOldHpp = Math.max(...oldStock.map((batch) => number(batch.hpp_per_unit ?? batch.purchase_price)));
  return {
    minSafePrice: Math.max(baseMin, calcMinSafePriceBase(highestOldHpp, targetMarginPct, rounding)),
    protected: true,
    highestOldHpp,
    oldStockValue: oldStock.reduce((sum, batch) => sum + number(batch.quantity) * number(batch.hpp_per_unit ?? batch.purchase_price), 0),
    basis: 'stok_lama',
  };
}

export function calculateInvoiceFinancials(rawItems = [], otherCharges = 0, settings = {}) {
  const ppnInHpp = settings.ppn_in_hpp !== 'false';
  const bonusTreatment = settings.bonus_treatment_default === 'Prorata' ? 'Prorata' : 'Gratis';
  const targetDefault = number(settings.default_target_margin) || 30;
  const rounding = number(settings.price_rounding) || 500;
  const normalized = rawItems.map((line) => {
    const quantity = number(line.quantity);
    const unitPrice = number(line.unit_price);
    const type = line.discount_type || 'Tidak Ada';
    const value = number(line.discount_value);
    const discount = type === 'Persen' ? unitPrice * Math.min(100, value) / 100 : type === 'Nominal' ? Math.min(unitPrice, value) : 0;
    const hna = Math.max(0, unitPrice - discount);
    return {
      ...line,
      quantity,
      bonus_quantity: number(line.bonus_quantity),
      unit_price: unitPrice,
      discount_type: type,
      discount_value: value,
      discount_amount: Math.round(discount),
      hna_per_unit: hna,
      net_unit_price: hna,
      ppn_percent: number(line.ppn_percent),
      ppn_amount: Math.round(hna * quantity * number(line.ppn_percent) / 100),
      bonus_treatment: line.bonus_treatment || bonusTreatment,
      target_margin: number(line.target_margin) || targetDefault,
    };
  });
  const netSubtotal = normalized.reduce((sum, line) => sum + line.hna_per_unit * line.quantity, 0);
  const safeCharges = number(otherCharges);
  const items = normalized.map((line, index) => {
    const charges = netSubtotal > 0
      ? Math.round(safeCharges * ((line.hna_per_unit * line.quantity) / netSubtotal))
      : (index === 0 ? safeCharges : 0);
    const hpp = calcHppPerUnit({ ...line, allocated_other_charges: charges }, ppnInHpp);
    const suggested = calculateSellingPriceFromHpp(hpp, line.target_margin, rounding);
    const manual = line.selling_price_auto === false && number(line.selling_price ?? line.hna_baru) > 0;
    const sellingPrice = manual ? number(line.selling_price ?? line.hna_baru) : suggested;
    return {
      ...line,
      allocated_other_charges: charges,
      hpp_per_unit: hpp,
      suggested_selling_price: suggested,
      selling_price: sellingPrice,
      // Compatibility with existing local records/UI. This is no longer HNA.
      hna_baru: sellingPrice,
      selling_price_auto: !manual,
      line_total: Math.round(line.hna_per_unit * line.quantity + line.ppn_amount + charges),
    };
  });
  const subtotal = normalized.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
  const totalDiscount = normalized.reduce((sum, line) => sum + line.discount_amount * line.quantity, 0);
  const tax = normalized.reduce((sum, line) => sum + line.ppn_amount, 0);
  return {
    items,
    subtotal: Math.round(subtotal),
    total_discount: Math.round(totalDiscount),
    net_subtotal: Math.round(netSubtotal),
    tax_ppn: Math.round(tax),
    other_charges: safeCharges,
    total_amount: Math.round(netSubtotal + tax + safeCharges),
    definition: PRICING_DEFINITION,
  };
}

export const DEFAULT_PRICING_SETTINGS = {
  hpp_method: 'Per Batch FEFO',
  hna_definition: PRICING_DEFINITION.hna,
  margin_method: PRICING_DEFINITION.marginMethod,
  bonus_treatment_default: 'Per Faktur',
  ppn_in_hpp: 'true',
  default_target_margin: '30',
  price_rounding: '500',
  override_roles: 'Owner,Admin',
};

export async function loadPricingSettings() {
  try {
    const records = await db.entities.ClinicSetting.filter({ category: 'Penentuan Harga' });
    const map = {};
    (records || []).forEach((record) => { map[record.key] = record.value; });
    return {
      hpp_method: map.hpp_method || DEFAULT_PRICING_SETTINGS.hpp_method,
      hna_definition: map.hna_definition || DEFAULT_PRICING_SETTINGS.hna_definition,
      margin_method: map.margin_method || DEFAULT_PRICING_SETTINGS.margin_method,
      bonus_treatment_default: map.bonus_treatment_default || DEFAULT_PRICING_SETTINGS.bonus_treatment_default,
      ppn_in_hpp: map.ppn_in_hpp ?? DEFAULT_PRICING_SETTINGS.ppn_in_hpp,
      default_target_margin: number(map.default_target_margin) || 30,
      price_rounding: number(map.price_rounding) || 500,
      override_roles: map.override_roles || DEFAULT_PRICING_SETTINGS.override_roles,
    };
  } catch {
    return { ...DEFAULT_PRICING_SETTINGS, default_target_margin: 30, price_rounding: 500 };
  }
}
