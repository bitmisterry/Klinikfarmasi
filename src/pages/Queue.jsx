const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Tv, Plus, RefreshCw, RotateCcw, Clock, CheckCircle2, SkipForward, Volume2, Monitor, ChevronDown, History } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import QueueAddForm from '@/components/QueueAddForm';
import QueueHistory from '@/components/QueueHistory';
import EmptyState from '@/components/EmptyState';

const LOKET_OPTIONS = ['Semua', 'Loket Pendaftaran', 'Poli Umum', 'Poli Anak', 'Poli Kandungan', 'Poli Gigi', 'Apotek', 'Kasir'];
const AVG_SERVICE_MINUTES = 10;
const FILTER_OPTIONS = ['Semua', 'Menunggu', 'Dipanggil', 'Menunggu Intake', 'Siap Dokter', 'Pemeriksaan', 'Selesai Periksa'];

export default function Queue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoket, setSelectedLoket] = useState('Semua');
  const [filter, setFilter] = useState('Semua');
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncTime, setSyncTime] = useState(new Date());
  const [syncing, setSyncing] = useState(false);
  const [latency, setLatency] = useState(0);
  const [view, setView] = useState('aktif');
  const { toast } = useToast();

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') setShowAddForm(true);
    const interval = setInterval(() => setSyncTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = db.entities.QueueEntry.subscribe(() => load());
    return unsubscribe;
  }, []);

  const load = async () => {
    const start = Date.now();
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = await db.entities.QueueEntry.filter({ visit_date: today }, 'created_date', 100);
      setQueue(q || []);
      setLatency(Date.now() - start);
    } catch {}
    setLoading(false);
  };

  const sync = async () => {
    setSyncing(true);
    await load();
    setSyncing(false);
    toast({ title: 'Antrean disinkronkan' });
  };

  const reset = async () => {
    if (!confirm('Reset antrean demo hari ini? Semua kunjungan aktif akan dibatalkan dengan alasan reset demo.')) return;
    try {
      const active = queue.filter(q => q.status !== 'Selesai' && q.status !== 'Batal');
      await db.entities.QueueEntry.updateMany(
        { id: { $in: active.map(a => a.id) } },
        { $set: { status: 'Batal', cancellation_reason: 'Reset antrean demo', cancelled_at: new Date().toISOString() } }
      );
      toast({ title: `${active.length} antrean direset` });
      load();
    } catch (e) { toast({ title: 'Gagal reset', description: e.message, variant: 'destructive' }); }
  };

  const openTV = () => window.open('/tv-display', '_blank', 'width=1920,height=1080');

  const loketQueue = selectedLoket === 'Semua' ? queue : queue.filter(q => q.loket === selectedLoket);
  const activeCall = loketQueue.find(q => q.status === 'Dipanggil');
  const waiting = loketQueue
    .filter(q => q.status === 'Menunggu')
    .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || (a.queue_number || '').localeCompare(b.queue_number || ''));
  const totalEstWait = waiting.length * AVG_SERVICE_MINUTES;

  const callNext = async () => {
    if (activeCall) { toast({ title: 'Selesaikan panggilan aktif dulu', variant: 'destructive' }); return; }
    const next = waiting[0];
    if (!next) { toast({ title: 'Tidak ada antrean menunggu' }); return; }
    try {
      await db.functions.invoke('callVisit', { queue_entry_id: next.id });
      toast({ title: `Memanggil ${next.queue_number} — ${next.patient_name}` });
      load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const skip = async () => {
    if (!activeCall) return;
    try {
      await db.functions.invoke('returnVisitToWaiting', { queue_entry_id: activeCall.id, reason: 'Panggilan dilewati oleh Front Office' });
      toast({ title: `${activeCall.queue_number} dilewati (skip)` });
      load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const done = async () => {
    if (!activeCall) return;
    try {
      await db.functions.invoke('confirmVisitArrival', { queue_entry_id: activeCall.id });
      toast({ title: `${activeCall.queue_number} hadir`, description: 'Pasien diteruskan ke pemeriksaan awal perawat.' });
      load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const callSpecific = async (entry) => {
    if (activeCall && activeCall.id !== entry.id) {
      await db.functions.invoke('returnVisitToWaiting', { queue_entry_id: activeCall.id, reason: 'Diganti dengan panggilan antrean lain' });
    }
    try {
      await db.functions.invoke('callVisit', { queue_entry_id: entry.id });
      toast({ title: `Memanggil ${entry.queue_number} — ${entry.patient_name}` });
      load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const callAgain = async (entry) => {
    try {
      await db.functions.invoke('callVisit', { queue_entry_id: entry.id });
      toast({ title: `Memanggil ulang ${entry.queue_number}` });
      load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const getEstWait = (entry) => {
    const pos = waiting.findIndex(w => w.id === entry.id);
    return pos >= 0 ? (pos + 1) * AVG_SERVICE_MINUTES : 0;
  };

  const getTargetTime = (estMin) => {
    const t = new Date(Date.now() + estMin * 60000);
    return t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

  const filteredQueue = (() => {
    if (filter === 'Semua') return loketQueue;
    if (filter === 'Selesai Periksa') return loketQueue.filter(q => q.status === 'Selesai Periksa' || q.status === 'Selesai');
    return loketQueue.filter(q => q.status === filter);
  })();

  return (
    <div className="p-3 lg:p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Manajemen Antrean & Ruang Tunggu</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Panggil pasien, estimasi waktu tunggu otomatis, dan kontrol tampilan TV ruang tunggu.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setView('aktif')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              view === 'aktif' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}>
            <Clock className="w-3.5 h-3.5" /> Antrean Aktif
          </button>
          <button onClick={() => setView('riwayat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              view === 'riwayat' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}>
            <History className="w-3.5 h-3.5" /> Riwayat
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Status bar */}
          <div className="flex items-center gap-1.5 text-[11px] bg-card border border-border rounded px-2 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-emerald-600">Tersambung</span>
            <span className="text-muted-foreground">({latency}ms)</span>
            <span className="text-muted-foreground ml-1">Sinkron: {syncTime.toLocaleTimeString('id-ID')} WIB</span>
          </div>
          <button onClick={sync} disabled={syncing}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Sinkronkan
          </button>
          <button onClick={reset}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={openTV}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-primary text-primary rounded text-xs font-medium hover:bg-primary/5">
            <Tv className="w-3.5 h-3.5" /> Buka Layar TV
          </button>
          <button onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 btn-primary rounded text-xs font-medium">
            <Plus className="w-3.5 h-3.5" /> Tambah Antrean Baru
          </button>
        </div>
      </div>

      {view === 'riwayat' ? (
        <QueueHistory />
      ) : (
      <>
      {/* Info banner */}
      <div className="bg-slate-800 text-white rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-slate-700 flex items-center justify-center shrink-0">
          <Monitor className="w-5 h-5 text-blue-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Tampilan Visual Layar TV Ruang Tunggu Siap Digunakan</p>
            <span className="text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded border border-blue-400/30">Layar 16:9/TV</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-0.5">Pasien dapat melihat nomor panggilan aktif, multi-loket, estimasi menit tunggu, dan pemanggilan suara otomatis.</p>
        </div>
        <button onClick={openTV}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors shrink-0">
          <Tv className="w-3.5 h-3.5" /> Buka di Jendela / Monitor TV Baru
        </button>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_1.5fr] gap-3">
        {/* Left: Kontrol Loket */}
        <div className="space-y-3">
          {/* Loket selector */}
          <div className="panel px-3 py-2.5">
            <p className="micro-label mb-1.5">KONTROL LOKET / POLIKLINIK</p>
            <div className="relative">
              <select value={selectedLoket} onChange={e => setSelectedLoket(e.target.value)}
                className="w-full appearance-none px-2.5 py-2 border border-border rounded text-xs font-medium bg-card outline-none focus:border-primary pr-8">
                {LOKET_OPTIONS.map(l => <option key={l}>{l}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Active Call Card */}
          <div className="panel py-6 px-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sedang Dilayani di Loket Ini</p>
            {activeCall ? (
              <div className="mt-3">
                <p className="text-4xl font-bold text-primary tracking-tight">{activeCall.queue_number}</p>
                <p className="text-sm font-semibold mt-2">{activeCall.patient_name}</p>
                {activeCall.priority && <span className="pill pill-warning mt-1.5">Prioritas</span>}
                <p className="text-xs text-muted-foreground mt-1">{activeCall.loket || selectedLoket}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Dokter: {activeCall.doctor_name || 'Belum ditentukan'}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" /> Dipanggil pkl {fmtTime(activeCall.called_time)}
                </p>
              </div>
            ) : (
              <div className="mt-4 py-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                  <Volume2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Tidak ada pasien sedang dipanggil</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Tekan tombol di bawah untuk memanggil</p>
              </div>
            )}
            <div className="mt-4 space-y-2">
              <button onClick={callNext}
                className="w-full btn-primary py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2">
                <Volume2 className="w-4 h-4" /> Panggil Antrean Selanjutnya
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={skip} disabled={!activeCall}
                  className="flex items-center justify-center gap-1.5 py-2 border border-border rounded text-xs font-medium hover:bg-muted disabled:opacity-40">
                  <SkipForward className="w-3.5 h-3.5" /> Lewati (Skip)
                </button>
                <button onClick={done} disabled={!activeCall}
                  className="flex items-center justify-center gap-1.5 py-2 border border-emerald-300 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-50 disabled:opacity-40">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pasien Hadir
                </button>
              </div>
              {activeCall && <button onClick={() => callAgain(activeCall)} className="w-full flex items-center justify-center gap-1.5 py-2 border border-border rounded text-xs font-medium hover:bg-muted"><Volume2 className="w-3.5 h-3.5" /> Panggil Ulang</button>}
            </div>
          </div>

          {/* Stats */}
          <div className="panel">
            <div className="px-3 py-2.5 border-b border-border">
              <p className="micro-label">STATISTIK BEBAN LOKET</p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="bg-muted/40 rounded p-2.5 text-center">
                <p className="text-2xl font-bold text-primary">{waiting.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Antrean Menunggu</p>
              </div>
              <div className="bg-muted/40 rounded p-2.5 text-center">
                <p className="text-2xl font-bold text-amber-600">~{totalEstWait}m</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Est. Tunggu</p>
              </div>
            </div>
            <div className="px-3 pb-3">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Estimasi waktu tunggu dihitung otomatis berdasarkan akumulasi durasi rata-rata per poli dan disiarkan real-time ke TV ruang tunggu.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Daftar Antrean */}
        <div className="panel flex flex-col">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Daftar Antrean Pasien</h2>
              <p className="text-[11px] text-muted-foreground">{loketQueue.length} terdaftar {selectedLoket !== 'Semua' ? `di ${selectedLoket}` : 'semua loket'}</p>
            </div>
            <div className="relative">
              <select value={filter} onChange={e => setFilter(e.target.value)}
                className="appearance-none px-2.5 py-1.5 border border-border rounded text-xs font-medium bg-card outline-none focus:border-primary pr-7">
                {FILTER_OPTIONS.map(f => <option key={f}>{f}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border max-h-[calc(100vh-340px)]">
            {loading && <p className="px-3 py-8 text-center text-xs text-muted-foreground">Memuat…</p>}
            {!loading && filteredQueue.length === 0 && (
              <EmptyState icon={Clock} title="Tidak ada antrean" description="Tambah antrean baru atau ubah filter loket" />
            )}
            {filteredQueue.map(q => {
              const isActive = q.status === 'Dipanggil';
              const isWaiting = q.status === 'Menunggu';
              const isWaitingIntake = q.status === 'Menunggu Intake';
              const est = getEstWait(q);
              return (
                <div key={q.id} className={`px-3 py-2.5 flex items-center gap-3 ${isActive ? 'bg-primary/5' : 'hover:bg-slate-50'} transition-colors`}>
                  <span className="text-sm font-mono font-semibold text-muted-foreground w-14 shrink-0">{q.queue_number || '-'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold truncate">{q.patient_name}</p>
                      {q.priority && <span className="pill pill-warning shrink-0">Prioritas</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {q.loket || 'Belum ditentukan'} • {q.doctor_name || 'Dokter belum ditentukan'} • Masuk: {fmtTime(q.check_in_time)}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {isActive && (
                      <div className="flex items-center gap-1.5">
                        <span className="pill pill-info flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Dipanggil</span>
                        <button onClick={() => done()} className="px-2.5 py-1.5 border border-emerald-300 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-50">Pasien Hadir</button>
                      </div>
                    )}
                    {isWaiting && (
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Est. Tunggu</p>
                          <p className="text-[11px] font-medium text-amber-600">~{est}m</p>
                          <p className="text-[9px] text-muted-foreground">Target {getTargetTime(est)}</p>
                        </div>
                        <button onClick={() => callSpecific(q)}
                          className="flex items-center gap-1 px-2.5 py-1.5 btn-primary rounded text-xs font-medium">
                          <Volume2 className="w-3 h-3" /> Panggil
                        </button>
                      </div>
                    )}
                    {isWaitingIntake && <span className="pill pill-warning">Menunggu intake perawat</span>}
                    {!isWaiting && !isActive && !isWaitingIntake && <span className="pill pill-info">{q.status}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      </>
      )}
      {showAddForm && (
        <QueueAddForm
          onClose={() => setShowAddForm(false)}
          onCreated={() => { setShowAddForm(false); load(); }}
        />
      )}
    </div>
  );
}
