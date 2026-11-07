const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Pill, LogOut } from 'lucide-react';

import { PATIENT_PORTAL_NAV as navItems } from '@/lib/navigation';

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    db.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await db.auth.logout();
    window.location.href = '/login';
  };

  const isActive = (path) => path === '/portal' ? location.pathname === '/portal' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Pill className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-semibold text-sm block leading-tight">KlinikFarma</span>
            <span className="text-[10px] text-muted-foreground">Portal Pasien</span>
          </div>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground hidden sm:block">{user?.full_name}</span>
        <button onClick={handleLogout} className="flex items-center gap-1 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded">
          <LogOut className="w-3.5 h-3.5" /> Keluar
        </button>
      </header>

      <nav className="bg-card border-b border-border flex items-center gap-1 px-3 py-1.5 overflow-x-auto">
        {navItems.map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              isActive(item.path) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" /> {item.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        <Outlet />
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-card border-t border-border flex items-center justify-around z-30">
        {navItems.map(item => {
          const active = isActive(item.path);
          return (
            <button key={item.path} onClick={() => navigate(item.path)} className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${active ? 'text-primary' : 'text-muted-foreground'}`}>
              <item.icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}