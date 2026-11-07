import React from 'react';
import { MODULE_LABELS, ACTION_LABELS } from '@/lib/roles';

const MODULE_ORDER = [
  'dashboard', 'patients', 'queue', 'rme', 'prescription', 'master_obat',
  'inventory', 'purchasing', 'finance', 'cashier', 'management',
  'hr', 'schedule', 'doctor_schedule', 'facility', 'settings',
  'comms', 'audit_log', 'user_role',
];

export default function PermissionMatrix({ permissions, onChange, disabled = false, maxPermissions = null }) {
  const toggle = (module, action) => {
    if (disabled || (maxPermissions && maxPermissions?.[module]?.[action] !== true)) return;
    const current = permissions?.[module] || {};
    onChange({
      ...permissions,
      [module]: { ...current, [action]: !current[action] },
    });
  };

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-2 py-1.5 text-left micro-label sticky left-0 bg-muted/50">Modul</th>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <th key={key} className="px-2 py-1.5 text-center micro-label min-w-[50px]">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MODULE_ORDER.map(mod => {
              const perms = permissions?.[mod] || {};
              return (
                <tr key={mod} className="hover:bg-slate-50/50">
                  <td className="px-2 py-1.5 font-medium sticky left-0 bg-card border-r border-border">{MODULE_LABELS[mod]}</td>
                  {Object.keys(ACTION_LABELS).map(action => (
                    <td key={action} className="px-2 py-1.5 text-center">
                      {(() => {
                        const blockedByCeiling = Boolean(maxPermissions) && maxPermissions?.[mod]?.[action] !== true;
                        return (
                      <button
                        onClick={() => toggle(mod, action)}
                        disabled={disabled || blockedByCeiling}
                        title={blockedByCeiling ? 'Dibatasi oleh requirement role bawaan' : undefined}
                        className={`w-5 h-5 rounded border transition-colors ${
                          perms[action]
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-card border-border hover:border-primary/50'
                        } ${disabled || blockedByCeiling ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {perms[action] && (
                          <svg className="w-3 h-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                        );
                      })()}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
