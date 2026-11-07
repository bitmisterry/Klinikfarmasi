import React from 'react';
import { Check, FlaskConical, Package, Printer, Hand, CheckCircle2, ArrowRight } from 'lucide-react';

const STATUS_FLOW = ['Draft', 'Review Farmasi', 'Siap Diracik', 'Diracik', 'Siap Diserahkan', 'Selesai'];
const STATUS_ICONS = {
  'Draft': FlaskConical,
  'Review Farmasi': Check,
  'Siap Diracik': Package,
  'Diracik': FlaskConical,
  'Siap Diserahkan': Hand,
  'Selesai': CheckCircle2,
};

export default function RacikanWorkflowBar({ status, onTransition, onPrintLabel, processing }) {
  const currentIdx = STATUS_FLOW.indexOf(status || 'Draft');
  const canPrint = currentIdx >= 3; // Diracik or beyond

  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
  const NextIcon = nextStatus ? STATUS_ICONS[nextStatus] : null;

  return (
    <div className="px-3 py-2.5 border-t border-border bg-muted/20">
      {/* Status stepper */}
      <div className="flex items-center gap-1 mb-2.5 overflow-x-auto">
        {STATUS_FLOW.map((s, i) => {
          const Icon = STATUS_ICONS[s];
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] whitespace-nowrap ${
                isCurrent ? 'bg-primary text-primary-foreground font-semibold' :
                isPast ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                <Icon className="w-3 h-3" /> {s}
              </div>
              {i < STATUS_FLOW.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {nextStatus && (
          <button
            onClick={() => onTransition(nextStatus)}
            disabled={processing}
            className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
          >
            {NextIcon && <NextIcon className="w-3.5 h-3.5" />} Lanjut ke {nextStatus}
          </button>
        )}
        {canPrint && (
          <button
            onClick={onPrintLabel}
            className="flex items-center gap-1.5 border border-border px-3 py-1.5 rounded text-xs font-medium hover:bg-muted"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Label
          </button>
        )}
        {status === 'Selesai' && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium px-2">
            <CheckCircle2 className="w-4 h-4" /> Racikan selesai
          </span>
        )}
      </div>
    </div>
  );
}