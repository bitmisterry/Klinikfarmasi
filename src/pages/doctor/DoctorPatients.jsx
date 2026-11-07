// @ts-nocheck -- Doctor patient summaries combine visit and queue schemas.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, ArrowRight, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/doctorContext';
import EmptyState from '@/components/EmptyState';

export default function DoctorPatients() {
  const { user } = useAuth();
  const { doctorUserId, loading: ctxLoading } = useDoctorContext();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState('semua');
  const [historyFilter, setHistoryFilter] = useState('semua');
  const [loading, setLoading] = useState(true);

  const doctorId = doctorUserId;

  useEffect(() => { if (doctorId) load(); }, [doctorId]);

  const load = async () => {
    try {
      const [recs, prescs, appts, queueEntries] = await Promise.all([
        base44.entities.MedicalRecord.filter({ doctor_id: doctorId }).catch(() => []),
        base44.entities.Prescription.filter({ doctor_id: doctorId }).catch(() => []),
        base44.entities.Appointment.filter({ doctor_id: doctorId }).catch(() => []),
        base44.entities.QueueEntry.filter({ doctor_id: doctorId }).catch(() => []),
      ]);

      setRecords(recs || []);

      // Combine patient IDs with source tracking: "mine" (examined/prescribed) vs "poli" (booked/queued)
      const patientMap = new Map();
      (recs || []).forEach(r => { if (r.patient_id) patientMap.set(r.patient_id, 'mine'); });
      (prescs || []).forEach(p => { if (p.patient_id) patientMap.set(p.patient_id, 'mine'); });
      (appts || []).forEach(a => { if (a.patient_id && !patientMap.has(a.patient_id)) patientMap.set(a.patient_id, 'poli'); });
      (queueEntries || []).forEach(q => { if (q.patient_id && !patientMap.has(q.patient_id)) patientMap.set(q.patient_id, 'poli'); });

      const patientIds = [...patientMap.keys()];
      const allPatients = await base44.entities.Patient.list() || [];
      setPatients(allPatients.filter(p => patientIds.includes(p.id)).map(p => ({ ...p, _source: patientMap.get(p.id) })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getPatientStats = (patientId) => {
    const recs = records.filter(r => r.patient_id === patientId);
    return { visits: recs.length, lastVisit: recs[0]?.visit_date };
  };

  const filtered = patients.filter(p => {
    const stats = getPatientStats(p.id);
    const matchesQuery = !query.trim() || p.full_name?.toLowerCase().includes(query.toLowerCase()) || p.mr_number?.toLowerCase().includes(query.toLowerCase()) || p.phone?.includes(query);
    const matchesRelationship = relationshipFilter === 'semua' || p._source === relationshipFilter;
    const matchesHistory = historyFilter === 'semua' || (historyFilter === 'ada' ? stats.visits > 0 : stats.visits === 0);
    return matchesQuery && matchesRelationship && matchesHistory;
  });

  if (ctxLoading || loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-3 lg:p-5 space-y-3 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Pasien Saya</h1>

      <div className="panel">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari pasien…" className="flex-1 bg-transparent outline-none text-sm" />
          <span className="text-xs text-muted-foreground">{filtered.length} pasien</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={relationshipFilter} onChange={(event) => setRelationshipFilter(event.target.value)} className="rounded border border-border bg-card px-2 py-1 text-[11px] outline-none focus:border-primary" aria-label="Filter hubungan pasien">
            <option value="semua">Semua pasien</option>
            <option value="mine">Sudah ditangani saya</option>
            <option value="poli">Pasien poli / antrean</option>
          </select>
          <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} className="rounded border border-border bg-card px-2 py-1 text-[11px] outline-none focus:border-primary" aria-label="Filter riwayat pasien">
            <option value="semua">Semua riwayat</option>
            <option value="ada">Memiliki riwayat</option>
            <option value="belum">Belum ada riwayat saya</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="Belum ada pasien" description="Pasien akan muncul setelah Anda melakukan pemeriksaan" />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(p => {
              const stats = getPatientStats(p.id);
              const age = p.birth_date ? Math.floor((new Date() - new Date(p.birth_date)) / (365 * 24 * 60 * 60 * 1000)) : null;
              return (
                <button key={p.id} onClick={() => navigate(`/doctor/history?patient=${p.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0">
                    {p.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.mr_number || 'No RM'} • {p.gender === 'L' ? 'L' : 'P'}{age !== null ? ` • ${age}th` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">{stats.visits} kunjungan</p>
                    {stats.lastVisit && <p className="text-[10px] text-muted-foreground">Terakhir: {new Date(stats.lastVisit).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>}
                  </div>
                  {p._source === 'mine'
                    ? <span className="pill pill-success">Pasien Saya</span>
                    : <span className="pill pill-info">Pasien Poli</span>}
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
