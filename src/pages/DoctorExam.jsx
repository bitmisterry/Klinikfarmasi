// @ts-nocheck -- Clinical workspace supports specialty-specific dynamic fields.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Search, Stethoscope, FileText, Pill, X, AlertCircle, Save, FlaskConical, Activity, ClipboardList, Calendar, GraduationCap, Users, Clock, CheckCircle2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import SmartDrugSearch from '@/components/SmartDrugSearch';
import RacikanWorksheet from '@/components/RacikanWorksheet';
import PatientClinicalSidebar from '@/components/PatientClinicalSidebar';
import TindakanPanel from '@/components/TindakanPanel';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';

const COMMON_ICD10 = [
  { code: 'J00', desc: 'Common cold (nasopharyngitis)' },
  { code: 'J02', desc: 'Acute pharyngitis' },
  { code: 'J03', desc: 'Acute tonsillitis' },
  { code: 'J11', desc: 'Influenza' },
  { code: 'J20', desc: 'Acute bronchitis' },
  { code: 'J45', desc: 'Asthma' },
  { code: 'K30', desc: 'Dyspepsia' },
  { code: 'K29', desc: 'Gastritis' },
  { code: 'A09', desc: 'Diarrhea & gastroenteritis' },
  { code: 'L20', desc: 'Atopic dermatitis' },
  { code: 'L23', desc: 'Allergic contact dermatitis' },
  { code: 'M54', desc: 'Back pain' },
  { code: 'R51', desc: 'Headache' },
  { code: 'R10', desc: 'Abdominal pain' },
  { code: 'E11', desc: 'Type 2 diabetes mellitus' },
  { code: 'I10', desc: 'Essential hypertension' },
  { code: 'N39', desc: 'Urinary tract infection' },
];

const BMI_CATEGORIES = [
  { min: 0, max: 18.5, label: 'Kurang', color: 'text-amber-600' },
  { min: 18.5, max: 25, label: 'Normal', color: 'text-emerald-600' },
  { min: 25, max: 30, label: 'Berlebih', color: 'text-amber-600' },
  { min: 30, max: 100, label: 'Obesitas', color: 'text-rose-600' },
];

export default function DoctorExam() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [record, setRecord] = useState(null);
  const [isRacik, setIsRacik] = useState(false);
  const [examTab, setExamTab] = useState('soap');
  const [icdSearch, setIcdSearch] = useState(false);
  const [icdResults, setIcdResults] = useState(null);
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setQueue(await db.entities.QueueEntry.filter({ status: { $in: ['Menunggu', 'Pemeriksaan'] } }, 'created_date', 50) || []);
    } catch {} finally { setLoading(false); }
  };

  const selectPatient = async (q) => {
    setSelected(q);
    setIsRacik(false);
    setExamTab('soap');
    setRecord({
      patient_id: q.patient_id, patient_name: q.patient_name, queue_entry_id: q.id,
      visit_date: new Date().toISOString().split('T')[0],
      chief_complaint: q.complaint || '',
      subjective: '', vital_signs_bp: '', vital_signs_temp: '', vital_signs_pulse: '',
      vital_signs_rr: '', vital_signs_weight: '', vital_signs_height: '', bmi: null,
      physical_exam: '', diagnosis: '', diagnosis_code: '', treatment_plan: '', notes: '',
      procedures: [], tindakan_total: 0,
      follow_up_date: '', patient_education: '',
      prescriptionItems: [],
    });
    // Mark as being examined
    if (q.status === 'Menunggu') {
      try { await db.entities.QueueEntry.update(q.id, { status: 'Pemeriksaan' }); load(); } catch {}
    }
  };

  const handleRacikanSaved = async (tpl, rx) => {
    if (!record.diagnosis) { toast({ title: 'Diagnosis wajib sebelum simpan', variant: 'destructive' }); return; }
    try {
      await db.entities.MedicalRecord.create({
        ...record, doctor_name: record.doctor_name || 'dr. Andini Pratama',
        tindakan_total: record.procedures.reduce((s, p) => s + (p.subtotal || 0), 0),
      });
      await db.entities.QueueEntry.update(record.queue_entry_id, { status: 'Di Apotek' });
      toast({ title: 'Rekam medis & resep racikan tersimpan', description: 'Racikan masuk antrean apotek untuk review' });
      setSelected(null); load();
    } catch (e) {
      toast({ title: 'Rekam medis gagal tersimpan', description: e.message, variant: 'destructive' });
    }
  };

  const set = (k, v) => setRecord(r => ({ ...r, [k]: v }));

  const bmi = (record?.vital_signs_weight && record?.vital_signs_height)
    ? (record.vital_signs_weight / Math.pow(record.vital_signs_height / 100, 2))
    : null;
  const bmiCat = bmi ? BMI_CATEGORIES.find(c => bmi >= c.min && bmi < c.max) : null;

  const saveRecord = async () => {
    if (!record.diagnosis) { toast({ title: 'Diagnosis wajib', variant: 'destructive' }); return; }
    try {
      const tindakanTotal = record.procedures.reduce((s, p) => s + (p.subtotal || 0), 0);
      const med = await db.entities.MedicalRecord.create({
        ...record,
        doctor_name: record.doctor_name || 'dr. Andini Pratama',
        bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        tindakan_total: tindakanTotal,
      });
      if (record.prescriptionItems.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        await db.entities.Prescription.create({
          prescription_number: `R${today.replace(/-/g, '')}${String(Date.now()).slice(-3)}`,
          patient_id: record.patient_id, patient_name: record.patient_name,
          queue_entry_id: record.queue_entry_id, doctor_name: med.doctor_name,
          prescription_date: today, source: 'Internal', status: 'Diresepkan',
          items: record.prescriptionItems,
        });
      }
      const nextStatus = record.prescriptionItems.length > 0 ? 'Di Apotek' : 'Kasir';
      await db.entities.QueueEntry.update(record.queue_entry_id, { status: nextStatus });
      const desc = tindakanTotal > 0
        ? `Pasien dilanjutkan ke ${nextStatus === 'Di Apotek' ? 'apotek' : 'kasir'} (tindakan: Rp ${tindakanTotal.toLocaleString('id-ID')})`
        : `Pasien dilanjutkan ke ${nextStatus === 'Di Apotek' ? 'apotek' : 'kasir'}`;
      toast({ title: 'Rekam medis tersimpan', description: desc });
      setSelected(null); load();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
  };

  const addRxItem = (med) => {
    setRecord(r => ({
      ...r,
      prescriptionItems: [...r.prescriptionItems, {
        medicine_id: med.id, medicine_name: med.name, strength: med.strength,
        dosage: '', quantity: 1, instructions: '', substituted: false,
      }]
    }));
  };

  const requestPengadaan = async (med) => {
    try {
      await db.entities.InternalRequest.create({
        type: 'Permintaan Pengadaan',
        from_user_name: record?.doctor_name || 'dr. Andini Pratama',
        from_role: 'Dokter', to_role: 'Apoteker',
        subject: `Pengadaan ${med.name} ${med.strength || ''}`,
        message: `Dokter meminta pengadaan ${med.name} (${med.active_substance || ''} ${med.strength || ''}) — stok habis. Pasien: ${record?.patient_name || 'N/A'}`,
        medicine_id: med.id, medicine_name: med.name, status: 'Baru', priority: 'Penting',
      });
      await db.entities.Notification.create({
        type: 'pengadaan', target_role: 'Apoteker',
        title: `Pengadaan: ${med.name}`,
        body: `${record?.doctor_name || 'Dokter'} meminta pengadaan ${med.name} — stok habis`,
        priority: 'Penting', related_entity: 'InternalRequest',
        action_label: 'Lihat', action_type: 'navigate',
        action_payload: JSON.stringify({ path: '/pharmacy' }),
      });
      toast({ title: `Pengadaan ${med.name} diajukan ke apotek`, description: 'Apoteker akan diberi notifikasi' });
    } catch (e) {
      toast({ title: 'Gagal mengajukan', description: e.message, variant: 'destructive' });
    }
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";
  const tindakanTotal = record?.procedures?.reduce((s, p) => s + (p.subtotal || 0), 0) || 0;

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <h1 className="text-lg font-medium">Pemeriksaan Dokter & Rekam Medis</h1>

      <ModuleStatHeader stats={[
        { icon: Clock, label: 'Menunggu', value: queue.filter(q => q.status === 'Menunggu').length, color: 'text-amber-600' },
        { icon: Stethoscope, label: 'Pemeriksaan', value: queue.filter(q => q.status === 'Pemeriksaan').length, color: 'text-blue-600' },
        { icon: CheckCircle2, label: 'Selesai', value: queue.filter(q => ['Selesai Periksa', 'Di Apotek', 'Kasir', 'Selesai'].includes(q.status)).length, color: 'text-emerald-600' },
        { icon: Users, label: 'Total Antrean', value: queue.length, color: 'text-teal-600' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_260px] gap-3">
        {/* Patient queue */}
        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" /> Antrean</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
            {queue.map(q => (
              <button key={q.id} onClick={() => selectPatient(q)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                  selected?.id === q.id ? 'bg-primary/5 border-l-[3px] border-l-[hsl(var(--primary))]' : ''
                }`}>
                <span className="text-xs font-mono font-semibold text-primary w-10">{q.queue_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{q.patient_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{q.complaint}</p>
                </div>
                <span className={`pill ${q.status === 'Pemeriksaan' ? 'pill-info' : 'pill-inactive'}`}>{q.status}</span>
              </button>
            ))}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {!loading && queue.length === 0 && <EmptyState icon={Stethoscope} title="Tidak ada antrean" description="Pasien akan muncul di sini setelah check-in di pendaftaran" />}
          </div>
        </div>

        {/* Exam form */}
        <div className="space-y-3">
          {!selected ? (
            <div className="panel flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Stethoscope className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Pilih pasien dari antrean untuk memulai pemeriksaan</p>
            </div>
          ) : (
            <>
              <div className="panel">
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">{selected.patient_name}</h2>
                    <p className="text-[11px] text-muted-foreground">{selected.queue_number} • {selected.complaint}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
                </div>

                {/* Exam Tabs */}
                <div className="flex border-b border-border overflow-x-auto">
                  {[
                    { k: 'soap', l: 'Pemeriksaan', icon: Activity },
                    { k: 'tindakan', l: 'Tindakan', icon: ClipboardList, badge: record.procedures.length },
                    { k: 'resep', l: 'Resep', icon: Pill, badge: record.prescriptionItems.length },
                  ].map(t => (
                    <button key={t.k} onClick={() => setExamTab(t.k)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                        examTab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}>
                      <t.icon className="w-3.5 h-3.5" /> {t.l}
                      {t.badge > 0 && <span className="ml-0.5 text-[10px] bg-primary text-primary-foreground px-1.5 rounded-full">{t.badge}</span>}
                    </button>
                  ))}
                </div>

                {/* SOAP Tab */}
                {examTab === 'soap' && (
                  <div className="p-3 space-y-3">
                    {/* Subjective */}
                    <div>
                      <p className="micro-label mb-1.5 flex items-center gap-1"><FileText className="w-3 h-3 text-blue-600" /> S — Subjective</p>
                      <input value={record.chief_complaint} onChange={e=>set('chief_complaint',e.target.value)} className={inputCls} placeholder="Keluhan utama (chief complaint)" />
                      <textarea value={record.subjective} onChange={e=>set('subjective',e.target.value)} className={inputCls + ' mt-1.5'} rows={2} placeholder="Anamnesis / riwayat penyakit (HPI)…" />
                    </div>

                    {/* Objective — Vital Signs */}
                    <div>
                      <p className="micro-label mb-1.5 flex items-center gap-1"><Activity className="w-3 h-3 text-teal-600" /> O — Objective / Vital Signs</p>
                      <div className="grid grid-cols-3 lg:grid-cols-7 gap-2">
                        <div><label className="text-[10px] text-muted-foreground">TD (mmHg)</label><input value={record.vital_signs_bp} onChange={e=>set('vital_signs_bp',e.target.value)} className={inputCls} placeholder="120/80" /></div>
                        <div><label className="text-[10px] text-muted-foreground">Suhu (°C)</label><input type="number" step="0.1" value={record.vital_signs_temp} onChange={e=>set('vital_signs_temp',+e.target.value)} className={inputCls} /></div>
                        <div><label className="text-[10px] text-muted-foreground">Nadi</label><input type="number" value={record.vital_signs_pulse} onChange={e=>set('vital_signs_pulse',+e.target.value)} className={inputCls} /></div>
                        <div><label className="text-[10px] text-muted-foreground">RR</label><input type="number" value={record.vital_signs_rr} onChange={e=>set('vital_signs_rr',+e.target.value)} className={inputCls} /></div>
                        <div><label className="text-[10px] text-muted-foreground">BB (kg)</label><input type="number" step="0.1" value={record.vital_signs_weight} onChange={e=>set('vital_signs_weight',+e.target.value)} className={inputCls} /></div>
                        <div><label className="text-[10px] text-muted-foreground">TB (cm)</label><input type="number" value={record.vital_signs_height} onChange={e=>set('vital_signs_height',+e.target.value)} className={inputCls} /></div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">BMI</label>
                          <div className="px-2 py-1.5 border border-border rounded text-xs text-center font-medium">
                            {bmi ? <span className={bmiCat?.color}>{bmi.toFixed(1)}</span> : <span className="text-muted-foreground">-</span>}
                          </div>
                          {bmiCat && <p className={`text-[9px] text-center mt-0.5 ${bmiCat.color}`}>{bmiCat.label}</p>}
                        </div>
                      </div>
                      <textarea value={record.physical_exam} onChange={e=>set('physical_exam',e.target.value)} className={inputCls + ' mt-1.5'} rows={2} placeholder="Pemeriksaan fisik…" />
                    </div>

                    {/* Assessment */}
                    <div>
                      <p className="micro-label mb-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-600" /> A — Assessment / Diagnosis *</p>
                      <div className="relative">
                        <input value={record.diagnosis} onChange={e=>set('diagnosis',e.target.value)} className={inputCls} placeholder="Diagnosis (narasi)" onFocus={() => setIcdSearch(true)} />
                        {icdSearch && (
                          <div className="absolute z-20 mt-1 w-full panel max-h-48 overflow-y-auto divide-y divide-border shadow-lg">
                            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border sticky top-0 bg-card">
                              <Search className="w-3.5 h-3.5 text-muted-foreground" />
                              <input autoFocus placeholder="Cari ICD-10…" className="flex-1 bg-transparent outline-none text-xs"
                                onChange={e => {
                                  const q = e.target.value.toLowerCase();
                                  const results = COMMON_ICD10.filter(c => c.code.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
                                  // Store filtered results for rendering
                                  setIcdResults(results);
                                }} />
                              <button onClick={() => setIcdSearch(false)} className="p-0.5 hover:bg-muted rounded"><X className="w-3 h-3" /></button>
                            </div>
                            {(icdResults || COMMON_ICD10).map(c => (
                              <button key={c.code} onClick={() => { set('diagnosis', c.desc); set('diagnosis_code', c.code); setIcdSearch(false); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-left text-xs">
                                <span className="font-mono font-medium text-primary w-12">{c.code}</span>
                                <span className="flex-1">{c.desc}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input value={record.diagnosis_code} onChange={e=>set('diagnosis_code',e.target.value)} className={inputCls + ' mt-1.5'} placeholder="Kode ICD-10 (opsional)" />
                    </div>

                    {/* Plan */}
                    <div>
                      <p className="micro-label mb-1.5 flex items-center gap-1"><ClipboardList className="w-3 h-3 text-purple-600" /> P — Plan / Rencana Terapi</p>
                      <textarea value={record.treatment_plan} onChange={e=>set('treatment_plan',e.target.value)} className={inputCls} rows={2} placeholder="Rencana tindakan & terapi…" />
                    </div>

                    {/* Follow-up & Education */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="micro-label mb-1 flex items-center gap-1"><Calendar className="w-3 h-3 text-primary" /> Kunjungan Ulang</p>
                        <input type="date" value={record.follow_up_date} onChange={e=>set('follow_up_date',e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <p className="micro-label mb-1 flex items-center gap-1"><GraduationCap className="w-3 h-3 text-primary" /> Edukasi Pasien</p>
                        <input value={record.patient_education} onChange={e=>set('patient_education',e.target.value)} className={inputCls} placeholder="Edukasi / instruksi pasien" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tindakan Tab */}
                {examTab === 'tindakan' && (
                  <div className="p-3">
                    <TindakanPanel
                      procedures={record.procedures}
                      onChange={(procs) => setRecord(r => ({ ...r, procedures: procs }))}
                    />
                  </div>
                )}

                {/* Resep Tab */}
                {examTab === 'resep' && (
                  <div className="p-3 space-y-2">
                    <div className="flex border border-border rounded overflow-hidden text-xs">
                      <button onClick={() => setIsRacik(false)} className={`px-2.5 py-1.5 flex items-center gap-1 ${!isRacik ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>
                        <Pill className="w-3 h-3" /> Non-Racik
                      </button>
                      <button onClick={() => setIsRacik(true)} className={`px-2.5 py-1.5 flex items-center gap-1 ${isRacik ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>
                        <FlaskConical className="w-3 h-3" /> Obat Racik
                      </button>
                    </div>
                    {isRacik ? (
                      <RacikanWorksheet
                        patient={{ id: record.patient_id, full_name: record.patient_name }}
                        mode="doctor"
                        onSaved={handleRacikanSaved}
                      />
                    ) : (
                      <>
                        <SmartDrugSearch onSelect={addRxItem} onRequestPengadaan={requestPengadaan} compact />
                        {record.prescriptionItems.length > 0 && (
                          <div className="space-y-1.5">
                            {record.prescriptionItems.map((it, i) => (
                              <div key={i} className="flex items-center gap-2 bg-muted/30 rounded p-2 text-xs">
                                <Pill className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="flex-1 font-medium">{it.medicine_name} {it.strength}</span>
                                <input placeholder="3x1" onChange={e => {
                                  const items = [...record.prescriptionItems]; items[i].dosage = e.target.value;
                                  setRecord(r => ({ ...r, prescriptionItems: items }));
                                }} className="w-16 px-1 py-1 border border-border rounded text-center" />
                                <input type="number" value={it.quantity} onChange={e => {
                                  const items = [...record.prescriptionItems]; items[i].quantity = +e.target.value;
                                  setRecord(r => ({ ...r, prescriptionItems: items }));
                                }} className="w-12 px-1 py-1 border border-border rounded text-center" />
                                <button onClick={() => {
                                  const items = record.prescriptionItems.filter((_, idx) => idx !== i);
                                  setRecord(r => ({ ...r, prescriptionItems: items }));
                                }} className="text-rose-500"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Save bar */}
              {!isRacik && (
                <div className="panel p-3">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <div className="flex items-center gap-3">
                      {tindakanTotal > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <ClipboardList className="w-3.5 h-3.5" /> Tindakan: <strong>Rp {tindakanTotal.toLocaleString('id-ID')}</strong>
                        </span>
                      )}
                      {record.prescriptionItems.length > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Pill className="w-3.5 h-3.5" /> {record.prescriptionItems.length} obat
                        </span>
                      )}
                      {record.follow_up_date && (
                        <span className="flex items-center gap-1 text-purple-600">
                          <Calendar className="w-3.5 h-3.5" /> Kontrol: {new Date(record.follow_up_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={saveRecord} className="w-full btn-primary py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> Simpan Rekam Medis & Lanjutkan ke Kasir
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Patient Clinical Sidebar */}
        <div>
          {selected && <PatientClinicalSidebar patientId={selected.patient_id} patientName={selected.patient_name} />}
        </div>
      </div>
    </div>
  );
}
