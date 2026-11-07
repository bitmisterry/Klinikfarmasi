// @ts-nocheck -- Staff profiles support multiple role-specific record shapes.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import {
  X, Phone, Mail, BadgeCheck, Calendar, Wallet, Stethoscope, Receipt,
  FileText, Activity, Clock, Edit2, User, TrendingUp, Pill
} from 'lucide-react';

const ROLE_ICONS = {
  Dokter: Stethoscope, Apoteker: Pill, Kasir: Receipt,
  Perawat: Activity, Admin: BadgeCheck, Owner: BadgeCheck, Staff: User
};

const ROLE_COLORS = {
  Dokter: 'text-blue-600 bg-blue-50', Apoteker: 'text-teal-600 bg-teal-50',
  Kasir: 'text-amber-600 bg-amber-50', Perawat: 'text-purple-600 bg-purple-50',
  Admin: 'text-slate-600 bg-slate-100', Owner: 'text-emerald-600 bg-emerald-50',
  Staff: 'text-slate-600 bg-slate-100'
};

const DAY_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function StaffProfileDrawer({ staff, onClose, onEdit, hideFinancial = false }) {
  const [schedules, setSchedules] = useState([]);
  const [doctorSchedules, setDoctorSchedules] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!staff) return;
    const load = async () => {
      setLoading(true);
      try {
        const [scheds, docScheds, medRecords, prescriptions, transactions, auditLogs] = await Promise.all([
          db.entities.Schedule.filter({ staff_id: staff.id }).catch(() => []),
          staff.role === 'Dokter'
            ? db.entities.DoctorSchedule.filter({ doctor_id: staff.id }).catch(() => [])
            : Promise.resolve([]),
          staff.role === 'Dokter'
            ? db.entities.MedicalRecord.filter({ doctor_name: staff.full_name }).catch(() => [])
            : Promise.resolve([]),
          staff.role === 'Dokter' || staff.role === 'Apoteker'
            ? db.entities.Prescription.filter({ doctor_name: staff.full_name }).catch(() => [])
            : Promise.resolve([]),
          staff.role === 'Kasir'
            ? db.entities.Transaction.filter({ cashier_name: staff.full_name }).catch(() => [])
            : Promise.resolve([]),
          db.entities.AuditLog.filter({ entity_id: staff.id }).catch(() => []),
        ]);

        const today = new Date().toISOString().split('T')[0];
        setSchedules((scheds || []).filter(s => s.shift_date >= today).sort((a, b) => (a.shift_date || '').localeCompare(b.shift_date || '')));
        setDoctorSchedules((docScheds || []).sort((a, b) => DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)));
        setMetrics({
          records: (medRecords || []).length,
          prescriptions: (prescriptions || []).length,
          txns: (transactions || []).length,
          revenue: (transactions || []).reduce((s, t) => s + (t.total || 0), 0),
          cashTxns: (transactions || []).filter(t => t.payment_method === 'Tunai').length,
        });
        setLogs((auditLogs || []).slice(0, 8));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [staff]);

  if (!staff) return null;

  const Icon = ROLE_ICONS[staff.role] || User;
  const colorClass = ROLE_COLORS[staff.role] || 'text-slate-600 bg-slate-100';
  const initials = (staff.full_name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground px-4 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-semibold">
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{staff.full_name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{staff.role}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${staff.is_active ? 'bg-emerald-400/30' : 'bg-white/10'}`}>
                    {staff.is_active ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onEdit && (
                <button onClick={() => onEdit(staff)} className="p-1.5 hover:bg-white/20 rounded" title="Edit">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Contact & Employment */}
            <Section title="Informasi Kontak & Kepegawaian" icon={User}>
              <div className="grid grid-cols-2 gap-2">
                <InfoRow icon={Phone} label="Telepon" value={staff.phone || '-'} />
                <InfoRow icon={Mail} label="Email" value={staff.email || '-'} />
                <InfoRow icon={BadgeCheck} label="No. Izin (STR/SIP)" value={staff.license_number || '-'} />
                <InfoRow icon={Clock} label="Shift" value={staff.shift || '-'} />
                <InfoRow icon={Calendar} label="Bergabung" value={staff.hire_date ? new Date(staff.hire_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'} />
                {!hideFinancial && <InfoRow icon={Wallet} label="Gaji/Bulan" value={`Rp ${(staff.salary || 0).toLocaleString('id-ID')}`} />}
              </div>
              {staff.hire_date && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-[11px] text-muted-foreground">
                    Lama bekerja: {Math.floor((new Date() - new Date(staff.hire_date)) / (365 * 24 * 60 * 60 * 1000))} tahun{' '}
                    {Math.floor(((new Date() - new Date(staff.hire_date)) % (365 * 24 * 60 * 60 * 1000)) / (30 * 24 * 60 * 60 * 1000))} bulan
                  </p>
                </div>
              )}
            </Section>

            {/* Performance Metrics */}
            {staff.role === 'Dokter' && (
              <Section title="Performa Dokter" icon={Stethoscope}>
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox icon={FileText} label="Rekam Medis" value={metrics.records} color="text-blue-600 bg-blue-50" />
                  <MetricBox icon={Pill} label="Resep Dibuat" value={metrics.prescriptions} color="text-teal-600 bg-teal-50" />
                </div>
              </Section>
            )}

            {staff.role === 'Kasir' && (
              <Section title="Performa Kasir" icon={Receipt}>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox icon={Receipt} label="Transaksi" value={metrics.txns} color="text-amber-600 bg-amber-50" />
                  <MetricBox icon={Wallet} label="Tunai" value={metrics.cashTxns} color="text-emerald-600 bg-emerald-50" />
                  <MetricBox icon={TrendingUp} label="Total Omzet" value={`Rp ${(metrics.revenue / 1000).toFixed(0)}k`} color="text-primary bg-primary/10" />
                </div>
              </Section>
            )}

            {/* Doctor Weekly Schedule */}
            {staff.role === 'Dokter' && doctorSchedules.length > 0 && (
              <Section title="Jadwal Praktek Mingguan" icon={Calendar}>
                <div className="space-y-1.5">
                  {doctorSchedules.map(s => (
                    <div key={s.id} className="flex items-center gap-2 bg-muted/30 rounded px-2.5 py-2 text-xs">
                      <div className="w-16 font-medium text-primary">{s.day_of_week}</div>
                      <div className="flex-1">
                        <p>{s.start_time} - {s.end_time}</p>
                        {s.poli && <p className="text-[11px] text-muted-foreground">{s.poli}</p>}
                      </div>
                      <span className={`pill ${s.status === 'Hadir' ? 'pill-success' : s.status === 'Izin' || s.status === 'Sakit' ? 'pill-warning' : 'pill-inactive'}`}>
                        {s.status || 'Dijadwalkan'}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Upcoming Shifts */}
            {schedules.length > 0 && (
              <Section title="Jadwal Shift Mendatang" icon={Clock}>
                <div className="space-y-1.5">
                  {schedules.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center gap-2 bg-muted/30 rounded px-2.5 py-2 text-xs">
                      <div className="w-20 font-medium">{new Date(s.shift_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>
                      <div className="flex-1">
                        <p>Shift {s.shift}</p>
                        {s.start_time && <p className="text-[11px] text-muted-foreground">{s.start_time} - {s.end_time}</p>}
                      </div>
                      <span className={`pill ${s.status === 'Hadir' ? 'pill-success' : s.status === 'Izin' || s.status === 'Sakit' ? 'pill-warning' : s.status === 'Alpa' ? 'pill-critical' : 'pill-inactive'}`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Recent Activity */}
            {logs.length > 0 && (
              <Section title="Aktivitas Terbaru" icon={Activity}>
                <div className="space-y-1.5">
                  {logs.map(l => (
                    <div key={l.id} className="flex items-center gap-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.severity === 'Critical' ? 'bg-rose-500' : l.severity === 'Warning' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                      <span className="flex-1 truncate">
                        <span className="font-medium">{l.action}</span> {l.entity}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{l.timestamp?.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Quick Actions */}
            <div className="flex gap-2 pt-2">
              {onEdit && <button onClick={() => onEdit(staff)} className="flex-1 flex items-center justify-center gap-1.5 btn-primary py-2 rounded-md text-xs font-medium">
                <Edit2 className="w-3.5 h-3.5" /> Edit Staff
              </button>}
              <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Tutup</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="panel">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-primary" /> {title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-xs font-medium truncate">{value}</p>
    </div>
  );
}

function MetricBox({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className={`w-7 h-7 rounded flex items-center justify-center mb-1.5 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-base font-semibold leading-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
