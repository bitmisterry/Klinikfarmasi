const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Stethoscope, ClipboardList, Users } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import ModuleStatHeader from '@/components/ModuleStatHeader';

export default function DoctorJasa() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const doctorId = user?.id;
  const doctorName = user?.full_name || 'Dokter';

  useEffect(() => {
    (async () => {
      try {
        const profiles = await db.entities.DoctorProfile.filter({ user_id: doctorId }).catch(() => []);
        setProfile((profiles || [])[0]);
      } catch {}
      loadRemuneration();
    })();
  }, [period, doctorId]);

  const loadRemuneration = async () => {
    const now = new Date();
    let start, end;
    if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (period === 'lastmonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    }

    try {
      const res = await db.functions.invoke('calculateDoctorRemuneration', {
        doctor_id: doctorId,
        doctor_name: doctorName,
        period_start: start,
        period_end: end,
      });
      setData(res.data || res);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  const metrics = data?.metrics || {};
  const remuneration = data?.remuneration || 0;

  return (
    <div className="p-3 lg:p-5 space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Jasa Saya</h1>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="px-2 py-1.5 border border-border rounded text-xs">
          <option value="month">Bulan Ini</option>
          <option value="lastmonth">Bulan Lalu</option>
          <option value="year">Tahun Ini</option>
        </select>
      </div>

      {profile && (
        <div className="panel px-3 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Skema Remunerasi</span>
            <span className="font-medium">{profile.remuneration_scheme}</span>
          </div>
        </div>
      )}

      <ModuleStatHeader stats={[
        { icon: Wallet, label: 'Total Jasa', value: `Rp ${remuneration.toLocaleString('id-ID')}`, color: 'text-emerald-600' },
        { icon: Stethoscope, label: 'Konsultasi', value: metrics.consultations || 0, color: 'text-blue-600' },
        { icon: ClipboardList, label: 'Tindakan', value: metrics.tindakan_count || 0, color: 'text-teal-600' },
        { icon: Users, label: 'Pasien Unik', value: metrics.unique_patients || 0, color: 'text-purple-600' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Rincian Aktivitas</h3>
          </div>
          <div className="p-3 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Konsultasi</span><span className="font-medium">{metrics.consultations || 0}x</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tindakan dilakukan</span><span className="font-medium">{metrics.tindakan_count || 0}x</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total nilai tindakan</span><span className="font-medium">Rp {(metrics.tindakan_total || 0).toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pasien unik</span><span className="font-medium">{metrics.unique_patients || 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Follow-up terjadwal</span><span className="font-medium">{metrics.follow_ups || 0}</span></div>
          </div>
        </div>

        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Perhitungan Jasa</h3>
          </div>
          <div className="p-3 space-y-2 text-xs">
            {data?.breakdown && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Skema</span><span className="font-medium">{data.breakdown.scheme}</span></div>
                {data.breakdown.consultations !== undefined && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{data.breakdown.consultations} konsultasi × Rp {(data.breakdown.rate || 0).toLocaleString('id-ID')}</span><span className="font-medium">Rp {remuneration.toLocaleString('id-ID')}</span></div>
                )}
                {data.breakdown.tindakan_total !== undefined && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{data.breakdown.percent}% × Rp {(data.breakdown.tindakan_total || 0).toLocaleString('id-ID')}</span><span className="font-medium">Rp {remuneration.toLocaleString('id-ID')}</span></div>
                )}
                {data.breakdown.tindakan_count !== undefined && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{data.breakdown.tindakan_count} tindakan × Rp {(data.breakdown.rate || 0).toLocaleString('id-ID')}</span><span className="font-medium">Rp {remuneration.toLocaleString('id-ID')}</span></div>
                )}
                {data.breakdown.consult_part !== undefined && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Bagian konsultasi</span><span className="font-medium">Rp {(data.breakdown.consult_part || 0).toLocaleString('id-ID')}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Bagian tindakan</span><span className="font-medium">Rp {(data.breakdown.tindakan_part || 0).toLocaleString('id-ID')}</span></div>
                  </>
                )}
              </>
            )}
            <div className="flex justify-between pt-2 border-t border-border"><span className="font-semibold">Total Jasa</span><span className="font-bold text-emerald-600 text-sm">Rp {remuneration.toLocaleString('id-ID')}</span></div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Perhitungan otomatis berdasarkan aktivitas tercatat. Detail lengkap tersedia di Finance/Owner.
      </p>
    </div>
  );
}