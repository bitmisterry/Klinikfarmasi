const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { getUserRole, checkPermission, checkAdvancedPermission } from '../../shared/permissions.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { module, action, advancedPermission } = body;

    const role = await getUserRole(base44);
    const roleName = role?.name || user?.data?.clinic_role || 'Staff';

    let allowed = false;
    if (advancedPermission) {
      allowed = await checkAdvancedPermission(base44, advancedPermission);
    } else if (module && action) {
      allowed = await checkPermission(base44, module, action);
    }

    return Response.json({ allowed, role: roleName, isSystem: role?.is_system || false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}