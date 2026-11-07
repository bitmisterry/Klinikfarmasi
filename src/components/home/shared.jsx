import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="panel px-3 py-2.5 flex items-center gap-2.5 hover:shadow-sm transition-shadow">
      <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="micro-label truncate">{label}</p>
        <p className="text-base font-semibold leading-tight truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}

export function AttentionSection({ icon: Icon, title, color, count, children }) {
  return (
    <div className="px-3 py-2">
      <p className={`text-xs font-medium flex items-center gap-1.5 mb-1 ${color}`}>
        <Icon className="w-3.5 h-3.5" /> {title}
        {count > 0 && <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{count}</span>}
      </p>
      {children}
    </div>
  );
}

export function QuickAction({ to, icon: Icon, label, color = 'text-primary bg-primary/10' }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 panel p-3 hover:shadow-sm transition-shadow">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </Link>
  );
}

export function CompactKPI({ icon: Icon, value, label, color = 'text-foreground' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-md">
      <Icon className={`w-4 h-4 ${color} shrink-0`} />
      <div className="min-w-0">
        <span className="text-sm font-semibold">{value}</span>
        <span className="text-[11px] text-muted-foreground ml-1">{label}</span>
      </div>
    </div>
  );
}

export function SectionHeader({ icon: Icon, title, subtitle, to, actionLabel }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-primary" /> {title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} className="text-xs text-primary hover:text-primary-hover flex items-center gap-1">
          {actionLabel || 'Detail'} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}