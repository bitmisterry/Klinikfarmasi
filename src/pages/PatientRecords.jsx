const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { FileText, Pill, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react';

export default function PatientRecords() {
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await db.auth.me();
        const patients = await db.entities.Patient.filter({ user_id: user.id }) || [];
        if (patients.length === 0) { setLoading(false); return; }
        const p = patients[0];
        setPatient(p);
        const [recs, rxs] = await Promise.all([
          db.entities.MedicalRecord.filter({ patient_id: p.id }, '-visit_date', 50) || [],
          db.entities.Prescription.filter({ patient_id: p.id }, '-prescription_date', 50) || [],
        ]);
        setRecords(recs); setPrescriptions(rxs);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (!patient) return <div className="max-w-md mx-auto mt-20 p-6 panel text-center"><p className="text-sm">Akun belum terhubung ke rekam medis. Hubungi admin.</p></div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      <h1 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Rekam Medis Saya</h1>
      <p className="text-xs text-muted-foreground">Riwayat kunjungan, diagnosis, dan resep — {records.length} kunjungan</p>

      {records.length === 0 && (
        <div className="panel p-8 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Belum ada riwayat kunjungan</p>
        </div>
      )}

      <div className="space-y-2">
        {records.map(r => {
          const rx = prescriptions.find(p => p.queue_entry_id === r.queue_entry_id);
          const isOpen = expanded === r.id;
          return (
            <div key={r.id} className="panel overflow-hidden">
              <button onClick={() => setExpanded(isOpen ? null : r.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.diagnosis || 'Kunjungan'}</p>
                  <p className="text-[11px] text-muted-foreground">{r.visit_date} • {r.doctor_name}</p>
                </div>
                {rx && <span className="pill pill-warning"><Pill className="w-2.5 h-2.5" /> Resep</span>}
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                  {r.chief_complaint && <div><p className="micro-label">Keluhan</p><p className="text-xs">{r.chief_complaint}</p></div>}
                  <div className="grid grid-cols-3 gap-2">
                    {r.vital_signs_bp && <div><p className="micro-label">TD</p><p className="text-xs">{r.vital_signs_bp}</p></div>}
                    {r.vital_signs_temp && <div><p className="micro-label">Suhu</p><p className="text-xs">{r.vital_signs_temp}°C</p></div>}
                    {r.vital_signs_pulse && <div><p className="micro-label">Nadi</p><p className="text-xs">{r.vital_signs_pulse} bpm</p></div>}
                  </div>
                  {r.physical_exam && <div><p className="micro-label">Pemeriksaan Fisik</p><p className="text-xs">{r.physical_exam}</p></div>}
                  {r.diagnosis && <div><p className="micro-label">Diagnosis</p><p className="text-xs font-medium">{r.diagnosis}</p></div>}
                  {r.treatment_plan && <div><p className="micro-label">Rencana Terapi</p><p className="text-xs">{r.treatment_plan}</p></div>}
                  {rx && rx.items && rx.items.length > 0 && (
                    <div>
                      <p className="micro-label">Resep ({rx.items.length} item)</p>
                      <div className="space-y-1">
                        {rx.items.map((it, i) => (
                          <div key={i} className="flex items-center gap-2 bg-amber-50/30 rounded px-2 py-1.5 text-xs">
                            <Pill className="w-3 h-3 text-amber-600" />
                            <span className="flex-1 font-medium">{it.medicine_name} {it.strength}</span>
                            <span className="text-muted-foreground">{it.dosage}</span>
                            <span className="text-muted-foreground">{it.quantity}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}