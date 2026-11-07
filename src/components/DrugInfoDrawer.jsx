import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Pill, AlertCircle, CheckCircle2, Ban, Beaker, Baby, Sparkles, Link2, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { recordSubstitution } from '@/lib/pharmacy';
import SubstitutionPanel from './SubstitutionPanel';

export default function DrugInfoDrawer({ medicine, onClose, onSelect = null }) {
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [allMedicines, setAllMedicines] = useState([]);

  useEffect(() => {
    base44.entities.Medicine.list().then(setAllMedicines).catch(() => {});
  }, []);

  const fetchAISummary = async () => {
    if (aiData) return;
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('fetchDrugInfoSummary', {
        medicineName: medicine.name,
        activeSubstance: medicine.active_substance,
        strength: medicine.strength,
        form: medicine.form,
      });
      setAiData(res.data);
    } catch {
      setAiData({ error: 'Gagal memuat ringkasan AI. Silakan gunakan referensi eksternal di bawah.' });
    }
    setAiLoading(false);
  };

  const sections = [
    { icon: CheckCircle2, label: 'Indikasi', value: medicine.indication, color: 'text-emerald-600' },
    { icon: Ban, label: 'Kontraindikasi', value: medicine.contraindication, color: 'text-rose-600' },
    { icon: AlertCircle, label: 'Efek Samping', value: medicine.side_effects, color: 'text-amber-600' },
    { icon: Beaker, label: 'Interaksi Obat', value: medicine.interactions, color: 'text-purple-600' },
    { icon: AlertCircle, label: 'Perhatian Khusus', value: medicine.precautions, color: 'text-blue-600' },
    { icon: Baby, label: 'Kategori Kehamilan/Menyusui', value: medicine.pregnancy_category ? `Kategori ${medicine.pregnancy_category}` : '-', color: 'text-pink-600' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{medicine.name}</h3>
              <p className="text-[11px] text-muted-foreground">{medicine.active_substance} {medicine.strength} • {medicine.form}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        {/* Quick info */}
        <div className="px-4 py-3 border-b border-border grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="micro-label">Kategori</p>
            <p className="text-xs font-medium mt-0.5">{medicine.category}</p>
          </div>
          <div>
            <p className="micro-label">Rak</p>
            <p className="text-xs font-medium mt-0.5">{medicine.shelf_location || '-'}</p>
          </div>
          <div>
            <p className="micro-label">Harga</p>
            <p className="text-xs font-medium mt-0.5">Rp {(medicine.selling_price || 0).toLocaleString('id-ID')}</p>
          </div>
        </div>

        {/* PIO Sections */}
        <div className="px-4 py-3 space-y-3">
          <p className="micro-label">Pelayanan Informasi Obat (PIO) — Master Data</p>
          {sections.map(s => (
            <div key={s.label} className="flex gap-2">
              <s.icon className={`w-4 h-4 ${s.color} shrink-0 mt-0.5`} />
              <div className="flex-1">
                <p className="text-xs font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.value || 'Tidak ada data'}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI Summary — Curated sources */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="micro-label flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" /> AI Summary (Sumber Terkurasi)</p>
            {!aiData && (
              <button onClick={fetchAISummary} disabled={aiLoading} className="text-[11px] text-primary hover:text-primary-hover font-medium disabled:opacity-50">
                {aiLoading ? 'Memuat…' : 'Generate'}
              </button>
            )}
          </div>
          {aiData && !aiData.error && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 leading-relaxed">
                {aiData.summary}
              </div>
              {aiData.sources && aiData.sources.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Sumber
                  </p>
                  {aiData.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary-hover">
                      <ExternalLink className="w-3 h-3" /> {s.source}
                      <span className="text-muted-foreground flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{s.accessedDate}</span>
                    </a>
                  ))}
                </div>
              )}
              {aiData.disclaimer && (
                <p className="text-[10px] italic text-muted-foreground">{aiData.disclaimer}</p>
              )}
            </div>
          )}
          {aiData?.error && (
            <p className="text-xs text-rose-600 bg-rose-50 rounded p-2.5">{aiData.error}</p>
          )}
        </div>

        {/* External Reference */}
        <div className="px-4 py-3 border-t border-border">
          <p className="micro-label mb-2">Referensi Eksternal (One-Click)</p>
          <div className="flex flex-wrap gap-1.5">
            <a href={`https://www.medscape.com/search?queryText=${encodeURIComponent(medicine.active_substance || medicine.name)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs px-2 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100">
              <ExternalLink className="w-3 h-3" /> Medscape
            </a>
            <a href={`https://www.drugs.com/search.php?searchterm=${encodeURIComponent(medicine.active_substance || medicine.name)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs px-2 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">
              <ExternalLink className="w-3 h-3" /> Drugs.com
            </a>
            <a href={`https://www.mims.com/indonesia/search?q=${encodeURIComponent(medicine.active_substance || medicine.name)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs px-2 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100">
              <ExternalLink className="w-3 h-3" /> MIMS
            </a>
          </div>
        </div>

        {/* Substitution Panel */}
        <SubstitutionPanel
          medicine={medicine}
          allMedicines={allMedicines}
          onSelect={(m) => {
            if (medicine.stock_on_hand <= 0) {
              recordSubstitution(medicine, m, 'AutoLearned');
            }
            onSelect?.(m);
          }}
        />

        {/* Action */}
        {onSelect && medicine.stock_on_hand > 0 && (
          <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3">
            <button onClick={() => { onSelect(medicine); onClose(); }}
              className="w-full btn-primary py-2 rounded-md text-sm font-medium">
              + Tambah ke Transaksi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
