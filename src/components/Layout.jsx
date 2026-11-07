const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Pill,
  Search, UserPlus, Clock, Menu, X, ChevronDown, LogOut, Sparkles
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import NotificationCenter from '@/components/NotificationCenter';
import SearchHelpModal from '@/components/search/SearchHelpModal';
import HelpButton from '@/components/search/HelpButton';
import { getClinicRole, getAccessibleNav, canAccess, canPerform } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';
import { NAV_GROUPS, MOBILE_NAV } from '@/lib/navigation';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const { user, roles } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  const clinicRole = getClinicRole(user);
  const isDemo = user?.id?.startsWith('demo-');
  const accessibleNav = getAccessibleNav(NAV_GROUPS, clinicRole, roles);

  useEffect(() => {
    if (user && clinicRole === 'Pasien') {
      navigate('/portal', { replace: true });
    }
    if (user && clinicRole.startsWith('Dokter')) {
      navigate('/doctor', { replace: true });
    }
  }, [user, clinicRole, navigate]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isActive = (path) => {
    const [targetPath, targetQuery] = String(path || '/').split('?');
    const pathMatches = targetPath === '/'
      ? location.pathname === '/'
      : location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
    if (!pathMatches) return false;
    const expected = new URLSearchParams(targetQuery);
    const current = new URLSearchParams(location.search);
    // When a role-specific tab is open, keep the generic module link from
    // appearing active at the same time as the scoped workflow link.
    if (!targetQuery && ['/pharmacy', '/purchasing'].includes(targetPath) && current.has('tab')) return false;
    if (!targetQuery) {
      // A scoped child page must win over its parent entry. For example,
      // /front-desk/documents activates only "Dokumen Disetujui", not both
      // that item and the broader "Front Desk" entry.
      const moreSpecificPathExists = accessibleNav
        .flatMap((group) => group.items)
        .map((item) => String(item.path || '').split('?')[0])
        .some((candidate) => candidate.length > targetPath.length
          && (location.pathname === candidate || location.pathname.startsWith(`${candidate}/`))
          && (candidate === targetPath || candidate.startsWith(`${targetPath}/`)));
      return !moreSpecificPathExists;
    }
    return [...expected.entries()].every(([key, value]) => current.get(key) === value);
  };

  const handleLogout = async () => {
    await db.auth.logout();
    window.location.href = '/login';
  };

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Top Bar 48px */}
      <header className="h-12 bg-card border-b border-border flex items-center px-3 gap-3 sticky top-0 z-30">
        <button className="lg:hidden p-1.5 hover:bg-muted rounded-md" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Pill className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm hidden sm:block">KlinikFarma</span>
        </div>

        {/* Global Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex-1 max-w-md mx-auto flex items-center gap-2 h-8 px-3 bg-muted border border-border rounded-md text-muted-foreground hover:border-primary/40 transition-colors text-xs"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Cari menu, pasien, obat, atau tanyakan cara…</span>
          <kbd className="hidden sm:inline-flex text-[10px] px-1 py-0.5 bg-card border border-border rounded">⌘K</kbd>
        </button>

        <div className="flex items-center gap-2">
          {canPerform('/patients', clinicRole, 'create', roles) && (
          <button
            onClick={() => navigate('/patients?action=new')}
            className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary-hover text-xs font-medium transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Pasien Baru
          </button>
          )}
          {isDemo ? (
            <div className="hidden md:flex items-center gap-1.5 h-8 px-2.5 bg-purple-50 border border-purple-200 rounded-md text-purple-700 text-xs">
              <Sparkles className="w-3.5 h-3.5" /> <span className="font-medium">Mode Demo</span>
            </div>
          ) : clinicRole === 'Owner' ? (
            <div className="hidden md:flex items-center gap-1.5 h-8 px-2.5 bg-purple-50 border border-purple-200 rounded-md text-purple-700 text-xs">
              <Sparkles className="w-3.5 h-3.5" /> <span className="font-medium">Mode Monitoring</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 h-8 px-2.5 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-xs">
              <Clock className="w-3.5 h-3.5" /> <span className="font-medium">Shift Pagi</span>
            </div>
          )}
          <NotificationCenter user={user} />
          <HelpButton onOpenSearch={() => setSearchOpen(true)} />
          <div className="relative">
            <button
              onClick={() => setUserMenu(!userMenu)}
              className="flex items-center gap-1.5 h-8 px-1.5 hover:bg-muted rounded-md transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 top-10 z-50 w-56 bg-card border border-border rounded-md shadow-lg py-1">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium truncate">{user?.full_name || 'Pengguna'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <span className="pill pill-info mt-1">{clinicRole}</span>
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside className={`fixed top-12 bottom-0 lg:static z-30 w-[220px] h-full min-h-0 bg-card border-r border-border flex flex-col transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <nav className="sidebar-scroll flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-4">
            {accessibleNav.map((group) => (
              <div key={group.label}>
                <p className="micro-label px-2 mb-1.5">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-3 border-t border-border">
            <div className="text-[10px] text-muted-foreground text-center">v1.0 • Clinic & Pharmacy</div>
          </div>
        </aside>

        {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Main Content */}
        <main className="flex-1 min-w-0 min-h-0 overflow-auto pb-14 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Floating Action */}
      {canPerform('/patients', clinicRole, 'create', roles) && (
      <button
        onClick={() => navigate('/patients?action=new')}
        className="lg:hidden fixed right-3 bottom-16 z-30 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary-hover transition-colors"
      >
        <UserPlus className="w-5 h-5" />
      </button>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-card border-t border-border flex items-center justify-around z-30">
        {MOBILE_NAV.filter(item => canAccess(item.path, clinicRole, roles)).map(item => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} to={item.path} className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${active ? 'text-primary' : 'text-muted-foreground'}`}>
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Cari & Bantuan */}
      <SearchHelpModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
