// @ts-nocheck -- TV queue timestamps may be legacy strings or numbers.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Volume2 } from 'lucide-react';

const AVG_SERVICE_MINUTES = 10;
const LOKET_OPTIONS = ['Loket Pendaftaran', 'Poli Umum', 'Poli Anak', 'Poli Kandungan', 'Poli Gigi', 'Apotek', 'Kasir'];

export default function TVDisplay() {
  const [queue, setQueue] = useState([]);
  const [now, setNow] = useState(new Date());
  const [lastCallId, setLastCallId] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const prevCallRef = useRef(null);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const q = await db.entities.QueueEntry.filter({ visit_date: today }, 'created_date', 100);
        setQueue(q || []);
      } catch {}
    };
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    const unsubscribe = db.entities.QueueEntry.subscribe(() => fetchQueue());
    return () => { clearInterval(interval); clearInterval(clockInterval); unsubscribe(); };
  }, []);

  // Load doctor schedules for today
  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const today = dayNames[new Date().getDay()];
        const scheds = await db.entities.DoctorSchedule.filter({ day_of_week: today, is_active: true }) || [];
        setDoctors(scheds);
      } catch {}
    };
    loadDoctors();
    const interval = setInterval(loadDoctors, 10000);
    return () => clearInterval(interval);
  }, []);

  // Text-to-speech when a new patient is called
  useEffect(() => {
    const activeCalls = queue.filter(q => q.status === 'Pemeriksaan' && q.called_time);
    if (activeCalls.length > 0) {
      const latest = activeCalls.sort((a, b) => new Date(b.called_time) - new Date(a.called_time))[0];
      if (latest.id !== prevCallRef.current) {
        prevCallRef.current = latest.id;
        if ('speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(
            `Nomor antrean ${latest.queue_number}, ${latest.patient_name}, silakan menuju ${latest.loket || 'loket'}`
          );
          utter.lang = 'id-ID';
          utter.rate = 0.9;
          speechSynthesis.speak(utter);
        }
      }
    }
  }, [queue]);

  const activeCalls = queue.filter(q => q.status === 'Pemeriksaan');
  const waiting = queue
    .filter(q => q.status === 'Menunggu')
    .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || (a.queue_number || '').localeCompare(b.queue_number || ''))
    .slice(0, 12);

  // Group active calls by loket
  const loketCalls = LOKET_OPTIONS.map(l => ({
    loket: l,
    call: activeCalls.find(c => c.loket === l),
  })).filter(l => l.call);

  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="fixed inset-0 bg-slate-900 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">KlinikFarma — Layar TV Ruang Tunggu</h1>
            <p className="text-xs text-slate-400">Panggilan otomatis • Estimasi waktu tunggu real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-2xl font-mono font-semibold text-blue-300">
          <Clock className="w-6 h-6" />
          {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 p-6 overflow-hidden">
        {/* Left: Active calls (large) */}
        <div className="flex-1 flex flex-col gap-3">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Sedang Dipanggil</p>
          {loketCalls.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <Volume2 className="w-16 h-16 mb-3 opacity-30" />
              <p className="text-lg">Menunggu panggilan…</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {loketCalls.map(({ loket, call }) => (
              <div key={loket} className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider">{loket}</p>
                <p className="text-6xl font-bold text-blue-400 my-3 tracking-tight">{call.queue_number}</p>
                <p className="text-lg font-semibold">{call.patient_name}</p>
                {call.priority && <span className="mt-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded border border-amber-500/30">Prioritas</span>}
                <p className="text-sm text-slate-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Dipanggil pkl {fmtTime(call.called_time)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Waiting list */}
        <div className="w-[400px] flex flex-col bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <p className="text-sm font-medium text-slate-300">Antrean Menunggu</p>
            <p className="text-xs text-slate-500">{waiting.length} pasien menunggu</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {waiting.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-8">Tidak ada antrean menunggu</p>
            )}
            {waiting.map((q, i) => {
              const est = (i + 1) * AVG_SERVICE_MINUTES;
              const target = new Date(Date.now() + est * 60000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={q.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${q.priority ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-700/50'}`}>
                  <span className="text-lg font-mono font-bold text-blue-300 w-16">{q.queue_number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.patient_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{q.loket || '-'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase">Est. ~{est}m</p>
                    <p className="text-[11px] text-slate-400">→ {target}</p>
                  </div>
                  {q.priority && <span className="text-[9px] bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded shrink-0">Prioritas</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Doctor schedule strip */}
      {doctors.length > 0 && (
        <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Dokter Praktek Hari Ini</p>
          <div className="flex gap-3 overflow-x-auto">
            {doctors.map(d => (
              <div key={d.id} className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5 shrink-0">
                <div className={`w-2 h-2 rounded-full ${d.status === 'Hadir' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div>
                  <p className="text-sm font-medium text-white">{d.doctor_name}</p>
                  <p className="text-[11px] text-slate-400">{d.poli} • {d.start_time}-{d.end_time}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${d.status === 'Hadir' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {d.status || 'Dijadwalkan'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-8 py-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
        <p>Mohon tunggu nomor dipanggil • Estimasi tunggu dihitung otomatis</p>
        <p className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Tersambung real-time
        </p>
      </div>
    </div>
  );
}
