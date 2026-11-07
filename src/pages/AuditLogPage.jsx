const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Shield, Calendar, Activity } from 'lucide-react';

import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import { MODULE_LABELS } from '@/lib/roles';

const ACTION_LABELS = {
  create: 'Create', update: 'Update', delete: 'Delete', void: 'Void', refund: 'Refund',
  price_change: 'Ubah Harga', stock_adjust: 'Stock Adj.', login: 'Login', logout: 'Logout',
  role_change: 'Role Change', permission_change: 'Permission', payment: 'Payment', kontrabon: 'Kontrabon',
};

const SEVERITY_STYLES = {
  Info: 'pill-info',
  Warning: 'pill-warning',
  Critical: 'pill-critical',
};

const HIDDEN_AUDIT_FIELDS = new Set([
  'id', 'created_date', 'updated_date', 'timestamp', 'hash', 'hash_prev',
  'branch_id', 'encounter_id', 'visit_id', 'queue_entry_id', 'status_history',
]);

const humanizeKey = (key) => String(key || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const isMoneyKey = (key) => /(amount|price|total|subtotal|fee|cost|discount|tax|value|paid|hpp|saldo)/i.test(key);

const formatAuditValue = (value, key = '') => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (Array.isArray(value)) return `${value.length} item`;
  if (typeof value === 'object') return 'Data terstruktur';
  if (isMoneyKey(key) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
  }
  if (/(date|at)$/i.test(key) && !Number.isNaN(Date.parse(String(value)))) {
    return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return String(value);
};

const parseAuditValue = (value) => {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
};

const auditEntries = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter(([key]) => !HIDDEN_AUDIT_FIELDS.has(key))
    .filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
    .sort(([a], [b]) => a.localeCompare(b));
};

const auditChanges = (before, after) => {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !HIDDEN_AUDIT_FIELDS.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }))
    .sort((a, b) => a.key.localeCompare(b.key));
};

const auditSummary = (log) => {
  const before = parseAuditValue(log.old_value);
  const after = parseAuditValue(log.new_value);
  const changes = auditChanges(before, after);
  if (changes.length) {
    return changes.slice(0, 3).map(({ key, before: previous, after: next }) =>
      `${humanizeKey(key)}: ${formatAuditValue(previous, key)} → ${formatAuditValue(next, key)}`
    ).join(' · ') + (changes.length > 3 ? ` · +${changes.length - 3} perubahan` : '');
  }
  const source = after || before;
  const entries = auditEntries(source).slice(0, 3);
  if (entries.length) return entries.map(([key, value]) => `${humanizeKey(key)}: ${formatAuditValue(value, key)}`).join(' · ');
  return typeof source === 'string' ? source : '-';
};

function AuditDetail({ log }) {
  const before = parseAuditValue(log.old_value);
  const after = parseAuditValue(log.new_value);
  const changes = auditChanges(before, after);
  if (changes.length) {
    return (
      <div className="space-y-1.5">
        {changes.map(({ key, before: previous, after: next }) => (
          <div key={key} className="grid grid-cols-[minmax(100px,0.7fr)_1fr] gap-2 items-start">
            <span className="text-muted-foreground">{humanizeKey(key)}</span>
            <span><span className="text-muted-foreground line-through">{formatAuditValue(previous, key)}</span> <span className="text-muted-foreground">→</span> <span className="font-medium text-primary">{formatAuditValue(next, key)}</span></span>
          </div>
        ))}
      </div>
    );
  }
  const source = after || before;
  const entries = auditEntries(source).slice(0, 10);
  if (!entries.length) return <span className="text-muted-foreground">Tidak ada detail tambahan</span>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
      {entries.map(([key, value]) => <div key={key}><span className="text-muted-foreground">{humanizeKey(key)}:</span> {formatAuditValue(value, key)}</div>)}
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await db.entities.AuditLog.list('-timestamp', 200);
      setLogs(data || []);
    } catch (e) {
      console.error('Audit log load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (search) {
        const q = search.toLowerCase();
        const match = (log.description || '').toLowerCase().includes(q) ||
          (log.entity_name || '').toLowerCase().includes(q) ||
          (log.user_name || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterModule && log.module !== filterModule) return false;
      if (filterAction && log.action !== filterAction) return false;
      if (filterSeverity && log.severity !== filterSeverity) return false;
      if (dateFrom && log.timestamp?.slice(0, 10) < dateFrom) return false;
      if (dateTo && log.timestamp?.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [logs, search, filterModule, filterAction, filterSeverity, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total: logs.length,
    critical: logs.filter(l => l.severity === 'Critical').length,
    warning: logs.filter(l => l.severity === 'Warning').length,
    today: logs.filter(l => l.timestamp?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
  }), [logs]);

  const inputCls = "px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div>
        <h1 className="text-lg font-medium">Audit Log</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Riwayat aktivitas sensitif — siapa, kapan, melakukan apa, nilai sebelum & sesudah</p>
      </div>

      <ModuleStatHeader stats={[
        { icon: Activity, label: 'Total Log', value: stats.total, color: 'text-teal-600' },
        { icon: Shield, label: 'Critical', value: stats.critical, color: 'text-rose-600' },
        { icon: Filter, label: 'Warning', value: stats.warning, color: 'text-amber-600' },
        { icon: Calendar, label: 'Hari Ini', value: stats.today, color: 'text-blue-600' },
      ]} />

      {/* Filter Bar */}
      <div className="panel p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari deskripsi, entitas, atau user…" className="flex-1 bg-transparent outline-none text-xs" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filterModule} onChange={e => setFilterModule(e.target.value)} className={inputCls}>
            <option value="">Semua Modul</option>
            {Object.entries(MODULE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className={inputCls}>
            <option value="">Semua Aksi</option>
            {Object.entries(ACTION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className={inputCls}>
            <option value="">Semua Severity</option>
            <option value="Info">Info</option>
            <option value="Warning">Warning</option>
            <option value="Critical">Critical</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} title="Dari tanggal" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} title="Sampai tanggal" />
        </div>
      </div>

      {/* Log Table */}
      <div className="panel">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-4"><EmptyState icon={Activity} title="Tidak ada log" description="Belum ada aktivitas yang tercatat dengan filter ini" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-left">
                  <th className="px-3 py-2 micro-label">Waktu</th>
                  <th className="px-3 py-2 micro-label">User</th>
                  <th className="px-3 py-2 micro-label">Aksi</th>
                  <th className="px-3 py-2 micro-label">Entitas</th>
                  <th className="px-3 py-2 micro-label hidden md:table-cell">Sebelum → Sesudah</th>
                  <th className="px-3 py-2 micro-label hidden lg:table-cell">Alasan</th>
                  <th className="px-3 py-2 micro-label">Severity</th>
                  <th className="px-3 py-2 micro-label w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(log => (
                  <React.Fragment key={log.id}>
                    <tr
                      className="row-hover cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-medium shrink-0">
                            {log.user_name?.[0]?.toUpperCase() || 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{log.user_name || 'System'}</p>
                            <p className="text-[10px] text-muted-foreground">{log.user_role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="pill pill-info">{ACTION_LABELS[log.action] || log.action}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{log.entity_name || log.entity}</p>
                        <p className="text-[10px] text-muted-foreground">{MODULE_LABELS[log.module] || log.module}</p>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        {log.old_value || log.new_value ? (
                          <span className="block max-w-[360px] whitespace-normal break-words text-[11px] leading-relaxed">
                            {auditSummary(log)}
                          </span>
                        ) : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground truncate max-w-[150px]">{log.reason || '-'}</td>
                      <td className="px-3 py-2"><span className={`pill ${SEVERITY_STYLES[log.severity] || 'pill-inactive'}`}>{log.severity}</span></td>
                      <td className="px-3 py-2">
                        {expandedId === log.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr className="bg-muted/30">
                        <td colSpan={8} className="px-3 py-2.5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="micro-label mb-1">Deskripsi</p>
                              <p>{log.description || '-'}</p>
                            </div>
                            <div>
                              <p className="micro-label mb-1">Detail Perubahan</p>
                              <div className="space-y-1">
                                {(log.old_value || log.new_value) && <AuditDetail log={log} />}
                                {log.reason && (
                                  <div className="flex items-center gap-2">
                                    <span className="pill pill-warning">Alasan</span>
                                    <span>{log.reason}</span>
                                  </div>
                                )}
                                {!log.old_value && !log.new_value && !log.reason && <span className="text-muted-foreground">Tidak ada detail tambahan</span>}
                              </div>
                            </div>
                            <div>
                              <p className="micro-label mb-1">Entity ID</p>
                              <p className="font-mono text-[11px] text-muted-foreground">{log.entity_id || '-'}</p>
                            </div>
                            <div>
                              <p className="micro-label mb-1">Timestamp</p>
                              <p className="text-muted-foreground">{log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
