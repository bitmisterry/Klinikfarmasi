import React from 'react';
import { ClipboardList, Baby, Shield, Bone, RotateCcw } from 'lucide-react';
import { VITAL_FIELD_OPTIONS, DEFAULT_EXAM_TEMPLATES } from '@/lib/examTemplates';

export default function ExamTemplateEditor({ form, setForm, editing, doctor }) {
  const config = form.exam_template_config || {};

  const updateConfig = (key, value) => {
    setForm(f => ({ ...f, exam_template_config: { ...(f.exam_template_config || {}), [key]: value } }));
  };

  const toggleVital = (key) => {
    const current = config.visible_vital_fields || [];
    updateConfig('visible_vital_fields', current.includes(key) ? current.filter(k => k !== key) : [...current, key]);
  };

  const applyPreset = (preset) => {
    setForm(f => ({ ...f, exam_template_config: { ...DEFAULT_EXAM_TEMPLATES[preset] } }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium">Template Pemeriksaan</p>
          <p className="text-[10px] text-muted-foreground">Konfigurasi field SOAP yang ditampilkan di Clinical Workspace untuk dokter ini.</p>
        </div>
        {editing && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Preset:</span>
            <button onClick={() => applyPreset('Umum')} className="text-[10px] px-1.5 py-1 rounded border border-border hover:bg-muted">Umum</button>
            <button onClick={() => applyPreset('Anak')} className="text-[10px] px-1.5 py-1 rounded border border-border hover:bg-muted">Anak</button>
            <button onClick={() => applyPreset('Gigi')} className="text-[10px] px-1.5 py-1 rounded border border-border hover:bg-muted">Gigi</button>
          </div>
        )}
      </div>

      {/* Vital Signs Fields */}
      <div className="panel">
        <div className="px-3 py-2 border-b border-border">
          <p className="micro-label flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Vital Signs Fields</p>
        </div>
        <div className="p-3">
          {!editing ? (
            <div className="flex flex-wrap gap-1.5">
              {(config.visible_vital_fields || []).length === 0 ? (
                <span className="text-xs text-muted-foreground">Default (mengikuti spesialisasi: {doctor.specialization || 'Umum'})</span>
              ) : (
                config.visible_vital_fields.map(k => {
                  const opt = VITAL_FIELD_OPTIONS.find(o => o.key === k);
                  return <span key={k} className="pill pill-info">{opt?.label || k}</span>;
                })
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {VITAL_FIELD_OPTIONS.map(opt => {
                const sel = (config.visible_vital_fields || []).includes(opt.key);
                return (
                  <button key={opt.key} onClick={() => toggleVital(opt.key)} className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs border transition-colors ${sel ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:bg-muted'}`}>
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${sel ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                      {sel && <span className="text-primary-foreground text-[9px]">✓</span>}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Clinical Prompts */}
      <div className="panel">
        <div className="px-3 py-2 border-b border-border">
          <p className="micro-label">Prompt Klinis Kontekstual</p>
        </div>
        <div className="p-3 space-y-2">
          <PromptToggle
            icon={Baby}
            label="Growth Chart Prompt"
            description="Tampilkan reminder BB/TB/lingkar kepala untuk dokter anak"
            value={config.show_growth_prompt}
            editing={editing}
            onChange={v => updateConfig('show_growth_prompt', v)}
          />
          <PromptToggle
            icon={Shield}
            label="Imunisasi Prompt"
            description="Tampilkan reminder imunisasi untuk pasien anak"
            value={config.show_immunization_prompt}
            editing={editing}
            onChange={v => updateConfig('show_immunization_prompt', v)}
          />
          <PromptToggle
            icon={Bone}
            label="Odontogram Link"
            description="Tampilkan link ke odontogram untuk dokter gigi"
            value={config.show_odontogram_link}
            editing={editing}
            onChange={v => updateConfig('show_odontogram_link', v)}
          />
        </div>
      </div>

      {editing && (
        <button onClick={() => setForm(f => ({ ...f, exam_template_config: {} }))} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-rose-600">
          <RotateCcw className="w-3 h-3" /> Reset ke default spesialisasi
        </button>
      )}
    </div>
  );
}

function PromptToggle({ icon: Icon, label, description, value, editing, onChange }) {
  if (!editing) {
    return (
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${value ? 'text-primary' : 'text-muted-foreground/40'}`} />
        <div className="flex-1">
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
        <span className={`pill ${value ? 'pill-success' : 'pill-inactive'}`}>{value ? 'Aktif' : 'Nonaktif'}</span>
      </div>
    );
  }
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center gap-2.5 text-left">
      <Icon className={`w-4 h-4 ${value ? 'text-primary' : 'text-muted-foreground/40'}`} />
      <div className="flex-1">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <span className={`w-9 h-5 rounded-full transition-colors flex items-center ${value ? 'bg-primary' : 'bg-muted-foreground/20'}`}>
        <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}