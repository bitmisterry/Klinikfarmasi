import React, { useMemo } from 'react';
import { ADULT_TEETH, CHILD_TEETH, TOOTH_CONDITIONS } from '@/lib/odontogram';

export default function OdontogramChart({ records = [], onToothClick, selectedTooth, isChild = false }) {
  const teeth = isChild ? CHILD_TEETH : ADULT_TEETH;

  const recordMap = useMemo(() => {
    const m = {};
    records.forEach(r => { m[r.tooth_number] = r; });
    return m;
  }, [records]);

  const renderTooth = (tooth, isUpper) => {
    const record = recordMap[tooth.number];
    const condition = record?.condition || 'Sehat';
    const condInfo = TOOTH_CONDITIONS[condition];
    const isSelected = selectedTooth === tooth.number;

    return (
      <button
        key={tooth.number}
        onClick={() => onToothClick?.(tooth.number)}
        className={`flex flex-col items-center gap-0.5 group transition-all`}
        title={`${tooth.number} — ${tooth.name} (${tooth.type})`}
      >
        <span className={`text-[9px] font-mono ${isSelected ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          {tooth.number}
        </span>
        <div
          className={`w-7 h-9 rounded-sm border-2 flex items-center justify-center text-[8px] font-bold transition-all ${
            isSelected ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'group-hover:scale-105'
          }`}
          style={{
            backgroundColor: condInfo.color,
            borderColor: isSelected ? 'hsl(var(--primary))' : condInfo.border,
            color: condition === 'Sehat' ? '#64748B' : '#fff',
          }}
        >
          {condition !== 'Sehat' ? condInfo.icon : ''}
        </div>
        <span className="text-[8px] text-muted-foreground truncate w-7 text-center hidden lg:block">
          {tooth.type.slice(0, 4)}
        </span>
      </button>
    );
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Odontogram {isChild ? '(Gigi Susu)' : '(Gigi Tetap)'}</h3>
        <div className="flex flex-wrap gap-1">
          {Object.entries(TOOTH_CONDITIONS).filter(([k]) => k !== 'Sehat').map(([key, info]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: info.color, borderColor: info.border }} />
              <span className="text-[9px] text-muted-foreground">{info.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upper Arch */}
      <div className="mb-2">
        <p className="micro-label mb-1">Rahang Atas</p>
        <div className="flex justify-center gap-0.5 flex-wrap">
          <div className="flex gap-0.5 pr-2 border-r-2 border-border">
            {teeth.upperRight.map(t => renderTooth(t, true))}
          </div>
          <div className="flex gap-0.5 pl-2">
            {teeth.upperLeft.map(t => renderTooth(t, true))}
          </div>
        </div>
      </div>

      {/* Lower Arch */}
      <div>
        <p className="micro-label mb-1">Rahang Bawah</p>
        <div className="flex justify-center gap-0.5 flex-wrap">
          <div className="flex gap-0.5 pr-2 border-r-2 border-border">
            {teeth.lowerRight.map(t => renderTooth(t, false))}
          </div>
          <div className="flex gap-0.5 pl-2">
            {teeth.lowerLeft.map(t => renderTooth(t, false))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        Klik gigi untuk mencatat kondisi • FDI Notation • Sistem penomoran internasional
      </p>
    </div>
  );
}