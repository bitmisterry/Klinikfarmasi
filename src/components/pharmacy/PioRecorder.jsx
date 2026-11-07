const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';
import { Info, Save, X } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

const EMPTY_FIELDS = { cara_pakai: '', efek_samping: '', interaksi: '', catatan: '' };
const asText = (value) => (value == null ? '' : String(value));

const getPrescriptionItems = (rx) => {
  const items = Array.isArray(rx?.items) ? rx.items : [];
  return items.length ? items : [{ medicine_id: '', medicine_name: 'Item resep belum terbaca', strength: '', dosage: '', instructions: '' }];
};

const normalizeLegacyPio = (rx, items, medicines = []) => {
  const recorded = rx?.pio_recorded;
  const savedItems = Array.isArray(recorded?.items) ? recorded.items : [];
  return items.map((item, index) => {
    const saved = savedItems[index] || (index === 0 && recorded && !Array.isArray(recorded.items) ? recorded : {});
    const medicine = medicines.find((entry) => entry.id === item.medicine_id);
    return {
      item_index: index,
      medicine_id: item.medicine_id || saved.medicine_id || '',
      medicine_name: item.medicine_name || saved.medicine_name || `Item ${index + 1}`,
      strength: item.strength || saved.strength || '',
      ...EMPTY_FIELDS,
      cara_pakai: asText(saved.cara_pakai || item.dosage || item.instructions),
      efek_samping: asText(saved.efek_samping || medicine?.side_effects || medicine?.adverse_effects),
      interaksi: asText(saved.interaksi || medicine?.interactions),
      catatan: asText(saved.catatan),
    };
  });
};

/** PIO dicatat per item obat, bukan satu catatan global untuk seluruh resep. */
export default function PioRecorder({ rx, medicines = [], onClose, onSaved }) {
  const prescriptionItems = useMemo(() => getPrescriptionItems(rx), [rx]);
  const [forms, setForms] = useState(() => normalizeLegacyPio(rx, prescriptionItems, medicines));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setForms(normalizeLegacyPio(rx, getPrescriptionItems(rx), medicines));
  }, [rx?.id, medicines]);

  const updateField = (index, field, value) => {
    setForms((current) => current.map((form, formIndex) => (
      formIndex === index ? { ...form, [field]: value } : form
    )));
  };

  const handleSave = async () => {
    if (!rx?.id) return;
    setSaving(true);
    try {
      await db.entities.Prescription.update(rx.id, {
        pio_recorded: {
          scope: 'per_item',
          items: forms.map((form, index) => ({
            ...form,
            item_index: index,
            medicine_id: prescriptionItems[index]?.medicine_id || form.medicine_id || '',
            medicine_name: prescriptionItems[index]?.medicine_name || form.medicine_name,
            strength: prescriptionItems[index]?.strength || form.strength || '',
          })),
          recorded_by: 'Apoteker',
          recorded_at: new Date().toISOString(),
        },
      });
      toast({ title: 'PIO per obat tercatat' });
      onSaved?.();
      onClose?.();
    } catch (error) {
      toast({ title: 'Gagal menyimpan PIO', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'mt-1 w-full rounded border border-border px-2 py-1.5 text-xs outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-md border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Info className="h-4 w-4 text-primary" /> Catat PIO per obat</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto p-4">
          <p className="rounded bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
            Pelayanan Informasi Obat bersifat opsional. Lengkapi tiap obat sesuai resep dan informasi yang terverifikasi; melewati PIO tidak memblokir transaksi.
          </p>

          {prescriptionItems.map((item, index) => {
            const form = forms[index] || { ...EMPTY_FIELDS };
            return (
              <section key={`${item.medicine_id || item.medicine_name}-${index}`} className="rounded-md border border-border p-3">
                <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-2">
                  <div>
                    <p className="text-xs font-semibold">{item.medicine_name || `Item ${index + 1}`}</p>
                    <p className="text-[11px] text-muted-foreground">{item.strength || ''}{item.dosage ? ` • ${item.dosage}` : ''}</p>
                  </div>
                  <span className="rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">Obat {index + 1}</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-[11px] text-muted-foreground">Cara Pakai
                    <textarea value={form.cara_pakai} onChange={(event) => updateField(index, 'cara_pakai', event.target.value)} className={inputCls} rows={2} placeholder="Mis. 3x sehari setelah makan, 1 tablet" />
                  </label>
                  <label className="text-[11px] text-muted-foreground">Efek Samping Utama
                    <textarea value={form.efek_samping} onChange={(event) => updateField(index, 'efek_samping', event.target.value)} className={inputCls} rows={2} placeholder="Mis. Mual, pusing, diare" />
                  </label>
                  <label className="text-[11px] text-muted-foreground">Interaksi dengan Obat Rutin
                    <textarea value={form.interaksi} onChange={(event) => updateField(index, 'interaksi', event.target.value)} className={inputCls} rows={2} placeholder="Mis. Hindari alkohol atau antasida bersamaan" />
                  </label>
                  <label className="text-[11px] text-muted-foreground">Catatan Tambahan
                    <textarea value={form.catatan} onChange={(event) => updateField(index, 'catatan', event.target.value)} className={inputCls} rows={2} placeholder="Catatan lain untuk pasien…" />
                  </label>
                </div>
              </section>
            );
          })}
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="flex-1 rounded border border-border py-2 text-xs hover:bg-muted">Lewati</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex flex-1 items-center justify-center gap-1.5 rounded py-2 text-xs font-medium disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {saving ? 'Menyimpan…' : 'Simpan PIO'}
          </button>
        </div>
      </div>
    </div>
  );
}
