const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Plus, Save, Search, Stethoscope, User, X } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const POLI_PREFIX = { 'Poli Umum': 'U', 'Poli Anak': 'A', 'Poli Kandungan': 'K', 'Poli Gigi': 'G' };
const CLOSED_SCHEDULE_STATUS = ['Cuti', 'Izin', 'Sakit', 'Tidak Praktik', 'Dibatalkan'];
const EMPTY_PATIENT = {
  full_name: '', nik: '', gender: 'L', birth_date: '', phone: '', email: '', address: '',
  blood_type: '-', allergies: '', insurance_type: 'Umum', bpjs_number: '', insurance_number: '',
  guardian_name: '', guardian_relation: '', guardian_phone: '', emergency_contact: '',
};

const fieldClass = 'w-full px-2.5 py-2 border border-border rounded-md text-xs bg-card outline-none focus:border-primary';

export default function QueueAddForm({ onClose, onCreated }) {
  const [patients, setPatients] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [poli, setPoli] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [visitType, setVisitType] = useState('Kunjungan Baru');
  const [channel, setChannel] = useState('walk-in');
  const [payerType, setPayerType] = useState('Umum');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [priority, setPriority] = useState(false);
  const [complaint, setComplaint] = useState('');
  const [registrationNotes, setRegistrationNotes] = useState('');
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [savingPatient, setSavingPatient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const todayName = DAYS[new Date(`${today}T12:00:00`).getDay()];

  useEffect(() => {
    Promise.all([
      db.entities.Patient.list(),
      db.entities.DoctorProfile.filter({ is_active: true }).catch(() => db.entities.DoctorProfile.list()),
      db.entities.DoctorSchedule.filter({ is_active: true }).catch(() => db.entities.DoctorSchedule.list()),
      db.entities.Appointment.filter({ appointment_date: today }).catch(() => []),
    ]).then(([patientRows, profileRows, scheduleRows, appointmentRows]) => {
      setPatients(patientRows || []);
      setProfiles(profileRows || []);
      setSchedules(scheduleRows || []);
      setAppointments(appointmentRows || []);
    }).catch((error) => {
      toast({ title: 'Data pendaftaran gagal dimuat', description: error.message, variant: 'destructive' });
    }).finally(() => setLoading(false));
  }, [today, toast]);

  const scheduleOptions = useMemo(() => {
    const explicit = schedules
      .filter((item) => item.day_of_week === todayName && !CLOSED_SCHEDULE_STATUS.includes(item.status))
      .filter((item) => !item.effective_from || item.effective_from <= today)
      .filter((item) => !item.effective_until || item.effective_until >= today)
      .map((item) => ({
        id: item.id,
        doctorId: item.doctor_id,
        doctorName: item.doctor_name,
        poli: item.poli || 'Poli Umum',
        startTime: item.start_time,
        endTime: item.end_time,
      }));
    if (explicit.length) return explicit;
    return profiles
      .filter((doctor) => (doctor.practice_days || []).includes(todayName))
      .map((doctor) => ({
        id: `profile-${doctor.id}`,
        doctorId: doctor.user_id || doctor.staff_id || doctor.id,
        doctorName: doctor.display_name || doctor.full_name,
        poli: doctor.practice_room || `Poli ${doctor.specialization || 'Umum'}`,
        startTime: doctor.default_start_time || '08:00',
        endTime: doctor.default_end_time || '12:00',
      }));
  }, [profiles, schedules, today, todayName]);

  const poliOptions = useMemo(() => [...new Set(scheduleOptions.map((item) => item.poli))], [scheduleOptions]);
  const doctorOptions = scheduleOptions.filter((item) => !poli || item.poli === poli);
  const selectedSchedule = scheduleOptions.find((item) => item.id === scheduleId);

  useEffect(() => {
    if (!poli && poliOptions.length) setPoli(poliOptions[0]);
  }, [poli, poliOptions]);

  useEffect(() => {
    if (scheduleId && !doctorOptions.some((item) => item.id === scheduleId)) setScheduleId('');
    if (!scheduleId && doctorOptions.length === 1) setScheduleId(doctorOptions[0].id);
  }, [doctorOptions, scheduleId]);

  const filteredPatients = search.trim()
    ? patients.filter((patient) => {
      const query = search.toLowerCase();
      return patient.full_name?.toLowerCase().includes(query)
        || patient.mr_number?.toLowerCase().includes(query)
        || patient.phone?.includes(search);
    }).slice(0, 12)
    : [];

  const patientAppointments = appointments.filter((appointment) =>
    selectedPatient && appointment.patient_id === selectedPatient.id
      && ['Terjadwalkan', 'Dikonfirmasi', 'Pending'].includes(appointment.status));

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearch('');
    setPayerType(patient.insurance_type || 'Umum');
    setInsuranceNumber(patient.bpjs_number || patient.insurance_number || '');
    setAppointmentId('');
  };

  const chooseAppointment = (id) => {
    setAppointmentId(id);
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment) return;
    setPoli(appointment.poli || poli);
    const matchingSchedule = scheduleOptions.find((item) =>
      (item.doctorId === appointment.doctor_id || item.doctorName === appointment.doctor_name)
      && item.poli === appointment.poli);
    if (matchingSchedule) setScheduleId(matchingSchedule.id);
    setComplaint(appointment.notes || complaint);
    setChannel(appointment.source?.toLowerCase().includes('telepon') ? 'telepon' : 'online');
    setVisitType('Kontrol / Janji Temu');
  };

  const createPatient = async (allowDuplicate = false) => {
    setSavingPatient(true);
    try {
      const response = await db.functions.invoke('registerPatient', { ...patientForm, allow_duplicate: allowDuplicate });
      const result = response.data || response;
      if (result.duplicate_found) {
        setDuplicateMatches(result.matches || []);
        toast({ title: 'Kemungkinan pasien sudah terdaftar', description: 'Gunakan data yang ada agar riwayat dan alergi tidak terpisah.', variant: 'destructive' });
        return;
      }
      const patient = result.patient;
      setPatients((rows) => [...rows, patient]);
      selectPatient(patient);
      setShowNewPatient(false);
      setDuplicateMatches([]);
      setPatientForm(EMPTY_PATIENT);
      toast({ title: `Pasien ${patient.mr_number} terdaftar`, description: 'Data pasien siap digunakan pada kunjungan ini dan seluruh role terkait.' });
    } catch (error) {
      toast({ title: 'Pasien gagal didaftarkan', description: error.message, variant: 'destructive' });
    } finally {
      setSavingPatient(false);
    }
  };

  const save = async () => {
    if (!selectedPatient || !selectedSchedule || !poli || !complaint.trim()) {
      toast({ title: 'Lengkapi pasien, keluhan awal, poli, dan dokter tujuan', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const existing = await db.entities.QueueEntry.filter({ visit_date: today }, 'created_date', 500);
      const prefix = POLI_PREFIX[poli] || 'A';
      const usedNumbers = (existing || [])
        .map((queue) => queue.queue_number?.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1])
        .filter(Boolean)
        .map(Number);
      const seq = String((usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1).padStart(3, '0');
      const queueNumber = `${prefix}-${seq}`;
      const response = await db.functions.invoke('registerVisit', {
        queue_number: queueNumber,
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.full_name,
        visit_type: visitType,
        poli,
        doctor_id: selectedSchedule.doctorId,
        doctor_name: selectedSchedule.doctorName,
        schedule_id: selectedSchedule.id,
        appointment_id: appointmentId,
        priority,
        complaint: complaint.trim(),
        channel,
        payer_type: payerType,
        insurance_number: insuranceNumber,
        registration_notes: registrationNotes.trim(),
        visit_date: today,
      });
      const result = response.data || response;
      toast({
        title: result.duplicate_prevented ? 'Kunjungan aktif sudah ada' : `Kunjungan ${queueNumber} berhasil dibuat`,
        description: `${selectedPatient.full_name} → ${poli} → ${selectedSchedule.doctorName}. Berikutnya: intake perawat.`,
      });
      onCreated(result);
    } catch (error) {
      toast({ title: 'Kunjungan gagal dibuat', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3" onClick={onClose}>
      <div className="w-full max-w-3xl bg-card border border-border rounded-lg shadow-xl max-h-[94vh] flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Daftarkan Kunjungan Pasien</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pasien → poli & dokter terjadwal → antrean → intake perawat</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <section className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary" /> 1. Cari atau daftarkan pasien</p>
              <button onClick={() => { setShowNewPatient((value) => !value); setDuplicateMatches([]); }} className="text-xs text-primary font-medium flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Pasien baru
              </button>
            </div>

            {showNewPatient ? (
              <div className="bg-muted/30 rounded-md p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Field label="Nama lengkap *" className="sm:col-span-2"><input className={fieldClass} value={patientForm.full_name} onChange={(event) => setPatientForm({ ...patientForm, full_name: event.target.value })} /></Field>
                  <Field label="NIK (16 digit)"><input className={fieldClass} inputMode="numeric" maxLength={16} value={patientForm.nik} onChange={(event) => setPatientForm({ ...patientForm, nik: event.target.value.replace(/\D/g, '') })} /></Field>
                  <Field label="Tanggal lahir *"><input type="date" className={fieldClass} value={patientForm.birth_date} onChange={(event) => setPatientForm({ ...patientForm, birth_date: event.target.value })} /></Field>
                  <Field label="Jenis kelamin *"><select className={fieldClass} value={patientForm.gender} onChange={(event) => setPatientForm({ ...patientForm, gender: event.target.value })}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></Field>
                  <Field label="Telepon"><input className={fieldClass} value={patientForm.phone} onChange={(event) => setPatientForm({ ...patientForm, phone: event.target.value })} /></Field>
                  <Field label="Jenis penjamin"><select className={fieldClass} value={patientForm.insurance_type} onChange={(event) => setPatientForm({ ...patientForm, insurance_type: event.target.value })}><option>Umum</option><option>BPJS</option><option>Asuransi</option></select></Field>
                  <Field label="Nomor penjamin"><input className={fieldClass} value={patientForm.bpjs_number} onChange={(event) => setPatientForm({ ...patientForm, bpjs_number: event.target.value, insurance_number: event.target.value })} /></Field>
                  <Field label="Alamat" className="sm:col-span-2"><textarea rows={2} className={fieldClass} value={patientForm.address} onChange={(event) => setPatientForm({ ...patientForm, address: event.target.value })} /></Field>
                  <Field label="Nama orang tua / wali"><input className={fieldClass} value={patientForm.guardian_name} onChange={(event) => setPatientForm({ ...patientForm, guardian_name: event.target.value })} /></Field>
                  <Field label="Hubungan wali"><input className={fieldClass} placeholder="Ibu/Ayah/Wali" value={patientForm.guardian_relation} onChange={(event) => setPatientForm({ ...patientForm, guardian_relation: event.target.value })} /></Field>
                  <Field label="Telepon orang tua / wali" className="sm:col-span-2"><input className={fieldClass} value={patientForm.guardian_phone} onChange={(event) => setPatientForm({ ...patientForm, guardian_phone: event.target.value })} /></Field>
                  <div className="sm:col-span-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
                    Alergi dan tanda vital akan dikonfirmasi Perawat pada tahap intake, sehingga Front Office tidak mengisi data klinis.
                  </div>
                </div>

                {duplicateMatches.length > 0 && (
                  <div className="border border-amber-300 bg-amber-50 rounded-md p-3">
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Data mirip sudah ditemukan</p>
                    <div className="mt-2 space-y-1.5">
                      {duplicateMatches.map((patient) => (
                        <button key={patient.id} onClick={() => { selectPatient(patient); setShowNewPatient(false); setDuplicateMatches([]); }} className="w-full text-left border border-amber-200 bg-white rounded px-2.5 py-2 text-xs hover:border-primary">
                          <span className="font-medium">{patient.full_name}</span> <span className="text-muted-foreground">• {patient.mr_number} • {patient.birth_date}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => createPatient(true)} disabled={savingPatient} className="mt-2 text-[11px] text-amber-800 underline">Data memang pasien berbeda — tetap buat RM baru</button>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowNewPatient(false)} className="px-3 py-1.5 border border-border rounded text-xs">Batal</button>
                  <button onClick={() => createPatient(false)} disabled={savingPatient} className="btn-primary px-3 py-1.5 rounded text-xs disabled:opacity-50">{savingPatient ? 'Menyimpan…' : 'Simpan & pilih pasien'}</button>
                </div>
              </div>
            ) : selectedPatient ? (
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/30 rounded-md px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0"><p className="text-xs font-semibold">{selectedPatient.full_name}</p><p className="text-[11px] text-muted-foreground">{selectedPatient.mr_number} • {selectedPatient.birth_date || '-'} • {selectedPatient.phone || '-'}</p></div>
                <button onClick={() => setSelectedPatient(null)} className="p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 px-2.5 py-2 border border-border rounded-md"><Search className="w-3.5 h-3.5 text-muted-foreground" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, nomor RM, atau telepon…" className="flex-1 bg-transparent outline-none text-xs" /></div>
                {search && <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-20 max-h-56 overflow-y-auto">
                  {filteredPatients.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">Pasien tidak ditemukan. Gunakan tombol Pasien baru.</p>}
                  {filteredPatients.map((patient) => <button key={patient.id} onClick={() => selectPatient(patient)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted text-left text-xs"><User className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-medium">{patient.full_name}</span><span className="text-muted-foreground ml-auto">{patient.mr_number} • {patient.phone || '-'}</span></button>)}
                </div>}
              </div>
            )}

            {selectedPatient && patientAppointments.length > 0 && (
              <Field label="Janji temu hari ini">
                <select className={fieldClass} value={appointmentId} onChange={(event) => chooseAppointment(event.target.value)}>
                  <option value="">Walk-in / tanpa janji</option>
                  {patientAppointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointment.time_slot} • {appointment.poli} • {appointment.doctor_name}</option>)}
                </select>
              </Field>
            )}
          </section>

          <section className="rounded-md border border-border p-3 space-y-3">
            <p className="text-xs font-semibold flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5 text-primary" /> 2. Tentukan layanan dan dokter terjadwal</p>
            {loading ? <p className="text-xs text-muted-foreground">Memuat jadwal dokter…</p> : scheduleOptions.length === 0 ? (
              <div className="border border-amber-300 bg-amber-50 rounded-md p-3 text-xs text-amber-800"><AlertCircle className="w-4 h-4 inline mr-1" /> Tidak ada dokter praktik pada {todayName}. Tambahkan atau aktifkan jadwal dokter sebelum mendaftarkan kunjungan.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Poli tujuan *"><select className={fieldClass} value={poli} onChange={(event) => { setPoli(event.target.value); setScheduleId(''); }}><option value="">Pilih poli</option>{poliOptions.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Dokter & jadwal praktik *"><select className={fieldClass} value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}><option value="">Pilih dokter</option>{doctorOptions.map((item) => <option key={item.id} value={item.id}>{item.doctorName} • {item.startTime}-{item.endTime}</option>)}</select></Field>
                <Field label="Jenis kunjungan"><select className={fieldClass} value={visitType} onChange={(event) => setVisitType(event.target.value)}><option>Kunjungan Baru</option><option>Kontrol / Janji Temu</option><option>Rujukan Internal</option></select></Field>
                <Field label="Kanal registrasi"><select className={fieldClass} value={channel} onChange={(event) => setChannel(event.target.value)}><option value="walk-in">Walk-in</option><option value="telepon">Telepon</option><option value="online">Online / konsultasi online</option></select></Field>
                <Field label="Penjamin"><select className={fieldClass} value={payerType} onChange={(event) => setPayerType(event.target.value)}><option>Umum</option><option>BPJS</option><option>Asuransi</option></select></Field>
                <Field label="Nomor penjamin"><input className={fieldClass} value={insuranceNumber} onChange={(event) => setInsuranceNumber(event.target.value)} disabled={payerType === 'Umum'} /></Field>
                {payerType === 'BPJS' && <div className="sm:col-span-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800"><strong>Data BPJS tersimpan pada visit ini.</strong> Integrasi SATUSEHAT/PCare belum dikonfigurasi pada demo lokal, sehingga sistem tidak mengklaim eligibilitas, SEP, atau pengiriman data ke layanan pemerintah. Aktivasi produksi memerlukan kredensial dan persetujuan fasilitas kesehatan.</div>}
                <Field label="Keluhan awal (bukan diagnosis) *" className="sm:col-span-2"><textarea rows={2} className={fieldClass} value={complaint} onChange={(event) => setComplaint(event.target.value)} placeholder="Keluhan yang disampaikan pasien untuk diteruskan ke perawat dan dokter" /></Field>
                <Field label="Catatan administrasi" className="sm:col-span-2"><input className={fieldClass} value={registrationNotes} onChange={(event) => setRegistrationNotes(event.target.value)} placeholder="Opsional; tidak masuk catatan diagnosis" /></Field>
              </div>
            )}
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={priority} onChange={(event) => setPriority(event.target.checked)} className="w-4 h-4" /><AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Prioritas layanan (urgensi/lansia/difabel)</label>
          </section>

          {selectedSchedule && <div className="rounded-md bg-teal-50 border border-teal-200 p-3 text-xs text-teal-800 flex items-start gap-2"><CalendarDays className="w-4 h-4 mt-0.5" /><div><p className="font-semibold">Rute kunjungan terkonfirmasi</p><p className="mt-0.5">{poli} • {selectedSchedule.doctorName} • {selectedSchedule.startTime}-{selectedSchedule.endTime}. Setelah dipanggil dan hadir, pasien masuk antrean intake perawat; dokter menerima pasien setelah intake selesai.</p></div></div>}
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={save} disabled={saving || !selectedPatient || !selectedSchedule || !complaint.trim()} className="btn-primary px-4 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> {saving ? 'Mendaftarkan…' : 'Buat Visit & Antrean'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return <label className={className}><span className="micro-label block mb-1">{label}</span>{children}</label>;
}
