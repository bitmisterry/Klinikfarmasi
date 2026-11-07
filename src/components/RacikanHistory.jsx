const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { FlaskConical, ChevronRight, Copy, ArrowLeft } from 'lucide-react';

import { fmtNum } from '@/lib/racikan';

const STATUS_COLORS = {
  'Draft': 'pill-inactive',
  'Review Farmasi': 'pill-info',
  'Siap Diracik': 'pill-warning',
  'Diracik': 'pill-success',
  'Siap Diserahkan': 'pill-info',
  'Selesai': 'pill-success',
};

export default function RacikanHistory({ patientId, onCopyToNew }) {
  const [racikans, setRacikans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    db.entities.RacikanTemplate.filter(
      { patient_id: patientId, is_master_template: { $ne: true } },
      '-created_date', 20
    ).then(list => setRacikans(list || [])).catch(() => setRacikans([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <p className="text-[11px] text-muted-foreground px-4 py-2">Memuat riwayat racikan…</p>;
  if (racikans.length === 0 && !selected) return null;

  if (selected) {
    const selectedComponents = Array.isArray(selected.components) ? selected.components : [];
    return (
      <div className="px-4 py-3 border-b border-border">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover mb-2">
          <ArrowLeft className="w-3 h-3" /> Kembali ke riwayat
        </button>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-semibold">{selected.racikan_name} — {selected.bentuk_racikan}</p>
            <p className="text-[10px] text-muted-foreground">{selected.signa} • {selected.jumlah_ambil || selected.jumlah_resep || 0} unit</p>
          </div>
          <span className={`pill ${STATUS_COLORS[selected.workflow_status] || 'pill-inactive'}`}>{selected.workflow_status || 'Draft'}</span>
        </div>
        <div className="space-y-1">
          {selectedComponents.map((c, i) => (
            <div key={i} className="text-[11px] flex items-center justify-between bg-muted/30 rounded px-2 py-1">
              <span className="font-medium">{c?.medicine_name || 'Bahan racikan'}</span>
              <span className="text-muted-foreground">{c?.dosis_label || `${fmtNum(c?.dosis_per_racikan)} mg`} → ambil {fmtNum(c?.kebutuhan_ambil)}</span>
            </div>
          ))}
          {selectedComponents.length === 0 && <p className="rounded bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">Komposisi racikan belum tersedia pada riwayat ini.</p>}
        </div>
        <button
          onClick={() => onCopyToNew?.(selected)}
          className="w-full mt-2 flex items-center justify-center gap-1.5 btn-primary py-1.5 rounded text-[11px] font-medium"
        >
          <Copy className="w-3 h-3" /> Copy ke Resep Racikan Baru
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-border">
      <p className="micro-label flex items-center gap-1 mb-2"><FlaskConical className="w-3 h-3 text-primary" /> Riwayat Racikan ({racikans.length})</p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {racikans.map(t => (
          <button key={t.id} onClick={() => setSelected(t)}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded text-left">
            <FlaskConical className="w-3 h-3 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">{t.racikan_name} — {t.bentuk_racikan}</p>
              <p className="text-[10px] text-muted-foreground">{t.signa} • {Array.isArray(t.components) ? t.components.length : 0} bahan</p>
            </div>
            <span className={`pill ${STATUS_COLORS[t.workflow_status] || 'pill-inactive'}`}>{t.workflow_status || 'Draft'}</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
