const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { FileText, Calendar, CreditCard, Pill, ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PatientPortal() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await db.auth.me();
        const patients = await db.entities.Patient.filter({ user_id: user.id }) || [];
        if (patients.length === 0) { setLoading(false); return; }
        const p = patients[0];
        setPatient(p);
        const [recs, rxs, txns, appts] = await Promise.all([
          db.entities.MedicalRecord.filter({ patient_id: p.id }, '-visit_date', 5) || [],
          db.entities.Prescription.filter({ patient_id: p.id }, '-prescription_date', 5) || [],
          db.entities.Transaction.filter({ patient_id: p.id }, '-transaction_date', 10) || [],
          db.entities.Appointment.filter({ patient_id: p.id, status: 'Terjadwalkan' }, 'appointment_date', 5) || [],
        ]);
        setRecords(recs); setPrescriptions(rxs); setTransactions(txns); setAppointments(appts);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const unpaidBills = transactions.filter(t => t.payment_status === 'Belum Bayar');
  const lastVisit = records[0];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  if (!patient) return (
    <div className="max-w-md mx-auto mt-20 p-6 panel text-center">
      <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
      <h2 className="text-sm font-semibold mb-1">Akun belum terhubung ke rekam medis</h2>
      <p className="text-xs text-muted-foreground">Hubungi admin klinik untuk menghubungkan akun Anda dengan data pasien.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="panel-accent p-4">
        <h1 className="text-lg font-semibold">Selamat datang, {patient.full_name}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">No. RM: {patient.mr_number || '-'} • {patient.insurance_type}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => navigate('/portal/records')} className="panel p-3 text-left hover:border-primary/40 transition-colors">
          <FileText className="w-5 h-5 text-blue-600 mb-1.5" />
          <p className="text-xs text-muted-foreground">Kunjungan</p>
          <p className="text-lg font-semibold">{records.length}</p>
        </button>
        <button onClick={() => navigate('/portal/records')} className="panel p-3 text-left hover:border-primary/40 transition-colors">
          <Pill className="w-5 h-5 text-amber-600 mb-1.5" />
          <p className="text-xs text-muted-foreground">Resep</p>
          <p className="text-lg font-semibold">{prescriptions.length}</p>
        </button>
        <button onClick={() => navigate('/portal/billing')} className="panel p-3 text-left hover:border-primary/40 transition-colors">
          <CreditCard className="w-5 h-5 text-rose-600 mb-1.5" />
          <p className="text-xs text-muted-foreground">Tagihan</p>
          <p className="text-lg font-semibold">{unpaidBills.length}</p>
        </button>
        <button onClick={() => navigate('/portal/booking')} className="panel p-3 text-left hover:border-primary/40 transition-colors">
          <Calendar className="w-5 h-5 text-emerald-600 mb-1.5" />
          <p className="text-xs text-muted-foreground">Janji Temu</p>
          <p className="text-lg font-semibold">{appointments.length}</p>
        </button>
      </div>

      {lastVisit && (
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Kunjungan Terakhir</h2>
          </div>
          <div className="text-xs space-y-1">
            <p><span className="text-muted-foreground">Tanggal:</span> {lastVisit.visit_date}</p>
            <p><span className="text-muted-foreground">Dokter:</span> {lastVisit.doctor_name}</p>
            <p><span className="text-muted-foreground">Diagnosis:</span> {lastVisit.diagnosis}</p>
            {lastVisit.treatment_plan && <p><span className="text-muted-foreground">Tindakan:</span> {lastVisit.treatment_plan}</p>}
          </div>
          <button onClick={() => navigate('/portal/records')} className="text-xs text-primary font-medium flex items-center gap-1 mt-2">
            Lihat semua rekam medis <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {appointments.length > 0 && (
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold">Janji Temu Mendatang</h2>
          </div>
          <div className="space-y-2">
            {appointments.map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-emerald-50/50 rounded p-2.5">
                <div className="text-center px-2">
                  <p className="text-sm font-bold text-emerald-700">{new Date(a.appointment_date).getDate()}</p>
                  <p className="text-[10px] text-emerald-600">{new Date(a.appointment_date).toLocaleDateString('id-ID', { month: 'short' })}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">{a.doctor_name}</p>
                  <p className="text-[11px] text-muted-foreground">{a.poli} • {a.time_slot}</p>
                </div>
                <span className="pill pill-success">{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {unpaidBills.length > 0 && (
        <div className="panel p-4 border-l-2 border-l-rose-400">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-rose-600" />
            <h2 className="text-sm font-semibold text-rose-700">Tagihan Belum Dibayar ({unpaidBills.length})</h2>
          </div>
          <div className="space-y-2">
            {unpaidBills.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-rose-50/50 rounded p-2.5">
                <div>
                  <p className="text-xs font-medium">{t.invoice_number}</p>
                  <p className="text-[11px] text-muted-foreground">{t.type} • {t.transaction_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-rose-600">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                  <button onClick={() => navigate('/portal/billing')} className="text-[11px] text-primary font-medium">Bayar →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}