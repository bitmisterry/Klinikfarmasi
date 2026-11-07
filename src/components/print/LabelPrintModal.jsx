const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, Download, Pill, Edit3, Lock } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import {
  loadPrintConfig, buildLabelData, getPrescriptionUsage, buildRacikanLabelHTML, saveLabelsPDF,
  printLabelsPDF, logPrintAction, getLabelDimensions, getCachedConfig,
} from '@/lib/printEngine';

const TYPE_META = {
  white: { label: 'Etiket Putih', color: 'bg-white border-slate-300 text-slate-700', icon: Pill },
  blue: { label: 'Etiket Biru', color: 'bg-blue-50 border-blue-400 text-blue-700', icon: Pill },
};

export default function LabelPrintModal({ rx, items, medicines = [], onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState(getCachedConfig());
  const [selected, setSelected] = useState(new Set());
  const [editingIdx, setEditingIdx] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await loadPrintConfig();
      setConfig(cfg);
    })();
  }, []);

  // Build label data for each item
  const labels = useMemo(() => {
    return (items || []).map((item, idx) => {
      const medicine = medicines.find(m => m.id === item.medicine_id);
      const override = overrides[idx] || item.label_override || {};
      const base = buildLabelData(rx, item, medicine, config);
      const usageInstruction = override.usage_instruction || getPrescriptionUsage(item, rx?.signa);
      return {
        ...base,
        _idx: idx,
        // The queue item is the source of truth for racikan printing. Strip
        // the display-only "(Puyer)" suffix so preview and PDF share the same
        // readable racikan name.
        racikan_name: base.racikan_name?.replace(/\s*\([^)]*\)\s*$/, '') || base.racikan_name,
        dosage: usageInstruction,
        storage_note: override.storage_note || '',
        pio_note: override.pio_note || '',
        signa: usageInstruction,
        storage_instructions: override.storage_note || '',
      };
    });
  }, [items, medicines, rx, config, overrides]);
  const selectableIndexesKey = labels.filter((label) => !label.route_needs_verification).map((label) => label._idx).join(',');
  const selectableLabels = labels.filter((label) => !label.route_needs_verification);
  const allSelectableSelected = selectableLabels.length > 0 && selectableLabels.every((label) => selected.has(label._idx));

  // Auto-select all by default
  useEffect(() => {
    setSelected(new Set(labels.filter((label) => !label.route_needs_verification).map((label) => label._idx)));
  }, [selectableIndexesKey]);

  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelectableSelected) setSelected(new Set());
    else setSelected(new Set(selectableLabels.map((label) => label._idx)));
  };

  const handleSaveOverride = (idx, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [idx]: { ...prev[idx], [field]: value },
    }));
  };

  const persistOverrides = async () => {
    if (Object.keys(overrides).length === 0) return;
    try {
      const updatedItems = (rx?.items || items || []).map((it, i) => {
        if (overrides[i]) {
          return { ...it, label_override: { ...(it.label_override || {}), ...overrides[i] } };
        }
        return it;
      });
      if (rx?.id) {
        await db.entities.Prescription.update(rx.id, { items: updatedItems });
      }
      await db.entities.AuditLog.create({
        action: 'update',
        entity: 'Prescription',
        description: `Farmasis mengubah label etiket resep ${rx?.prescription_number || ''} — ${Object.keys(overrides).length} item`,
        user_name: user?.full_name || user?.email || 'Apoteker',
        timestamp: new Date().toISOString(),
        metadata: JSON.stringify({ overrides }),
      });
      toast({ title: 'Perubahan etiket disimpan', description: 'Data resep dokter tidak diubah' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Gagal menyimpan', variant: 'destructive' });
    }
  };

  const handlePrintAll = async () => {
    const toPrint = labels.filter(l => selected.has(l._idx));
    if (toPrint.length === 0) {
      toast({ title: 'Pilih minimal satu etiket', variant: 'destructive' });
      return;
    }
    if (toPrint.some((label) => label.route_needs_verification)) {
      toast({ title: 'Rute pemakaian belum diverifikasi', description: 'Lengkapi rute pemakaian di Master Obat sebelum mencetak etiket.', variant: 'destructive' });
      return;
    }
    setPrinting(true);
    await persistOverrides();
    try {
      await printLabelsPDF(toPrint, config);
      await logPrintAction({
        user,
        prescriptionNumber: rx?.prescription_number,
        printReason: 'Normal',
        documentType: 'Etiket',
        details: { count: toPrint.length },
      });
    } catch (e) {
      toast({ title: 'Gagal mencetak', description: e.message, variant: 'destructive' });
    }
    setPrinting(false);
  };

  const handleDownloadAll = async () => {
    const toPrint = labels.filter(l => selected.has(l._idx));
    if (toPrint.length === 0) return;
    if (toPrint.some((label) => label.route_needs_verification)) {
      toast({ title: 'Rute pemakaian belum diverifikasi', description: 'Lengkapi rute pemakaian di Master Obat sebelum membuat PDF.', variant: 'destructive' });
      return;
    }
    setPrinting(true);
    await persistOverrides();
    try {
      await saveLabelsPDF(toPrint, config, `Etiket-${rx?.prescription_number || Date.now()}.pdf`);
      await logPrintAction({
        user,
        prescriptionNumber: rx?.prescription_number,
        printReason: 'Normal',
        documentType: 'Etiket (PDF)',
        details: { count: toPrint.length },
      });
    } catch (e) {
      toast({ title: 'Gagal generate PDF', description: e.message, variant: 'destructive' });
    }
    setPrinting(false);
  };

  const dims = getLabelDimensions(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-md shadow-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" /> Smart Label Generator
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium">{selected.size} / {labels.length} etiket dipilih</span>
            <button onClick={toggleAll} className="text-primary hover:underline text-[11px]">
              {allSelectableSelected ? 'Kosongkan' : 'Pilih Semua'}
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Ukuran label: {dims.w}×{dims.h} mm
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {labels.length === 0 && (
            <div className="text-center py-10 text-xs text-muted-foreground">
              Tidak ada item obat pada resep ini
            </div>
          )}
          {labels.map((label) => {
            const baseMeta = TYPE_META[label.type] || TYPE_META.white;
            const meta = label.is_racikan ? { ...baseMeta, label: `${baseMeta.label} • Racikan` } : baseMeta;
            const Icon = meta.icon;
            const isSelected = selected.has(label._idx);
            const isEditing = editingIdx === label._idx;
            return (
              <div key={label._idx} className={`border rounded-md overflow-hidden ${isSelected ? 'border-primary/40' : 'border-border opacity-60'}`}>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={label.route_needs_verification}
                    onChange={() => toggleSelect(label._idx)}
                    className="w-4 h-4"
                  />
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{label.medicine_name} {label.strength}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {label.patient_name} • {label.dosage || '—'}
                    </p>
                    {label.route_needs_verification && <p className="mt-1 text-[10px] text-amber-700">Rute pemakaian belum diverifikasi di Master Obat.</p>}
                  </div>
                  <span className={`pill ${meta.color}`}>{meta.label}</span>
                  <button
                    onClick={() => setEditingIdx(isEditing ? null : label._idx)}
                    className={`p-1 rounded hover:bg-muted ${isEditing ? 'text-primary' : 'text-muted-foreground'}`}
                    title="Edit etiket"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isEditing && (
                  <div className="px-3 py-2.5 border-t border-border bg-amber-50/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-700 mb-1">
                      <Lock className="w-3 h-3" />
                      <span>Data resep dokter terkunci — hanya informasi etiket/PIO yang dapat diedit</span>
                    </div>
                    <div>
                      <label className="micro-label">Aturan Pakai</label>
                      <input
                        value={label.dosage}
                        onChange={e => handleSaveOverride(label._idx, 'usage_instruction', e.target.value)}
                        className="w-full px-2 py-1 border border-border rounded text-xs bg-card"
                        placeholder="3x1 tablet"
                      />
                    </div>
                    <div>
                      <label className="micro-label">Catatan Penyimpanan</label>
                      <input
                        value={label.storage_note}
                        onChange={e => handleSaveOverride(label._idx, 'storage_note', e.target.value)}
                        className="w-full px-2 py-1 border border-border rounded text-xs bg-card"
                        placeholder="Kocok dahulu / Simpan di lemari es (kosongkan jika tidak relevan)"
                      />
                    </div>
                    <div>
                      <label className="micro-label">Info PIO (opsional)</label>
                      <input
                        value={label.pio_note}
                        onChange={e => handleSaveOverride(label._idx, 'pio_note', e.target.value)}
                        className="w-full px-2 py-1 border border-border rounded text-xs bg-card"
                        placeholder="Edukasi pasien terkait obat"
                      />
                    </div>
                  </div>
                )}

                {isSelected && label.is_racikan && (
                  <div className="border-t border-border bg-muted/20 p-3 flex justify-center overflow-x-auto">
                    <div
                      className="shadow-sm"
                      dangerouslySetInnerHTML={{ __html: buildRacikanLabelHTML(label, config) }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <button
            onClick={handlePrintAll}
            disabled={printing || selected.size === 0}
            className="flex-1 flex items-center justify-center gap-1.5 btn-primary py-2.5 rounded text-sm font-medium disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> {printing ? 'Memproses…' : `Print ${selected.size} Etiket`}
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={printing || selected.size === 0}
            className="flex items-center justify-center gap-1.5 px-4 border border-border rounded text-sm hover:bg-muted disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={onClose} className="px-4 border border-border rounded text-sm hover:bg-muted">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
