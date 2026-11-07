// @ts-nocheck -- Retention summary accepts legacy sync and async payloads.
import React, { useState, useEffect } from 'react';
import { ShieldAlert, FileText, Archive, Clock, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { getPrescriptionRetentionLog } from '@/lib/pharmacy';
import EmptyState from '@/components/EmptyState';

/**
 * Log Retensi Resep — pelacakan retensi arsip resep.
 * Narkotika/Psikotropika = 5 tahun, Standar = 2 tahun.
 */
export default function PrescriptionRetentionLog({ month }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | Narkotika | Standar | due

  useEffect(() => {
    setLoading(true);
    getPrescriptionRetentionLog(month).then(r => {
      setData(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [month]);

  const handleExport = () => {
    if (!data || data.entries.length === 0) return;
    const csv = [
      'No. Resep,Tanggal,Pasien,Dokter,Sumber,Kategori Retensi,Masa Retensi (Tahun),Akhir Retensi,Status,Hari Lagi',
      ...data.entries.map(e =>
        `"${e.prescription_number || '-'}","${e.prescription_date || '-'}","${e.patient_name || '-'}","${e.doctor_name || '-'}","${e.source || '-'}","${e.retention_category}",${e.retention_years},"${e.retention_end_date || '-'}","${e.status}",${e.days_until_destruction ?? '-'}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Log-Retensi-Resep-${month || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = data ? data.entries.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'due') return e.status === 'Siap Musnah' || e.status === 'Mendekati Jatuh Tempo';
    return e.retention_category === filter;
  }) : [];

  const statusPill = (status) => {
    if (status === 'Siap Musnah') return 'pill-critical';
    if (status === 'Mendekati Jatuh Tempo') return 'pill-warning';
    return 'pill-success';
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="panel px-3 py-2">
          <p className="micro-label flex items-center gap-1"><FileText className="w-3 h-3" /> Total Resep</p>
          <p className="text-base font-semibold">{data ? data.entries.length : 0}</p>
        </div>
        <div className="panel px-3 py-2">
          <p className="micro-label flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-rose-600" /> Retensi Narkotik</p>
          <p className="text-base font-semibold text-rose-600">{data ? data.narcotic_count : 0}</p>
          <p className="text-[10px] text-muted-foreground">5 tahun</p>
        </div>
        <div className="panel px-3 py-2">
          <p className="micro-label flex items-center gap-1"><Archive className="w-3 h-3 text-blue-600" /> Retensi Standar</p>
          <p className="text-base font-semibold text-blue-600">{data ? data.standard_count : 0}</p>
          <p className="text-[10px] text-muted-foreground">2 tahun</p>
        </div>
        <div className="panel px-3 py-2">
          <p className="micro-label flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" /> Siap Musnah</p>
          <p className="text-base font-semibold text-amber-600">{data ? data.due_destruction_count : 0}</p>
        </div>
      </div>

      {/* Filter & Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {[
            { key: 'all', label: 'Semua' },
            { key: 'Narkotika', label: 'Narkotik (5th)' },
            { key: 'Standar', label: 'Standar (2th)' },
            { key: 'due', label: 'Jatuh Tempo' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {data && data.entries.length > 0 && (
          <button onClick={handleExport} className="flex items-center gap-1 text-xs border border-border px-2 py-1.5 rounded hover:bg-muted">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-8">Memuat log retensi…</p>
      ) : !data || filtered.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Tidak ada resep"
          description={month ? `Tidak ada resep pada ${month}` : 'Belum ada resep tercatat'}
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 micro-label">No. Resep</th>
                <th className="px-3 py-2 micro-label hidden sm:table-cell">Tanggal</th>
                <th className="px-3 py-2 micro-label">Pasien</th>
                <th className="px-3 py-2 micro-label hidden md:table-cell">Dokter</th>
                <th className="px-3 py-2 micro-label">Kategori</th>
                <th className="px-3 py-2 micro-label hidden lg:table-cell">Akhir Retensi</th>
                <th className="px-3 py-2 micro-label">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(e => (
                <tr key={e.id} className="row-hover">
                  <td className="px-3 py-2 font-mono text-primary">{e.prescription_number || '-'}</td>
                  <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{e.prescription_date || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="font-medium truncate max-w-[120px]">{e.patient_name || '-'}</span>
                      {e.source === 'Eksternal' && <span className="pill pill-info text-[10px]">Eks</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground truncate max-w-[100px]">{e.doctor_name || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`pill ${e.retention_category === 'Narkotika' ? 'pill-critical' : 'pill-info'}`}>
                      {e.retention_category === 'Narkotika' ? <ShieldAlert className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                      {e.retention_years}th
                    </span>
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">
                    {e.retention_end_date || '-'}
                    {e.days_until_destruction != null && e.days_until_destruction > 0 && (
                      <span className="text-[10px] block text-muted-foreground">({e.days_until_destruction} hari lagi)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`pill ${statusPill(e.status)}`}>
                      {e.status === 'Siap Musnah' ? <AlertTriangle className="w-3 h-3" /> : e.status === 'Mendekati Jatuh Tempo' ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
