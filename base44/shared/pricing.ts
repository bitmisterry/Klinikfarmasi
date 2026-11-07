// Shared pricing logic — HPP, Harga Minimum Aman, perlindungan stok lama, pembulatan.
// Dipakai oleh backend functions (processInvoice, changeSellingPrice, voidInvoice, runAnomalyScan)
// dan frontend (InvoiceForm, PriceInfoPopover).

/**
 * Hitung HPP per unit untuk satu item faktur.
 * @param {Object} item - { net_unit_price, ppn_percent, ppn_amount, quantity, bonus_quantity, bonus_treatment }
 * @returns {number} HPP per unit
 *
 * - PPN masuk ke HPP jika ppn_in_hpp=true (default). PPN share per unit = ppn_amount / quantity berbayar.
 * - Perlakuan bonus:
 *   Gratis  → HPP = (net × qty + ppn) / qty          (bonus tidak menurunkan HPP)
 *   Prorata → HPP = (net × qty + ppn) / (qty + bonus) (biaya dibagi ke semua unit)
 */
export function calcHppPerUnit(item, ppnInHpp = true) {
  const qty = Math.max(1, item.quantity || 0);
  const bonus = Math.max(0, item.bonus_quantity || 0);
  const net = item.net_unit_price || 0;
  const ppnTotal = ppnInHpp ? (item.ppn_amount || 0) : 0;
  const totalCost = net * qty + ppnTotal;
  const divisor = item.bonus_treatment === 'Prorata' ? (qty + bonus) : qty;
  return divisor > 0 ? totalCost / divisor : 0;
}

/**
 * Pembulatan ke atas ke kelipatan rounding (default Rp500).
 */
export function roundUpTo(value, rounding = 500) {
  if (!rounding || rounding <= 0) return Math.round(value);
  return Math.ceil(value / rounding) * rounding;
}

/**
 * Hitung Harga Minimum Aman dasar = HPP / (1 - margin/100), dibulatkan ke atas.
 */
export function calcMinSafePriceBase(hppPerUnit, targetMarginPct, rounding = 500) {
  if (!hppPerUnit || hppPerUnit <= 0) return 0;
  const factor = 1 - (targetMarginPct || 0) / 100;
  if (factor <= 0) return roundUpTo(hppPerUnit * 2, rounding); // margin ≥100% — fallback
  return roundUpTo(hppPerUnit / factor, rounding);
}

/**
 * Hitung Harga Minimum Aman dengan perlindungan stok lama.
 * Jika ada batch aktif lain dengan HPP lebih tinggi dari batch baru,
 * Harga Minimum Aman dilindungi = max(hpp_lama/(1-margin), min_safe_price_baru).
 *
 * @param {number} newHpp - HPP batch baru
 * @param {number} targetMarginPct - target margin %
 * @param {number} rounding - pembulatan
 * @param {Array} activeBatches - [{ hpp_per_unit, quantity, batch_number }] batch aktif lain (bukan batch baru)
 * @returns {{ minSafePrice, protected, highestOldHpp, oldStockValue, basis }}
 */
export function calcProtectedMinSafePrice(newHpp, targetMarginPct, rounding, activeBatches = []) {
  const baseMin = calcMinSafePriceBase(newHpp, targetMarginPct, rounding);
  // Stok lama dengan HPP lebih tinggi dari batch baru
  const oldStock = (activeBatches || [])
    .filter(b => (b.quantity || 0) > 0 && (b.hpp_per_unit || 0) > newHpp);
  if (oldStock.length === 0) {
    return { minSafePrice: baseMin, protected: false, highestOldHpp: 0, oldStockValue: 0, basis: 'new' };
  }
  const highestOldHpp = Math.max(...oldStock.map(b => b.hpp_per_unit || 0));
  const oldMin = calcMinSafePriceBase(highestOldHpp, targetMarginPct, rounding);
  const oldStockValue = oldStock.reduce((s, b) => s + (b.quantity || 0) * (b.hpp_per_unit || 0), 0);
  const minSafePrice = Math.max(baseMin, oldMin);
  return { minSafePrice, protected: true, highestOldHpp, oldStockValue, basis: 'old' };
}

/**
 * Default pengaturan Penentuan Harga.
 */
export const DEFAULT_PRICING_SETTINGS = {
  hpp_method: 'Per Batch FEFO',
  bonus_treatment_default: 'Per Faktur',
  ppn_in_hpp: 'true',
  default_target_margin: '30',
  price_rounding: '500',
  override_roles: 'Owner,Admin',
};

/**
 * Parse pengaturan dari ClinicSetting records (array of {key, value}).
 */
export function parsePricingSettings(records = []) {
  const map = {};
  (records || []).forEach(r => { map[r.key] = r.value; });
  return {
    hpp_method: map.hpp_method || DEFAULT_PRICING_SETTINGS.hpp_method,
    bonus_treatment_default: map.bonus_treatment_default || DEFAULT_PRICING_SETTINGS.bonus_treatment_default,
    ppn_in_hpp: map.ppn_in_hpp !== undefined ? map.ppn_in_hpp : DEFAULT_PRICING_SETTINGS.ppn_in_hpp,
    default_target_margin: parseFloat(map.default_target_margin || DEFAULT_PRICING_SETTINGS.default_target_margin) || 30,
    price_rounding: parseInt(map.price_rounding || DEFAULT_PRICING_SETTINGS.price_rounding) || 500,
    override_roles: map.override_roles || DEFAULT_PRICING_SETTINGS.override_roles,
  };
}