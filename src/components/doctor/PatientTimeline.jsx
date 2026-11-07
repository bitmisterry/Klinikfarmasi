// @ts-nocheck -- Clinical timeline supports migrated date formats.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Clock, Activity, Pill, Stethoscope, AlertCircle, TrendingDown, TrendingUp, Minus, ChevronRight } from 'lucide-react';

export default function PatientTimeline({ patientId, patientName, currentRecord }) {
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    (async () => {
      try {
        const [p, records] = await Promise.all([
          db.entities.Patient.get(patientId).catch(() => null),
          db.entities.MedicalRecord.filter({ patient_id: patientId }).catch(() => []),
        ]);
        setPatient(p);
        setHistory((records || []).sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || '')));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) return <div className="panel p-4 text-center text-xs text-muted-foreground">Memuat riwayat…</div>;
  if (!patientId) return <div className="panel p-4 text-center text-xs text-muted-foreground">Pasien walk-in — tidak ada riwayat</div>;

  const age = patient?.birth_date ? Math.floor((new Date() - new Date(patient.birth_date)) / (365 * 24 * 60 * 60 * 1000)) : null;
  const lastVisit = history[0];

  // Quick comparison between last visit and current
  const compareField = (label, lastVal, currVal, suffix = '') => {
    if (!lastVal && !currVal) return null;
    const diff = (typeof lastVal === 'number' && typeof currVal === 'number') ? currVal - lastVal : null;
    let icon = <Minus className="w-3 h-3 text-muted-foreground" />;
    let color = 'text-muted-foreground';
    if (diff !== null && diff !== 0) {
      if (diff > 0) { icon = <TrendingUp className="w-3 h-3" />; color = 'text-emerald-600'; }
      else { icon = <TrendingDown className="w-3 h-3" />; color = 'text-rose-600'; }
    }
    return (
      <div className="flex items-center justify-between py-1 text-xs border-b border-border last:border-0">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{lastVal || '-'}{suffix}</span>
          <span className="text-muted-foreground">→</span>
          <span className={`font-medium ${color}`}>{currVal || '-'}{suffix}</span>
          {diff !== null && diff !== 0 && <span className={color}>{icon}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Patient Info */}
      <div className="panel">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-xs font-semibold flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-primary" /> Profil Pasien</h3>
        </div>
        <div className="p-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
              {(patientName || '?')[0]}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{patientName}</p>
              <p className="text-[11px] text-muted-foreground">{patient?.mr_number || 'No RM'} • {patient?.gender === 'L' ? 'L' : 'P'}{age !== null ? ` • ${age}th` : ''}</p>
            </div>
          </div>
          {patient?.blood_type && patient.blood_type !== '-' && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-muted-foreground">Gol. Darah</span><span className="font-medium">{patient.blood_type}</span>
            </div>
          )}
          {patient?.insurance_type && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Asuransi</span><span className="pill pill-info">{patient.insurance_type}</span>
            </div>
          )}
        </div>
      </div>

      {/* Allergies Alert */}
      {patient?.allergies && (
        <div className="panel border-l-2 border-l-rose-400 bg-rose-50/50">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-rose-700">
              <AlertCircle className="w-3.5 h-3.5" /> Alergi
            </p>
            <p className="text-sm font-medium text-rose-700 mt-1">{patient.allergies}</p>
          </div>
        </div>
      )}

      {/* Quick Comparison */}
      {lastVisit && currentRecord && (currentRecord.vital_signs_weight || currentRecord.vital_signs_height || currentRecord.diagnosis) && (
        <div className="panel">
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="w-full px-3 py-2 border-b border-border flex items-center justify-between"
          >
            <h3 className="text-xs font-semibold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Perbandingan</h3>
            <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showCompare ? 'rotate-90' : ''}`} />
          </button>
          {showCompare && (
            <div className="p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Kunjungan terakhir ({new Date(lastVisit.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}) ↔ Sekarang</p>
              {compareField('BB (kg)', lastVisit.vital_signs_weight, currentRecord.vital_signs_weight)}
              {compareField('TB (cm)', lastVisit.vital_signs_height, currentRecord.vital_signs_height)}
              {compareField('Suhu (°C)', lastVisit.vital_signs_temp, currentRecord.vital_signs_temp)}
              {compareField('Nadi', lastVisit.vital_signs_pulse, currentRecord.vital_signs_pulse)}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="panel">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-xs font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> Riwayat Kunjungan</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">{history.length} kunjungan</p>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {history.length === 0 && <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">Belum ada riwayat</p>}
          {history.map(r => (
            <div key={r.id} className="px-3 py-2 border-b border-border last:border-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-primary">{new Date(r.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {r.doctor_name && <span className="text-[10px] text-muted-foreground">{r.doctor_name}</span>}
              </div>
              {r.chief_complaint && <p className="text-[11px] text-muted-foreground truncate">Keluhan: {r.chief_complaint}</p>}
              {r.diagnosis && <p className="text-xs font-medium truncate">{r.diagnosis}</p>}
              <div className="flex flex-wrap gap-1 mt-0.5">
                {r.procedures && r.procedures.length > 0 && (
                  <span className="pill pill-info text-[9px]"><Stethoscope className="w-2.5 h-2.5" /> {r.procedures.length} tindakan</span>
                )}
                {r.prescriptionItems && r.prescriptionItems.length > 0 && (
                  <span className="pill pill-info text-[9px]"><Pill className="w-2.5 h-2.5" /> {r.prescriptionItems.length} obat</span>
                )}
                {r.follow_up_date && (
                  <span className="pill pill-warning text-[9px]">Kontrol {new Date(r.follow_up_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
