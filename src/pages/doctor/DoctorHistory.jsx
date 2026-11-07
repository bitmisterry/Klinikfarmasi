const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { History, Stethoscope, Pill, Calendar, ClipboardList, ChevronLeft, ChevronDown, FileText } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/doctorContext';
import EmptyState from '@/components/EmptyState';

export default function DoctorHistory() {
  const { user } = useAuth();
  const { doctorUserId, loading: ctxLoading } = useDoctorContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [filteredPatient, setFilteredPatient] = useState(null);
  const [patientIndex, setPatientIndex] = useState({});
  const [expandedRecordId, setExpandedRecordId] = useState(null);
  const [loading, setLoading] = useState(true);

  const doctorId = doctorUserId;
  const patientId = searchParams.get('patient');

  useEffect(() => { if (doctorId) load(); }, [patientId, doctorId]);

  const load = async () => {
    try {
      let recs = await db.entities.MedicalRecord.filter({ doctor_id: doctorId }, '-visit_date', 100) || [];
      if (patientId) {
        recs = recs.filter(r => r.patient_id === patientId);
        try {
          setFilteredPatient(await db.entities.Patient.get(patientId));
        } catch {}
      }
      const patientIds = [...new Set(recs.map((record) => record.patient_id).filter(Boolean))];
      const patientRows = await Promise.all(patientIds.map((id) => db.entities.Patient.get(id).catch(() => null)));
      setPatientIndex(Object.fromEntries(patientRows.filter(Boolean).map((patient) => [patient.id, patient])));
      setRecords(recs);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Group by date
  const grouped = records.reduce((acc, r) => {
    const date = r.visit_date || 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(r);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const followUp = (record) => {
    if (!record.follow_up_date) return null;
    if (record.follow_up_status) return record.follow_up_status;
    const date = String(record.follow_up_date).slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return date < today ? 'Terlewat' : date === today ? 'Menunggu' : 'Terjadwal';
  };

  if (ctxLoading || loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-3 lg:p-5 space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        {patientId && (
          <button onClick={() => navigate('/doctor/history')} className="p-1.5 hover:bg-muted rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Riwayat & Follow-up</h1>
          {filteredPatient && <p className="text-xs text-muted-foreground mt-0.5">{filteredPatient.full_name} • {filteredPatient.mr_number}</p>}
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={History} title="Belum ada riwayat" description="Riwayat pemeriksaan akan muncul di sini" />
      ) : (
        <div className="space-y-3">
          {dates.map(date => (
            <div key={date} className="panel">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold">{new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="text-[10px] text-muted-foreground">{grouped[date].length} pemeriksaan</p>
              </div>
              <div className="divide-y divide-border">
                {grouped[date].map(r => {
                  const patientInfo = patientIndex[r.patient_id];
                  const isExpanded = expandedRecordId === r.id;
                  const status = followUp(r);
                  return (
                  <div key={r.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Stethoscope className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="text-sm font-medium truncate">{r.patient_name}</p>
                          <span className="text-[10px] font-mono text-muted-foreground">{patientInfo?.mr_number || r.mr_number || 'RM tidak tersedia'}</span>
                        </div>
                        {r.chief_complaint && <p className="text-[11px] text-muted-foreground truncate">Keluhan: {r.chief_complaint}</p>}
                        {r.diagnosis && <p className="text-xs font-medium mt-0.5">{r.diagnosis} {r.diagnosis_code && <span className="text-muted-foreground">({r.diagnosis_code})</span>}</p>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.procedures && r.procedures.length > 0 && (
                            <button type="button" onClick={() => setExpandedRecordId(isExpanded ? null : r.id)} className="pill pill-info text-[9px] hover:ring-1 hover:ring-primary" aria-expanded={isExpanded}><ClipboardList className="w-2.5 h-2.5" /> {r.procedures.length} tindakan</button>
                          )}
                          {r.prescriptionItems && r.prescriptionItems.length > 0 && (
                            <span className="pill pill-info text-[9px]"><Pill className="w-2.5 h-2.5" /> {r.prescriptionItems.length} obat</span>
                          )}
                          {r.follow_up_date && (
                            <span className={`pill text-[9px] ${status === 'Selesai' ? 'pill-success' : status === 'Terlewat' ? 'pill-critical' : status === 'Menunggu' ? 'pill-warning' : 'pill-info'}`}><Calendar className="w-2.5 h-2.5" /> Kontrol {new Date(r.follow_up_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · {status}</span>
                          )}
                        </div>
                        <button type="button" onClick={() => setExpandedRecordId(isExpanded ? null : r.id)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover" aria-expanded={isExpanded}>
                          <FileText className="h-3 w-3" /> {isExpanded ? 'Sembunyikan detail pemeriksaan' : 'Lihat detail pemeriksaan'} <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                          <div className="mt-2 grid gap-2 rounded-md border border-border bg-muted/20 p-2.5 text-[11px] sm:grid-cols-2">
                            <p className="sm:col-span-2"><span className="font-medium">Ringkasan pemeriksaan:</span> {r.physical_exam || r.subjective || 'Tidak ada ringkasan pemeriksaan.'}</p>
                            <p><span className="font-medium">Tindakan:</span> {(r.procedures || []).map((item) => item.name || item).filter(Boolean).join(', ') || 'Tidak ada tindakan'}</p>
                            <p><span className="font-medium">Resep:</span> {(r.prescriptionItems || []).map((item) => item.medicine_name || item.name).filter(Boolean).join(', ') || 'Tidak ada resep'}</p>
                            {r.treatment_plan && <p className="sm:col-span-2"><span className="font-medium">Rencana terapi:</span> {r.treatment_plan}</p>}
                            {r.follow_up_date && <p className="sm:col-span-2"><span className="font-medium">Kontrol berikutnya:</span> {new Date(r.follow_up_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {status}{r.follow_up_instructions ? ` — ${r.follow_up_instructions}` : ''}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ); })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
