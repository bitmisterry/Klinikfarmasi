const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Shared permission logic — used by backend functions for enforcement
// Reads role from User.data.clinic_role, looks up Role entity for permission matrix

export async function getUserRole(base44) {
  const user = await db.auth.me();
  if (!user) return null;
  const roleName = user?.data?.clinic_role || user?.clinic_role || 'Staff';
  const roles = await db.asServiceRole.entities.Role.filter({ name: roleName, is_active: true });
  return (roles && roles[0]) || null;
}

export async function checkPermission(base44, module, action) {
  const role = await getUserRole(base44);
  if (!role) return false;
  // Owner (system role) has all permissions
  if (role.is_system && role.name === 'Owner') return true;
  // Admin (system role) has most permissions except user_role management
  if (role.is_system && role.name === 'Admin' && module !== 'user_role') return true;
  const modPerms = role.permissions && role.permissions[module];
  if (!modPerms) return false;
  return modPerms[action] === true;
}

export async function checkAdvancedPermission(base44, permKey) {
  const role = await getUserRole(base44);
  if (!role) return false;
  if (role.is_system && (role.name === 'Owner' || role.name === 'Admin')) return true;
  return (role.advanced_permissions || []).includes(permKey);
}

// Check both module permission and advanced permission in one call
export async function authorize(base44, opts) {
  const { module, action, advancedPermission } = opts;
  if (advancedPermission) {
    return await checkAdvancedPermission(base44, advancedPermission);
  }
  return await checkPermission(base44, module, action);
}