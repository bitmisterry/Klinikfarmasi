import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';

// Sapaan + tanggal — judul halaman
export function HomeGreeting({ user, roleName }) {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Pengguna';
  const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-page-title">{greeting}, {userName}</h1>
        <p className="text-caption mt-0.5">{dateStr}</p>
      </div>
      {roleName && <span className="pill pill-info">{roleName}</span>}
    </div>
  );
}

// "Hari Ini" — grid KPI 4 kolom, angka besar + label kecil
export function TodayGrid({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="panel px-3.5 py-3">
            <div className="flex items-center gap-2 mb-1">
              {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
              <p className="micro-label">{s.label}</p>
            </div>
            <p className="text-kpi-sm">{s.value}</p>
            {s.sub && <p className="text-caption mt-0.5">{s.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

// "Perlu Perhatian" — list dengan dot warna status
export function AttentionList({ items, emptyText = 'Tidak ada yang perlu diperhatikan' }) {
  const dotMap = { red: '🔴', yellow: '🟠', gray: '⚪', green: '🟢' };
  if (!items || items.length === 0) {
    return (
      <div className="px-3 py-8 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-body text-emerald-600">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-border">
      {items.map((it, i) => {
        const content = (
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="text-sm shrink-0">{dotMap[it.dot] || '⚪'}</span>
            <span className="text-body flex-1">{it.text}</span>
            {it.to && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </div>
        );
        return it.to ? (
          <Link key={i} to={it.to} className="block hover:bg-slate-50 transition-colors">{content}</Link>
        ) : (
          <div key={i}>{content}</div>
        );
      })}
    </div>
  );
}

// "Yang Perlu Dikerjakan" — campuran data nyata (bisa diklik) + daftar tetap (checkbox localStorage)
export function TaskChecklist({ storageKey, dataTasks = [], staticTasks = [] }) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`tasks_${storageKey}`);
      if (saved) setChecked(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    try { localStorage.setItem(`tasks_${storageKey}`, JSON.stringify(next)); } catch {}
  };

  const allTasks = [
    ...dataTasks.map(t => ({ ...t, kind: 'data' })),
    ...staticTasks.map(t => ({ ...t, kind: 'static' })),
  ];

  if (allTasks.length === 0) {
    return <div className="px-3 py-8 text-center"><p className="text-caption">Tidak ada tugas hari ini</p></div>;
  }

  return (
    <div className="divide-y divide-border">
      {allTasks.map((t, i) => {
        const id = t.id || `task-${i}`;
        const isChecked = checked[id];
        const isDataTask = t.kind === 'data';
        const labelClass = `text-body flex-1 min-w-0 ${isChecked ? 'line-through text-muted-foreground' : ''}`;
        return (
          <div key={id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors">
            <button
              type="button"
              onClick={() => {
                if (isDataTask && t.to) {
                  navigate(t.to);
                  return;
                }
                toggle(id);
              }}
              aria-label={isDataTask ? `Buka ${t.label}` : `${isChecked ? 'Batalkan' : 'Tandai'} ${t.label}`}
              title={isDataTask ? 'Buka persiapan pasien' : (isChecked ? 'Batalkan checklist' : 'Tandai selesai')}
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
            >
              {isChecked && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
            </button>
            {t.to && !isChecked ? (
              <Link to={t.to} className={labelClass} aria-label={t.label}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">{t.label}</span>
                  {t.badge && <span className="pill pill-warning text-[9px] px-1.5 py-0.5">{t.badge}</span>}
                </div>
                {t.subtitle && <p className="text-[11px] text-amber-700 mt-0.5 line-clamp-1">{t.subtitle}</p>}
              </Link>
            ) : (
              <span className={labelClass}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">{t.label}</span>
                  {t.badge && <span className="pill pill-warning text-[9px] px-1.5 py-0.5">{t.badge}</span>}
                </div>
                {t.subtitle && <p className="text-[11px] text-amber-700 mt-0.5 line-clamp-1">{t.subtitle}</p>}
              </span>
            )}
            {t.to && !isChecked && <Link to={t.to} aria-label={`Buka ${t.label}`} className="shrink-0"><ArrowRight className="w-3.5 h-3.5 text-muted-foreground" /></Link>}
          </div>
        );
      })}
    </div>
  );
}

// Panel bersarang — judul bagian + isi
export function HomePanel({ icon: Icon = null, title = '', subtitle = '', to = '', actionLabel = 'Lihat', children = null, accent = false }) {
  return (
    <div className={`panel ${accent ? 'border-l-2 border-l-primary' : ''}`}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div>
          <h2 className="text-section-title flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-primary" />} {title}
          </h2>
          {subtitle && <p className="text-caption mt-0.5">{subtitle}</p>}
        </div>
        {to && (
          <Link to={to} className="text-caption text-primary hover:text-primary-hover flex items-center gap-1">
            {actionLabel || 'Lihat'} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
