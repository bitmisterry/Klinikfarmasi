import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getGrowthChartData, calculateGrowth } from '@/lib/growthChart';
import { TrendingUp, AlertCircle } from 'lucide-react';

export default function GrowthChartView({ patient, records = [] }) {
  const [chartType, setChartType] = useState('wfa'); // wfa or hfa

  const gender = patient?.gender || 'L';
  const chartData = useMemo(() => getGrowthChartData(gender, chartType), [gender, chartType]);

  const patientData = useMemo(() => {
    return records
      .filter(r => r.weight != null || r.height != null)
      .map(r => ({
        age: r.age_months,
        value: chartType === 'wfa' ? r.weight : r.height,
        date: r.visit_date,
      }))
      .sort((a, b) => a.age - b.age);
  }, [records, chartType]);

  const latestRecord = records?.[0];
  const growthResult = latestRecord ? calculateGrowth(gender, latestRecord.age_months, latestRecord.weight, latestRecord.height) : null;

  const unit = chartType === 'wfa' ? 'kg' : 'cm';
  const yLabel = chartType === 'wfa' ? 'Berat Badan (kg)' : 'Tinggi Badan (cm)';

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-primary" />
          Grafik Pertumbuhan (WHO)
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setChartType('wfa')}
            className={`text-xs px-2 py-1 rounded ${chartType === 'wfa' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
          >
            BB/U
          </button>
          <button
            onClick={() => setChartType('hfa')}
            className={`text-xs px-2 py-1 rounded ${chartType === 'hfa' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
          >
            TB/U
          </button>
        </div>
      </div>

      {patient && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="micro-label">Z-Score</p>
            <p className="text-sm font-semibold">{growthResult?.z_score_bb_u ?? '-'}</p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="micro-label">Persentil</p>
            <p className="text-sm font-semibold">{growthResult?.percentile_bb_u ? `${growthResult.percentile_bb_u}%` : '-'}</p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="micro-label">Status Gizi</p>
            <p className={`text-sm font-semibold ${
              growthResult?.nutrition_status === 'Normal' ? 'text-emerald-600' :
              growthResult?.nutrition_status?.includes('Kurus') ? 'text-amber-600' :
              growthResult?.nutrition_status?.includes('Gemuk') || growthResult?.nutrition_status === 'Obesitas' ? 'text-rose-600' : ''
            }`}>
              {growthResult?.nutrition_status || '-'}
            </p>
          </div>
        </div>
      )}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="age" tick={{ fontSize: 10 }} label={{ value: 'Umur (bulan)', position: 'insideBottom', offset: -2, style: { fontSize: 10 } }} />
            <YAxis tick={{ fontSize: 10 }} label={{ value: unit, angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(v, name) => {
                const labels = { p3: 'P3 (-2SD)', p15: 'P15 (-1SD)', p50: 'Median', p85: 'P85 (+1SD)', p97: 'P97 (+2SD)' };
                return [`${Number(v).toFixed(1)} ${unit}`, labels[name] || name];
              }}
              labelFormatter={(l) => `Umur: ${l} bulan`}
            />
            {/* WHO percentile bands */}
            <Line type="monotone" dataKey="p3" stroke="#EF4444" strokeWidth={1} strokeDasharray="4 2" dot={false} />
            <Line type="monotone" dataKey="p15" stroke="#F59E0B" strokeWidth={1} strokeDasharray="2 2" dot={false} />
            <Line type="monotone" dataKey="p50" stroke="#0D9488" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="p85" stroke="#F59E0B" strokeWidth={1} strokeDasharray="2 2" dot={false} />
            <Line type="monotone" dataKey="p97" stroke="#EF4444" strokeWidth={1} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {patientData.length > 0 && (
        <div className="mt-3">
          <p className="micro-label mb-1">Riwayat Pengukuran Pasien</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {patientData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-2 py-1 bg-muted/30 rounded">
                <span className="text-muted-foreground">{d.date} • {d.age} bln</span>
                <span className="font-medium">{d.value} {unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {patientData.length === 0 && patient && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5" />
          Belum ada data pengukuran. Input pengukuran untuk mulai melacak pertumbuhan.
        </div>
      )}
    </div>
  );
}