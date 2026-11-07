const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { calcProtectedMinSafePrice, parsePricingSettings } from '../../shared/pricing.ts';

// Kontrol Usaha — 16 rules rekonsiliasi rantai:
// Pelayanan → Resep → Barang Keluar → Tagihan → Pembayaran → Kas
// + 5 rules Penentuan Harga (HPP, margin, harga minimum, perubahan supplier, selisih faktur)
// Semua rules aktif (tidak toggleable — keputusan user: semua 16 sekaligus)

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user?.data?.clinic_role !== 'Owner' && user?.data?.clinic_role !== 'Admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const anomalies = [];
    const now = new Date().toISOString();

    // === 1. Stok berkurang tanpa penjualan ===
    const movements = await db.asServiceRole.entities.StockMovement.filter({ type: 'Keluar' });
    const orphanMovements = (movements || []).filter(m => !m.reference_id || m.reference_id === 'pending');
    orphanMovements.forEach(m => {
      anomalies.push({
        type: 'stock_out_no_transaction',
        severity: 'critical',
        description: `Stok berkurang ${Math.abs(m.quantity || 0)} ${m.medicine_name || ''} tanpa penjualan`,
        evidence_json: JSON.stringify({ movement_id: m.id, batch: m.batch_number, timestamp: m.timestamp }),
        related_entity: 'StockMovement',
        related_id: m.id,
        user_id: m.created_by_id,