// @ts-nocheck -- Patient records include migrated optional local fields.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Search, Plus, User, X, AlertCircle, Edit2, Users, Shield } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import PatientDetailDrawer from '@/components/PatientDetailDrawer';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { canPerform, getClinicRole } from '@/lib/roles';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const { toast } = useToast();
  const { user, roles } = useAuth();
  const clinicRole = getClinicRole(user);
  const canCreate = canPerform('/patients', clinicRole, 'create', roles);
  const canEdit = canPerform('/patients', clinicRole, 'edit', roles);
  const canSeeClinicalFlags = clinicRole !== 'Front Office';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') setShowForm(true);
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try { setPatients(await db.entities.Patient.list() || []); } catch {}
    setLoading(false);
  };

  const filtered = patients.filter(p =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.mr_number?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search)
  );

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Pasien & Registrasi</h1>
        {canCreate && <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded-md text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Pasien Baru
        </button>}
      </div>

      <ModuleStatHeader stats={[
        { icon: Users, label: 'Total Pasien', value: patients.length, color: 'text-blue-600' },
        { icon: Shield, label: 'BPJS', value: patients.filter(p => p.insurance_type === 'BPJS').length, color: 'text-teal-600' },
        { icon: User, label: 'Umum', value: patients.filter(p => p.insurance_type === 'Umum' || !p.insurance_type).length, color: 'text-amber-600' },
        canSeeClinicalFlags
          ? { icon: AlertCircle, label: 'Punya Alergi', value: patients.filter(p => p.allergies).length, color: 'text-rose-600' }
          : { icon: User, label: 'Data Identitas', value: patients.length, color: 'text-slate-600' },
      ]} />

      <div className="panel">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, nomor RM, atau telepon…"
            className="flex-1 bg-transparent outline-none text-sm" />
          <span className="text-xs text-muted-foreground">{filtered.length} pasien</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="px-3 py-2 micro-label">No. RM</th>
                <th className="px-3 py-2 micro-label">Nama</th>
                <th className="px-3 py-2 micro-label">L/P</th>
                <th className="px-3 py-2 micro-label hidden sm:table-cell">Tgl Lahir</th>
                <th className="px-3 py-2 micro-label hidden md:table-cell">Telepon</th>
                <th className="px-3 py-2 micro-label">Asuransi</th>
                {canSeeClinicalFlags && <th className="px-3 py-2 micro-label hidden lg:table-cell">Alergi</th>}
                <th className="px-3 py-2 micro-label text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => (
                <tr key={p.id} className="row-hover cursor-pointer" onClick={() => setSelectedPatient(p)}>
                   <td className="px-3 py-2 font-mono text-primary">{p.mr_number || '-'}</td>
                   <td className="px-3 py-2 font-medium">{p.full_name}</td>
                   <td className="px-3 py-2">{p.gender}</td>
                   <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{p.birth_date || '-'}</td>
                   <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{p.phone || '-'}</td>
                   <td className="px-3 py-2"><span className="pill pill-info">{p.insurance_type || 'Umum'}</span></td>
                   {canSeeClinicalFlags && <td className="px-3 py-2 hidden lg:table-cell">
                     {p.allergies ? <span className="pill pill-critical">{p.allergies}</span> : <span className="text-muted-foreground">-</span>}
                   </td>}
                   <td className="px-3 py-2 text-right">
                     {canEdit && <button onClick={(e) => { e.stopPropagation(); setEditing(p); setShowForm(true); }} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Edit">
                       <Edit2 className="w-3.5 h-3.5" />
                     </button>}
                   </td>
                 </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <div className="py-4"><EmptyState icon={Users} title="Belum ada pasien" description="Daftarkan pasien baru untuk mulai pelayanan" /></div>
          )}
        </div>
      </div>

      {showForm && (
        <PatientForm patient={editing} clinicRole={clinicRole} onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
      )}

      {selectedPatient && (
        <PatientDetailDrawer
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onEdit={canEdit ? (p) => { setSelectedPatient(null); setEditing(p); setShowForm(true); } : undefined}
        />
      )}
    </div>
  );
}

function PatientForm({ patient, clinicRole, onClose, onSaved }) {
  const [form, setForm] = useState(patient || {
    full_name: '', gender: 'L', birth_date: '', phone: '', address: '',
    blood_type: '-', allergies: '', insurance_type: 'Umum', bpjs_number: '', nik: '', emergency_contact: '',
    guardian_name: '', guardian_relation: '', guardian_phone: ''
  });
  const [saving, setSaving] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const { toast } = useToast();
  const isFrontOffice = clinicRole === 'Front Office';

  const submit = async (allowDuplicate = false) => {
    if (!form.full_name.trim() || !form.birth_date || !form.gender) { toast({ title: 'Nama, tanggal lahir, dan jenis kelamin wajib diisi', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (patient?.id) {
        const allowedFields = ['full_name', 'nik', 'gender', 'birth_date', 'phone', 'email', 'address', 'insurance_type', 'bpjs_number', 'insurance_number', 'guardian_name', 'guardian_relation', 'guardian_phone', 'emergency_contact'];
        const payload = isFrontOffice
          ? Object.fromEntries(allowedFields.map((field) => [field, form[field] ?? '']))
          : form;
        await db.entities.Patient.update(patient.id, payload);
        toast({ title: 'Data pasien diperbarui' });
      } else {
        const response = await db.functions.invoke('registerPatient', { ...form, allow_duplicate: allowDuplicate });
        const result = response.data || response;
        if (result.duplicate_found) {
          setDuplicateMatches(result.matches || []);
          toast({ title: 'Kemungkinan pasien sudah terdaftar', description: 'Pilih data yang sudah ada agar riwayat pasien tidak terpisah.', variant: 'destructive' });
          return;
        }
        toast({ title: `Pasien ${result.patient.mr_number} terdaftar` });
      }
      onSaved();
    } catch (e) { toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{patient ? 'Edit Pasien' : 'Registrasi Pasien Baru'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {isFrontOffice && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
              Front Office hanya mengelola identitas, kontak, penjamin, dan data wali. Alergi serta tanda vital diverifikasi oleh Perawat saat intake.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama Lengkap *" className="col-span-2">
              <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                className="input-field" placeholder="Nama lengkap pasien" />
            </Field>
            <Field label="NIK">
              <input value={form.nik} onChange={e => set('nik', e.target.value)} className="input-field" placeholder="16 digit" />
            </Field>
            <Field label="No. BPJS">
              <input value={form.bpjs_number} onChange={e => set('bpjs_number', e.target.value)} className="input-field" />
            </Field>
            <Field label="Jenis Kelamin">
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className="input-field">
                <option value="L">Laki-laki</option><option value="P">Perempuan</option>
              </select>
            </Field>
            <Field label="Tgl Lahir *">
              <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="input-field" />
            </Field>
            {!isFrontOffice && <Field label="Gol. Darah">
              <select value={form.blood_type} onChange={e => set('blood_type', e.target.value)} className="input-field">
                {['A','B','AB','O','-'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>}
            <Field label="Jenis Asuransi">
              <select value={form.insurance_type} onChange={e => set('insurance_type', e.target.value)} className="input-field">
                {['Umum','BPJS','Asuransi'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Telepon" className="col-span-2">
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field" />
            </Field>
            <Field label="Alamat" className="col-span-2">
              <textarea value={form.address} onChange={e => set('address', e.target.value)} className="input-field" rows={2} />
            </Field>
            {!isFrontOffice && <Field label="Alergi (obat/makanan)" className="col-span-2">
              <input value={form.allergies} onChange={e => set('allergies', e.target.value)} className="input-field"
                placeholder="Tulis alergi atau kosongkan" />
              {form.allergies && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1">
                  <AlertCircle className="w-3 h-3" /> Alergi tercatat — akan ditampilkan saat pemeriksaan & dispensing
                </p>
              )}
            </Field>}
            <Field label="Kontak Darurat" className="col-span-2">
              <input value={form.emergency_contact} onChange={e => set('emergency_contact', e.target.value)} className="input-field" />
            </Field>
            <Field label="Nama Orang Tua / Wali">
              <input value={form.guardian_name || ''} onChange={e => set('guardian_name', e.target.value)} className="input-field" />
            </Field>
            <Field label="Hubungan & Telepon Wali">
              <div className="grid grid-cols-2 gap-2">
                <input value={form.guardian_relation || ''} onChange={e => set('guardian_relation', e.target.value)} className="input-field" placeholder="Ibu/Ayah/Wali" />
                <input value={form.guardian_phone || ''} onChange={e => set('guardian_phone', e.target.value)} className="input-field" placeholder="No. telepon" />
              </div>
            </Field>
          </div>
          {duplicateMatches.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 rounded-md p-3">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Data mirip sudah ada</p>
              <div className="mt-2 space-y-1">
                {duplicateMatches.map(match => <p key={match.id} className="text-xs text-amber-900 bg-white border border-amber-200 rounded px-2 py-1.5">{match.full_name} • {match.mr_number} • {match.birth_date}</p>)}
              </div>
              <button onClick={() => submit(true)} disabled={saving} className="mt-2 text-[11px] text-amber-900 underline">Data memang pasien berbeda — tetap buat RM baru</button>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={() => submit(false)} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
      <style>{`.input-field{width:100%;padding:6px 10px;border:1px solid hsl(var(--border));border-radius:6px;font-size:13px;outline:none;background:transparent}.input-field:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <p className="micro-label mb-1">{label}</p>
      {children}
    </div>
  );
}
