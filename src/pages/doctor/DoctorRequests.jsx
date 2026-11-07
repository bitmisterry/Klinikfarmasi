const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Pill, CalendarClock, AlertCircle, X, MessageSquare, Send, ArrowRightLeft, Eye, Stethoscope } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/doctorContext';

export default function DoctorRequests() {
  const { user } = useAuth();
  const { doctorUserId, isAssistant, loading: ctxLoading } = useDoctorContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('notifikasi');
  const [notifications, setNotifications] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [referralRecord, setReferralRecord] = useState(null);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [loading, setLoading] = useState(true);

  const doctorId = doctorUserId;

  useEffect(() => { if (doctorId) load(); }, [doctorId]);

  const load = async () => {
    try {
      const [notifs, fbs, referralRows] = await Promise.all([
        db.entities.Notification.filter({ target_role: 'Dokter' }, '-created_date', 30).catch(() => []),
        db.entities.ClinicalFeedback.list('-created_date', 20).catch(() => []),
        db.entities.InternalRequest.filter({ type: 'Rujukan Internal' }, '-created_date', 30).catch(() => []),
      ]);
      setNotifications(notifs || []);
      setFeedbacks(fbs || []);
      setReferrals(referralRows || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openRevision = async (fb) => {
    try {
      let queueEntryId = fb.queue_entry_id;
      if (!queueEntryId && fb.prescription_id) {
        const rx = await db.entities.Prescription.get(fb.prescription_id).catch(() => null);
        queueEntryId = rx?.queue_entry_id;
      }
      if (!queueEntryId && fb.patient_id) {
        const queues = await db.entities.QueueEntry.filter({ patient_id: fb.patient_id }).catch(() => []);
        queueEntryId = queues?.[0]?.id;
      }
      if (queueEntryId) {
        navigate(`/doctor/exam?queue=${queueEntryId}&tab=resep`);
      } else {
        navigate('/doctor/exam?tab=resep');
      }
    } catch {
      navigate('/doctor/exam?tab=resep');
    }
  };

  const openNotificationAction = async (n) => {
    await markRead(n);
    if (n.related_entity === 'Prescription' && n.related_id) {
      const rx = await db.entities.Prescription.get(n.related_id).catch(() => null);
      if (rx?.queue_entry_id) {
        navigate(`/doctor/exam?queue=${rx.queue_entry_id}&tab=resep`);
        return;
      }
    }
    if (n.action_payload) {
      navigate(n.action_payload);
    } else {
      navigate('/doctor/exam?tab=resep');
    }
  };

  const openReferral = async (referral) => {
    try {
      const medicalRecord = referral.medical_record_id
        ? await db.entities.MedicalRecord.get(referral.medical_record_id)
        : null;
      if (!medicalRecord) throw new Error('Rekam medis rujukan tidak tersedia untuk akun ini');
      setSelectedReferral(referral);
      setReferralRecord(medicalRecord);
      if (referral.to_user_id === doctorId && referral.status === 'Baru') {
        await db.entities.InternalRequest.update(referral.id, { status: 'Dibaca', opened_at: new Date().toISOString() });
        load();
      }
    } catch (error) {
      toast({ title: 'Rujukan tidak dapat dibuka', description: error.message, variant: 'destructive' });
    }
  };

  const markRead = async (n) => {
    try {
      await db.entities.Notification.update(n.id, { is_read: true });
      load();
    } catch {}
  };

  const reviewFeedback = async (fb, action) => {
    try {
      await db.entities.ClinicalFeedback.update(fb.id, {
        status: action === 'approve' ? 'Perlu Resep Pengganti' : 'Selesai',
        review_action: action,
        reviewed_at: new Date().toISOString(),
      });
      toast({
        title: action === 'approve' ? 'Permintaan telah ditinjau' : 'Feedback ditandai selesai',
        description: action === 'approve' ? 'Keputusan substitusi tetap dibuat dokter melalui resep pengganti; resep asli tidak diubah.' : undefined,
      });
      load();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const sendAnnouncement = async (data) => {
    try {
      await db.entities.Notification.create({
        type: 'announcement',
        target_role: data.target_role,
        title: data.title,
        body: data.message,
        priority: data.priority || 'Normal',
      });
      toast({ title: 'Pengumuman terkirim' });
      setShowAnnounce(false);
    } catch (e) {
      toast({ title: 'Gagal mengirim', description: e.message, variant: 'destructive' });
    }
  };

  if (ctxLoading || loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-3 lg:p-5 space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Permintaan & Notifikasi</h1>
        {!isAssistant && (
          <button onClick={() => setShowAnnounce(true)} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-md text-xs font-medium">
            <Send className="w-3.5 h-3.5" /> Kirim Info
          </button>
        )}
      </div>

      <div className="flex border border-border rounded-md overflow-hidden text-xs">
        {[
          { k: 'notifikasi', l: 'Notifikasi', count: notifications.filter(n => !n.is_read).length },
          { k: 'feedback', l: 'Feedback Farmasi', count: feedbacks.filter(f => f.status === 'Baru').length },
          { k: 'rujukan', l: 'Rujukan Internal', count: referrals.filter(r => r.to_user_id === doctorId && r.status === 'Baru').length },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex-1 px-3 py-2 font-medium flex items-center justify-center gap-1.5 ${tab === t.k ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>
            {t.l}
            {t.count > 0 && <span className="text-[9px] bg-rose-500 text-white px-1.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'notifikasi' && (
        <div className="panel divide-y divide-border">
          {notifications.length === 0 && (
            <div className="px-3 py-10 text-center">
              <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Tidak ada notifikasi</p>
            </div>
          )}
          {notifications.map(n => (
            <div key={n.id} className={`px-3 py-2.5 transition-colors ${!n.is_read ? 'border-l-2 border-l-primary bg-primary/5' : 'bg-card'}`}>
              <div className="flex items-start gap-2">
                <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                  n.priority === 'Mendesak' ? 'bg-rose-100 text-rose-600' : n.priority === 'Penting' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {n.type === 'prescription' ? <Pill className="w-3.5 h-3.5" /> : n.type === 'schedule_change' ? <CalendarClock className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${!n.is_read ? 'bg-primary' : 'bg-transparent'}`} aria-label={n.is_read ? 'Sudah dibaca' : 'Belum dibaca'} /><p className="text-xs font-medium">{n.title}</p>{!n.is_read && <span className="text-[9px] font-medium text-primary">Baru</span>}</div>
                  <p className="text-[11px] text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{n.created_date ? new Date(n.created_date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Waktu tidak tersedia'} · {n.is_read ? 'Sudah dibaca' : 'Belum dibaca'}</p>
                  {(n.type === 'prescription_returned' || n.related_entity === 'Prescription') && (
                    <button
                      type="button"
                      onClick={() => openNotificationAction(n)}
                      className="mt-2 text-xs px-3 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 flex items-center gap-1.5 font-medium shadow-sm w-fit"
                    >
                      <Stethoscope className="w-3.5 h-3.5" /> Buka Pemeriksaan & Revisi Resep
                    </button>
                  )}
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n)} className="text-[10px] text-primary hover:text-primary-hover">Tandai dibaca</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'feedback' && (
        <div className="panel divide-y divide-border">
          {feedbacks.length === 0 && (
            <div className="px-3 py-10 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Tidak ada feedback dari farmasi</p>
            </div>
          )}
          {feedbacks.map(f => (
            <div key={f.id} className="px-3 py-3">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-7 h-7 rounded bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{f.subject}</p>
                  <p className="text-[11px] text-muted-foreground">{f.message}</p>
                  {f.alternative_medicine_name && (
                    <p className="text-[11px] text-emerald-600 mt-1">Alternatif: {f.alternative_medicine_name}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">Dari: {f.from_name} • {f.from_role}</p>
                </div>
                <span className={`pill ${f.status === 'Baru' ? 'pill-warning' : f.status === 'Perlu Resep Pengganti' ? 'pill-warning' : f.status === 'Direview' ? 'pill-info' : 'pill-inactive'}`}>{f.status}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-9">
                <button
                  type="button"
                  onClick={() => openRevision(f)}
                  className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 flex items-center gap-1.5 font-medium shadow-sm transition-colors"
                >
                  <Stethoscope className="w-3.5 h-3.5" /> Buka Pemeriksaan & Revisi Resep
                </button>
                {f.status === 'Baru' && (
                  <button onClick={() => reviewFeedback(f, 'done')} className="text-[11px] px-2.5 py-1.5 bg-muted text-muted-foreground border border-border rounded-md hover:bg-muted/70">
                    Tandai Selesai
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'rujukan' && (
        <div className="panel divide-y divide-border">
          {referrals.length === 0 && (
            <div className="px-3 py-10 text-center">
              <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Tidak ada rujukan internal untuk dokter ini</p>
            </div>
          )}
          {referrals.map((referral) => {
            const incoming = referral.to_user_id === doctorId;
            return (
              <div key={referral.id} className="px-3 py-3">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><ArrowRightLeft className="w-3.5 h-3.5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{referral.patient_name}</p>
                      <span className={`pill ${incoming ? 'pill-info' : 'pill-inactive'}`}>{incoming ? 'Masuk' : 'Dikirim'}</span>
                      <span className="pill pill-warning">{referral.status}</span>
                    </div>
                    <p className="text-[11px] mt-1"><span className="font-medium">Alasan:</span> {referral.reason}</p>
                    {referral.clinical_summary && <p className="text-[11px] text-muted-foreground mt-1">{referral.clinical_summary}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{referral.from_user_name} → {referral.to_user_name}</p>
                  </div>
                  <button onClick={() => openReferral(referral)} className="flex items-center gap-1 px-2 py-1 border border-border rounded text-[10px] hover:bg-muted">
                    <Eye className="w-3 h-3" /> Buka RM
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAnnounce && (
        <AnnounceForm onClose={() => setShowAnnounce(false)} onSend={sendAnnouncement} />
      )}

      {selectedReferral && referralRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => { setSelectedReferral(null); setReferralRecord(null); }}>
          <div className="w-full max-w-2xl bg-card border border-border rounded-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-card">
              <div>
                <h2 className="text-sm font-semibold">Rekam Medis Rujukan — {selectedReferral.patient_name}</h2>
                <p className="text-[11px] text-muted-foreground">Akses diberikan karena: {selectedReferral.reason}</p>
              </div>
              <button onClick={() => { setSelectedReferral(null); setReferralRecord(null); }} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <ClinicalField label="Dokter Perujuk" value={referralRecord.doctor_name} />
              <ClinicalField label="Tanggal Kunjungan" value={referralRecord.visit_date} />
              <ClinicalField label="Keluhan Utama" value={referralRecord.chief_complaint} wide />
              <ClinicalField label="Anamnesis" value={referralRecord.subjective} wide />
              <ClinicalField label="Pemeriksaan Fisik" value={referralRecord.physical_exam} wide />
              <ClinicalField label="Diagnosis" value={`${referralRecord.diagnosis_code || ''} ${referralRecord.diagnosis || ''}`.trim()} wide />
              <ClinicalField label="Rencana Terapi" value={referralRecord.treatment_plan} wide />
              <ClinicalField label="Edukasi / Catatan" value={referralRecord.patient_education || referralRecord.notes} wide />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClinicalField({ label, value, wide = false }) {
  return (
    <div className={`${wide ? 'sm:col-span-2' : ''} rounded border border-border p-2.5`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">{value || '-'}</p>
    </div>
  );
}

function AnnounceForm({ onClose, onSend }) {
  const [form, setForm] = useState({ target_role: 'Front Office', title: '', message: '', priority: 'Normal' });
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Kirim Informasi/Pengumuman</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tujuan</label>
            <select value={form.target_role} onChange={e => setForm(f => ({ ...f, target_role: e.target.value }))} className={inputCls}>
              <option>Front Office</option>
              <option>Apoteker</option>
              <option>Kasir</option>
              <option>Admin</option>
              <option>Owner</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Judul</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Judul pesan…" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Pesan</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={inputCls} rows={3} placeholder="Isi pesan…" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Prioritas</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
              <option>Normal</option>
              <option>Penting</option>
              <option>Mendesak</option>
            </select>
          </div>
          <button onClick={() => onSend(form)} className="w-full btn-primary py-2 rounded text-xs font-medium flex items-center justify-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Kirim
          </button>
        </div>
      </div>
    </div>
  );
}
