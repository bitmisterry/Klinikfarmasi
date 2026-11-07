import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

export default function PrescriptionWarnings({ warnings, onDismiss }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {warnings.map((w, i) => {
        const isCritical = w.severity === 'critical';
        return (
          <div
            key={i}
            className={`flex items-start gap-2 rounded px-2.5 py-2 text-xs ${
              isCritical
                ? 'bg-rose-50 border border-rose-200 text-rose-700'
                : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}
          >
            {isCritical ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">{w.message}</p>
              {w.type === 'allergy' && (
                <p className="text-[10px] mt-0.5 opacity-80">
                  Pastikan pasien tahu — pertimbangkan obat alternatif atau konsfirmasi alergi.
                </p>
              )}
              {w.type === 'interaction' && (
                <p className="text-[10px] mt-0.5 opacity-80">
                  Tinjau dosis & jarak pemberian — pertimbangkan alternatif jika perlu.
                </p>
              )}
            </div>
            {onDismiss && (
              <button onClick={() => onDismiss(i)} className="text-[10px] underline shrink-0 opacity-70 hover:opacity-100">
                Abaikan
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}