import React from 'react';

export default function ModuleStatHeader({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="panel px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              {Icon && <Icon className={`w-3.5 h-3.5 ${s.color || 'text-muted-foreground'}`} />}
              <p className="micro-label">{s.label}</p>
            </div>
            <p className={`text-base font-semibold ${s.color || 'text-foreground'}`}>{s.value}</p>
            {s.subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{s.subtitle}</p>}
          </div>
        );
      })}
    </div>
  );
}