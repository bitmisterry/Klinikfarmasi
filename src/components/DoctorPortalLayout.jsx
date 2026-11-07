const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Stethoscope, Bell, User, LogOut, ChevronDown, Menu, X, Sparkles, Briefcase, Layers, MessageSquare
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { getClinicRole, hasPermission, getManagementRoles } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';
import { DoctorContextProvider, useDoctorContext } from '@/lib/doctorContext';
import DoctorNavGroup from '@/components/doctor/DoctorNavGroup';
import {
  DOCTOR_PORTAL_NAV as PORTAL_NAV,
  DOCTOR_MANAGEMENT_NAV as MANAGEMENT_NAV,
  DOCTOR_ASSISTANT_NAV as ASSISTANT_NAV,
  DOCTOR_MOBILE_NAV,
  ASSISTANT_MOBILE_NAV,
} from '@/lib/navigation';

export default function DoctorPortalLayout() {
  return (
    <DoctorContextProvider>
      <DoctorPortalContent />
    </DoctorContextProvider>
  );
}

function DoctorPortalContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const { user, roles } = useAuth();
  const { loading: ctxLoading, isAssistant, isDoctor, doctorProfile } = useDoctorContext();
  const [notifCount, setNotifCount] = useState(0);
  const [activeWorkspace, setActiveWorkspace] = useState(() => localStorage.getItem('doctorWorkspace') || 'clinical');
  const [workspaceMenu, setWorkspaceMenu] = useState(false);

  const clinicRole = getClinicRole(user);
  const isDemo = user?.id?.startsWith('demo-') || user?.id === 'local-owner' || user?.id === 'staff-doctor-1';

  // Redirect non-doctors and non-assistants; redirect assistants to their dashboard
  useEffect(() => {
    if (!ctxLoading && user && !isDoctor && !isAssistant) {
      navigate('/', { replace: true });
    }
    if (!ctxLoading && user && isAssistant && location.pathname === '/doctor') {
      navigate('/doctor/assistant', { replace: true });
    }
  }, [user, isDoctor, isAssistant, ctxLoading, navigate, location.pathname]);

  useEffect(() => {
    db.entities.Notification.filter({ target_role: 'Dokter', is_read: false })
      .then(n => setNotifCount((n || []).length))
      .catch(() => {});
  }, [location.pathname]);

  const managementRoles = (!isAssistant && doctorProfile?.management_roles) || getManagementRoles(user) || [];

  const handleLogout = async () => {
    await db.auth.logout();
    window.location.href = '/login';
  };

  const isActive = (path, exact) => {
    const [targetPath, targetQuery = ''] = path.split('?');
    const pathMatches = exact || targetPath === '/doctor'
      ? location.pathname === targetPath
      : location.pathname.startsWith(targetPath);
    if (!pathMatches) return false;

    const currentParams = new URLSearchParams(location.search);
    const targetParams = new URLSearchParams(targetQuery);
    if (targetQuery) {
      return [...targetParams.entries()].every(([key, value]) => currentParams.get(key) === value);
    }

    // Chat and memo share one page. The no-query chat item must not remain
    // active while the memo query parameter is selected.
    if (targetPath === '/doctor/comms' && currentParams.get('tab') === 'memo') return false;

    // The prescription workspace shares /doctor/exam but is a distinct menu.
    if (targetPath === '/doctor/exam' && ['resep', 'racikan'].includes(currentParams.get('tab'))) return false;
    return true;
  };

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Dokter';
  const doctorDisplayName = doctorProfile?.display_name || doctorProfile?.full_name || user?.full_name || 'Dokter';
  const displayName = isAssistant ? `Asisten ${doctorDisplayName}` : doctorDisplayName;
  const specialization = doctorProfile?.specialization;

  if (ctxLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed top-14 bottom-0 lg:static z-40 w-[220px] h-full min-h-0 bg-card border-r border-border flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shrink-0">
            <Stethoscope className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">{isAssistant ? 'Asisten Dokter' : 'Dokter'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{doctorDisplayName}</p>
          </div>
        </div>
        <nav className="sidebar-scroll flex-1 min-h-0 overflow-y-auto py-3 px-1">
          {isAssistant ? (
            ASSISTANT_NAV.map((group) => (
              <DoctorNavGroup key={group.label} group={group} isActiveFn={isActive} onItemClick={() => setSidebarOpen(false)} />
            ))
          ) : activeWorkspace === 'management' && managementRoles.length > 0 ? (
            MANAGEMENT_NAV.map((group) => (
              <DoctorNavGroup
                key={group.label}
                group={group}
                isActiveFn={isActive}
                onItemClick={() => setSidebarOpen(false)}
                permissionFilter={item => hasPermission(clinicRole, item.module, 'view', roles)}
                footer={
                  <button
                    onClick={() => { setActiveWorkspace('clinical'); localStorage.setItem('doctorWorkspace', 'clinical'); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 mt-2 border-t border-border pt-2.5"
                  >
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    <span>Kembali ke Pemeriksaan</span>
                  </button>
                }
              />
            ))
          ) : (
            PORTAL_NAV.map((group) => (
              <DoctorNavGroup key={group.label} group={group} isActiveFn={isActive} onItemClick={() => setSidebarOpen(false)} clinicRole={clinicRole} />
            ))
          )}
        </nav>
        <div className="px-3 py-2.5 border-t border-border">
          {isDemo && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2 bg-purple-50 border border-purple-200 rounded-md text-purple-700 text-[10px] font-medium">
              <Sparkles className="w-3 h-3" /> Mode Demo
            </div>
          )}
          <div className="text-[10px] text-muted-foreground/60 text-center font-medium">Dokter v1.0</div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-card/80 backdrop-blur-sm border-b border-border flex items-center px-4 gap-2 sticky top-0 z-30">
          <button className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <p className="text-sm font-semibold truncate">{greeting}, {displayName}</p>
              {specialization && <span className="pill pill-info hidden sm:inline-flex">{specialization}</span>}
              {isAssistant && <span className="pill pill-warning hidden sm:inline-flex">Asisten</span>}
            </div>
          </div>
          {!isAssistant && managementRoles.length > 0 && (
            <div className="relative">
              <button onClick={() => setWorkspaceMenu(!workspaceMenu)} className={`flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs font-medium transition-all ${activeWorkspace === 'management' ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">{activeWorkspace === 'management' ? 'Manajemen' : 'Pemeriksaan'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {workspaceMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setWorkspaceMenu(false)} />
                  <div className="absolute right-0 top-11 z-50 w-56 bg-card border border-border rounded-lg shadow-lg py-1 overflow-hidden">
                    <button onClick={() => { setActiveWorkspace('clinical'); localStorage.setItem('doctorWorkspace', 'clinical'); setWorkspaceMenu(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors ${activeWorkspace === 'clinical' ? 'text-primary font-medium' : ''}`}>
                      <Stethoscope className="w-4 h-4" /> Pemeriksaan Dokter
                    </button>
                    {managementRoles.map(role => (
                      <button key={role} onClick={() => { setActiveWorkspace('management'); localStorage.setItem('doctorWorkspace', 'management'); setWorkspaceMenu(false); navigate('/'); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors ${activeWorkspace === 'management' ? 'text-primary font-medium' : ''}`}>
                        <Briefcase className="w-4 h-4" /> {role}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <Link to="/doctor/comms" className="p-2 hover:bg-muted rounded-lg transition-colors" title="Komunikasi Internal">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/doctor/requests" className="relative p-2 hover:bg-muted rounded-lg transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
            {notifCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-rose-500 text-white text-[9px] rounded-full flex items-center justify-center font-semibold">{notifCount}</span>
            )}
          </Link>
          <div className="relative">
            <button onClick={() => setUserMenu(!userMenu)} className="flex items-center gap-1.5 h-9 pl-1 pr-2 hover:bg-muted rounded-lg transition-colors">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold ring-1 ring-primary/10">
                {userName[0]?.toUpperCase()}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 top-11 z-50 w-52 bg-card border border-border rounded-lg shadow-lg py-1 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border bg-muted/30">
                    <p className="text-sm font-medium truncate">{user?.full_name || userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <span className="pill pill-info mt-1.5">{isAssistant ? 'Asisten Dokter' : clinicRole}</span>
                    {isAssistant && doctorDisplayName && <p className="text-[10px] text-muted-foreground mt-1.5">Untuk: {doctorDisplayName}</p>}
                  </div>
                  <Link to="/doctor/profile" onClick={() => setUserMenu(false)} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors">
                    <User className="w-4 h-4" /> Profil Saya
                  </Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors">
                    <LogOut className="w-4 h-4" /> Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 min-w-0 min-h-0 overflow-auto pb-14 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-card/95 backdrop-blur-sm border-t border-border flex items-center justify-around z-30">
        {(isAssistant ? ASSISTANT_MOBILE_NAV : DOCTOR_MOBILE_NAV).map(item => {
          const Icon = item.icon;
          const active = isActive(item.path, item.path === '/doctor');
          return (
            <Link key={item.path} to={item.path} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors relative ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-primary" />}
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
