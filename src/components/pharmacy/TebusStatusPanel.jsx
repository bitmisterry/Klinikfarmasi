const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, RotateCcw, Save } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

/**
 * Panel status tebus untuk resep: Seluruhnya/Sebagian/Tidak Ditebus.
 * Notasi kefarmasian: det (diberikan), ne det (tidak diberikan), iter+N (ulang).
 * Hitung sisa obat belum diserahkan otomatis.
 */
export default function TebusStatusPanel({ rx, onUpdate }) {
  const [tebusStatus, setTebusStatus] = useState(rx?.tebus_status || '');
  const [notation, setNotation] = useState(rx?.tebus_notation || '');
  const [remaining, setRemaining] = useState(rx?.tebus_remaining || 0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const totalItems = (rx?.items || []).length;

  useEffect(() => {
    setTebusStatus(rx?.tebus_status || '');
    setNotation(rx?.tebus_notation || '');
    setRemaining(rx?.tebus_remaining || 0);
  }, [rx?.id]);

  // Auto-calculate remaining based on status
  useEffect(() => {
    if (tebusStatus === 'Seluruhnya') setRemaining(0);
    else if (tebusStatus === 'Tidak Ditebus') setRemaining(totalItems);
    else if (tebusStatus === 'Sebagian' && !rx?.tebus_remaining) setRemaining(Math.ceil(totalItems / 2));
  }, [tebusStatus, totalItems]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.entities.Prescription.update(rx.id, {
        tebus_status: tebusStatus,
        tebus_notation: notation,
        tebus_remaining: remaining,
      });
      toast({ title: 'Status tebus disimpan' });
      onUpdate?.();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const notationOptions = [
    { value: 'det', label: 'det (diberikan)', desc: 'Seluruh obat diberikan/tebus' },
    { value: 'ne det', label: 'ne det (tidak diberikan)', desc: 'Obat tidak ditebus pasien' },
    { value: 'iter', label: 'iter (ulang)', desc: 'Resep dapat diulang' },
  ];

  return (
    <div className="panel p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
        <p className="text-xs font-semibold">Status Tebus Resep</p>
      </div>

      {/* Status selector */}
      <div className="grid grid-cols-3 gap-1.5">
        {['Seluruhnya', 'Sebagian', 'Tidak Ditebus'].map(s => (
          <button
            key={s}
            onClick={() => {
              setTebusStatus(s);
              setNotation((current) => {
                if (s === 'Tidak Ditebus') return current || 'ne det';
                return current === 'ne det' ? '' : current;
              });
            }}
            className={`py-1.5 rounded text-[11px] font-medium border transition-colors ${
              tebusStatus === s
                ? s === 'Seluruhnya' ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : s === 'Sebagian' ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-rose-50 text-rose-700 border-rose-300'
                : 'border-border hover:bg-muted text-muted-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Notation */}
      <div>
        <p className="micro-label mb-1">Notasi Kefarmasian</p>
        <div className="flex flex-wrap gap-1">
          {notationOptions.map(n => (
            <button
              key={n.value}
              onClick={() => setNotation(notation === n.value ? '' : n.value)}
              title={n.desc}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                notation === n.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
        <input
          value={notation}
          onChange={e => setNotation(e.target.value)}
          placeholder="Atau ketik notasi manual, mis. iter.2"
          className="w-full mt-1.5 px-2 py-1 border border-border rounded text-[11px] font-mono outline-none focus:border-primary"
        />
      </div>

      {/* Remaining */}
      {tebusStatus === 'Sebagian' && (
        <div>
          <p className="micro-label mb-1">Sisa Obat Belum Diserahkan</p>
          <input
            type="number"
            value={remaining}
            onChange={e => setRemaining(parseInt(e.target.value) || 0)}
            min={0}
            max={totalItems}
            className="w-full px-2 py-1 border border-border rounded text-xs outline-none focus:border-primary"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Dari total {totalItems} item resep</p>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-2 text-[11px] bg-muted/30 rounded px-2 py-1.5">
        {tebusStatus === 'Seluruhnya' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
        {tebusStatus === 'Sebagian' && <AlertCircle className="w-3 h-3 text-amber-600" />}
        {tebusStatus === 'Tidak Ditebus' && <RotateCcw className="w-3 h-3 text-rose-600" />}
        <span className="text-muted-foreground">
          {tebusStatus ? `${tebusStatus} • Sisa: ${remaining} item` : 'Pilih status tebus'}
          {notation && ` • ${notation}`}
        </span>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !tebusStatus}
        className="w-full btn-primary py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan Status Tebus'}
      </button>
    </div>
  );
}
