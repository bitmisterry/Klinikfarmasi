const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';

import { useAuth } from '@/lib/AuthContext';
import { UserPlus, Clock, Calendar, Users, Phone, Plus, ClipboardPlus, UsersRound, CheckCircle2, FileCheck } from 'lucide-react';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import QueueAddForm from '@/components/QueueAddForm';
import RoleWorkflowGuide from '@/components/RoleWorkflowGuide';
import AppointmentConfirmationPanel from '@/components/frontdesk/AppointmentConfirmationPanel';
import { useToast } from '@/components/ui/use-toast';

export default function FrontDesk() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [queues, setQueues] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [confirmingAppointmentId, setConfirmingAppointmentId] = useState(null);
  const [familyForm, setFamilyForm] = useState({ family_name: '', parent_name: '', parent_phone: '', parent_relation: 'Ibu', address: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [q, a, f] = await Promise.all([
        db.entities.QueueEntry.filter({ visit_date: today }).catch(() => []),
        db.entities.Appointment.list().catch(() => []),
        db.entities.FamilyAccount.list().catch(() => []),
      ]);
      setQueues(q || []);
      setAppointments((a || []).filter(ap => ap.appointment_date >= today).slice(0, 10));
      setFamilies(f || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const todayQueues = queues.filter(q => q.status !== 'Selesai' && q.status !== 'Batal');
  const waiting = todayQueues.filter(q => q.status === 'Menunggu' || q.status === 'Dipanggil');
  const waitingIntake = todayQueues.filter(q => q.status === 'Menunggu Intake' || q.status === 'Siap Dokter');
  const inProgress = todayQueues.filter(q => q.status === 'Pemeriksaan' || q.status === 'Selesai Periksa');

  const dailyDoctorVisits = queues
    .filter(q => q.status !== 'Batal')
    .reduce((groups, queue) => {
      const key = queue.doctor_id || queue.doctor_name || 'unassigned';
      const current = groups[key] || { doctor_name: queue.doctor_name || 'Dokter belum ditentukan', poli: queue.loket || '-', total: 0, waiting: 0, ready: 0, completed: 0 };
      current.total += 1;
      if (['Menunggu', 'Dipanggil'].includes(queue.status)) current.waiting += 1;
      if (['Menunggu Intake', 'Siap Dokter'].includes(queue.status)) current.ready += 1;
      if (['Selesai Periksa', 'Selesai'].includes(queue.status)) current.completed += 1;
      groups[key] = current;
      return groups;
    }, {});

  const saveFamily = async () => {
    if (!familyForm.family_name.trim() || !familyForm.parent_name.trim()) {
      toast({ title: 'Nama keluarga & orang tua wajib diisi', variant: 'destructive' });
      return;
    }
    try {
      await db.entities.FamilyAccount.create({
        ...familyForm,
        child_patient_ids: [],
        child_names: [],
      });
      toast({ title: 'Keluarga terdaftar' });
      setShowFamilyForm(false);
      setFamilyForm({ family_name: '', parent_name: '', parent_phone: '', parent_relation: 'Ibu', address: '' });
      loadData();
    } catch (e) {
      toast({ title: 'Gagal mendaftarkan keluarga', description: e.message, variant: 'destructive' });
    }
  };

  const confirmAppointment = async (appointment, channel) => {
    setConfirmingAppointmentId(appointment.id);
    const timestamp = new Date().toISOString();
    try {
      await db.entities.Appointment.update(appointment.id, {
        status: 'Dikonfirmasi',
        confirmation_status: 'Terkonfirmasi',
        confirmation_channel: channel,
        notification_status: 'Tercatat',
        notification_sent_at: timestamp,
        confirmed_at: timestamp,
        confirmed_by: user?.id || '',
        confirmed_by_name: user?.full_name || 'Front Office',
      });
      await db.entities.Notification.create({
        type: 'appointment_confirmation',
        target_role: 'Front Office',
        title: `Janji temu dikonfirmasi — ${appointment.patient_name || 'Pasien'}`,
        body: `Konfirmasi ${channel} untuk ${appointment.appointment_date} ${appointment.time_slot || ''} dengan ${appointment.doctor_name || 'dokter tujuan'} tercatat di sistem lokal.`,
        priority: 'Normal',
        related_entity: 'Appointment',
        related_id: appointment.id,
        delivery_channel: channel,
        delivery_status: 'Tercatat',
        is_read: true,
        status: 'Tercatat',
      });
      await db.entities.AuditLog.create({
        action: 'confirm_notification',
        entity: 'Appointment',
        entity_id: appointment.id,
        entity_name: appointment.patient_name || 'Pasien',
        module: 'front_desk',
        description: `Konfirmasi janji temu dicatat melalui ${channel}`,
        user_id: user?.id || '',
        user_name: user?.full_name || 'Front Office',
        user_role: 'Front Office',
        timestamp,
      });
      toast({ title: 'Janji temu terkonfirmasi', description: `Status ${channel} tercatat dan siap ditindaklanjuti Front Office.` });
      await loadData();
    } catch (e) {
      toast({ title: 'Konfirmasi gagal', description: e.message, variant: 'destructive' });
    } finally {
      setConfirmingAppointmentId(null);
    }
  };

  const stats = [
    { label: 'Menunggu', value: waiting.length, icon: Clock, color: 'text-amber-500' },
    { label: 'Intake / Siap Dokter', value: waitingIntake.length, icon: Clock, color: 'text-teal-500' },
    { label: 'Pemeriksaan', value: inProgress.length, icon: Clock, color: 'text-blue-500' },
    { label: 'Janji Temu', value: appointments.length, icon: Calendar, color: 'text-emerald-500' },
  ];

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Front Desk</h1>
          <p className="text-xs text-muted-foreground">Registrasi pasien, antrean, janji temu & akun keluarga</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/patients?action=new" className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted">
            <UserPlus className="w-3.5 h-3.5" /> Pasien Baru
          </a>
          <button onClick={() => setShowVisitForm(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary-hover">
            <ClipboardPlus className="w-3.5 h-3.5" /> Daftar Kunjungan
          </button>
          <a href="/front-desk/documents" className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted">
            <FileCheck className="w-3.5 h-3.5" /> Dokumen Disetujui
          </a>
        </div>
      </div>

      <RoleWorkflowGuide role="Front Office" />

      <ModuleStatHeader stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Queue */}
        <div className="panel p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" /> Antrean Hari Ini
          </h3>
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Memuat…</p>
          ) : todayQueues.length === 0 ? (
            <EmptyState icon={Clock} title="Antrean kosong" description="Belum ada pasien terdaftar hari ini" />
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {todayQueues.map(q => (
                <div key={q.id} className="flex items-center gap-2 p-2 border border-border rounded-md text-xs">
                  <span className="font-mono font-medium text-primary w-12">{q.queue_number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{q.patient_name}</p>
                    <p className="text-[10px] text-muted-foreground">{q.loket || q.visit_type} • {q.doctor_name || 'Dokter belum ditentukan'}</p>
                    <p className="text-[10px] text-muted-foreground">Penanggung jawab: {q.handoff_to || (q.status === 'Siap Dokter' ? 'Dokter tujuan' : q.status === 'Menunggu Intake' ? 'Perawat / Intake' : 'Front Office')}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Visit: {q.visit_id || q.encounter_id || '-'}</p>
                  </div>
                  <span className={`pill ${
                    q.status === 'Menunggu' ? 'pill-warning' :
                    q.status === 'Pemeriksaan' ? 'pill-info' :
                    'pill-success'
                  }`}>{q.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <AppointmentConfirmationPanel appointments={appointments} onConfirm={confirmAppointment} busyId={confirmingAppointmentId} />

        <div className="panel p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <UsersRound className="w-4 h-4 text-primary" /> Kunjungan Hari Ini per Dokter
          </h3>
          {Object.keys(dailyDoctorVisits).length === 0 ? (
            <EmptyState icon={Calendar} title="Belum ada kunjungan hari ini" />
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {Object.values(dailyDoctorVisits).map((group) => (
                <div key={`${group.doctor_name}-${group.poli}`} className="border border-border rounded-md p-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5" />
                    <div className="flex-1 min-w-0"><p className="font-medium truncate">{group.doctor_name}</p><p className="text-[10px] text-muted-foreground">{group.poli}</p></div>
                    <span className="pill pill-info">{group.total} kunjungan</span>
                  </div>
                  <div className="flex gap-3 pl-5 mt-1.5 text-[10px] text-muted-foreground"><span>Menunggu {group.waiting}</span><span>Siap/intake {group.ready}</span><span>Selesai {group.completed}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Family Accounts */}
        <div className="panel p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" /> Akun Keluarga
            </h3>
            <button onClick={() => setShowFamilyForm(!showFamilyForm)} className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover">
              <Plus className="w-3.5 h-3.5" /> Daftar Keluarga
            </button>
          </div>

          {showFamilyForm && (
            <div className="mb-3 p-3 bg-muted/50 rounded-md space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={familyForm.family_name} onChange={e => setFamilyForm({ ...familyForm, family_name: e.target.value })} placeholder="Nama keluarga" className="px-2 py-1.5 text-xs border border-border rounded bg-card" />
                <input value={familyForm.parent_name} onChange={e => setFamilyForm({ ...familyForm, parent_name: e.target.value })} placeholder="Nama orang tua/wali" className="px-2 py-1.5 text-xs border border-border rounded bg-card" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={familyForm.parent_phone} onChange={e => setFamilyForm({ ...familyForm, parent_phone: e.target.value })} placeholder="No. telepon" className="px-2 py-1.5 text-xs border border-border rounded bg-card" />
                <select value={familyForm.parent_relation} onChange={e => setFamilyForm({ ...familyForm, parent_relation: e.target.value })} className="px-2 py-1.5 text-xs border border-border rounded bg-card">
                  {['Ayah', 'Ibu', 'Wali', 'Kakek', 'Nenek', 'Lainnya'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <input value={familyForm.address} onChange={e => setFamilyForm({ ...familyForm, address: e.target.value })} placeholder="Alamat" className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card" />
              <div className="flex gap-2">
                <button onClick={saveFamily} className="btn-primary text-xs px-3 py-1.5 rounded">Simpan</button>
                <button onClick={() => setShowFamilyForm(false)} className="text-xs px-3 py-1.5 rounded border border-border">Batal</button>
              </div>
            </div>
          )}

          {families.length === 0 ? (
            <EmptyState icon={Users} title="Belum ada akun keluarga" description="Daftarkan keluarga untuk mengelola imunisasi anak" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {families.map(f => (
                <div key={f.id} className="p-3 border border-border rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <p className="text-sm font-medium">{f.family_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.parent_name} ({f.parent_relation})</p>
                  {f.parent_phone && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5"><Phone className="w-3 h-3" />{f.parent_phone}</p>}
                  {f.child_names?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {f.child_names.map((n, i) => <span key={i} className="pill pill-info">{n}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
        Front Office hanya mengelola identitas, jadwal, keluhan awal, kunjungan, antrean, dan konfirmasi kedatangan. Rekam medis, diagnosis, resep, harga, serta laporan keuangan tetap berada pada role yang berwenang.
      </div>
      {showVisitForm && <QueueAddForm onClose={() => setShowVisitForm(false)} onCreated={() => { setShowVisitForm(false); loadData(); }} />}
    </div>
  );
}
