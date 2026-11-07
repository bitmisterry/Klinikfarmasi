import React from 'react';
import { Receipt, FileText, Stethoscope } from 'lucide-react';

export default function CashierQueue({ queue, selected, onSelect }) {
  return (
    <div className="panel flex flex-col">
      <div className="px-3 py-2.5 border-b border-border">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" /> Antrean Kasir
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Pasien siap membayar seluruh tagihan kunjungan
        </p>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border max-h-[calc(100vh-220px)]">
        {queue.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Receipt className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">Tidak ada antrean kasir</p>
            <p className="text-[11px] mt-0.5">Pasien masuk setelah layanan dan resep (bila ada) siap ditagihkan</p>
          </div>
        )}
        {queue.map(q => (
          <button
            key={q.id}
            onClick={() => onSelect(q)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${
              selected?.id === q.id ? 'bg-primary/5 border-l-[3px] border-l-[hsl(var(--primary))]' : ''
            }`}
          >
            <span className="text-xs font-mono font-semibold text-primary w-14">{q.queue_number}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{q.patient_name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{q.loket || q.complaint || '-'}</p>
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <span className="pill pill-info text-[9px] px-1 py-0">
                <Stethoscope className="w-2.5 h-2.5" /> Konsultasi
              </span>
              {q.prescription_id && (
                <span className="pill pill-warning text-[9px] px-1 py-0">
                  <FileText className="w-2.5 h-2.5" /> Resep
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
