const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { X, FileText, Trash2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import SmartDrugSearch from '@/components/SmartDrugSearch';

export default function ExternalRxForm({ onClose, onCreated }) {
  const [doctorName, setDoctorName] = useState('');
  const [patientName, setPatientName] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const addItem = (med) => {
    setItems(prev => [...prev, {
      medicine_id: med.id,
      medicine_name: med.name,
      strength: med.strength || '',
      dosage: '',
      quantity: 1,
      instructions: '',
      substituted: false,
    }]);
  };

  const updateItem = (i, field, val) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  };

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!doctorName.trim()) { toast({ title: 'Nama dokter wajib', variant: 'destructive' }); return; }
    if (items.length === 0) { toast({ title: 'Minimal 1 item obat', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const rx = await db.entities.Prescription.create({
        prescription_number: `RX${today.replace(/-/g, '')}${String(Date.now()).slice(-3)}`,
        patient_name: patientName || 'Walk-in',
        doctor_name: doctorName,
        prescription_date: today,
        source: 'Eksternal',
        status: 'Diresepkan',
        items,
        notes,
      });
      toast({ title: 'Resep eksternal dibuat', description: rx.prescription_number });
      onCreated?.(rx);
      onClose?.();
    } catch (e) {
      toast({ title: 'Gagal membuat resep', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Resep Eksternal
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Nama Dokter Luar *</label>
              <input value={doctorName} onChange={e => setDoctorName(e.target.value)} className={inputCls} placeholder="dr. ..." />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Nama Pasien (opsional)</label>
              <input value={patientName} onChange={e => setPatientName(e.target.value)} className={inputCls} placeholder="Walk-in" />
            </div>
          </div>

          <div>
            <p className="micro-label mb-1.5">Cari & Tambah Obat</p>
            <SmartDrugSearch onSelect={addItem} compact />
          </div>

          {items.length > 0 && (
            <div className="space-y-1.5">
              <p className="micro-label">Item Resep</p>
              {items.map((it, i) => (
                <div key={i} className="bg-muted/30 rounded p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium flex-1">{it.medicine_name} {it.strength}</span>
                    <button onClick={() => removeItem(i)} className="text-rose-500 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input value={it.dosage} onChange={e => updateItem(i, 'dosage', e.target.value)} placeholder="Signa (3x1)" className={inputCls} />
                    <input type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} placeholder="Qty" className={inputCls} />
                    <input value={it.instructions} onChange={e => updateItem(i, 'instructions', e.target.value)} placeholder="Instruksi" className={inputCls} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-[11px] text-muted-foreground">Catatan</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={2} placeholder="Catatan untuk apoteker…" />
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Buat Resep & Lanjut ke POS'}
          </button>
        </div>
      </div>
    </div>
  );
}