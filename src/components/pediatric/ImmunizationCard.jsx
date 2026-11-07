// @ts-nocheck -- Immunization schedules use mixed dose/date value types.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useMemo } from 'react';
import { Syringe, Plus, CheckCircle2, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { IMMUNIZATION_SCHEDULE, VACCINE_TYPES, calculateNextDue, getAgeInMonths, getAgeLabel } from '@/lib/immunization';

export default function ImmunizationCard({ patient, records = [], onRefresh, doctor }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vaccine_type: 'BCG',
    dose_number: 1,
    administered_date: new Date().toISOString().split('T')[0],
    batch_number: '',
    site: 'Lengan Kanan',
    notes: '',
  });

  const ageMonths = patient?.birth_date ? getAgeInMonths(patient.birth_date) : 0;
  const nextDue = useMemo(() => calculateNextDue(patient?.birth_date, records), [patient, records]);

  const administeredSet = useMemo(() => {
    return new Set(records.filter(r => r.status === 'Terkonfirmasi').map(r => `${r.vaccine_type}-${r.dose_number}`));
  }, [records]);

  const submitVaccine = async () => {
    if (!patient) return;
    try {
      const vaccineInfo = VACCINE_TYPES[form.vaccine_type];
      const label = `${form.vaccine_type} ${form.dose_number}`;
      await db.entities.ImmunizationRecord.create({
        patient_id: patient.id,
        patient_name: patient.full_name,
        vaccine_type: form.vaccine_type,
        vaccine_label: label,
        dose_number: Number(form.dose_number),
        administered_date: form.administered_date,
        age_at_administration: getAgeLabel(ageMonths),
        doctor_id: doctor?.id,
        doctor_name: doctor?.full_name,
        batch_number: form.batch_number,
        site: form.site,
        status: 'Terkonfirmasi',
        notes: form.notes,
      });
      toast({ title: 'Imunisasi tercatat', description: `${label} — ${vaccineInfo?.label}` });
      setShowForm(false);
      setForm({ ...form, batch_number: '', notes: '' });
      onRefresh?.();
    } catch (e) {
      toast({ title: 'Gagal mencatat imunisasi', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Syringe className="w-4 h-4 text-primary" />
          Kartu Imunisasi
        </h3>
        {patient && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover">
            <Plus className="w-3.5 h-3.5" /> Catat Imunisasi
          </button>
        )}
      </div>

      {patient && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Usia:</span>
          <span className="font-medium">{getAgeLabel(ageMonths)}</span>
          {nextDue?.overdue && (
            <span className="pill pill-critical flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" /> Ada vaksin terlewat
            </span>
          )}
        </div>
      )}

      {/* Next Due Alert */}
      {nextDue && patient && (
        <div className={`mb-3 p-2 rounded-md text-xs ${nextDue.overdue ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-1.5">
            {nextDue.overdue ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <Clock className="w-3.5 h-3.5 text-amber-600" />}
            <span className="font-medium">{nextDue.overdue ? 'Vaksin Terlewat' : 'Vaksin Jatuh Tempo'}</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            {nextDue.vaccines.map(v => v.label).join(', ')} — {nextDue.ageLabel}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
            <Calendar className="w-3 h-3" /> Jadwal: {nextDue.dueDate}
          </p>
        </div>
      )}

      {/* Form */}
      {showForm && patient && (
        <div className="mb-3 p-3 bg-muted/50 rounded-md space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.vaccine_type}
              onChange={e => setForm({ ...form, vaccine_type: e.target.value })}
              className="px-2 py-1.5 text-xs border border-border rounded bg-card"
            >
              {Object.entries(VACCINE_TYPES).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={form.dose_number}
              onChange={e => setForm({ ...form, dose_number: e.target.value })}
              placeholder="Dosis ke-"
              className="px-2 py-1.5 text-xs border border-border rounded bg-card"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.administered_date}
              onChange={e => setForm({ ...form, administered_date: e.target.value })}
              className="px-2 py-1.5 text-xs border border-border rounded bg-card"
            />
            <select
              value={form.site}
              onChange={e => setForm({ ...form, site: e.target.value })}
              className="px-2 py-1.5 text-xs border border-border rounded bg-card"
            >
              {['Lengan Kanan', 'Lengan Kiri', 'Paha Kanan', 'Paha Kiri', 'Oral', 'Lainnya'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <input
            value={form.batch_number}
            onChange={e => setForm({ ...form, batch_number: e.target.value })}
            placeholder="Nomor batch vaksin"
            className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
          />
          <input
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Catatan (opsional)"
            className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
          />
          <div className="flex gap-2">
            <button onClick={submitVaccine} className="btn-primary text-xs px-3 py-1.5 rounded">Simpan</button>
            <button onClick={() => setShowForm(false)} className="text-xs px-3 py-1.5 rounded border border-border">Batal</button>
          </div>
        </div>
      )}

      {/* Schedule Table */}
      {patient && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {IMMUNIZATION_SCHEDULE.map((sched, i) => (
            <div key={i} className="border border-border rounded-md p-2">
              <p className="text-xs font-medium mb-1">{sched.ageLabel}</p>
              <div className="flex flex-wrap gap-1">
                {sched.vaccines.map((v, j) => {
                  const administered = administeredSet.has(`${v.type}-${v.dose}`);
                  const vInfo = VACCINE_TYPES[v.type];
                  return (
                    <span
                      key={j}
                      className={`pill ${administered ? 'pill-success' : 'pill-inactive'}`}
                      title={v.label}
                    >
                      {administered && <CheckCircle2 className="w-3 h-3" />}
                      {v.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!patient && (
        <p className="text-xs text-muted-foreground">Pilih pasien anak untuk melihat kartu imunisasi.</p>
      )}
    </div>
  );
}
