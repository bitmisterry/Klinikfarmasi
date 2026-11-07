const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Users, Stethoscope, Wallet, Activity, Award } from 'lucide-react';

/**
 * Laporan Kinerja Harian per Dokter
 * mode="all"    → tabel ringkasan semua dokter (untuk Owner/Manajemen)
 * mode="single" → kartu ringkasan kinerja dokter sendiri (untuk Doctor Portal)
 */
export default function DoctorPerformanceReport({ mode = 'all', doctorId, doctorName }) {
  const [records, setRecords] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    (async () => {
      try {
        const [recs, profs] = await Promise.all([
          db.entities.MedicalRecord.filter({ visit_date: today }, '-created_date', 500),
          db.entities.DoctorProfile.list().catch(() => []),
        ]);
        setRecords(recs || []);
        setProfiles(profs || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // Group records by doctor
  const byDoctor = {};
  records.forEach(r => {
    const key = r.doctor_id || r.doctor_name || 'unknown';
    if (!byDoctor[key]) {
      byDoctor[key] = {
        doctor_id: r.doctor_id || '',
        doctor_name: r.doctor_name || 'Tidak diketahui',
        patients: 0,
        procedureCount: 0,
        revenue: 0,
      };
    }
    byDoctor[key].patients += 1;
    byDoctor[key].procedureCount += (r.procedures || []).length;
    byDoctor[key].revenue += r.tindakan_total || 0;
  });

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.user_id || p.id] = p; });

  const doctorRows = Object.values(byDoctor).sort((a, b) => b.revenue - a.revenue);
  const totals = doctorRows.reduce((acc, d) => ({
    patients: acc.patients + d.patients,
    procedureCount: acc.procedureCount + d.procedureCount,
    revenue: acc.revenue + d.revenue,
  }), { patients: 0, procedureCount: 0, revenue: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ===== Single doctor mode (Doctor Portal) =====
  if (mode === 'single') {
    const myKey = doctorId || doctorName;
    const my = byDoctor[myKey] || { patients: 0, procedureCount: 0, revenue: 0 };
    const rank = doctorRows.findIndex(d => (d.doctor_id || d.doctor_name) === myKey) + 1;

    return (
      <div className="panel border-l-2 border-l-primary">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-primary" /> Kinerja Hari Ini
          </h3>
        </div>
        <div className="p-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="w-8 h-8 mx-auto rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-1">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-purple-600">{my.patients}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pasien</p>
          </div>
          <div>
            <div className="w-8 h-8 mx-auto rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mb-1">
              <Stethoscope className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-teal-600">{my.procedureCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tindakan</p>
          </div>
          <div>
            <div className="w-8 h-8 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
              <Wallet className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-emerald-600">Rp {my.revenue.toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendapatan</p>
          </div>
        </div>
        {rank > 0 && doctorRows.length > 1 && (
          <div className="px-3 pb-2 text-center">
            <span className="pill pill-info">Peringkat #{rank} dari {doctorRows.length} dokter hari ini</span>
          </div>
        )}
      </div>
    );
  }

  // ===== All doctors mode (Owner/Management) =====
  return (
    <div className="panel">
      <div className="px-3 py-2.5 border-b border-border">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Kinerja Dokter Hari Ini
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Ringkasan otomatis — {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Summary totals */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2.5 bg-muted/30 border-b border-border">
        <div className="text-center">
          <p className="text-lg font-bold text-purple-600">{totals.patients}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Pasien</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-teal-600">{totals.procedureCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Tindakan</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-emerald-600">Rp {totals.revenue.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Pendapatan</p>
        </div>
      </div>

      {/* Per-doctor table */}
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b border-border sticky top-0">
            <tr className="text-left">
              <th className="px-3 py-2 micro-label">#</th>
              <th className="px-3 py-2 micro-label">Dokter</th>
              <th className="px-3 py-2 micro-label hidden sm:table-cell">Spesialisasi</th>
              <th className="px-3 py-2 micro-label text-center">Pasien</th>
              <th className="px-3 py-2 micro-label text-center">Tindakan</th>
              <th className="px-3 py-2 micro-label text-right">Pendapatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {doctorRows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Belum ada pemeriksaan hari ini</td></tr>
            )}
            {doctorRows.map((d, i) => {
              const prof = profileMap[d.doctor_id];
              const spec = prof?.specialization || '-';
              return (
                <tr key={d.doctor_id || d.doctor_name} className="row-hover">
                  <td className="px-3 py-2 text-muted-foreground font-medium">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {d.doctor_name?.[0]?.toUpperCase()}
                      </div>
                      <span className="truncate max-w-[140px]">{d.doctor_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{spec}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="font-medium text-purple-600">{d.patients}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="font-medium text-teal-600">{d.procedureCount}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-600">Rp {d.revenue.toLocaleString('id-ID')}</td>
                </tr>
              );
            })}
          </tbody>
          {doctorRows.length > 0 && (
            <tfoot className="bg-muted/40 border-t-2 border-border">
              <tr>
                <td colSpan={3} className="px-3 py-2.5 font-semibold">Total</td>
                <td className="px-3 py-2.5 text-center font-bold text-purple-600">{totals.patients}</td>
                <td className="px-3 py-2.5 text-center font-bold text-teal-600">{totals.procedureCount}</td>
                <td className="px-3 py-2.5 text-right font-bold text-emerald-600">Rp {totals.revenue.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}