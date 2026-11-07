// @ts-nocheck -- Timeline combines multiple persisted entity shapes.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import {
  X, Phone, MapPin, AlertCircle, Calendar, Wallet, Activity, FileText,
  Receipt, Clock, Stethoscope, Pill, Edit2, User, TrendingUp, ClipboardList, CreditCard
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

const TABS = [
  { k: 'overview', l: 'Ringkasan', icon: Activity },
  { k: 'medical', l: 'Rekam Medis', icon: Stethoscope },
  { k: 'prescriptions', l: 'Resep', icon: FileText },
  { k: 'transactions', l: 'Transaksi', icon: Receipt },
];

export default function PatientDetailDrawer({ patient, onClose, onEdit }) {
  const { user } = useAuth();
  const clinicRole = getClinicRole(user);
  const isFrontOffice = clinicRole === 'Front Office';
  const isDoctor = clinicRole.startsWith('Dokter');
  const visibleTabs = TABS.filter((item) => {
    if (isFrontOffice) return item.k === 'overview';
    if (isDoctor) return item.k !== 'transactions';
    return true;
  });
  const [tab, setTab] = useState('overview');
  const [records, setRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patient) return;
    const load = async () => {
      setLoading(true);
      try {
        const [meds, rxns, txns, queue] = await Promise.all([
          db.entities.MedicalRecord.filter({ patient_id: patient.id }).catch(() => []),
          db.entities.Prescription.filter({ patient_id: patient.id }).catch(() => []),
          db.entities.Transaction.filter({ patient_id: patient.id }).catch(() => []),
          db.entities.QueueEntry.filter({ patient_id: patient.id }).catch(() => []),
        ]);
        setRecords((meds || []).sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || '')));
        setPrescriptions((rxns || []).sort((a, b) => (b.prescription_date || '').localeCompare(a.prescription_date || '')));
        setTransactions((txns || []).sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || '')));
        setVisits((queue || []).sort((a, b) => (b.visit_date || b.created_date || '').localeCompare(a.visit_date || a.created_date || '')));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [patient]);

  if (!patient) return null;

  const age = patient.birth_date ? Math.floor((new Date() - new Date(patient.birth_date)) / (365 * 24 * 60 * 60 * 1000)) : null;
  const totalSpent = transactions.filter(t => t.payment_status === 'Lunas').reduce((s, t) => s + (t.total || 0), 0);
  const lastVisit = visits[0];
  const firstVisit = visits[visits.length - 1];
  const unpaidBills = transactions.filter(t => t.payment_status === 'Belum Bayar').reduce((s, t) => s + (t.total || 0), 0);

  // Combined timeline
  const timeline = [
    ...records.map(r => ({ type: 'medical', date: r.visit_date, data: r })),
    ...prescriptions.map(p => ({ type: 'prescription', date: p.prescription_date, data: p })),
    ...transactions.filter(t => t.payment_status === 'Lunas').map(t => ({ type: 'transaction', date: t.transaction_date, data: t })),
    ...visits.map(q => ({ type: 'visit', date: q.visit_date || q.created_date, data: q })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 15);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground px-4 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-semibold">
                {(patient.full_name || '')[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{patient.full_name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">{patient.mr_number || 'No RM'}</span>
                  <span className="text-xs opacity-90">{patient.gender === 'L' ? 'Laki-laki' : 'Perempuan'}{age !== null ? ` • ${age} thn` : ''}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onEdit && (
                <button onClick={() => onEdit(patient)} className="p-1.5 hover:bg-white/20 rounded" title="Edit">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {patient.allergies && (
            <div className="mt-2 flex items-center gap-1.5 bg-rose-400/20 rounded px-2 py-1 text-xs">
              <AlertCircle className="w-3.5 h-3.5" /> Alergi: <strong>{patient.allergies}</strong>
            </div>
          )}
        </div>

        {/* CRM Summary Cards */}
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <CRMMetric icon={ClipboardList} label="Total Kunjungan" value={visits.length} color="text-blue-600 bg-blue-50" />
            {!isFrontOffice && !isDoctor && <CRMMetric icon={Wallet} label="Total Belanja" value={`Rp ${(totalSpent / 1000).toFixed(0)}k`} color="text-emerald-600 bg-emerald-50" />}
            <CRMMetric icon={Calendar} label="Kunjungan Terakhir" value={lastVisit ? new Date(lastVisit.visit_date || lastVisit.created_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'} color="text-amber-600 bg-amber-50" />
            <CRMMetric icon={TrendingUp} label="Pasien Sejak" value={firstVisit ? new Date(firstVisit.visit_date || firstVisit.created_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} color="text-purple-600 bg-purple-50" />
          </div>
          {!isFrontOffice && !isDoctor && unpaidBills > 0 && (
            <div className="mt-2 flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-xs">
              <CreditCard className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-rose-700">Tagihan belum dibayar: <strong>Rp {unpaidBills.toLocaleString('id-ID')}</strong></span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-4 mt-3 overflow-x-auto">
          {visibleTabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.l}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {tab === 'overview' && (
                <div className="space-y-3">
                  {/* Patient Info */}
                  <div className="panel">
                    <div className="px-3 py-2 border-b border-border">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary" /> Informasi Pasien</h3>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-2">
                      <InfoRow icon={Phone} label="Telepon" value={patient.phone || '-'} />
                      <InfoRow icon={Calendar} label="Tgl Lahir" value={patient.birth_date || '-'} />
                      <InfoRow icon={Wallet} label="Asuransi" value={patient.insurance_type || 'Umum'} />
                      <InfoRow icon={FileText} label="No. BPJS" value={patient.bpjs_number || '-'} />
                      {patient.blood_type && patient.blood_type !== '-' && (
                        <InfoRow icon={Activity} label="Gol. Darah" value={patient.blood_type} />
                      )}
                      {patient.nik && <InfoRow icon={FileText} label="NIK" value={patient.nik} />}
                      {patient.emergency_contact && <InfoRow icon={Phone} label="Kontak Darurat" value={patient.emergency_contact} />}
                    </div>
                    {patient.address && (
                      <div className="px-3 pb-3">
                        <InfoRow icon={MapPin} label="Alamat" value={patient.address} />
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="panel">
                    <div className="px-3 py-2 border-b border-border">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> Aktivitas Terbaru</h3>
                    </div>
                    <div className="p-3">
                      {timeline.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Belum ada aktivitas</p>
                      ) : (
                        <div className="space-y-2">
                          {timeline.map((item, i) => <TimelineItem key={`${item.type}-${item.data.id || i}`} item={item} />)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'medical' && (
                <div className="space-y-2">
                  {records.length === 0 && <EmptyState icon={Stethoscope} text="Belum ada rekam medis" />}
                  {records.map(r => (
                    <div key={r.id} className="panel p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5 text-blue-600" /> {new Date(r.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span className="text-[11px] text-muted-foreground">{r.doctor_name || '-'}</span>
                      </div>
                      {r.chief_complaint && <p className="text-xs"><span className="text-muted-foreground">Keluhan:</span> {r.chief_complaint}</p>}
                      {r.diagnosis && <p className="text-xs mt-0.5"><span className="text-muted-foreground">Diagnosis:</span> <span className="font-medium">{r.diagnosis}</span></p>}
                      {r.treatment_plan && <p className="text-xs mt-0.5 text-muted-foreground">{r.treatment_plan}</p>}
                      {(r.vital_signs_bp || r.vital_signs_temp) && (
                        <div className="flex gap-2 mt-1.5">
                          {r.vital_signs_bp && <span className="pill pill-inactive">TD: {r.vital_signs_bp}</span>}
                          {r.vital_signs_temp && <span className="pill pill-inactive">{r.vital_signs_temp}°C</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'prescriptions' && (
                <div className="space-y-2">
                  {prescriptions.length === 0 && <EmptyState icon={FileText} text="Belum ada resep" />}
                  {prescriptions.map(p => (
                    <div key={p.id} className="panel p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono font-medium text-primary">{p.prescription_number || 'Resep'}</span>
                        <span className={`pill ${p.status === 'Paid' ? 'pill-success' : p.status === 'Batal' ? 'pill-critical' : 'pill-info'}`}>{p.status}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{new Date(p.prescription_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {p.doctor_name || '-'}</p>
                      {p.is_racikan && <span className="pill pill-warning mt-1">Racikan</span>}
                      <div className="mt-1.5 space-y-0.5">
                        {(p.items || []).slice(0, 4).map((it, i) => (
                          <p key={i} className="text-xs flex items-center gap-1"><Pill className="w-3 h-3 text-muted-foreground" /> {it.medicine_name} {it.strength} — {it.dosage || `${it.quantity} unit`}</p>
                        ))}
                        {(p.items || []).length > 4 && <p className="text-[11px] text-muted-foreground">+{p.items.length - 4} item lainnya</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'transactions' && (
                <div className="space-y-2">
                  {transactions.length === 0 && <EmptyState icon={Receipt} text="Belum ada transaksi" />}
                  {transactions.map(t => (
                    <div key={t.id} className="panel p-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-medium truncate">{t.invoice_number}</p>
                        <p className="text-[11px] text-muted-foreground">{t.transaction_date} • {t.payment_method} • {t.type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                        <span className={`pill ${t.payment_status === 'Lunas' ? 'pill-success' : t.payment_status === 'Belum Bayar' ? 'pill-warning' : 'pill-critical'}`}>{t.payment_status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          {onEdit && <button onClick={() => onEdit(patient)} className="flex-1 flex items-center justify-center gap-1.5 btn-primary py-2 rounded-md text-xs font-medium">
            <Edit2 className="w-3.5 h-3.5" /> Edit Pasien
          </button>}
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Tutup</button>
        </div>
      </div>
    </div>
  );
}

function CRMMetric({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className={`w-7 h-7 rounded flex items-center justify-center mb-1.5 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-sm font-semibold leading-tight truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}

function TimelineItem({ item }) {
  const config = {
    medical: { icon: Stethoscope, color: 'text-blue-600 bg-blue-50', label: 'Pemeriksaan', detail: (d) => d.diagnosis || d.chief_complaint || '-' },
    prescription: { icon: FileText, color: 'text-teal-600 bg-teal-50', label: 'Resep', detail: (d) => `${(d.items || []).length} item${d.is_racikan ? ' (racikan)' : ''}` },
    transaction: { icon: Receipt, color: 'text-emerald-600 bg-emerald-50', label: 'Pembayaran', detail: (d) => `Rp ${(d.total || 0).toLocaleString('id-ID')} — ${d.payment_method}` },
    visit: { icon: Calendar, color: 'text-amber-600 bg-amber-50', label: 'Kunjungan', detail: (d) => d.complaint || d.visit_type || d.status },
  };
  const cfg = config[item.type];
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-2.5">
      <div className={`w-7 h-7 rounded shrink-0 flex items-center justify-center ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{cfg.label}</p>
          <span className="text-[10px] text-muted-foreground">{item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}</span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{cfg.detail(item.data)}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <Icon className="w-8 h-8 mb-2 opacity-30" />
      <p className="text-xs">{text}</p>
    </div>
  );
}
