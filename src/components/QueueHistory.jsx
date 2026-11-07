// @ts-nocheck -- Queue history combines legacy timestamp formats.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, History } from 'lucide-react';

import EmptyState from '@/components/EmptyState';

const STATUS_PILLS = {
  'Menunggu': 'pill-inactive',
  'Pemeriksaan': 'pill-info',
  'Selesai Periksa': 'pill-success',
  'Di Apotek': 'pill-info',
  'Kasir': 'pill-warning',
  'Selesai': 'pill-success',
  'Batal': 'pill-critical',
};

const DATE_OPTIONS = [
  { label: 'Hari Ini', days: 0 },
  { label: 'Kemarin', days: 1 },
  { label: '7 Hari Terakhir', days: 7 },
  { label: '30 Hari Terakhir', days: 30 },
];

export default function QueueHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(7);
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [loketFilter, setLoketFilter] = useState('Semua');

  useEffect(() => { load(); }, [daysBack]);

  const load = async () => {
    setLoading(true);
    try {
      const dates = [];
      for (let i = 0; i <= daysBack; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      const results = await Promise.all(
        dates.map(d => db.entities.QueueEntry.filter({ visit_date: d }, '-created_date', 200).catch(() => []))
      );
      const all = results.flat();
      // Only show completed/cancelled or past dates (not today's active)
      const today = new Date().toISOString().split('T')[0];
      const historical = all.filter(r =>
        r.visit_date !== today ||
        r.status === 'Selesai' || r.status === 'Batal' || r.status === 'Selesai Periksa'
      );
      setRecords(historical);
    } catch {} finally { setLoading(false); }
  };

  const filtered = records.filter(r => {
    if (statusFilter !== 'Semua' && r.status !== statusFilter) return false;
    if (loketFilter !== 'Semua' && r.loket !== loketFilter) return false;
    return true;
  });

  const loketOptions = ['Semua', ...Array.from(new Set(records.map(r => r.loket).filter(Boolean)))];

  const stats = {
    total: filtered.length,
    selesai: filtered.filter(r => r.status === 'Selesai' || r.status === 'Selesai Periksa').length,
    batal: filtered.filter(r => r.status === 'Batal').length,
  };

  const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

  const getDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '-';
    const mins = Math.round((new Date(checkOut) - new Date(checkIn)) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}j ${mins % 60}m`;
  };

  // Group by date
  const grouped = filtered.reduce((acc, r) => {
    const d = r.visit_date || 'Tanpa Tanggal';
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="panel flex flex-col">
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Riwayat Antrean
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Histori kunjungan pasien yang sudah selesai/dibatalkan</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select value={daysBack} onChange={e => setDaysBack(Number(e.target.value))}
                className="appearance-none px-2.5 py-1.5 border border-border rounded text-xs font-medium bg-card outline-none focus:border-primary pr-7">
                {DATE_OPTIONS.map(o => <option key={o.days} value={o.days}>{o.label}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px]">
            {['Semua', 'Selesai', 'Selesai Periksa', 'Batal'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                  statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                }`}>{s}</button>
            ))}
          </div>
          {loketOptions.length > 1 && (
            <div className="relative">
              <select value={loketFilter} onChange={e => setLoketFilter(e.target.value)}
                className="appearance-none px-2.5 py-1.5 border border-border rounded text-[11px] font-medium bg-card outline-none focus:border-primary pr-7">
                {loketOptions.map(l => <option key={l}>{l}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Kunjungan</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-emerald-600">{stats.selesai}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Selesai</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-rose-600">{stats.batal}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Batal</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-320px)]">
        {loading && <p className="px-3 py-8 text-center text-xs text-muted-foreground">Memuat riwayat…</p>}
        {!loading && filtered.length === 0 && (
          <EmptyState icon={History} title="Tidak ada riwayat" description="Belum ada kunjungan yang selesai/dibatalkan pada rentang ini" />
        )}
        {!loading && sortedDates.map(date => (
          <div key={date}>
            <div className="px-3 py-1.5 bg-muted/50 border-b border-border sticky top-0">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                <span className="text-muted-foreground/60">• {grouped[date].length} kunjungan</span>
              </p>
            </div>
            {grouped[date].map(r => (
              <div key={r.id} className="px-3 py-2 flex items-center gap-3 border-b border-border hover:bg-slate-50 transition-colors">
                <span className="text-sm font-mono font-semibold text-muted-foreground w-14 shrink-0">{r.queue_number || '-'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold truncate">{r.patient_name}</p>
                    {r.priority && <span className="pill pill-warning shrink-0">Prioritas</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.loket || '-'} • Masuk: {fmtDateTime(r.check_in_time)} • Keluar: {fmtDateTime(r.check_out_time)}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{getDuration(r.check_in_time, r.check_out_time)}</span>
                  <span className={`pill ${STATUS_PILLS[r.status] || 'pill-inactive'}`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
