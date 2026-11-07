const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { X, User, AlertTriangle, Pill, FileText, Clock } from 'lucide-react';

/**
 * Drawer ringan untuk akses cepat rekam medis pasien dari layar pelayanan resep.
 * Menampilkan: alergi, MR number, riwayat resep/obat rutin terbaru.
 */
export default function PatientQuickAccessDrawer({ patientId, patientName, onClose }) {
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [visits, setVisits] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;
    (async () => {
      try {
        const [p, meds, visitRows, rxns] = await Promise.all([
          db.entities.Patient.get(patientId),
          db.entities.MedicalRecord.filter({ patient_id: patientId }, '-visit_date', 5),
          db.entities.QueueEntry.filter({ patient_id: patientId }, '-visit_date', 10),
          db.entities.Prescription.filter({ patient_id: patientId }, '-prescription_date', 5),
        ]);
        setPatient(p);
        setRecords(meds || []);
        setVisits(visitRows || []);
        setPrescriptions(rxns || []);
      } catch {}
      setLoading(false);
    })();
  }, [patientId]);

  // Collect obat rutin from latest prescriptions
  const obatRutin = React.useMemo(() => {
    const meds = [];
    const seen = new Set();
    for (const rx of prescriptions) {
      for (const it of (rx.items || [])) {
        const key = it.medicine_id || it.medicine_name;
        if (!seen.has(key)) {
          seen.add(key);
          meds.push({ name: it.medicine_name, dosage: it.dosage, date: rx.prescription_date });
        }
      }
    }
    return meds.slice(0, 8);
  }, [prescriptions]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Rekam Medis Pasien
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Patient Info */}
            <div className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{patient?.full_name || patientName}</p>
                  <p className="text-[11px] text-muted-foreground">RM: {patient?.mr_number || '-'} • {patient?.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                </div>
              </div>
              {patient?.birth_date && (
                <p className="text-[11px] text-muted-foreground">Lahir: {patient.birth_date}</p>
              )}
            </div>

            {/* Allergies */}
            <div className="panel p-3">
              <p className="micro-label mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-500" /> Alergi</p>
              {patient?.allergies ? (
                <div className="bg-rose-50 border border-rose-200 rounded px-2 py-1.5 text-xs text-rose-700">
                  {patient.allergies}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Tidak ada alergi tercatat</p>
              )}
            </div>

            {/* Obat Rutin */}
            <div className="panel p-3">
              <p className="micro-label mb-2 flex items-center gap-1"><Pill className="w-3 h-3 text-primary" /> Obat Rutin (Resep Terbaru)</p>
              {obatRutin.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada riwayat obat</p>
              ) : (
                <div className="space-y-1">
                  {obatRutin.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border last:border-0">
                      <Pill className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 font-medium truncate">{m.name}</span>
                      {m.dosage && <span className="text-muted-foreground text-[11px]">{m.dosage}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Riwayat Kunjungan */}
            <div className="panel p-3">
              <p className="micro-label mb-2 flex items-center gap-1"><FileText className="w-3 h-3 text-primary" /> Kunjungan Terakhir</p>
              {records.length === 0 && visits.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada kunjungan</p>
              ) : (
                <div className="space-y-2">
                  {visits.slice(0, 5).map((visit) => (
                    <div key={`visit-${visit.id}`} className="text-xs border-b border-border last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{visit.visit_date || visit.created_date?.slice(0, 10) || 'Tanggal belum tersedia'}</span>
                        <span className="text-muted-foreground ml-auto">{visit.doctor_name || ''}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {visit.status || 'Kunjungan tercatat'}{visit.complaint ? ` • ${visit.complaint}` : ''}
                      </p>
                    </div>
                  ))}
                  {records.map((r) => (
                    <div key={`record-${r.id}`} className="text-xs border-b border-border last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{r.visit_date}</span>
                        <span className="text-muted-foreground ml-auto">{r.doctor_name || ''}</span>
                      </div>
                      {r.diagnosis && <p className="text-[11px] text-muted-foreground">Diagnosis: {r.diagnosis}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
