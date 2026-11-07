const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, FlaskConical, Copy, Check, AlertCircle, Beaker, Info, Save, FileText, Layers } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import SmartDrugSearch from '@/components/SmartDrugSearch';
import DrugInfoDrawer from '@/components/DrugInfoDrawer';
import RacikanWorkflowBar from '@/components/RacikanWorkflowBar';
import RacikanLabelPrintModal from '@/components/print/RacikanLabelPrintModal';
import { parseKekuatan, fractionToMg, fmtNum, fmtRupiah, computeRacikan, validateRacikan, compareRacikan, appendAdjustment } from '@/lib/racikan';

const BENTUK_OPTIONS = ['Puyer', 'Kapsul', 'Cair', 'Krim', 'Lainnya'];
const FRACTION_OPTIONS = ['¼', '½', '¾', '1'];

export default function RacikanWorksheet({ patient, onProcess, mode = 'pharmacy', initialRacikan = null, onSaved = null, onClose = null, onCapture = null }) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState({});
  const [allMeds, setAllMeds] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [masterTemplates, setMasterTemplates] = useState([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pioMed, setPioMed] = useState(null);
  const [showLabel, setShowLabel] = useState(false);
  const [compareWith, setCompareWith] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [racikanId, setRacikanId] = useState(null);

  const [racikan, setRacikan] = useState({
    racikan_name: 'Racikan 1',
    bentuk_racikan: 'Puyer',
    administration_route: 'internal',
    jumlah_resep: 12,
    jumlah_ambil: 12,
    signa: '3x1',
    components: [],
    kemasan_fee: 3000,
    jasa_racik_fee: 10000,
    notes: '',
    workflow_status: 'Draft',
  });

  // Load configs + medicines
  useEffect(() => {
    Promise.all([
      db.entities.RacikanConfig.list(),
      db.entities.Medicine.list(),
    ]).then(([cfgs, meds]) => {
      const map = {};
      (cfgs || []).forEach(c => { map[c.bentuk_racikan] = c; });
      setConfigs(map);
      setAllMeds(meds || []);
    }).catch(() => {});
  }, []);

  // Load patient templates + master templates
  useEffect(() => {
    if (patient?.id) {
      db.entities.RacikanTemplate.filter({ patient_id: patient.id, is_master_template: { $ne: true } }, '-created_date', 10)
        .then(setTemplates).catch(() => setTemplates([]));
    } else {
      setTemplates([]);
    }
    db.entities.RacikanTemplate.filter({ is_master_template: true }, '-created_date', 20)
      .then(setMasterTemplates).catch(() => setMasterTemplates([]));
  }, [patient?.id]);

  // Load initial racikan if provided (from prescription or copy)
  useEffect(() => {
    if (initialRacikan) {
      setRacikan({
        racikan_name: initialRacikan.racikan_name || 'Racikan 1',
        bentuk_racikan: initialRacikan.bentuk_racikan || 'Puyer',
        administration_route: initialRacikan.administration_route || 'internal',
        jumlah_resep: initialRacikan.jumlah_resep || 12,
        jumlah_ambil: initialRacikan.jumlah_ambil || 12,
        signa: initialRacikan.signa || '3x1',
        components: (initialRacikan.components || []).map(c => ({
          ...c,
          kekuatan_mg: parseKekuatan(c.kekuatan),
          harga_unit: c.harga_unit || 0,
          stock: 0,
          kebutuhan_ambil_override: null,
        })),
        kemasan_fee: initialRacikan.kemasan_fee ?? 3000,
        jasa_racik_fee: initialRacikan.jasa_racik_fee ?? 10000,
        notes: initialRacikan.notes || '',
        workflow_status: initialRacikan.workflow_status || 'Draft',
      });
      setRacikanId(initialRacikan.id || null);
      // Re-fetch stock/prices from DB to ensure fresh data
      db.entities.Medicine.list().then(meds => {
        setAllMeds(meds || []);
        setRacikan(r => ({
          ...r,
          components: r.components.map(c => {
            const med = meds.find(m => m.id === c.medicine_id);
            if (!med) return c;
            return { ...c, harga_unit: med.selling_price || c.harga_unit, stock: med.stock_on_hand || 0, kekuatan: med.strength || c.kekuatan, kekuatan_mg: parseKekuatan(med.strength), active_substance: med.active_substance || c.active_substance };
          }),
        }));
      }).catch(() => {});
    }
  }, [initialRacikan]);

  // Apply config defaults when bentuk changes
  useEffect(() => {
    const cfg = configs[racikan.bentuk_racikan];
    if (cfg && !initialRacikan) {
      setRacikan(r => ({
        ...r,
        kemasan_fee: cfg.default_kemasan_fee ?? r.kemasan_fee,
        jasa_racik_fee: cfg.default_jasa_racik_fee ?? r.jasa_racik_fee,
      }));
    }
  }, [racikan.bentuk_racikan, configs]);

  const refreshComponentStock = () => {
    setRacikan(r => ({
      ...r,
      components: r.components.map(c => {
        const med = allMeds.find(m => m.id === c.medicine_id);
        if (!med) return c;
        return { ...c, harga_unit: med.selling_price || c.harga_unit, stock: med.stock_on_hand || 0, kekuatan: med.strength || c.kekuatan, kekuatan_mg: parseKekuatan(med.strength), active_substance: med.active_substance || c.active_substance };
      }),
    }));
  };

  const set = (k, v) => setRacikan(r => ({ ...r, [k]: v }));

  const addComponent = (med) => {
    const cfg = configs[racikan.bentuk_racikan];
    setRacikan(r => ({
      ...r,
      components: [...r.components, {
        medicine_id: med.id,
        medicine_name: med.name,
        active_substance: med.active_substance || '',
        kekuatan: med.strength || '',
        kekuatan_mg: parseKekuatan(med.strength),
        dosis_per_racikan: 0,
        dosis_mode: 'mg',
        dosis_label: '',
        harga_unit: med.selling_price || 0,
        stock: med.stock_on_hand || 0,
        product_type: med.product_type || 'Obat',
        pembulatan_rule: cfg?.pembulatan_rule || 'ceil',
        kebutuhan_ambil_override: null,
      }],
    }));
  };

  const updateComponent = (idx, field, value) => {
    setRacikan(r => {
      const comps = [...r.components];
      comps[idx] = { ...comps[idx], [field]: value };
      if (field === 'dosis_mode') {
        if (value === 'pecahan') {
          comps[idx].dosis_label = comps[idx].dosis_label || '¼';
          comps[idx].dosis_per_racikan = fractionToMg(comps[idx].dosis_label, comps[idx].kekuatan_mg);
        } else {
          comps[idx].dosis_label = String(comps[idx].dosis_per_racikan || '');
        }
      }
      if (field === 'dosis_label' && comps[idx].dosis_mode === 'pecahan') {
        comps[idx].dosis_per_racikan = fractionToMg(value, comps[idx].kekuatan_mg);
      }
      if (field === 'dosis_label' && comps[idx].dosis_mode === 'mg') {
        comps[idx].dosis_per_racikan = parseFloat(value) || 0;
      }
      if (field === 'dosis_label' || field === 'dosis_mode') {
        comps[idx].kebutuhan_ambil_override = null;
      }
      return { ...r, components: comps };
    });
  };

  const removeComponent = (idx) => {
    setRacikan(r => ({ ...r, components: r.components.filter((_, i) => i !== idx) }));
  };

  const overrideAmbil = (idx, value) => {
    setRacikan(r => {
      const comps = [...r.components];
      const oldVal = comps[idx].kebutuhan_ambil_override;
      comps[idx] = { ...comps[idx], kebutuhan_ambil_override: value === '' ? null : parseFloat(value) };
      // Audit override
      if (racikanId && oldVal !== comps[idx].kebutuhan_ambil_override) {
        logAdjustment(`Override ambil ${comps[idx].medicine_name}`, oldVal ?? comps[idx].kebutuhan_ambil, comps[idx].kebutuhan_ambil_override);
      }
      return { ...r, components: comps };
    });
  };

  const logAdjustment = async (field, oldVal, newVal) => {
    if (!racikanId) return;
    try {
      const tpl = await db.entities.RacikanTemplate.get(racikanId);
      const log = appendAdjustment(tpl.adjustment_log, { field, old: String(oldVal), new: String(newVal), user: mode === 'doctor' ? 'Dokter' : 'Apoteker' });
      await db.entities.RacikanTemplate.update(racikanId, { adjustment_log: log });
    } catch {}
  };

  const computed = useMemo(() => computeRacikan(racikan), [racikan]);
  const warnings = useMemo(() => validateRacikan(racikan, patient, allMeds), [racikan, patient, allMeds]);
  const sisaResep = (racikan.jumlah_resep || 0) - (racikan.jumlah_ambil || 0);

  const copyFromTemplate = (tpl, isComparison = false) => {
    const oldRacikan = { ...racikan };
    setRacikan(r => ({
      ...r,
      racikan_name: `Racikan ${(templates.length || 0) + 1}`,
      bentuk_racikan: tpl.bentuk_racikan || r.bentuk_racikan,
      jumlah_resep: tpl.jumlah_resep || r.jumlah_resep,
      jumlah_ambil: tpl.jumlah_ambil || tpl.jumlah_resep || r.jumlah_ambil,
      signa: tpl.signa || r.signa,
      administration_route: tpl.administration_route || r.administration_route,
      kemasan_fee: tpl.kemasan_fee ?? r.kemasan_fee,
      jasa_racik_fee: tpl.jasa_racik_fee ?? r.jasa_racik_fee,
      notes: tpl.notes || r.notes,
      components: (tpl.components || []).map(c => ({
        medicine_id: c.medicine_id,
        medicine_name: c.medicine_name,
        active_substance: c.active_substance || '',
        kekuatan: c.kekuatan || '',
        kekuatan_mg: parseKekuatan(c.kekuatan),
        dosis_per_racikan: c.dosis_per_racikan || 0,
        dosis_mode: c.dosis_mode || 'mg',
        dosis_label: c.dosis_label || '',
        harga_unit: c.harga_unit || 0,
        stock: 0,
        product_type: 'Obat',
        pembulatan_rule: configs[tpl.bentuk_racikan]?.pembulatan_rule || 'ceil',
        kebutuhan_ambil_override: null,
      })),
    }));
    // Re-fetch medicine prices/stock
    db.entities.Medicine.list().then(meds => {
      setAllMeds(meds || []);
      setRacikan(r => ({
        ...r,
        components: r.components.map(c => {
          const med = meds.find(m => m.id === c.medicine_id);
          if (!med) return c;
          return { ...c, harga_unit: med.selling_price || 0, stock: med.stock_on_hand || 0, kekuatan: med.strength || c.kekuatan, kekuatan_mg: parseKekuatan(med.strength), active_substance: med.active_substance || c.active_substance };
        }),
      }));
    }).catch(() => {});
    if (isComparison) setCompareWith({ ...oldRacikan, ...tpl });
    setShowCopyModal(false);
    setShowTemplateModal(false);
    toast({ title: `Racikan "${tpl.racikan_name}" disalin`, description: 'Sesuaikan komposisi/dosis sebelum proses' });
  };

  const diff = useMemo(() => compareWith ? compareRacikan(compareWith, racikan) : null, [compareWith, racikan]);

  const handleSaveDraft = async () => {
    if (racikan.components.length === 0) { toast({ title: 'Belum ada bahan racikan', variant: 'destructive' }); return; }
    setProcessing(true);
    try {
      const tplData = {
        patient_id: patient?.id || '',
        patient_name: patient?.full_name || '',
        racikan_name: racikan.racikan_name,
        bentuk_racikan: racikan.bentuk_racikan,
        jumlah_resep: racikan.jumlah_resep,
        jumlah_ambil: racikan.jumlah_ambil,
        signa: racikan.signa,
        administration_route: racikan.administration_route || 'internal',
        components: computed.components.map(c => ({
          medicine_id: c.medicine_id, medicine_name: c.medicine_name, active_substance: c.active_substance,
          kekuatan: c.kekuatan, dosis_per_racikan: c.dosis_per_racikan, dosis_mode: c.dosis_mode,
          dosis_label: c.dosis_label, kebutuhan_teoritis: c.kebutuhan_teoritis, kebutuhan_ambil: c.kebutuhan_ambil,
          pembulatan_rule: c.pembulatan_rule, harga_unit: c.harga_unit, subtotal: c.subtotal,
        })),
        kemasan_fee: racikan.kemasan_fee,
        jasa_racik_fee: racikan.jasa_racik_fee,
        notes: racikan.notes,
        workflow_status: 'Draft',
      };
      const tpl = await db.entities.RacikanTemplate.create(tplData);
      setRacikanId(tpl.id);
      // Create prescription with is_racikan
      const today = new Date().toISOString().split('T')[0];
      const rx = await db.entities.Prescription.create({
        prescription_number: `R${today.replace(/-/g, '')}${String(Date.now()).slice(-3)}`,
        patient_id: patient?.id || '', patient_name: patient?.full_name || '',
        doctor_name: 'dr. Andini Pratama',
        prescription_date: today, source: 'Internal', status: 'Diresepkan',
        is_racikan: true, racikan_template_id: tpl.id,
        items: [{
          medicine_id: `racikan-${tpl.id}`,
          medicine_name: `${racikan.racikan_name} (${racikan.bentuk_racikan})`,
          form: racikan.bentuk_racikan,
          administration_route: racikan.administration_route || 'internal',
          dosage: racikan.signa,
          quantity: racikan.jumlah_ambil,
          instructions: racikan.notes,
          is_racikan: true,
          racikan_template_id: tpl.id,
        }],
      });
      await db.entities.RacikanTemplate.update(tpl.id, { prescription_id: rx.id });
      toast({ title: 'Resep racikan tersimpan (Draft)', description: 'Apoteker akan me-review di antrean resep' });
      onSaved?.(tpl, rx);
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleTransition = async (nextStatus) => {
    if (!racikanId) { toast({ title: 'Simpan racikan sebagai Draft dulu', variant: 'destructive' }); return; }
    try {
      const updates = { workflow_status: nextStatus };
      if (nextStatus === 'Review Farmasi') {
        updates.verified_by = 'Apoteker';
        updates.verified_at = new Date().toISOString();
      }
      await db.entities.RacikanTemplate.update(racikanId, updates);
      setRacikan(r => ({ ...r, workflow_status: nextStatus }));
      await db.entities.AuditLog.create({
        action: 'update', entity: 'RacikanTemplate', entity_id: racikanId,
        description: `Status racikan: ${racikan.workflow_status} → ${nextStatus}`,
        user_name: 'Apoteker', severity: 'Info', timestamp: new Date().toISOString(),
      });
      toast({ title: `Status: ${nextStatus}` });
    } catch (e) {
      toast({ title: 'Gagal update status', description: e.message, variant: 'destructive' });
    }
  };

  const handleProcess = async () => {
    if (racikan.components.length === 0) { toast({ title: 'Belum ada bahan racikan', variant: 'destructive' }); return; }
    if (!racikan.jumlah_ambil || racikan.jumlah_ambil <= 0) { toast({ title: 'Jumlah ambil harus > 0', variant: 'destructive' }); return; }
    const stockIssues = computed.components.filter(c => c.kebutuhan_ambil > (c.stock || 0));
    if (stockIssues.length > 0) {
      toast({ title: 'Stok tidak cukup', description: stockIssues.map(s => `${s.medicine_name}: butuh ${fmtNum(s.kebutuhan_ambil)}, stok ${s.stock}`).join('; '), variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      await onProcess(racikan, computed);
      if (racikanId) {
        // Update existing template status (loaded from prescription)
        await db.entities.RacikanTemplate.update(racikanId, {
          workflow_status: 'Diracik',
          administration_route: racikan.administration_route || 'internal',
          jumlah_ambil: racikan.jumlah_ambil,
          components: computed.components.map(c => ({
            medicine_id: c.medicine_id, medicine_name: c.medicine_name, active_substance: c.active_substance,
            kekuatan: c.kekuatan, dosis_per_racikan: c.dosis_per_racikan, dosis_mode: c.dosis_mode,
            dosis_label: c.dosis_label, kebutuhan_teoritis: c.kebutuhan_teoritis, kebutuhan_ambil: c.kebutuhan_ambil,
            pembulatan_rule: c.pembulatan_rule, harga_unit: c.harga_unit, subtotal: c.subtotal,
          })),
        });
        setRacikan(r => ({ ...r, workflow_status: 'Diracik' }));
      } else if (patient?.id) {
        // Save as patient history template (new racikan not from prescription)
        await db.entities.RacikanTemplate.create({
          patient_id: patient.id, patient_name: patient.full_name,
          racikan_name: racikan.racikan_name, bentuk_racikan: racikan.bentuk_racikan,
          jumlah_resep: racikan.jumlah_resep, jumlah_ambil: racikan.jumlah_ambil, signa: racikan.signa,
          components: computed.components.map(c => ({
            medicine_id: c.medicine_id, medicine_name: c.medicine_name, active_substance: c.active_substance,
            kekuatan: c.kekuatan, dosis_per_racikan: c.dosis_per_racikan, dosis_mode: c.dosis_mode,
            dosis_label: c.dosis_label, kebutuhan_teoritis: c.kebutuhan_teoritis, kebutuhan_ambil: c.kebutuhan_ambil,
          })),
          kemasan_fee: racikan.kemasan_fee, jasa_racik_fee: racikan.jasa_racik_fee, notes: racikan.notes,
          administration_route: racikan.administration_route || 'internal',
          workflow_status: 'Diracik',
        });
      }
      setRacikan(r => ({ ...r, components: [], racikan_name: `Racikan ${(templates.length || 0) + 2}` }));
      setCompareWith(null);
    } catch (e) {
      toast({ title: 'Gagal memproses racikan', description: e.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) { toast({ title: 'Nama template wajib', variant: 'destructive' }); return; }
    if (racikan.components.length === 0) { toast({ title: 'Belum ada bahan', variant: 'destructive' }); return; }
    try {
      await db.entities.RacikanTemplate.create({
        racikan_name: templateName,
        bentuk_racikan: racikan.bentuk_racikan,
        jumlah_resep: racikan.jumlah_resep, jumlah_ambil: racikan.jumlah_ambil, signa: racikan.signa,
        components: computed.components.map(c => ({
          medicine_id: c.medicine_id, medicine_name: c.medicine_name, active_substance: c.active_substance,
          kekuatan: c.kekuatan, dosis_per_racikan: c.dosis_per_racikan, dosis_mode: c.dosis_mode,
          dosis_label: c.dosis_label, kebutuhan_teoritis: c.kebutuhan_teoritis, kebutuhan_ambil: c.kebutuhan_ambil,
        })),
        kemasan_fee: racikan.kemasan_fee, jasa_racik_fee: racikan.jasa_racik_fee, notes: racikan.notes,
        administration_route: racikan.administration_route || 'internal',
        is_master_template: true, workflow_status: 'Draft',
      });
      toast({ title: `Template "${templateName}" tersimpan` });
      setShowSaveTemplate(false);
      setTemplateName('');
      // Refresh master templates
      db.entities.RacikanTemplate.filter({ is_master_template: true }, '-created_date', 20).then(setMasterTemplates);
    } catch (e) {
      toast({ title: 'Gagal simpan template', description: e.message, variant: 'destructive' });
    }
  };

  const facilityConfig = configs[racikan.bentuk_racikan];

  return (
    <div className="space-y-3">
      <div className="panel-accent">
        {/* Worksheet header */}
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
          <FlaskConical className="w-4 h-4 text-primary" />
          <input value={racikan.racikan_name} onChange={e => set('racikan_name', e.target.value)} className="text-sm font-semibold bg-transparent outline-none w-28" />
          <span className="text-muted-foreground">—</span>
          <input type="number" value={racikan.jumlah_ambil} onChange={e => set('jumlah_ambil', +e.target.value)} className="w-16 px-1.5 py-0.5 border border-border rounded text-sm text-center" />
          <select value={racikan.bentuk_racikan} onChange={e => set('bentuk_racikan', e.target.value)} className="text-sm border border-border rounded px-1.5 py-0.5 bg-card">
            {BENTUK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={racikan.administration_route} onChange={e => set('administration_route', e.target.value)} className="text-xs border border-border rounded px-1.5 py-0.5 bg-card" aria-label="Rute pemakaian racikan">
            <option value="internal">Dalam • Putih</option>
            <option value="external">Luar • Biru</option>
          </select>
          {mode === 'pharmacy' && racikan.workflow_status && (
            <span className={`pill ${racikan.workflow_status === 'Selesai' ? 'pill-success' : racikan.workflow_status === 'Diracik' ? 'pill-info' : 'pill-warning'}`}>{racikan.workflow_status}</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover px-2 py-1 rounded border border-primary/30 hover:bg-primary/5">
              <Layers className="w-3.5 h-3.5" /> Template
            </button>
            <button onClick={() => setShowSaveTemplate(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted">
              <Save className="w-3.5 h-3.5" /> Simpan Template
            </button>
            {patient && templates.length > 0 && (
              <button onClick={() => setShowCopyModal(true)} className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover px-2 py-1 rounded border border-primary/30 hover:bg-primary/5">
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            )}
            {onClose && <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground">✕</button>}
          </div>
        </div>

        {/* Resep / Ambil / Signa */}
        <div className="px-3 py-2 grid grid-cols-3 gap-2 border-b border-border bg-muted/30">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Resep</label>
            <input type="number" value={racikan.jumlah_resep} onChange={e => set('jumlah_resep', +e.target.value)} className="w-full px-2 py-1 border border-border rounded text-sm bg-card" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Ambil/Buat</label>
            <input type="number" value={racikan.jumlah_ambil} onChange={e => set('jumlah_ambil', +e.target.value)} className="w-full px-2 py-1 border border-border rounded text-sm bg-card font-medium" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Signa</label>
            <input value={racikan.signa} onChange={e => set('signa', e.target.value)} className="w-full px-2 py-1 border border-border rounded text-sm bg-card" placeholder="3x1" />
          </div>
          {sisaResep > 0 && (
            <div className="col-span-3 text-[11px] text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Diresepkan: {racikan.jumlah_resep} • Diambil: {racikan.jumlah_ambil} • Sisa: {sisaResep} {racikan.bentuk_racikan.toLowerCase()} (untuk kunjungan berikutnya)
            </div>
          )}
        </div>

        {/* Comparison view */}
        {diff?.hasDiff && (
          <div className="px-3 py-2 border-b border-border bg-blue-50/50">
            <p className="text-[11px] font-medium text-blue-700 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Perbandingan dengan Racikan Sebelumnya</p>
            <div className="space-y-0.5 text-[10px]">
              {diff.added.map(c => <p key={'a'+c.medicine_id} className="text-emerald-600">+ Bahan baru: {c.medicine_name}</p>)}
              {diff.removed.map(c => <p key={'r'+c.medicine_id} className="text-rose-600">− Dihapus: {c.medicine_name}</p>)}
              {diff.changed.map(c => <p key={'c'+c.medicine_name} className="text-amber-600">↳ {c.medicine_name}: dosis {c.old_dosis}→{c.new_dosis}, ambil {c.old_ambil}→{c.new_ambil}</p>)}
              {diff.jumlahChanged && <p className="text-amber-600">↳ Jumlah ambil berubah</p>}
              {diff.signaChanged && <p className="text-amber-600">↳ Signa berubah</p>}
            </div>
            <button onClick={() => setCompareWith(null)} className="text-[10px] text-blue-600 hover:underline mt-1">Tutup perbandingan</button>
          </div>
        )}

        {/* Smart Drug Search */}
        <div className="p-3 border-b border-border">
          <SmartDrugSearch onSelect={addComponent} compact />
        </div>

        {/* Components table */}
        {racikan.components.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium">Bahan</th>
                  <th className="px-2 py-1.5 font-medium">Kekuatan</th>
                  <th className="px-2 py-1.5 font-medium">Dosis/Racikan</th>
                  <th className="px-2 py-1.5 font-medium text-right">Kebutuhan</th>
                  <th className="px-2 py-1.5 font-medium text-right">Ambil</th>
                  <th className="px-2 py-1.5 font-medium text-right">Biaya</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {computed.components.map((c, i) => {
                  const isPecahan = c.dosis_mode === 'pecahan';
                  const hasRounding = c.kebutuhan_teoritis !== c.kebutuhan_ambil;
                  const lowStock = c.kebutuhan_ambil > (c.stock || 0);
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.medicine_name}</div>
                        <div className="text-[10px] text-muted-foreground">Stok: {c.stock} {lowStock && <span className="text-rose-500">⚠ kurang</span>}</div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{c.kekuatan || '-'}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <div className="flex border border-border rounded overflow-hidden">
                            <button onClick={() => updateComponent(i, 'dosis_mode', 'mg')} className={`px-1.5 py-0.5 text-[10px] ${c.dosis_mode === 'mg' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>mg</button>
                            <button onClick={() => updateComponent(i, 'dosis_mode', 'pecahan')} className={`px-1.5 py-0.5 text-[10px] ${c.dosis_mode === 'pecahan' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>¼</button>
                          </div>
                          {isPecahan ? (
                            <select value={c.dosis_label} onChange={e => updateComponent(i, 'dosis_label', e.target.value)} className="px-1.5 py-0.5 border border-border rounded text-xs bg-card">
                              {FRACTION_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          ) : (
                            <input type="number" value={c.dosis_label} onChange={e => updateComponent(i, 'dosis_label', e.target.value)} className="w-16 px-1.5 py-0.5 border border-border rounded text-xs bg-card" placeholder="250" />
                          )}
                        </div>
                        {isPecahan && c.kekuatan_mg > 0 && <div className="text-[10px] text-muted-foreground mt-0.5">{c.dosis_label} = {fmtNum(c.dosis_per_racikan)} mg</div>}
                      </td>
                      <td className="px-2 py-2 text-right"><span className="text-muted-foreground italic">{fmtNum(c.kebutuhan_teoritis)}</span></td>
                      <td className="px-2 py-2 text-right">
                        <input type="number" value={c.kebutuhan_ambil_override != null ? c.kebutuhan_ambil_override : c.kebutuhan_ambil} onChange={e => overrideAmbil(i, e.target.value)} className="w-14 px-1 py-0.5 border border-border rounded text-xs text-center font-medium bg-card" title="Override pengambilan stok" />
                        {hasRounding && c.kebutuhan_ambil_override == null && <span className="pill pill-warning ml-1 text-[9px]">dibulatkan</span>}
                      </td>
                      <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{fmtRupiah(c.subtotal)}</td>
                      <td className="px-1 py-2">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setPioMed(allMeds.find(m => m.id === c.medicine_id) || { id: c.medicine_id, name: c.medicine_name, strength: c.kekuatan })} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="PIO"><Info className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeComponent(i)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Validation warnings */}
        {warnings.length > 0 && (
          <div className="px-3 py-2 border-t border-border space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className={`flex items-start gap-1.5 text-[11px] rounded px-2 py-1.5 ${w.severity === 'critical' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                {w.severity === 'critical' ? <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> : <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />}
                <span>{w.message}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground px-1">Peringatan bersifat decision-support — apoteker dapat override dengan tanggung jawab profesional</p>
          </div>
        )}

        {/* Summary + fees */}
        <div className="px-3 py-2.5 border-t border-border space-y-2 bg-muted/20">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kemasan</label>
              <input type="number" value={racikan.kemasan_fee} onChange={e => set('kemasan_fee', +e.target.value)} className="w-full px-2 py-1 border border-border rounded text-xs bg-card" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Jasa Racik</label>
              <input type="number" value={racikan.jasa_racik_fee} onChange={e => set('jasa_racik_fee', +e.target.value)} className="w-full px-2 py-1 border border-border rounded text-xs bg-card" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Catatan/Instruksi</label>
            <input value={racikan.notes} onChange={e => set('notes', e.target.value)} className="w-full px-2 py-1 border border-border rounded text-xs bg-card" placeholder="Instruksi khusus untuk label…" />
          </div>
          <div className="flex items-center justify-between text-xs flex-wrap gap-1">
            <span className="text-muted-foreground">Obat {fmtRupiah(computed.obat_total)} + Kemasan {fmtRupiah(racikan.kemasan_fee)} + Jasa Racik {fmtRupiah(racikan.jasa_racik_fee)}</span>
            <span className="font-semibold text-primary text-sm">= {fmtRupiah(computed.total)}</span>
          </div>
        </div>

        {/* Workflow bar (pharmacy mode) or Save Draft (doctor mode) */}
        {mode === 'pharmacy' && racikanId ? (
          <RacikanWorkflowBar
            status={racikan.workflow_status}
            onTransition={handleTransition}
            onPrintLabel={() => setShowLabel(true)}
            processing={processing}
          />
        ) : null}

        <div className="px-3 py-2.5 border-t border-border">
          {mode === 'doctor' ? (
            <button
              onClick={onCapture ? () => onCapture(racikan, computed) : handleSaveDraft}
              disabled={processing || racikan.components.length === 0}
              className="w-full btn-primary py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {processing ? 'Menyimpan…' : onCapture ? 'Simpan Racikan ke Resep' : 'Simpan Resep Racikan (Draft)'}
            </button>
          ) : (
            <button onClick={handleProcess} disabled={processing || racikan.components.length === 0}
              className="w-full btn-primary py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              <Check className="w-4 h-4" /> {processing ? 'Memproses…' : 'Verifikasi & Proses Racikan'}
            </button>
          )}
        </div>
      </div>

      {/* Copy Racikan Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40" onClick={() => setShowCopyModal(false)}>
          <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Copy className="w-4 h-4 text-primary" /> Copy Racikan — {patient?.full_name}</h3>
              <button onClick={() => setShowCopyModal(false)} className="p-1 hover:bg-muted rounded text-muted-foreground">✕</button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {templates.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Belum ada racikan tersimpan untuk pasien ini</p>}
              {templates.map(tpl => (
                <button key={tpl.id} onClick={() => copyFromTemplate(tpl, true)}
                  className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left">
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0"><Beaker className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tpl.racikan_name} — {tpl.jumlah_ambil || tpl.jumlah_resep} {tpl.bentuk_racikan}</p>
                    <p className="text-[11px] text-muted-foreground">{tpl.signa} • {(tpl.components || []).length} bahan • {tpl.components?.map(c => c.medicine_name).join(', ').slice(0, 60)}</p>
                  </div>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Template Modal (use master template) */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40" onClick={() => setShowTemplateModal(false)}>
          <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Gunakan Template Racikan</h3>
              <button onClick={() => setShowTemplateModal(false)} className="p-1 hover:bg-muted rounded text-muted-foreground">✕</button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {masterTemplates.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Belum ada template master tersimpan</p>}
              {masterTemplates.map(tpl => (
                <button key={tpl.id} onClick={() => copyFromTemplate(tpl)}
                  className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left">
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0"><Layers className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tpl.racikan_name} — {tpl.bentuk_racikan}</p>
                    <p className="text-[11px] text-muted-foreground">{tpl.signa} • {(tpl.components || []).length} bahan • {tpl.components?.map(c => c.medicine_name).join(', ').slice(0, 60)}</p>
                  </div>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground">Template hanya sebagai starting point — review & verifikasi sebelum proses</p>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSaveTemplate(false)}>
          <div className="w-full max-w-sm bg-card border border-border rounded-md shadow-xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold flex items-center gap-2"><Save className="w-4 h-4 text-primary" /> Simpan sebagai Template Master</h3>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nama template, mis. Puyer Demam Anak" className="w-full px-2 py-1.5 border border-border rounded text-sm" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowSaveTemplate(false)} className="flex-1 border border-border py-1.5 rounded text-xs hover:bg-muted">Batal</button>
              <button onClick={saveAsTemplate} className="flex-1 btn-primary py-1.5 rounded text-xs font-medium">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* PIO Drawer */}
      {pioMed && <DrugInfoDrawer medicine={pioMed} onClose={() => setPioMed(null)} />}

      {/* Label Modal */}
      {showLabel && (
        <RacikanLabelPrintModal
          racikan={{ ...racikan, patient_name: patient?.full_name }}
          computed={computed}
          config={facilityConfig}
          onClose={() => setShowLabel(false)}
        />
      )}
    </div>
  );
}
