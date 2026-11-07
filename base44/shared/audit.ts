const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Shared audit logging — called from backend functions after sensitive actions
// Creates an AuditLog record with who/when/what/before/after/reason

export async function logAudit(base44, opts) {
  const {
    action,
    entity,
    entityId,
    entityName,
    description,
    oldValue,
    newValue,
    reason,
    module,
    severity,
  } = opts;

  let user;
  try {
    user = await db.auth.me();
  } catch {
    user = null;
  }

  await db.asServiceRole.entities.AuditLog.create({
    action,
    entity,
    entity_id: entityId || null,
    entity_name: entityName || null,
    module: module || entity,
    description: description || '',
    old_value: oldValue != null ? String(oldValue) : null,
    new_value: newValue != null ? String(newValue) : null,
    reason: reason || null,
    user_id: user?.id || null,
    user_name: user?.full_name || 'System',
    user_role: user?.data?.clinic_role || user?.clinic_role || 'System',
    severity: severity || 'Info',
    timestamp: new Date().toISOString(),
  });
}