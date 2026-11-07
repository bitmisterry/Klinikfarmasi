const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

/**
 * Scan all Document records with valid_until.
 * Creates in-app notifications for documents within reminder_days (default 30) before expiry
 * and for documents already expired.
 * Should be called daily via scheduled workflow.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today + 'T00:00:00');

    // Get all active documents with valid_until
    const docs = await db.asServiceRole.entities.Document.filter({
      is_active: true,
      valid_until: { $exists: true },
    }, 'valid_until', 500);

    const results = { checked: 0, notified: 0, expiring: 0, expired: 0 };

    for (const doc of (docs || [])) {
      results.checked++;
      if (!doc.valid_until) continue;

      const validDate = new Date(doc.valid_until + 'T00:00:00');
      const diffMs = validDate.getTime() - todayDate.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));