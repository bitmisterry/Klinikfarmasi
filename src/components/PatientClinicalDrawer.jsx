const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { X, FileText, AlertCircle, Pill, Activity, User, Clock } from 'lucide-react';

import RacikanHistory from '@/components/RacikanHistory';

export default function PatientClinicalDrawer({ patientId, patientName, onClose, onCopyRacikan }) {
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    (async () => {
      try {
        const [p, meds, rxs] = await Promise.all([
          db.entities.Patient.get(patientId),
          db.entities.MedicalRecord.filter({ patient_id: patientId }, '-visit_date', 10),
          db.entities.Prescription.filter({ patient_id: patientId }, '-prescription_date', 10),
        ]);
        setPatient(p);
        setRecords(meds || []);
        setPrescriptions(rxs || []);
      } catch {}
      setLoading(false);
    })();
  }, [patientId]);

  const latestRecord = records[0];
  const allMedicines = prescriptions.flatMap(rx => (rx.items || []).map(it => it.medicine_name));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{patientName || patient?.full_name || 'Pasien'}</h3>
              <p className="text-[11px] text-muted-foreground">Rekam Medis Klinis • Apoteker</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : !patientId ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Pasien walk-in — tidak ada rekam medis terdaftar
          </div>
        ) : (
          <div className="pb-4">
            {/* Allergies — critical for apoteker */}
            <div className="px-4 py-3 border-b border-border">
              <p className="micro-label flex items-center gap-1 mb-2"><AlertCircle className="w-3 h-3 text-rose-500" /> Alergi</p>
            {patient?.allergies ? (
              <div className="bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-xs text-rose-700">
                {patient.allergies}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Tidak ada alergi tercatat</p>
            )}
            </div>

            {/* Latest diagnosis */}
            {latestRecord && (
              <div className="px-4 py-3 border-b border-border">
                <p className="micro-label flex items-center gap-1 mb-2"><Activity className="w-3 h-3 text-primary" /> Diagnosis Terkini</p>
                <div className="bg-muted/50 rounded px-2.5 py-2 space-y-1.5">
                  <p className="text-xs font-medium">{latestRecord.diagnosis}</p>
                  {latestRecord.chief_complaint && (
                    <p className="text-[11px] text-muted-foreground">Keluhan: {latestRecord.chief_complaint}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {latestRecord.visit_date} • {latestRecord.doctor_name}
                  </p>
                </div>
              </div>
            )}

            {/* Active medicines from prescriptions */}
            {allMedicines.length > 0 && (
              <div className="px-4 py-3 border-b border-border">
                <p className="micro-label flex items-center gap-1 mb-2"><Pill className="w-3 h-3 text-primary" /> Obat dari Resep</p>
                <div className="space-y-1">
                  {prescriptions.slice(0, 5).map(rx => (
                    <div key={rx.id} className="text-xs">
                      <p className="font-medium text-[11px] text-muted-foreground">{rx.prescription_date} — {rx.doctor_name}</p>
                      {(rx.items || []).map((it, i) => (
                        <p key={i} className="pl-3">• {it.medicine_name} {it.strength} — {it.dosage}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Racikan history */}
            <RacikanHistory patientId={patientId} onCopyToNew={onCopyRacikan} />

            {/* Doctor notes */}
            {latestRecord?.notes && (
              <div className="px-4 py-3 border-b border-border">
                <p className="micro-label flex items-center gap-1 mb-2"><FileText className="w-3 h-3 text-blue-500" /> Catatan Dokter</p>
                <p className="text-xs text-muted-foreground bg-blue-50/50 rounded px-2.5 py-2">{latestRecord.notes}</p>
              </div>
            )}

            {/* Treatment plan */}
            {latestRecord?.treatment_plan && (
              <div className="px-4 py-3 border-b border-border">
                <p className="micro-label mb-1.5">Rencana Terapi</p>
                <p className="text-xs text-muted-foreground">{latestRecord.treatment_plan}</p>
              </div>
            )}

            {/* Full history */}
            {records.length > 1 && (
              <div className="px-4 py-3">
                <p className="micro-label mb-2">Riwayat Kunjungan ({records.length})</p>
                <div className="space-y-1.5">
                  {records.slice(1).map(r => (
                    <div key={r.id} className="text-xs border-l-2 border-border pl-2">
                      <p className="font-medium">{r.diagnosis || 'Tanpa diagnosis'}</p>
                      <p className="text-[11px] text-muted-foreground">{r.visit_date} • {r.doctor_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!latestRecord && allMedicines.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                Belum ada rekam medis untuk pasien ini
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}