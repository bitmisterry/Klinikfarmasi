import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable navigation group for Doctor Portal sidebar.
 * Modern UI: left accent bar on active, subtle tinted bg, smooth transitions.
 */
export default function DoctorNavGroup({ group, isActiveFn, onItemClick, clinicRole, permissionFilter, footer }) {
  let items = group.items;
  if (clinicRole) {
    items = items.filter(item => !item.roles || item.roles.includes(clinicRole));
  }
  if (permissionFilter) {
    items = items.filter(permissionFilter);
  }
  if (items.length === 0 && !footer) return null;

  return (
    <div className="mb-3">
      <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {group.label}
      </p>
      <div className="space-y-0.5 px-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActiveFn(item.path, item.exact);
          return (
            <Link
              key={item.path + (item.label || '')}
              to={item.path}
              onClick={onItemClick}
              className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all duration-150 relative ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
              )}
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        {footer}
      </div>
    </div>
  );
}