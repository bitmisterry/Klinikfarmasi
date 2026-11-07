// @ts-nocheck -- SIPNAP rows vary by controlled-drug report category.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, FileText, Download, Pill, TrendingUp, Archive, Table, List } from 'lucide-react';

import { getSipnapMonthlyRecap } from '@/lib/pharmacy';
import EmptyState from '@/components/EmptyState';
import PrescriptionRetentionLog from './PrescriptionRetentionLog';

/**
 * SIPNAP Foundation: rekap bulanan transaksi narkotika/psikotropika
 * + log retensi resep (Narkotika 5th, Standar 2th).
 */
export default function SipnapReport() {
  const [medicines, setMedicines] = useState([]);
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('recap');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    db.entities.Medicine.list().then(m => {
      setMedicines(m || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'recap') return;
    setLoading(true);
    getSipnapMonthlyRecap(month).then(r => {
      setRecap(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [month, tab]);

  const narcoticMeds = useMemo(() => (medicines || []).filter(m => m.category === 'Narkotika/Psikotropika'), [medicines]);

  const handleExportRecap = () => {
    if (!recap || recap.items.length === 0) return;
    const csv = [
      'Jenis Obat,Bentuk Sediaan,Kekuatan,Jumlah Transaksi,Total Quantity,Total Nilai (Rp)',
      ...recap.items.map(i => `"${i.medicine_name}","${i.form || '-'}","${i.strength || '-'}",${i.transaction_count},${i.quantity},${i.total}`),
      `"TOTAL","","","",${recap.items.reduce((s, i) => s + i.transaction_count, 0)},${recap.total_qty},${recap.total_value}`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIPNAP-Rekap-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportLines = () => {
    if (!recap || recap.lines.length === 0) return;
    const csv = [
      'Tanggal,No. Resep,No. Invoice,Nama Obat,Bentuk,Kekuatan,Jml Keluar,Satuan,Sisa Stok,Pasien,Dokter',
      ...recap.lines.map(l => `"${l.date}","${l.prescription_number}","${l.invoice_number}","${l.medicine_name}","${l.form || '-'}","${l.strength || '-'}",${l.quantity_out},"${l.unit || '-'}",${l.stock_remaining},"${l.patient_name}","${l.doctor_name}"`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIPNAP-Detail-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" /> SIPNAP — Rekap Narkotika & Psikotropika
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Rekap bulanan transaksi narkotika/psikotropika + log retensi arsip resep. Akses terbatas untuk apoteker & admin.
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-2 py-1.5 border border-border rounded text-xs"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { key: 'recap', label: 'Rekap Bulanan', icon: Table },
          { key: 'lines', label: 'Detail Transaksi', icon: List },
          { key: 'retention', label: 'Log Retensi Resep', icon: Archive },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Recap Summary Tab */}
      {tab === 'recap' && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="panel px-3 py-2">
              <p className="micro-label flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-rose-600" /> Jenis Narkotik Aktif</p>
              <p className="text-base font-semibold text-rose-600">{narcoticMeds.length}</p>
            </div>
            <div className="panel px-3 py-2">
              <p className="micro-label flex items-center gap-1"><Pill className="w-3 h-3" /> Total Transaksi</p>
              <p className="text-base font-semibold text-amber-600">{recap ? recap.items.reduce((s, i) => s + i.transaction_count, 0) : 0}</p>
            </div>
            <div className="panel px-3 py-2">
              <p className="micro-label flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Total Quantity</p>
              <p className="text-base font-semibold text-primary">{recap ? recap.total_qty : 0}</p>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Memuat rekap…</p>
          ) : !recap || recap.items.length === 0 ? (
            <EmptyState icon={FileText} title="Tidak ada transaksi narkotik" description={`Tidak ada transaksi obat narkotika/psikotropika pada ${month}`} />
          ) : (
            <div className="panel">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <p className="text-xs font-medium">Rekap Periode: {month}</p>
                <button onClick={handleExportRecap} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Jenis Obat</th>
                      <th className="px-3 py-2 font-medium hidden sm:table-cell">Bentuk</th>
                      <th className="px-3 py-2 font-medium hidden md:table-cell">Kekuatan</th>
                      <th className="px-3 py-2 font-medium text-center">Jml Transaksi</th>
                      <th className="px-3 py-2 font-medium text-right">Total Qty</th>
                      <th className="px-3 py-2 font-medium text-right">Total Nilai (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recap.items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium flex items-center gap-1.5">
                          <ShieldAlert className="w-3 h-3 text-rose-500" /> {item.medicine_name}
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{item.form || '-'}</td>
                        <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{item.strength || '-'}</td>
                        <td className="px-3 py-2 text-center">{item.transaction_count}</td>
                        <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{item.total.toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 font-semibold">
                    <tr>
                      <td className="px-3 py-2" colSpan={4}>TOTAL</td>
                      <td className="px-3 py-2 text-right">{recap.total_qty}</td>
                      <td className="px-3 py-2 text-right text-primary">Rp {recap.total_value.toLocaleString('id-ID')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-medium flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Master Obat Narkotika/Psikotropika ({narcoticMeds.length})
              </p>
            </div>
            {narcoticMeds.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Tidak ada obat golongan narkotik terdaftar</p>
            ) : (
              <div className="divide-y divide-border max-h-48 overflow-y-auto">
                {narcoticMeds.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <Pill className="w-3 h-3 text-rose-500 shrink-0" />
                    <span className="font-medium flex-1 truncate">{m.name}</span>
                    <span className="text-muted-foreground">{m.active_substance} {m.strength}</span>
                    <span className={`pill ${(m.stock_on_hand || 0) <= 0 ? 'pill-critical' : (m.stock_on_hand || 0) <= (m.min_stock || 0) ? 'pill-warning' : 'pill-success'}`}>
                      Stok: {m.stock_on_hand || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail Lines Tab — SIPNAP format */}
      {tab === 'lines' && (
        <>
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Memuat detail transaksi…</p>
          ) : !recap || recap.lines.length === 0 ? (
            <EmptyState icon={List} title="Tidak ada detail transaksi" description={`Tidak ada transaksi narkotika/psikotropika pada ${month}`} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">{recap.lines.length} baris transaksi narkotik • Periode {month}</p>
                <button onClick={handleExportLines} className="flex items-center gap-1 text-xs border border-border px-2 py-1.5 rounded hover:bg-muted">
                  <Download className="w-3.5 h-3.5" /> Export Detail CSV
                </button>
              </div>
              <div className="panel overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Tanggal</th>
                      <th className="px-2 py-2 font-medium">No. Resep</th>
                      <th className="px-2 py-2 font-medium">Nama Obat</th>
                      <th className="px-2 py-2 font-medium hidden md:table-cell">Bentuk</th>
                      <th className="px-2 py-2 font-medium hidden lg:table-cell">Kekuatan</th>
                      <th className="px-2 py-2 font-medium text-right">Jml Keluar</th>
                      <th className="px-2 py-2 font-medium hidden sm:table-cell">Pasien</th>
                      <th className="px-2 py-2 font-medium hidden md:table-cell">Dokter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recap.lines.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{l.date}</td>
                        <td className="px-2 py-1.5 font-mono text-primary whitespace-nowrap">{l.prescription_number}</td>
                        <td className="px-2 py-1.5 font-medium flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate max-w-[140px]">{l.medicine_name}</span>
                        </td>
                        <td className="px-2 py-1.5 hidden md:table-cell text-muted-foreground">{l.form || '-'}</td>
                        <td className="px-2 py-1.5 hidden lg:table-cell text-muted-foreground">{l.strength || '-'}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{l.quantity_out} <span className="text-muted-foreground font-normal">{l.unit}</span></td>
                        <td className="px-2 py-1.5 hidden sm:table-cell truncate max-w-[100px]">{l.patient_name}</td>
                        <td className="px-2 py-1.5 hidden md:table-cell text-muted-foreground truncate max-w-[100px]">{l.doctor_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Retention Log Tab */}
      {tab === 'retention' && <PrescriptionRetentionLog month={month} />}
    </div>
  );
}
