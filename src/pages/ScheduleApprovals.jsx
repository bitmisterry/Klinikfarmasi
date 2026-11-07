const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], list:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}), subscribe:()=>()=>{} }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Clock3, FileCheck2, RefreshCw, Users, XCircle } from 'lucide-react';

import EmptyState from '@/components/EmptyState';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

const APPROVER_ROLES = ['Owner', 'Manajer Operasional'];
const REVIEW_ACTIONS = ['Notifikasi Pasien', 'Reschedule Otomatis', 'Tidak Ada Aksi'];

const dateLabel = (value) => {
  if (!value) return '-';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const dateTimeLabel = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const statusClass = (status) => ({
  Diajukan: 'pill-warning',
  Disetujui: 'pill-success',
  Ditolak: 'pill-critical',
  Selesai: 'pill-info',
}[status] || 'pill-inactive');

export default function ScheduleApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const clinicRole = getClinicRole(user);
  const canApprove = APPROVER_ROLES.includes(clinicRole);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [reviewNotes, setReviewNotes] = useState({});
  const [rescheduleActions, setRescheduleActions] = useState({});

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const rows = await db.entities.ScheduleChangeRequest.list('-submitted_at', 100).catch(() => []);
      setRequests(rows || []);
    } catch (error) {
      toast({ title: 'Gagal memuat pengajuan cuti', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const subscribe = db.entities.ScheduleChangeRequest.subscribe;
    if (typeof subscribe !== 'function') return undefined;
    const unsubscribe = subscribe(() => load({ silent: true }));
    return () => unsubscribe?.();
  }, []);

  const pending = useMemo(() => requests.filter((request) => request.status === 'Diajukan'), [requests]);
  const reviewed = useMemo(() => requests.filter((request) => request.status !== 'Diajukan'), [requests]);
  const visibleRequests = activeTab === 'pending' ? pending : reviewed;

  const review = async (request, action) => {
    if (!canApprove || savingId) return;
    const actionLabel = action === 'approve' ? 'menyetujui' : 'menolak';
    if (!window.confirm(`Anda akan ${actionLabel} pengajuan ${request.request_type} dari ${request.doctor_name}. Lanjutkan?`)) return;
    setSavingId(request.id);
    try {
      const response = await db.functions.invoke('approveScheduleChange', {
        request_id: request.id,
        action,
        review_notes: reviewNotes[request.id] || '',
        reschedule_action: rescheduleActions[request.id] || 'Notifikasi Pasien',
      });
      const result = response?.data || response;
      toast({
        title: action === 'approve' ? 'Pengajuan disetujui' : 'Pengajuan ditolak',
        description: result?.notified ? `${result.notified} janji temu diberi notifikasi.` : 'Status pengajuan telah diperbarui.',
      });
      await load({ silent: true });
    } catch (error) {
      toast({ title: 'Gagal memproses pengajuan', description: error.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-3 lg:p-5 space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><FileCheck2 className="w-5 h-5 text-primary" /> Persetujuan Cuti & Perubahan Jadwal</h1>
          <p className="text-xs text-muted-foreground mt-1">Tinjau pengajuan dokter, cek pasien terdampak, lalu setujui atau tolak dengan jejak audit yang jelas.</p>
        </div>
        <button onClick={() => load({ silent: true })} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Muat ulang
        </button>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11px] text-blue-800 flex items-start gap-2">
        <FileCheck2 className="w-4 h-4 mt-0.5 shrink-0" />
        <div><strong>Alur persetujuan:</strong> Dokter mengajukan cuti/izin atau perubahan jadwal. Owner atau Manajer Operasional meninjau. Jika disetujui, pasien yang terdampak ditandai untuk ditindaklanjuti Front Office.</div>
      </div>

      <ModuleStatHeader stats={[
        { icon: Clock3, label: 'Menunggu persetujuan', value: pending.length, color: 'text-amber-500' },
        { icon: Check, label: 'Disetujui', value: requests.filter((request) => request.status === 'Disetujui').length, color: 'text-emerald-500' },
        { icon: XCircle, label: 'Ditolak', value: requests.filter((request) => request.status === 'Ditolak').length, color: 'text-rose-500' },
        { icon: Users, label: 'Pasien terdampak', value: pending.reduce((total, request) => total + Number(request.impacted_count || 0), 0), color: 'text-blue-500' },
      ]} />

      <div className="flex items-center gap-1 border-b border-border">
        <button onClick={() => setActiveTab('pending')} className={`px-3 py-2 text-xs font-medium border-b-2 ${activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Menunggu ({pending.length})</button>
        <button onClick={() => setActiveTab('history')} className={`px-3 py-2 text-xs font-medium border-b-2 ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Riwayat ({reviewed.length})</button>
      </div>

      {visibleRequests.length === 0 ? (
        <EmptyState icon={CalendarDays} title={activeTab === 'pending' ? 'Tidak ada pengajuan yang menunggu' : 'Belum ada riwayat persetujuan'} description={activeTab === 'pending' ? 'Pengajuan baru dari dokter akan tampil di sini.' : 'Pengajuan yang telah diproses akan tercatat di sini.'} action={null} />
      ) : (
        <div className="space-y-3">
          {visibleRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              canApprove={canApprove}
              saving={savingId === request.id}
              reviewNote={reviewNotes[request.id] || ''}
              rescheduleAction={rescheduleActions[request.id] || 'Notifikasi Pasien'}
              onReviewNote={(value) => setReviewNotes((current) => ({ ...current, [request.id]: value }))}
              onRescheduleAction={(value) => setRescheduleActions((current) => ({ ...current, [request.id]: value }))}
              onReview={review}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ request, canApprove, saving, reviewNote, rescheduleAction, onReviewNote, onRescheduleAction, onReview }) {
  const isPending = request.status === 'Diajukan';
  const impactedCount = Number(request.impacted_count || request.impacted_appointments?.length || 0);
  return (
    <article className={`panel overflow-hidden ${isPending ? 'border-l-2 border-l-amber-400' : ''}`}>
      <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isPending ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}><CalendarDays className="w-4 h-4" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{request.doctor_name || 'Dokter'}</h2><span className="pill pill-info">{request.request_type || 'Perubahan Jadwal'}</span><span className={`pill ${statusClass(request.status)}`}>{request.status}</span></div>
            <p className="text-xs text-muted-foreground mt-1">{dateLabel(request.affected_date)}{request.affected_date_end ? ` s/d ${dateLabel(request.affected_date_end)}` : ''} • Diajukan {dateTimeLabel(request.submitted_at)}</p>
          </div>
        </div>
        {impactedCount > 0 && <div className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1"><AlertTriangle className="w-3.5 h-3.5" /> {impactedCount} pasien terdampak</div>}
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div><p className="micro-label">Alasan pengajuan</p><p className="mt-1 text-foreground whitespace-pre-wrap">{request.reason || 'Tidak ada alasan yang dicantumkan.'}</p></div>
          <div><p className="micro-label">Dampak operasional</p><p className="mt-1 text-muted-foreground">{impactedCount > 0 ? 'Janji temu perlu diberi informasi atau dijadwalkan ulang setelah keputusan.' : 'Tidak ada janji temu aktif yang terdeteksi pada tanggal tersebut.'}</p></div>
        </div>

        {impactedCount > 0 && <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs"><p className="font-medium text-amber-800 mb-1">Pasien/janji temu yang terdampak</p><div className="space-y-1 text-amber-900">{(request.impacted_appointments || []).slice(0, 5).map((appointment) => <div key={appointment.appointment_id} className="flex justify-between gap-2"><span>{appointment.patient_name || 'Pasien'}</span><span>{appointment.time_slot || 'Jam belum diatur'}</span></div>)}{impactedCount > 5 && <p className="text-[11px]">dan {impactedCount - 5} pasien lainnya.</p>}</div></div>}

        {isPending && canApprove ? (
          <div className="border-t border-border pt-3 space-y-2">
            {impactedCount > 0 && <label className="block"><span className="micro-label">Tindak lanjut pasien</span><select value={rescheduleAction} onChange={(event) => onRescheduleAction(event.target.value)} className="w-full mt-1 px-2 py-1.5 border border-border rounded text-xs bg-card">{REVIEW_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>}
            <label className="block"><span className="micro-label">Catatan reviewer (opsional)</span><textarea rows={2} value={reviewNote} onChange={(event) => onReviewNote(event.target.value)} placeholder="Catatan keputusan untuk dokter dan tim terkait…" className="w-full mt-1 px-2 py-1.5 border border-border rounded text-xs resize-y" /></label>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button type="button" onClick={() => onReview(request, 'reject')} disabled={saving} className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 border border-rose-200 text-rose-700 bg-rose-50 rounded-md text-xs font-medium hover:bg-rose-100 disabled:opacity-50"><XCircle className="w-3.5 h-3.5" /> Tolak</button>
              <button type="button" onClick={() => onReview(request, 'approve')} disabled={saving} className="btn-primary inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold shadow-sm disabled:opacity-50"><Check className="w-3.5 h-3.5" /> {saving ? 'Memproses…' : 'Setujui pengajuan'}</button>
            </div>
          </div>
        ) : !isPending ? (
          <div className="border-t border-border pt-2 text-xs text-muted-foreground">Diproses oleh <strong className="text-foreground">{request.reviewed_by_name || request.reviewed_by || 'approver'}</strong> pada {dateTimeLabel(request.reviewed_at)}{request.review_notes ? ` • Catatan: ${request.review_notes}` : ''}</div>
        ) : null}
      </div>
    </article>
  );
}
