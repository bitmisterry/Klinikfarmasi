const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { X, Pill, ArrowRight, BookOpen, History, Info } from 'lucide-react';

export default function SubstitutionPanel({ medicine, allMedicines = [], onSelect = null, onClose = null }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!medicine?.id) { setLoading(false); return; }
    (async () => {
      try {
        const r = await db.entities.SubstitutionRule.filter({ from_medicine_id: medicine.id });
        setRules(r || []);
      } catch {}
      setLoading(false);
    })();
  }, [medicine?.id]);

  if (!medicine) return null;

  // Clinical alternatives: same active substance + same strength + same form
  const clinical = (allMedicines || []).filter(m =>
    m.id !== medicine.id &&
    m.active_substance &&
    medicine.active_substance &&
    m.active_substance.toLowerCase() === medicine.active_substance.toLowerCase() &&
    (m.strength || '').toLowerCase() === (medicine.strength || '').toLowerCase() &&
    (m.form || '') === (medicine.form || '')
  );

  // Broader clinical: same active substance (any strength/form)
  const broaderClinical = (allMedicines || []).filter(m =>
    m.id !== medicine.id &&
    m.active_substance &&
    medicine.active_substance &&
    m.active_substance.toLowerCase() === medicine.active_substance.toLowerCase() &&
    !clinical.find(c => c.id === m.id)
  );

  // History-based from SubstitutionRule
  const activeRules = rules.filter(r => r.is_active);

  return (
    <div className="border-t border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <ArrowRight className="w-3.5 h-3.5 text-primary" />
          Rekomendasi Substitusi
        </p>
        {onClose && <button onClick={onClose} className="p-0.5 hover:bg-muted rounded"><X className="w-3 h-3" /></button>}
      </div>

      {loading && <p className="text-[11px] text-muted-foreground">Memuat…</p>}

      {!loading && clinical.length === 0 && broaderClinical.length === 0 && activeRules.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Tidak ada substitusi tersedia</p>
      )}

      {/* Clinical: same active substance + strength + form */}
      {clinical.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider font-medium text-emerald-600 flex items-center gap-1 mb-1">
            <BookOpen className="w-3 h-3" /> Kesamaan Klinis (zat aktif + kekuatan + sediaan)
          </p>
          {clinical.map(m => (
            <div key={m.id} className="flex items-center gap-2 py-1 text-xs">
              <Pill className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="flex-1 truncate">{m.name} {m.strength}</span>
              <span className="text-muted-foreground">Rp {(m.selling_price || 0).toLocaleString('id-ID')}</span>
              {m.stock_on_hand > 0 ? (
                onSelect ? <button onClick={() => onSelect(m)} className="text-primary font-medium">+ Pilih</button>
                  : <span className="pill pill-success">Tersedia</span>
              ) : <span className="pill pill-critical">Habis</span>}
            </div>
          ))}
        </div>
      )}

      {/* Broader clinical: same active substance, different strength/form */}
      {broaderClinical.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider font-medium text-teal-600 flex items-center gap-1 mb-1">
            <Info className="w-3 h-3" /> Zat Aktif Sama (kekuatan/bentuk berbeda)
          </p>
          {broaderClinical.slice(0, 5).map(m => (
            <div key={m.id} className="flex items-center gap-2 py-1 text-xs">
              <Pill className="w-3 h-3 text-teal-500 shrink-0" />
              <span className="flex-1 truncate">{m.name} {m.strength} ({m.form})</span>
              <span className="text-muted-foreground">Rp {(m.selling_price || 0).toLocaleString('id-ID')}</span>
              {m.stock_on_hand > 0 ? (
                onSelect ? <button onClick={() => onSelect(m)} className="text-primary font-medium">+ Pilih</button>
                  : <span className="pill pill-success">Tersedia</span>
              ) : <span className="pill pill-critical">Habis</span>}
            </div>
          ))}
        </div>
      )}

      {/* History-based: from SubstitutionRule */}
      {activeRules.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-amber-600 flex items-center gap-1 mb-1">
            <History className="w-3 h-3" /> Riwayat Penggantian {activeRules[0]?.rule_type === 'AutoLearned' ? '(Auto-learned)' : '(Aturan Owner)'}
          </p>
          {activeRules.map(r => {
            const med = allMedicines?.find(m => m.id === r.to_medicine_id);
            if (!med) return null;
            return (
              <div key={r.id} className="flex items-center gap-2 py-1 text-xs">
                <ArrowRight className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="flex-1 truncate">{med.name} {med.strength}</span>
                <span className="text-muted-foreground">Rp {(med.selling_price || 0).toLocaleString('id-ID')}</span>
                {med.stock_on_hand > 0 ? (
                  onSelect ? <button onClick={() => onSelect(med)} className="text-primary font-medium">+ Pilih</button>
                    : <span className="pill pill-success">Tersedia</span>
                ) : <span className="pill pill-critical">Habis</span>}
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground mt-1 italic">Riwayat penggantian ≠ ekuivalensi klinis. Konfirmasi dengan apoteker/dokter.</p>
        </div>
      )}
    </div>
  );
}
