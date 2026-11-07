// @ts-nocheck -- Workspace state contains specialty-specific dynamic records.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Stethoscope, FileText, Pill, FlaskConical, X, AlertCircle, Save,
  Activity, ClipboardList, ArrowLeft, CheckCircle2, Edit3
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/doctorContext';
import PatientTimeline from '@/components/doctor/PatientTimeline';
import ClinicalActions from '@/components/doctor/ClinicalActions';
import ExamTemplateModal from '@/components/doctor/ExamTemplateModal';
import { getExamTemplate } from '@/lib/examTemplates';
import { getClinicalCatalog } from '@/lib/clinicalCatalogs';
import { getClinicRole } from '@/lib/roles';
import RoleWorkflowGuide from '@/components/RoleWorkflowGuide';
import { Baby, Shield, Bone } from 'lucide-react';

const BMI_CATEGORIES = [
  { min: 0, max: 18.5, label: 'Kurang', color: 'text-amber-600' },
  { min: 18.5, max: 25, label: 'Normal', color: 'text-emerald-600' },
  { min: 25, max: 30, label: 'Berlebih', color: 'text-amber-600' },
  { min: 30, max: 100, label: 'Obesitas', color: 'text-rose-600' },
];

// Keep the clinical workspace readable at every action-panel width.  The
// timeline gives up a little space in wide mode so the SOAP column never
// becomes cramped when the doctor is writing a free-text prescription.
const ACTION_PANEL_LAYOUTS = {
  compact: 'lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)_340px]',
  standard: 'lg:grid-cols-[220px_minmax(0,1fr)_minmax(380px,460px)]',
  wide: 'lg:grid-cols-[minmax(180px,200px)_minmax(0,1fr)_minmax(480px,560px)]',
};

const COMPLETED_QUEUE_STATUSES = new Set(['Selesai Periksa', 'Di Apotek', 'Kasir', 'Selesai']);
const COMPLETED_WORKFLOW_STATUSES = new Set(['COMPLETED', 'READY_TO_CLOSE', 'CLOSED']);

const isCompletedQueueEntry = (entry) => COMPLETED_QUEUE_STATUSES.has(entry?.status)
  || COMPLETED_WORKFLOW_STATUSES.has(entry?.workflow_status);

export default function ClinicalWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [queue, setQueue] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [patient, setPatient] = useState(null);
  const [record, setRecord] = useState(null);
  const [icdSearch, setIcdSearch] = useState(false);
  const [icdResults, setIcdResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState('soap');
  const [examTemplate, setExamTemplate] = useState(null);
  const [showExamTpl, setShowExamTpl] = useState(false);
  const [examTplMode, setExamTplMode] = useState('load');
  const [accepted, setAccepted] = useState(false);
  const [completionSummary, setCompletionSummary] = useState(null);
  const [isEditingCompleted, setIsEditingCompleted] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [queueSearch, setQueueSearch] = useState('');
  const [actionPanelSize, setActionPanelSize] = useState(() => {
    const savedSize = window.localStorage.getItem('doctor-action-panel-size');
    return Object.hasOwn(ACTION_PANEL_LAYOUTS, savedSize) ? savedSize : 'standard';
  });

  const { doctorUserId, doctorProfile, isAssistant } = useDoctorContext();
  const doctorName = doctorProfile?.display_name || doctorProfile?.full_name || user?.full_name || 'Dokter';
  const doctorId = doctorUserId;
  const doctorRole = getClinicRole(user);
  const clinicalCatalog = getClinicalCatalog({ specialization: doctorProfile?.specialization, role: doctorRole });
  const initialTab = searchParams.get('tab') || 'tindakan';
  const prescriptionMode = initialTab === 'resep' || initialTab === 'racikan';

  useEffect(() => {
    window.localStorage.setItem('doctor-action-panel-size', actionPanelSize);
  }, [actionPanelSize]);

  useEffect(() => { if (doctorId) load(); }, [doctorId, prescriptionMode]);

  // Redirect assistants to their dedicated dashboard
  useEffect(() => {
    if (isAssistant) navigate('/doctor/assistant', { replace: true });
  }, [isAssistant, navigate]);

  // Load exam template from DoctorProfile
  useEffect(() => {
    if (doctorId) {
      db.entities.DoctorProfile.filter({ user_id: doctorId })
        .then(profiles => {
          const profile = (profiles || [])[0];
          if (profile) setExamTemplate(getExamTemplate(profile));
        })
        .catch(() => {});
    }
  }, [doctorId]);

  const visibleVitals = examTemplate?.visible_vital_fields || ['bp', 'temp', 'pulse', 'rr', 'weight', 'height', 'bmi'];
  const matchingQueue = queue.filter((item) => {
    const query = queueSearch.trim().toLowerCase();
    return !query || [item.patient_name, item.queue_number, item.complaint, item.visit_type]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
  });

  const load = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [activeQueue, doctorPrescriptions] = await Promise.all([
        db.entities.QueueEntry.filter({ doctor_id: doctorId, visit_date: todayStr, status: { $in: ['Siap Dokter', 'Pemeriksaan', 'Perlu Revisi Dokter', 'Dikembalikan ke Dokter'] } }, 'created_date', 50),
        prescriptionMode
          ? db.entities.Prescription.filter({ doctor_id: doctorId }, '-prescription_date', 20)
          : Promise.resolve([]),
      ]);
      let q = activeQueue || [];
      setQueue(q);
      setPrescriptions(doctorPrescriptions || []);
      const queueId = searchParams.get('queue');
      const rxId = searchParams.get('rx');
      let targetEntry = null;

      if (queueId) {
        targetEntry = q.find(e => e.id === queueId);
        if (!targetEntry) {
          const requested = await db.entities.QueueEntry.get(queueId).catch(() => null);
          const belongsToDoctor = requested && (!requested.doctor_id || requested.doctor_id === doctorId || requested.doctor_name === doctorName || (user?.id && requested.doctor_id === user.id));
          if (requested && belongsToDoctor) {
            targetEntry = requested;
            q = [requested, ...q.filter(e => e.id !== requested.id)];
            setQueue(q);
          }
        }
      } else if (rxId) {
        const rx = await db.entities.Prescription.get(rxId).catch(() => null);
        if (rx) {
          if (rx.queue_entry_id) {
            targetEntry = await db.entities.QueueEntry.get(rx.queue_entry_id).catch(() => null);
          }
          if (!targetEntry && rx.visit_id) {
            const vQueues = await db.entities.QueueEntry.filter({ visit_id: rx.visit_id }).catch(() => []);
            targetEntry = vQueues[0] || null;
          }
          if (!targetEntry && rx.patient_id) {
            const pQueues = await db.entities.QueueEntry.filter({ patient_id: rx.patient_id }).catch(() => []);
            targetEntry = pQueues[0] || null;
          }
          if (!targetEntry) {
            targetEntry = {
              id: `q-rx-${rx.id}`,
              patient_id: rx.patient_id,
              patient_name: rx.patient_name,
              visit_id: rx.visit_id,
              encounter_id: rx.visit_id,
              queue_number: 'REV-01',
              visit_type: 'Revisi Resep',
              complaint: rx.return_reason || 'Revisi resep dokter',
              status: 'Perlu Revisi Dokter',
              workflow_status: 'RETURNED_TO_DOCTOR',
              return_reason: rx.return_reason,
            };
          }
          if (targetEntry) {
            q = [targetEntry, ...q.filter(e => e.id !== targetEntry.id)];
            setQueue(q);
          }
        }
      }

      if (targetEntry) {
        selectPatient(targetEntry);
      }
    } catch (e) { console.error(e); }
  };

  const selectPatient = async (q) => {
    setSelected(q);
    const isReturned = q.status === 'Perlu Revisi Dokter' || q.status === 'Dikembalikan ke Dokter' || q.workflow_status === 'RETURNED_TO_DOCTOR';
    const completed = !isReturned && isCompletedQueueEntry(q);
    setAccepted(q.status === 'Pemeriksaan' || completed || isReturned);
    setIsEditingCompleted(false);
    setRevisionReason('');
    let existingRecord = null;
    let existingPrescription = null;
    if (completed || isReturned) {
      const [records, prescriptionsForVisit] = await Promise.all([
        db.entities.MedicalRecord.filter({ queue_entry_id: q.id }, '-finalized_at', 10),
        db.entities.Prescription.filter({ queue_entry_id: q.id }, '-prescription_date', 10),
      ]);
      existingRecord = (records || []).find((item) => item.finalized) || (records || [])[0] || null;
      existingPrescription = (prescriptionsForVisit || []).find((item) => item.returned_to_doctor || item.workflow_status === 'RETURNED_TO_DOCTOR') || (prescriptionsForVisit || [])[0] || null;

      const visitId = q.visit_id || q.encounter_id;
      if (!existingRecord && visitId) {
        const vRecords = await db.entities.MedicalRecord.filter({ visit_id: visitId }, '-finalized_at', 10).catch(() => []);
        existingRecord = (vRecords || []).find((item) => item.finalized) || (vRecords || [])[0] || null;
      }
      if (!existingPrescription && visitId) {
        const vPrescriptions = await db.entities.Prescription.filter({ visit_id: visitId }, '-prescription_date', 10).catch(() => []);
        existingPrescription = (vPrescriptions || []).find((item) => item.returned_to_doctor || item.workflow_status === 'RETURNED_TO_DOCTOR') || (vPrescriptions || [])[0] || null;
      }
      if (!existingRecord && q.patient_id) {
        const pRecords = await db.entities.MedicalRecord.filter({ patient_id: q.patient_id }, '-finalized_at', 5).catch(() => []);
        existingRecord = (pRecords || []).find((item) => item.finalized) || (pRecords || [])[0] || null;
      }
      if (!existingPrescription && q.patient_id) {
        const pPrescriptions = await db.entities.Prescription.filter({ patient_id: q.patient_id }, '-prescription_date', 5).catch(() => []);
        existingPrescription = (pPrescriptions || []).find((item) => item.returned_to_doctor || item.workflow_status === 'RETURNED_TO_DOCTOR') || (pPrescriptions || [])[0] || null;
      }
    }
    const initialRecord = {
      patient_id: q.patient_id, patient_name: q.patient_name, queue_entry_id: q.id,
      visit_date: new Date().toISOString().split('T')[0],
      chief_complaint: q.complaint || '',
      subjective: '',
      vital_signs_bp: q.vital_signs_bp || '', vital_signs_temp: q.vital_signs_temp || '', vital_signs_pulse: q.vital_signs_pulse || '',
      vital_signs_rr: q.vital_signs_rr || '', vital_signs_weight: q.vital_signs_weight || '', vital_signs_height: q.vital_signs_height || '', vital_signs_head_circumference: q.vital_signs_head_circumference || '',
      bmi: null,
      physical_exam: '', diagnosis: '', diagnosis_code: '', treatment_plan: '', notes: '',
      procedures: [], tindakan_total: 0,
      follow_up_date: '', follow_up_instructions: '', patient_education: '',
      prescriptionItems: [],
      prescriptionText: '', prescriptionConfirmed: false, prescriptionParse: null,
      prescriptionAllergyWarnings: [], prescriptionAllergyAcknowledged: false, prescriptionAllergyOverrideReason: '',
      administrative_documents: {
        prescription_print: { approved: false },
        sick_leave: { approved: false },
        external_referral: { approved: false },
        medical_summary: { approved: false },
        instructions: { approved: false },
        control_card: { approved: false },
      },
      doctor_name: doctorName,
      doctor_id: doctorId,
      clinical_specialty: clinicalCatalog.label,
    };
    const loadedRecord = existingRecord ? {
      ...initialRecord,
      ...existingRecord,
      medical_record_id: existingRecord.id,
      queue_entry_id: q.id,
      doctor_id: existingRecord.doctor_id || doctorId,
      doctor_name: existingRecord.doctor_name || doctorName,
      prescriptionItems: existingPrescription?.items || [],
      prescriptionText: existingPrescription?.original_text || '',
      freeTextPrescription: existingPrescription?.original_text || '',
      prescriptionConfirmed: isReturned ? false : Boolean(existingPrescription),
      prescriptionParse: existingPrescription?.parse_result || null,
      administrative_documents: existingRecord.administrative_documents || initialRecord.administrative_documents,
      returnedPrescription: isReturned ? existingPrescription : null,
      returnReason: existingPrescription?.return_reason || q.return_reason || '',
    } : initialRecord;
    setRecord(loadedRecord);
    setCompletionSummary((completed && !isReturned) ? {
      medical_record_id: existingRecord.id,
      next_status: q.status,
      finalized_at: existingRecord.finalized_at || existingRecord.created_date,
      record: loadedRecord,
    } : null);
    setMobileTab(prescriptionMode || isReturned ? 'actions' : 'soap');
    // Load patient details
    if (q.patient_id) {
      try {
        const p = await db.entities.Patient.get(q.patient_id);
        setPatient(p);
      } catch { setPatient(null); }
    } else {
      setPatient(null);
    }
  };

  const acceptPatient = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await db.functions.invoke('acceptVisit', {
        queue_entry_id: selected.id,
        doctor_id: doctorId,
        doctor_name: doctorName,
      });
      const updated = (response.data || response).queue;
      setSelected(updated || { ...selected, status: 'Pemeriksaan' });
      setAccepted(true);
      toast({ title: 'Pasien diterima', description: 'Konteks pasien dan Visit ID dikunci untuk pemeriksaan ini.' });
    } catch (error) {
      toast({ title: 'Pasien belum dapat diterima', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const set = (k, v) => setRecord(r => ({ ...r, [k]: v }));

  const handleLoadExamTemplate = (tpl) => {
    setRecord(r => ({
      ...r,
      chief_complaint: tpl.chief_complaint || r.chief_complaint,
      diagnosis: tpl.diagnosis || r.diagnosis,
      diagnosis_code: tpl.diagnosis_code || r.diagnosis_code,
      procedures: tpl.procedures || r.procedures,
      treatment_plan: tpl.treatment_plan || r.treatment_plan,
      follow_up_instructions: tpl.follow_up_instructions || r.follow_up_instructions,
      patient_education: tpl.patient_education || r.patient_education,
    }));
    toast({ title: `Template "${tpl.name}" dimuat`, description: 'Diagnosis & tindakan terisi otomatis' });
  };

  const bmi = (record?.vital_signs_weight && record?.vital_signs_height)
    ? (record.vital_signs_weight / Math.pow(record.vital_signs_height / 100, 2))
    : null;
  const bmiCat = bmi ? BMI_CATEGORIES.find(c => bmi >= c.min && bmi < c.max) : null;

  const completeExam = async () => {
    if (!accepted) { toast({ title: 'Tekan Terima Pasien terlebih dahulu', variant: 'destructive' }); return; }
    if (!record.diagnosis) { toast({ title: 'Diagnosis wajib sebelum menyelesaikan', variant: 'destructive' }); return; }
    const isRevision = Boolean(isEditingCompleted && record.medical_record_id);
    if (isRevision && !revisionReason.trim()) {
      toast({ title: 'Alasan koreksi wajib diisi', description: 'Catat alasan perubahan agar jejak koreksi pemeriksaan tetap jelas.', variant: 'destructive' });
      return;
    }
    if (!isRevision && String(record.prescriptionText || '').trim() && !record.prescriptionConfirmed) {
      toast({ title: 'Konfirmasi resep diperlukan', description: 'Tinjau pratinjau resep teks bebas lalu tekan “Konfirmasi resep” sebelum menyelesaikan pemeriksaan.', variant: 'destructive' });
      return;
    }
    if (!isRevision && (record.prescriptionAllergyWarnings || []).length > 0
      && (!record.prescriptionAllergyAcknowledged || !String(record.prescriptionAllergyOverrideReason || '').trim())) {
      toast({ title: 'Tinjauan alergi diperlukan', description: 'Catat alasan klinis dan konfirmasi peninjauan peringatan alergi sebelum mengirim resep.', variant: 'destructive' });
      return;
    }
    const documents = record.administrative_documents || {};
    if (!isRevision && documents.sick_leave?.approved && (!documents.sick_leave.start_date || !documents.sick_leave.end_date)) {
      toast({ title: 'Tanggal surat istirahat wajib diisi', description: 'Lengkapi tanggal mulai dan sampai sebelum surat disetujui dokter.', variant: 'destructive' });
      return;
    }
    if (!isRevision && documents.external_referral?.approved && (!String(documents.external_referral.destination || '').trim() || !String(documents.external_referral.reason || '').trim())) {
      toast({ title: 'Rujukan eksternal belum lengkap', description: 'Dokter wajib mencatat tujuan dan alasan rujukan sebelum surat disetujui.', variant: 'destructive' });
      return;
    }
    if (!isRevision && documents.prescription_print?.approved && !(record.prescriptionItems?.length || record.racikanData || String(record.prescriptionText || '').trim())) {
      toast({ title: 'Resep belum tersedia', description: 'Isi resep obat atau racikan sebelum menyetujui cetak resep.', variant: 'destructive' });
      return;
    }
    if (!isRevision && documents.instructions?.approved && !String(record.patient_education || record.treatment_plan || record.follow_up_instructions || '').trim()) {
      toast({ title: 'Instruksi belum tersedia', description: 'Isi edukasi pasien, rencana terapi, atau instruksi follow-up sebelum menyetujui cetak instruksi.', variant: 'destructive' });
      return;
    }
    if (!isRevision && documents.control_card?.approved && !record.follow_up_date) {
      toast({ title: 'Tanggal kontrol wajib diisi', description: 'Tentukan tanggal kontrol sebelum menyetujui cetak kartu kontrol.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (isRevision) {
        const res = await db.functions.invoke('completeExam', {
          mode: 'revise',
          medical_record_id: record.medical_record_id,
          revision_reason: revisionReason.trim(),
          record: {
            ...record,
            revision_reason: revisionReason.trim(),
            doctor_id: doctorId,
            doctor_name: doctorName,
          },
          queue_entry_id: record.queue_entry_id,
        });
        const data = res.data || res;
        const revisedRecord = data.medical_record || { ...record, revised_at: new Date().toISOString() };
        setRecord((current) => ({ ...current, ...revisedRecord, medical_record_id: record.medical_record_id }));
        setCompletionSummary((current) => ({
          ...(current || {}),
          medical_record_id: record.medical_record_id,
          next_status: selected?.status || current?.next_status,
          revised_at: revisedRecord.revised_at || new Date().toISOString(),
          record: revisedRecord,
        }));
        setIsEditingCompleted(false);
        setRevisionReason('');
        toast({ title: 'Koreksi pemeriksaan tersimpan', description: 'RME diperbarui tanpa membuat kunjungan, resep, atau tagihan baru.' });
        setSaving(false);
        return;
      }
      const bmiVal = bmi ? Math.round(bmi * 10) / 10 : null;
      const tindakanTotal = (record.procedures || []).reduce((s, p) => s + (p.subtotal || 0), 0);

      const res = await db.functions.invoke('completeExam', {
        record: {
          ...record,
          bmi: bmiVal,
          tindakan_total: tindakanTotal,
          doctor_name: doctorName,
          doctor_id: doctorId,
        },
        prescriptionItems: record.prescriptionItems || [],
        racikanData: record.racikanData || null,
        freeTextPrescription: record.freeTextPrescription || null,
        queue_entry_id: record.queue_entry_id,
        follow_up_date: record.follow_up_date || null,
        follow_up_instructions: record.follow_up_instructions || '',
      });

      const data = res.data || res;
      const finalizedAt = new Date().toISOString();
      setSelected((current) => current ? { ...current, status: data.next_status || current.status, workflow_status: 'COMPLETED', check_out_time: finalizedAt } : current);
      setRecord((current) => ({ ...current, medical_record_id: data.medical_record_id, finalized: true, finalized_at: finalizedAt }));
      setCompletionSummary({
        medical_record_id: data.medical_record_id,
        next_status: data.next_status,
        finalized_at: finalizedAt,
        record: { ...record, medical_record_id: data.medical_record_id, finalized: true, finalized_at: finalizedAt },
      });
      toast({
        title: 'Pemeriksaan selesai',
        description: `Pasien dilanjutkan ke ${data.next_status === 'Di Apotek' ? 'apotek' : 'kasir'}${String(record.prescriptionText || '').trim() ? ' • Resep teks bebas ke farmasi' : ''}${tindakanTotal > 0 ? ` • Tindakan Rp ${tindakanTotal.toLocaleString('id-ID')}` : ''}${record.follow_up_date ? ` • Kontrol terjadwal` : ''}${Object.values(record.administrative_documents || {}).some((document) => document?.approved) ? ' • Dokumen disetujui tersedia untuk Front Office' : ''}`,
      });
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleRacikanSaved = () => {
    // Racikan worksheet calls onSaved — trigger complete flow
    completeExam();
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";
  const vitalInputCls = `${inputCls} bg-muted/40 cursor-not-allowed`;
  const age = patient?.birth_date ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / (365 * 24 * 60 * 60 * 1000)) : null;

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      {/* Compact Header */}
      {selected ? (
        <div className="border-b border-border bg-card px-3 py-2">
          {isAssistant && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 mb-1.5 bg-indigo-50 border border-indigo-200 rounded text-[11px] text-indigo-700">
              <Stethoscope className="w-3 h-3" /> Menginput atas nama: {doctorName}
            </div>
          )}
          {selected.vital_signs_recorded_by && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 mb-1.5 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-700">
              <Activity className="w-3 h-3" /> Vital sign oleh: {selected.vital_signs_recorded_by}
              {selected.vital_signs_recorded_at && <span className="ml-1">• {new Date(selected.vital_signs_recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelected(null); setRecord(null); navigate('/doctor'); }} className="p-1.5 hover:bg-muted rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
              {selected.patient_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold truncate">{selected.patient_name}</h2>
                <span className="text-xs text-muted-foreground">{age !== null ? `${age} th` : ''} {patient?.gender === 'L' ? 'L' : patient?.gender === 'P' ? 'P' : ''}</span>
                {record.vital_signs_weight && <span className="text-xs text-muted-foreground">• BB {record.vital_signs_weight} kg</span>}
                <span className="pill pill-info">{selected.visit_type}</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{selected.queue_number} • {selected.complaint || selected.visit_type}</p>
            </div>
            {!accepted ? (
              <button onClick={acceptPatient} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded text-xs font-medium disabled:opacity-50">
                <Stethoscope className="w-3.5 h-3.5" /> Terima Pasien
              </button>
            ) : (
              <span className={`pill ${completionSummary && !isEditingCompleted ? 'pill-success' : 'pill-info'}`}>
                {completionSummary && !isEditingCompleted ? 'Pemeriksaan selesai' : 'Visit aktif'}
              </span>
            )}
            {patient?.allergies && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-md text-rose-700">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Alergi: {patient.allergies}</span>
              </div>
            )}
          </div>
          <div className="mt-2">
            <RoleWorkflowGuide role="Dokter" visit={selected} compact collapsible />
          </div>

          {/* Mobile tabs */}
          <div className="flex lg:hidden mt-2 gap-1">
            {[
              { k: 'riwayat', l: 'Riwayat' },
              { k: 'soap', l: 'Pemeriksaan' },
              { k: 'actions', l: 'Aksi' },
            ].map(t => (
              <button key={t.k} onClick={() => setMobileTab(t.k)}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium ${mobileTab === t.k ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-b border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/doctor')} className="p-1.5 hover:bg-muted rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
            {prescriptionMode ? <FlaskConical className="w-4 h-4 text-primary" /> : null}
            <div>
              <h2 className="text-sm font-semibold">{prescriptionMode ? 'Resep & Racikan' : 'Pemeriksaan — Pilih Pasien'}</h2>
              {prescriptionMode && <p className="text-[11px] text-muted-foreground">Pilih pasien dengan kunjungan aktif untuk menulis resep yang terhubung ke pemeriksaan.</p>}
            </div>
          </div>
          <div className="mt-2">
            <RoleWorkflowGuide role="Dokter" collapsible />
          </div>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="flex-1 overflow-hidden">
        {!selected ? (
          <div className="h-full overflow-y-auto p-3">
            <div className={`${prescriptionMode ? 'max-w-4xl' : 'max-w-md'} mx-auto space-y-3`}>
              <div className="panel">
                <div className="px-3 py-2.5 border-b border-border">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {prescriptionMode ? <Pill className="w-4 h-4 text-primary" /> : <Stethoscope className="w-4 h-4 text-primary" />}
                    {prescriptionMode ? 'Pasien Aktif — Buat Resep' : 'Antrean Saya'}
                  </h3>
                </div>
                <div className="border-b border-border px-3 py-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} className="w-full rounded border border-border py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary" placeholder="Cari nama pasien, nomor antrean, atau keluhan…" aria-label="Cari pasien antrean dokter" />
                  </div>
                </div>
                <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                  {matchingQueue.length === 0 && (
                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                      {prescriptionMode ? <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" /> : <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-30" />}
                      {queueSearch ? 'Pasien tidak ditemukan pada antrean aktif.' : prescriptionMode ? 'Tidak ada pasien aktif yang dapat diresepkan.' : 'Tidak ada antrean. Kembali ke Beranda.'}
                    </div>
                  )}
                  {matchingQueue.map(q => (
                    <button key={q.id} onClick={() => selectPatient(q)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left">
                      <span className="text-xs font-mono font-semibold text-primary w-12">{q.queue_number}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{q.patient_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{q.complaint || q.visit_type}</p>
                      </div>
                      {prescriptionMode
                        ? <span className="pill pill-info">Buat Resep</span>
                        : (q.status === 'Perlu Revisi Dokter' || q.status === 'Dikembalikan ke Dokter')
                          ? <span className="pill pill-warning font-semibold">Perlu Revisi</span>
                          : <span className={`pill ${q.status === 'Pemeriksaan' ? 'pill-info' : 'pill-inactive'}`}>{q.status}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {prescriptionMode && (
                <div className="panel">
                  <div className="px-3 py-2.5 border-b border-border">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Riwayat Resep Saya</h3>
                  </div>
                  {prescriptions.length === 0 ? (
                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">Belum ada riwayat resep untuk dokter ini.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {prescriptions.map((rx) => (
                        <div key={rx.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><Pill className="w-4 h-4" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{rx.patient_name || 'Pasien'}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{rx.prescription_number || 'Resep'} • {(rx.items || []).length} obat{rx.is_racikan || rx.racikan_data ? ' • Racikan' : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="pill pill-info">{rx.status || rx.workflow_status || 'Diresepkan'}</span>
                            {rx.prescription_date && <p className="text-[10px] text-muted-foreground mt-1">{new Date(rx.prescription_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          completionSummary && !isEditingCompleted ? (
            <CompletedExamSummary
              selected={selected}
              record={completionSummary.record || record}
              summary={completionSummary}
              onEdit={() => { setRevisionReason(''); setIsEditingCompleted(true); setMobileTab('soap'); }}
              onBack={() => { setSelected(null); setRecord(null); setCompletionSummary(null); navigate('/doctor'); }}
            />
          ) : (
          <div className={`h-full grid grid-cols-1 overflow-hidden ${ACTION_PANEL_LAYOUTS[actionPanelSize]}`}>
            {/* LEFT — Timeline */}
            <div className={`border-r border-border overflow-y-auto ${mobileTab === 'riwayat' ? 'block' : 'hidden lg:block'}`}>
              <PatientTimeline patientId={selected.patient_id} patientName={selected.patient_name} currentRecord={record} />
            </div>

            {/* CENTER — SOAP */}
            <div className={`overflow-y-auto p-3 ${mobileTab === 'soap' ? 'block' : 'hidden lg:block'}`}>
              <div className="space-y-3 max-w-2xl mx-auto">
                {/* Returned Prescription Alert */}
                {(selected.status === 'Perlu Revisi Dokter' || selected.status === 'Dikembalikan ke Dokter' || record?.returnedPrescription) && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 shadow-sm flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800">Resep Dikembalikan oleh Farmasi / Apoteker</p>
                      <p className="mt-0.5 text-amber-950 font-medium">
                        Alasan: {record?.returnReason || record?.returnedPrescription?.return_reason || selected?.return_reason || 'Perlu revisi obat / dosis oleh dokter.'}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-700">
                        Anda dapat memeriksa kembali pasien dan mengubah resep di panel Resep sebelah kanan, lalu konfirmasi dan simpan untuk meneruskannya kembali ke Farmasi.
                      </p>
                    </div>
                  </div>
                )}

                {/* Exam Template Bar */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setExamTplMode('load'); setShowExamTpl(true); }}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover px-2 py-1 rounded border border-primary/30 hover:bg-primary/5"
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> Muat Template
                  </button>
                  {record.diagnosis && (
                    <button
                      onClick={() => { setExamTplMode('save'); setShowExamTpl(true); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted"
                    >
                      <Save className="w-3.5 h-3.5" /> Simpan Template
                    </button>
                  )}
                </div>

                {/* Subjective */}
                <div className="panel">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="micro-label flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-blue-600" /> Keluhan</p>
                  </div>
                  <div className="p-3 space-y-2">
                    <input value={record.chief_complaint} onChange={e=>set('chief_complaint',e.target.value)} className={inputCls} placeholder={clinicalCatalog.placeholders.chiefComplaint} />
                    <textarea value={record.subjective} onChange={e=>set('subjective',e.target.value)} className={inputCls} rows={3} placeholder={clinicalCatalog.placeholders.subjective} />
                  </div>
                </div>

                {/* Objective */}
                <div className="panel">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="micro-label flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-teal-600" /> Pemeriksaan</p>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
                      {visibleVitals.includes('bp') && (
                        <div className="min-w-0"><label className="block min-h-8 text-[10px] leading-4 text-muted-foreground">TD (mmHg) · Perawat</label><input value={record.vital_signs_bp} readOnly disabled className={vitalInputCls} placeholder="Diisi perawat" /></div>
                      )}
                      {visibleVitals.includes('temp') && (
                        <div className="min-w-0"><label className="block min-h-8 text-[10px] leading-4 text-muted-foreground">Suhu (°C) · Perawat</label><input type="number" step="0.1" value={record.vital_signs_temp} readOnly disabled className={vitalInputCls} placeholder="Diisi perawat" /></div>
                      )}
                      {visibleVitals.includes('pulse') && (
                        <div className="min-w-0"><label className="block min-h-8 text-[10px] leading-4 text-muted-foreground">Nadi · Perawat</label><input type="number" value={record.vital_signs_pulse} readOnly disabled className={vitalInputCls} placeholder="Diisi perawat" /></div>
                      )}
                      {visibleVitals.includes('rr') && (
                        <div className="min-w-0"><label className="block min-h-8 text-[10px] leading-4 text-muted-foreground">RR · Perawat</label><input type="number" value={record.vital_signs_rr} readOnly disabled className={vitalInputCls} placeholder="Diisi perawat" /></div>
                      )}
                      {visibleVitals.includes('weight') && (
                        <div className="min-w-0"><label className="block min-h-8 text-[10px] leading-4 text-muted-foreground">BB (kg) · Perawat</label><input type="number" step="0.1" value={record.vital_signs_weight} readOnly disabled className={vitalInputCls} placeholder="Diisi perawat" /></div>
                      )}
                      {visibleVitals.includes('height') && (
                        <div className="min-w-0"><label className="block min-h-8 text-[10px] leading-4 text-muted-foreground">TB (cm) · Perawat</label><input type="number" value={record.vital_signs_height} readOnly disabled className={vitalInputCls} placeholder="Diisi perawat" /></div>
                      )}
                      {visibleVitals.includes('head_circumference') && (
                        <div className="min-w-0"><label className="block min-h-8 text-[10px] leading-4 text-muted-foreground">Lingkar Kepala · Perawat</label><input type="number" step="0.1" value={record.vital_signs_head_circumference} readOnly disabled className={vitalInputCls} placeholder="Diisi perawat" /></div>
                      )}
                      {visibleVitals.includes('bmi') && (
                        <div className="min-w-0">
                          <label className="block min-h-8 text-[10px] leading-4 text-muted-foreground">BMI</label>
                          <div className="px-2 py-1.5 border border-border rounded text-xs text-center font-medium">
                            {bmi ? <span className={bmiCat?.color}>{bmi.toFixed(1)}</span> : <span className="text-muted-foreground">-</span>}
                          </div>
                          {bmiCat && <p className={`text-[9px] text-center mt-0.5 ${bmiCat.color}`}>{bmiCat.label}</p>}
                        </div>
                      )}
                    </div>
                    <textarea value={record.physical_exam} onChange={e=>set('physical_exam',e.target.value)} className={inputCls} rows={2} placeholder={clinicalCatalog.placeholders.physicalExam} />
                  </div>
                </div>

                {/* Assessment */}
                <div className="panel">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="micro-label flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Diagnosis *</p>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="relative">
                      <input value={record.diagnosis} onChange={e=>set('diagnosis',e.target.value)} className={inputCls} placeholder={clinicalCatalog.placeholders.diagnosis} onFocus={() => { setIcdResults(null); setIcdSearch(true); }} />
                      {icdSearch && (
                        <div className="absolute z-20 mt-1 w-full panel max-h-48 overflow-y-auto divide-y divide-border shadow-lg">
                          <p className="border-b border-border bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground">Diagnosis cepat {clinicalCatalog.label}</p>
                          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border sticky top-0 bg-card">
                            <Search className="w-3.5 h-3.5 text-muted-foreground" />
                            <input autoFocus placeholder="Cari ICD-10…" className="flex-1 bg-transparent outline-none text-xs"
                              onChange={e => {
                                const q = e.target.value.toLowerCase();
                                setIcdResults(clinicalCatalog.icd10.filter(c => c.code.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)));
                              }} />
                            <button onClick={() => setIcdSearch(false)} className="p-0.5 hover:bg-muted rounded"><X className="w-3 h-3" /></button>
                          </div>
                          {(icdResults || clinicalCatalog.icd10).map(c => (
                            <button key={c.code} onClick={() => { set('diagnosis', c.desc); set('diagnosis_code', c.code); setIcdSearch(false); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-left text-xs">
                              <span className="font-mono font-medium text-primary w-12">{c.code}</span>
                              <span className="flex-1">{c.desc}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input value={record.diagnosis_code} onChange={e=>set('diagnosis_code',e.target.value)} className={inputCls} placeholder={clinicalCatalog.placeholders.diagnosisCode} />
                  </div>
                </div>

                {/* Plan */}
                <div className="panel">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="micro-label flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-purple-600" /> Rencana Tindakan</p>
                  </div>
                  <div className="p-3">
                    <textarea value={record.treatment_plan} onChange={e=>set('treatment_plan',e.target.value)} className={inputCls} rows={3} placeholder={clinicalCatalog.placeholders.treatmentPlan} />
                  </div>
                </div>

                {/* Clinical Prompts */}
                {(examTemplate?.show_growth_prompt || examTemplate?.show_immunization_prompt || examTemplate?.show_odontogram_link) && (
                  <div className="panel border-l-2 border-l-teal-400">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="micro-label flex items-center gap-1.5">Prompt Klinis</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {examTemplate?.show_growth_prompt && (
                        <button onClick={() => navigate(`/growth-chart?patient=${encodeURIComponent(selected.patient_id)}&visit=${encodeURIComponent(selected.visit_id || selected.encounter_id || '')}`)} className="w-full flex items-center gap-2 px-2.5 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 hover:bg-emerald-100">
                          <Baby className="w-4 h-4" /> Catat Growth Chart (BB/TB/Lingkar Kepala) untuk pasien ini
                        </button>
                      )}
                      {examTemplate?.show_immunization_prompt && (
                        <button onClick={() => navigate(`/growth-chart?patient=${encodeURIComponent(selected.patient_id)}&visit=${encodeURIComponent(selected.visit_id || selected.encounter_id || '')}`)} className="w-full flex items-center gap-2 px-2.5 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 hover:bg-blue-100">
                          <Shield className="w-4 h-4" /> Cek & catat status imunisasi pasien
                        </button>
                      )}
                      {examTemplate?.show_odontogram_link && (
                        <button onClick={() => navigate(`/odontogram?patient=${encodeURIComponent(selected.patient_id)}&visit=${encodeURIComponent(selected.visit_id || selected.encounter_id || '')}`)} className="w-full flex items-center gap-2 px-2.5 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 hover:bg-amber-100">
                          <Bone className="w-4 h-4" /> Buka Odontogram untuk pasien ini
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — Actions */}
            <div className={`border-l border-border overflow-hidden ${mobileTab === 'actions' ? 'block' : 'hidden lg:block'}`}>
              {isEditingCompleted ? (
                <div className="panel flex flex-col h-full max-h-[calc(100vh-180px)]">
                  <div className="border-b border-border px-3 py-2">
                    <p className="micro-label flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5 text-primary" /> Mode koreksi pemeriksaan</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                      Koreksi ini memperbarui catatan klinis RME yang sudah selesai tanpa membuat kunjungan, resep, tindakan, atau tagihan baru. Resep dan persetujuan dokumen tetap mengikuti versi final sebelumnya.
                    </div>
                    <label className="block">
                      <span className="micro-label block mb-1">Alasan koreksi *</span>
                      <textarea
                        value={revisionReason}
                        onChange={(event) => setRevisionReason(event.target.value)}
                        className="w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary"
                        rows={4}
                        placeholder="Contoh: Koreksi salah ketik diagnosis dan rencana terapi."
                      />
                    </label>
                  </div>
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    <button onClick={completeExam} disabled={saving} className="w-full btn-primary py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                      <Save className="w-4 h-4" /> {saving ? 'Menyimpan…' : 'Simpan Koreksi Pemeriksaan'}
                    </button>
                    <button onClick={() => { setIsEditingCompleted(false); setRevisionReason(''); }} disabled={saving} className="w-full px-3 py-2 border border-border rounded-md text-xs font-medium hover:bg-muted disabled:opacity-50">
                      Batal dan Kembali ke Ringkasan
                    </button>
                  </div>
                </div>
              ) : (
                <ClinicalActions
                  record={record}
                  setRecord={setRecord}
                  onComplete={completeExam}
                  saving={saving}
                  patient={patient}
                  doctorId={doctorId}
                  specialty={doctorProfile?.specialization}
                  role={doctorRole}
                  initialPanel={initialTab}
                  actionPanelSize={actionPanelSize}
                  onActionPanelSizeChange={setActionPanelSize}
                />
              )}
            </div>
          </div>
          )
        )}
      </div>

      <ExamTemplateModal
        open={showExamTpl}
        mode={examTplMode}
        doctorId={doctorId}
        doctorName={doctorName}
        placeholders={clinicalCatalog.placeholders}
        currentRecord={record}
        onLoad={handleLoadExamTemplate}
        onClose={() => setShowExamTpl(false)}
      />

    </div>
  );
}

function CompletedExamSummary({ selected, record, summary, onEdit, onBack }) {
  const nextStep = summary.next_status === 'Di Apotek'
    ? 'Resep diteruskan ke Farmasi untuk diverifikasi dan disiapkan.'
    : summary.next_status === 'Kasir'
      ? 'Layanan diteruskan ke Kasir untuk penagihan.'
      : summary.next_status === 'Selesai'
        ? 'Kunjungan sudah selesai.'
        : 'Pemeriksaan telah difinalkan.';
  const finishedAt = summary.revised_at || summary.finalized_at;
  const followUp = record?.follow_up_date
    ? new Date(`${record.follow_up_date}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Tidak ada jadwal kontrol';

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="panel border-emerald-200">
          <div className="flex items-start gap-3 border-b border-border px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold">Pemeriksaan pasien sudah selesai</h3>
              <p className="mt-1 text-xs text-muted-foreground">{selected.patient_name} • {selected.queue_number || 'Kunjungan'} • RME sudah difinalkan.</p>
            </div>
            <span className="pill pill-success">Selesai diperiksa</span>
          </div>
          <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
            <SummaryItem label="Status lanjutan" value={nextStep} />
            <SummaryItem label="Diagnosis" value={record?.diagnosis || 'Belum tersedia'} />
            <SummaryItem label="Rencana kontrol" value={followUp} />
            <SummaryItem label="Difinalkan" value={finishedAt ? new Date(finishedAt).toLocaleString('id-ID') : 'Baru saja'} />
          </div>
          <div className="border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Jika ada kesalahan pencatatan, klik <b className="text-foreground">Edit Pemeriksaan</b>. Sistem membuat jejak koreksi dan tidak membuat antrean, resep, atau tagihan baru.
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            <button onClick={onEdit} className="btn-primary flex items-center gap-1.5 rounded px-3 py-2 text-xs font-medium">
              <Edit3 className="h-3.5 w-3.5" /> Edit Pemeriksaan
            </button>
            <button onClick={onBack} className="flex items-center gap-1.5 rounded border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Antrean
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="micro-label">{label}</p>
      <p className="mt-1 text-xs leading-4 text-foreground">{value}</p>
    </div>
  );
}
