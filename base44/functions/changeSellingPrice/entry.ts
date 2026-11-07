import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { calcProtectedMinSafePrice, parsePricingSettings } from '../../shared/pricing.ts';
import { checkAdvancedPermission } from '../../shared/permissions.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { medicine_id, new_price, reason } = body;

    if (!medicine_id || !new_price || new_price <= 0) {
      return Response.json({ error: 'medicine_id & new_price wajib' }, { status: 400 });
    }

    const db = db.asServiceRole.entities;
    const actor = user.full_name || user.email || 'Sistem';

    const settingsRecs = await db.ClinicSetting.filter({ category: 'Penentuan Harga' });
    const settings = parsePricingSettings(settingsRecs || []);
    const rounding = settings.price_rounding || 500;
    const defaultMargin = settings.default_target_margin || 30;

    const med = await db.Medicine.get(medicine_id);
    if (!med) return Response.json({ error: 'Obat tidak ditemukan' }, { status: 404 });

    const targetMargin = med.target_margin_default || defaultMargin;
    const oldPrice = med.selling_price || 0;

    const activeBatches = await db.StockBatch.filter({ medicine_id, status: 'Aktif' });
    const sortedByHpp = (activeBatches || []).slice().sort((a, b) => (a.hpp_per_unit || 0) - (b.hpp_per_unit || 0));
    const newestHpp = sortedByHpp.length > 0 ? (sortedByHpp[0].hpp_per_unit || 0) : (med.purchase_price || 0);
    const otherBatches = sortedByHpp.slice(1);
    const protection = calcProtectedMinSafePrice(newestHpp, targetMargin, rounding, otherBatches);
    const minSafePrice = protection.minSafePrice;

    const belowMinimum = new_price < minSafePrice;

    if (belowMinimum) {
      const canOverride = await checkAdvancedPermission(base44, 'price_override');
      if (!canOverride) {
        return Response.json({
          error: 'Harga di bawah Harga Minimum Aman. Perlu hak khusus untuk melanjutkan.',
          min_safe_price: minSafePrice,
          attempted_price: new_price,
          protected: protection.protected,
        }, { status: 403 });
      }
      if (!reason || !reason.trim()) {
        return Response.json({ error: 'Alasan wajib untuk harga di bawah batas minimum', min_safe_price: minSafePrice }, { status: 400 });
      }
    }

    const medUpdate = {
      selling_price: new_price,
      min_safe_price: minSafePrice,
      price_protection_active: protection.protected,
    };
    if (med.purchase_price > 0) {
      medUpdate.margin_percent = ((new_price - med.purchase_price) / med.purchase_price) * 100;
    }
    await db.Medicine.update(medicine_id, medUpdate);

    await db.PriceHistory.create({
      medicine_id,
      medicine_name: med.name,
      old_price: oldPrice,
      new_price: new_price,
      min_safe_price: minSafePrice,
      hpp_basis: protection.protected ? protection.highestOldHpp : newestHpp,
      target_margin: targetMargin,
      reason: reason || '',
      changed_by_name: actor,
      changed_by_id: user.id,
      source: belowMinimum ? 'override' : 'manual',
      below_minimum: belowMinimum,
      timestamp: new Date().toISOString(),
    });

    await db.AuditLog.create({
      action: 'price_change',
      entity: 'Medicine',
      entity_name: med.name,
      module: 'master_obat',
      description: `Harga ${med.name}: Rp ${oldPrice.toLocaleString('id-ID')} → Rp ${new_price.toLocaleString('id-ID')}${belowMinimum ? ' (di bawah batas minimum)' : ''}${reason ? ' — ' + reason : ''}`,
      old_value: JSON.stringify({ selling_price: oldPrice }),
      new_value: JSON.stringify({ selling_price: new_price, min_safe_price: minSafePrice, below_minimum: belowMinimum, reason }),
      user_name: actor,
      severity: belowMinimum ? 'Critical' : 'Warning',
      timestamp: new Date().toISOString(),
    });

    if (belowMinimum) {
      await db.Anomaly.create({
        type: 'price_below_minimum',
        severity: 'critical',
        description: `Harga ${med.name} diubah ke Rp ${new_price.toLocaleString('id-ID')} — di bawah Harga Minimum Aman Rp ${minSafePrice.toLocaleString('id-ID')}${reason ? ' (' + reason + ')' : ''}`,
        evidence_json: JSON.stringify({ medicine_id, old_price: oldPrice, new_price: new_price, min_safe_price: minSafePrice, target_margin: targetMargin, reason, user: actor }),
        related_entity: 'Medicine',
        related_id: medicine_id,
        user_id: user.id,
        user_name: actor,
        status: 'Baru',
        detected_at: new Date().toISOString(),
      });
    }

    return Response.json({
      ok: true,
      old_price: oldPrice,
      new_price: new_price,
      min_safe_price: minSafePrice,
      protected: protection.protected,
      below_minimum: belowMinimum,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}