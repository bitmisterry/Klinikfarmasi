// @ts-nocheck -- Template form state is intentionally incremental.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { ClipboardList, Save, X, Trash2, Stethoscope, Activity, AlertCircle } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

export default function ExamTemplateModal({ open, mode, doctorId, doctorName, currentRecord, placeholders = {}, onLoad, onClose }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');
  const [diagnosisTag, setDiagnosisTag] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadTemplates();
  }, [open]);

  const loadTemplates = async () => {
    try {
      // A saved examination template is a doctor's personal clinical shortcut.
      // Filtering here is deliberate even when an adapter already applies RLS:
      // a dental account must never be offered a general-practice template.
      const list = await db.entities.ExamTemplate.filter({ doctor_id: doctorId }, '-created_date', 50);
      setTemplates(list || []);
    } catch { setTemplates([]); }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Nama template wajib', variant: 'destructive' }); return; }
    if (!currentRecord?.diagnosis) { toast({ title: 'Diagnosis wajib untuk menyimpan template', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      await db.entities.ExamTemplate.create({
        name: name.trim(),
        doctor_id: doctorId,
        doctor_name: doctorName,
        clinical_specialty: currentRecord?.clinical_specialty || '',
        diagnosis_tag: diagnosisTag.trim(),
        chief_complaint: currentRecord.chief_complaint || '',
        diagnosis: currentRecord.diagnosis || '',
        diagnosis_code: currentRecord.diagnosis_code || '',
        procedures: currentRecord.procedures || [],
        treatment_plan: currentRecord.treatment_plan || '',
        follow_up_instructions: currentRecord.follow_up_instructions || '',
        patient_education: currentRecord.patient_education || '',
        is_active: true,
      });
      toast({ title: `Template "${name}" tersimpan`, description: 'Dapat dimuat pada pemeriksaan berikutnya' });
      setName(''); setDiagnosisTag('');
      loadTemplates();
      onClose();
    } catch (e) {
      toast({ title: 'Gagal menyimpan template', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleLoad = (tpl) => {
    onLoad(tpl);
    onClose();
  };

  const handleDelete = async (id) => {
    try {
      await db.entities.ExamTemplate.delete(id);
      loadTemplates();
      toast({ title: 'Template dihapus' });
    } catch (e) {
      toast({ title: 'Gagal hapus', description: e.message, variant: 'destructive' });
    }
  };

  if (!open) return null;

  const procCount = (currentRecord?.procedures || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            {mode === 'save' ? 'Simpan Template Pemeriksaan' : 'Muat Template Pemeriksaan'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {mode === 'save' ? (
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nama Template *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={placeholders.templateName || 'Contoh: Template pemeriksaan'} className="w-full px-2 py-1.5 border border-border rounded text-sm mt-1" autoFocus />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tag Diagnosis (opsional)</label>
              <input value={diagnosisTag} onChange={e => setDiagnosisTag(e.target.value)} placeholder={placeholders.diagnosisTag || 'Contoh: Diagnosis klinis'} className="w-full px-2 py-1.5 border border-border rounded text-sm mt-1" />
            </div>
            <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 space-y-0.5">
              <p className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Diagnosis: {currentRecord?.diagnosis || '-'}</p>
              <p className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> {procCount} tindakan</p>
              {currentRecord?.treatment_plan && <p className="flex items-center gap-1.5"><ClipboardList className="w-3 h-3" /> Rencana terapi terisi</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 border border-border py-1.5 rounded text-xs hover:bg-muted">Batal</button>
              <button onClick={handleSave} disabled={loading} className="flex-1 btn-primary py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> Simpan
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {templates.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">Belum ada template tersimpan</p>
            )}
            {templates.map(tpl => (
              <div key={tpl.id} className="px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <button onClick={() => handleLoad(tpl)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {tpl.diagnosis || 'Tanpa diagnosis'}
                    {(tpl.procedures || []).length > 0 ? ` • ${(tpl.procedures || []).length} tindakan` : ''}
                    {tpl.diagnosis_tag ? ` • ${tpl.diagnosis_tag}` : ''}
                  </p>
                </button>
                <button onClick={() => handleDelete(tpl.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
