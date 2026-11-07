// @ts-nocheck -- Clinical sidebar combines heterogeneous timeline records.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, Activity, Stethoscope, Pill } from 'lucide-react';

export default function PatientClinicalSidebar({ patientId, patientName }) {
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="panel p-4 text-center text-xs text-muted-foreground">Memuat data pasien…</div>;
  }

  if (!patientId) {
    return <div className="panel p-4 text-center text-xs text-muted-foreground">Pasien walk-in — tidak ada riwayat</div>;
  }

  const age = patient?.birth_date ? Math.floor((new Date() - new Date(patient.birth_date)) / (365 * 24 * 60 * 60 * 1000)) : null;

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
              <span className="text-muted-foreground">Gol. Darah</span>
              <span className="font-medium">{patient.blood_type}</span>
            </div>
          )}
          {patient?.insurance_type && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Asuransi</span>
              <span className="pill pill-info">{patient.insurance_type}</span>
            </div>
          )}
          {patient?.phone && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Telepon</span>
              <span className="font-medium">{patient.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Allergies Alert */}
      {patient?.allergies && (
        <div className="panel border-l-2 border-l-rose-400 bg-rose-50/50">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-rose-700">
              <AlertCircle className="w-3.5 h-3.5" /> Alergi Tercatat
            </p>
            <p className="text-sm font-medium text-rose-700 mt-1">{patient.allergies}</p>
            <p className="text-[10px] text-rose-600 mt-0.5">Perhatikan saat meresep & dispensing</p>
          </div>
        </div>
      )}

      {/* Medical History */}
      <div className="panel">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-xs font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> Riwayat Kunjungan</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">{history.length} kunjungan</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
          {history.length === 0 && (
            <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">Belum ada riwayat</p>
          )}
          {history.slice(0, 8).map(r => (
            <div key={r.id} className="px-3 py-2 text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-[11px] text-muted-foreground">{new Date(r.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {r.doctor_name && <span className="text-[10px] text-muted-foreground">{r.doctor_name}</span>}
              </div>
              {r.diagnosis && <p className="font-medium truncate">{r.diagnosis}</p>}
              {r.chief_complaint && <p className="text-[11px] text-muted-foreground truncate">Keluhan: {r.chief_complaint}</p>}
              {r.procedures && r.procedures.length > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Stethoscope className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{r.procedures.map(p => p.name).join(', ').slice(0, 50)}</span>
                </div>
              )}
              {r.prescriptionItems && r.prescriptionItems.length > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Pill className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{r.prescriptionItems.map(i => i.medicine_name).join(', ').slice(0, 50)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
