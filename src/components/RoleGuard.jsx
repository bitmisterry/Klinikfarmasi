import { Link } from 'react-router-dom';
import { Eye, ShieldX } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { canAccess, canPerform, getClinicRole, MODULE_KEYS, MODULE_LABELS } from '@/lib/roles';

export default function RoleGuard({ path, children }) {
  const { user, roles } = useAuth();
  const clinicRole = getClinicRole(user);
  if (!canAccess(path, clinicRole, roles)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="panel max-w-md w-full p-6 text-center">
          <ShieldX className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h1 className="text-base font-semibold">Akses dibatasi</h1>
          <p className="text-xs text-muted-foreground mt-1.5">Role {clinicRole} tidak memiliki akses ke modul ini sesuai prinsip least privilege.</p>
          <Link to="/" className="btn-primary inline-flex mt-4 px-3 py-2 rounded-md text-xs font-medium">Kembali ke beranda</Link>
        </div>
      </div>
    );
  }
  const isReadOnly = !['create', 'edit', 'delete', 'approve'].some((action) => canPerform(path, clinicRole, action, roles));
  const module = MODULE_KEYS[String(path || '').split('?')[0]];
  return (
    <>
      {isReadOnly && (
        <div className="mx-3 lg:mx-4 mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800 flex items-start gap-2">
          <Eye className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span><strong>Mode lihat saja:</strong> role {clinicRole} dapat memantau {MODULE_LABELS[module] || 'modul ini'}, tetapi perubahan data operasional ditolak dan dicatat di audit trail.</span>
        </div>
      )}
      {children}
    </>
  );
}
