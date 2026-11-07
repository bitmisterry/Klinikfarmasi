const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, X, Save, Stethoscope, Activity, FileText, Search } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useDoctorContext } from '@/lib/doctorContext';
import { getClinicalCatalog } from '@/lib/clinicalCatalogs';

const EMPTY_TPL = {
  name: '', diagnosis_tag: '', chief_complaint: '', diagnosis: '', diagnosis_code: '',
  procedures: [], treatment_plan: '', follow_up_instructions: '', patient_education: '', is_active: true,
};

export default function DoctorExamTemplates() {
  const { toast } = useToast();
  const { doctorUserId, doctorProfile, isAssistant } = useDoctorContext();
  const doctorId = doctorUserId;
  const doctorName = doctorProfile?.display_name || doctorProfile?.full_name || 'Dokter';
  const clinicalCatalog = getClinicalCatalog({ specialization: doctorProfile?.specialization });

  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (doctorId) load(); }, [doctorId]);

  const load = async () => {
    try {
      const list = await db.entities.ExamTemplate.filter({ doctor_id: doctorId }, '-created_date', 100) || [];
      setTemplates(list);
    } catch (e) { toast({ title: 'Gagal memuat template', description: e.message, variant: 'destructive' }); }
  };

  const filtered = templates.filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
    t.diagnosis_tag?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => setEditing({ ...EMPTY_TPL });
  const openEdit = (tpl) => setEditing({ ...tpl });

  const handleSave = async () => {
    if (!editing.name?.trim()) { toast({ title: 'Nama template wajib', variant: 'destructive' }); return; }
    if (!editing.diagnosis?.trim()) { toast({ title: 'Diagnosis wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const procTotal = (editing.procedures || []).reduce((s, p) => s + (p.subtotal || 0), 0);
      const payload = {
        name: editing.name.trim(),
        doctor_id: doctorId,
        doctor_name: doctorName,
        clinical_specialty: clinicalCatalog.label,
        diagnosis_tag: editing.diagnosis_tag?.trim() || '',
        chief_complaint: editing.chief_complaint || '',
        diagnosis: editing.diagnosis || '',
        diagnosis_code: editing.diagnosis_code || '',
        procedures: (editing.procedures || []).map(p => ({
          name: p.name, code: p.code, fee: +p.fee || 0, quantity: +p.quantity || 1,
          subtotal: (+p.fee || 0) * (+p.quantity || 1),
        })),
        treatment_plan: editing.treatment_plan || '',
        follow_up_instructions: editing.follow_up_instructions || '',
        patient_education: editing.patient_education || '',
        is_active: true,
      };
      if (editing.id) {
        await db.entities.ExamTemplate.update(editing.id, payload);
        toast({ title: 'Template diperbarui' });
      } else {
        await db.entities.ExamTemplate.create(payload);
        toast({ title: 'Template tersimpan', description: 'Tersedia saat pemeriksaan' });
      }
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Hapus template "${name}"?`)) return;
    try {
      await db.entities.ExamTemplate.delete(id);
      toast({ title: 'Template dihapus' });
      load();
    } catch (e) { toast({ title: 'Gagal hapus', description: e.message, variant: 'destructive' }); }
  };

  const addProc = () => setEditing(e => ({ ...e, procedures: [...(e.procedures || []), { name: '', code: '', fee: 0, quantity: 1, subtotal: 0 }] }));
  const updProc = (i, k, v) => setEditing(e => {
    const procs = [...(e.procedures || [])];
    procs[i] = { ...procs[i], [k]: v };
    if (k === 'fee' || k === 'quantity') procs[i].subtotal = (+procs[i].fee || 0) * (+procs[i].quantity || 1);
    return { ...e, procedures: procs };
  });
  const delProc = (i) => setEditing(e => ({ ...e, procedures: (e.procedures || []).filter((_, idx) => idx !== i) }));

  const procTotal = (editing?.procedures || []).reduce((s, p) => s + (p.subtotal || 0), 0);
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";
  const procedureInputCls = "w-full h-10 px-3 border border-border rounded-md text-sm bg-card outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="panel px-3 py-2.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Template Pemeriksaan</h2>
          <p className="text-[11px] text-muted-foreground">Template pribadi untuk {clinicalCatalog.label}; diagnosis dan tindakan tidak tercampur dengan dokter lain.</p>
        </div>
        <button onClick={openNew} className="btn-primary px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari template..." className="w-full pl-8 pr-3 py-1.5 border border-border rounded text-xs" />
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <div className="panel px-3 py-12 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">{search ? 'Tidak ditemukan' : 'Belum ada template'}</p>
          <p className="text-xs text-muted-foreground mt-1">{search ? 'Coba kata kunci lain' : 'Klik "Tambah" untuk membuat template pertama'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map(tpl => (
            <div key={tpl.id} className="panel p-3 flex flex-col">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-7 h-7 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Stethoscope className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{tpl.name}</p>
                  {tpl.diagnosis_tag && <span className="pill pill-info text-[9px] mt-0.5">{tpl.diagnosis_tag}</span>}
                </div>
              </div>
              <div className="flex-1 space-y-1 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1"><FileText className="w-3 h-3" /> {tpl.diagnosis || 'Tanpa diagnosis'}</p>
                {(tpl.procedures || []).length > 0 && (
                  <p className="flex items-center gap-1"><Activity className="w-3 h-3" /> {(tpl.procedures || []).length} tindakan • Rp {(tpl.procedures || []).reduce((s, p) => s + (p.subtotal || 0), 0).toLocaleString('id-ID')}</p>
                )}
                {tpl.treatment_plan && <p className="line-clamp-1">📋 {tpl.treatment_plan}</p>}
              </div>
              <div className="flex gap-1 mt-2 pt-2 border-t border-border">
                <button onClick={() => openEdit(tpl)} className="flex-1 flex items-center justify-center gap-1 py-1 text-xs hover:bg-muted rounded border border-border">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => handleDelete(tpl.id, tpl.name)} className="px-2 py-1 text-xs text-rose-500 hover:bg-rose-50 rounded border border-rose-200">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={() => setEditing(null)}>
          <div className="my-auto flex w-full max-w-3xl flex-col rounded-md border border-border bg-card shadow-xl max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="shrink-0 border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                {editing.id ? 'Edit Template' : 'Template Baru'}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name & Tag */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nama Template *</label>
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder={clinicalCatalog.placeholders.templateName} className={inputCls} autoFocus />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tag Diagnosis</label>
                  <input value={editing.diagnosis_tag} onChange={e => setEditing({ ...editing, diagnosis_tag: e.target.value })} placeholder={clinicalCatalog.placeholders.diagnosisTag} className={inputCls} />
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Keluhan Utama</label>
                <input value={editing.chief_complaint} onChange={e => setEditing({ ...editing, chief_complaint: e.target.value })} placeholder={clinicalCatalog.placeholders.chiefComplaint} className={inputCls} />
              </div>

              {/* Diagnosis */}
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Diagnosis *</label>
                  <input value={editing.diagnosis} onChange={e => setEditing({ ...editing, diagnosis: e.target.value })} placeholder={clinicalCatalog.placeholders.diagnosis} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kode ICD-10</label>
                  <input value={editing.diagnosis_code} onChange={e => setEditing({ ...editing, diagnosis_code: e.target.value })} placeholder={clinicalCatalog.placeholders.diagnosisCode} className={inputCls} />
                </div>
              </div>

              {/* Procedures */}
              <div className="panel bg-muted/20">
                <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="micro-label flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Tindakan</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Masukkan nama layanan, kode, tarif satuan, dan jumlah agar nilai tagihan terbentuk dengan jelas.</p>
                  </div>
                  <button onClick={addProc} className="btn-primary shrink-0 px-3 py-2 text-xs font-medium flex items-center gap-1.5 rounded"><Plus className="w-3.5 h-3.5" /> Tambah Tindakan</button>
                </div>
                <div className="p-4 space-y-3">
                  {(editing.procedures || []).length === 0 && (
                    <div className="rounded-md border border-dashed border-border bg-card px-4 py-5 text-center">
                      <Activity className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
                      <p className="text-xs font-medium">Belum ada tindakan</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Klik “Tambah Tindakan” untuk memasukkan layanan yang akan ditagihkan.</p>
                    </div>
                  )}
                  {(editing.procedures || []).map((p, i) => (
                    <div key={i} className="rounded-md border border-border bg-card p-3 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold">Tindakan {i + 1}</p>
                        <button type="button" onClick={() => delProc(i)} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" aria-label={`Hapus tindakan ${i + 1}`}>
                          <X className="h-3.5 w-3.5" /> Hapus
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Nama tindakan *</span>
                          <input value={p.name || ''} onChange={e => updProc(i, 'name', e.target.value)} placeholder="Contoh: Nebulisasi, konsultasi, atau tindakan luka" className={procedureInputCls} aria-label={`Nama tindakan ${i + 1}`} autoFocus={i === (editing.procedures || []).length - 1 && !p.name} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Kode layanan</span>
                          <input value={p.code || ''} onChange={e => updProc(i, 'code', e.target.value)} placeholder="Opsional" className={procedureInputCls} aria-label={`Kode layanan tindakan ${i + 1}`} />
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_150px_140px]">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tarif satuan (Rp)</span>
                          <input type="number" min="0" value={p.fee || ''} onChange={e => updProc(i, 'fee', e.target.value)} placeholder="Contoh: 50000" className={procedureInputCls} aria-label={`Tarif tindakan ${i + 1}`} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Jumlah</span>
                          <input type="number" min="1" value={p.quantity || 1} onChange={e => updProc(i, 'quantity', e.target.value)} className={procedureInputCls} aria-label={`Jumlah tindakan ${i + 1}`} />
                        </label>
                        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Subtotal</p>
                          <p className="mt-1 text-base font-semibold text-primary">Rp {((+p.fee || 0) * (+p.quantity || 1)).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(editing.procedures || []).length > 0 && (
                    <div className="flex justify-between rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold">
                      <span>Total Tindakan</span>
                      <span className="text-primary">Rp {procTotal.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Plan */}
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Rencana Terapi</label>
                <textarea value={editing.treatment_plan} onChange={e => setEditing({ ...editing, treatment_plan: e.target.value })} rows={2} placeholder={clinicalCatalog.placeholders.treatmentPlan} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Instruksi Follow-up</label>
                <input value={editing.follow_up_instructions} onChange={e => setEditing({ ...editing, follow_up_instructions: e.target.value })} placeholder="mis. Kontrol 3 hari jika tidak membaik" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Edukasi Pasien</label>
                <textarea value={editing.patient_education} onChange={e => setEditing({ ...editing, patient_education: e.target.value })} rows={2} placeholder="Edukasi default..." className={inputCls} />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex gap-2 shrink-0">
              <button onClick={() => setEditing(null)} className="flex-1 border border-border py-1.5 rounded text-xs hover:bg-muted">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
