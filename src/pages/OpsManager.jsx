const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, Building2, CheckCircle2, ClipboardCheck, FileText, Users, Wrench, X } from 'lucide-react';

import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import MemoPanel from '@/components/MemoPanel';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const MEDICAL_ROLE_PREFIXES = ['Dokter', 'Apoteker', 'Perawat', 'Asisten Dokter', 'TTK/Asisten Farmasi'];
const isMedicalRole = (role = '') => MEDICAL_ROLE_PREFIXES.some((prefix) => role === prefix || role.startsWith(`${prefix} `));
const STATUS_PILLS = { Hadir: 'pill-success', Izin: 'pill-warning', Sakit: 'pill-warning', Cuti: 'pill-warning', Seminar: 'pill-info', Alpa: 'pill-critical', Dijadwalkan: 'pill-inactive' };
const datePlusDays = (date, days) => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + days); return next.toISOString().slice(0, 10); };

export default function OpsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceAsset, setMaintenanceAsset] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState({ next_maintenance: '', maintenance_pic: '', maintenance_notes: '' });
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const load = async () => {
    try {
      const [assetRows, staffRows, scheduleRows, queueRows] = await Promise.all([
        db.entities.Asset.list().catch(() => []),
        db.entities.Staff.list().catch(() => []),
        db.entities.Schedule.list().catch(() => []),
        db.entities.QueueEntry.filter({ visit_date: today }).catch(() => []),
      ]);
      setAssets(assetRows || []); setStaff(staffRows || []); setSchedules(scheduleRows || []); setQueue(queueRows || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const unsubscribers = [db.entities.Asset.subscribe(load), db.entities.Staff.subscribe(load), db.entities.Schedule.subscribe(load), db.entities.QueueEntry.subscribe(load)];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [today]);

  const overdueMaintenance = useMemo(() => assets.filter((asset) => asset.next_maintenance && asset.next_maintenance < today && asset.condition !== 'Pensiun'), [assets, today]);
  const dueSoon = useMemo(() => assets.filter((asset) => asset.next_maintenance && asset.next_maintenance >= today && asset.next_maintenance <= datePlusDays(today, 30) && asset.condition !== 'Pensiun'), [assets, today]);
  const needsService = useMemo(() => assets.filter((asset) => ['Perlu Servis', 'Rusak'].includes(asset.condition)), [assets]);
  const nonMedicalStaff = useMemo(() => staff.filter((person) => !isMedicalRole(person.role)), [staff]);
  const todaySchedules = schedules.filter((schedule) => schedule.shift_date === today);
  const attendancePresent = todaySchedules.filter((schedule) => schedule.status === 'Hadir').length;
  const todayVisits = queue.filter((entry) => entry.status !== 'Batal');

  const serviceByUnit = useMemo(() => todayVisits.reduce((groups, entry) => {
    const unit = entry.loket || 'Belum ditentukan';
    groups[unit] ||= { unit, total: 0, active: 0, completed: 0 };
    groups[unit].total += 1;
    if (['Selesai', 'Selesai Periksa'].includes(entry.status)) groups[unit].completed += 1;
    else groups[unit].active += 1;
    return groups;
  }, {}), [todayVisits]);

  const assetByLocation = useMemo(() => assets.reduce((groups, asset) => {
    const location = asset.location || 'Lokasi belum ditentukan';
    groups[location] = (groups[location] || 0) + 1;
    return groups;
  }, {}), [assets]);

  const stats = [
    { label: 'Total Aset', value: assets.length, icon: Building2, color: 'text-primary' },
    { label: 'Perlu Tindak Lanjut', value: needsService.length + overdueMaintenance.length, icon: Wrench, color: 'text-amber-500' },
    { label: 'Kehadiran Hari Ini', value: `${attendancePresent}/${todaySchedules.length}`, icon: Users, color: 'text-emerald-500' },
    { label: 'Kunjungan Hari Ini', value: todayVisits.length, icon: BarChart3, color: 'text-blue-500' },
  ];

  const openMaintenance = (asset) => {
    setMaintenanceAsset(asset);
    setMaintenanceForm({ next_maintenance: asset.next_maintenance || datePlusDays(today, 30), maintenance_pic: asset.maintenance_pic || '', maintenance_notes: asset.maintenance_notes || asset.notes || '' });
  };

  const saveMaintenance = async () => {
    if (!maintenanceAsset || !maintenanceForm.next_maintenance || !maintenanceForm.maintenance_pic.trim()) {
      toast({ title: 'Tanggal dan PIC maintenance wajib diisi', variant: 'destructive' }); return;
    }
    setSavingMaintenance(true);
    try {
      await db.entities.Asset.update(maintenanceAsset.id, { next_maintenance: maintenanceForm.next_maintenance, maintenance_pic: maintenanceForm.maintenance_pic.trim(), maintenance_notes: maintenanceForm.maintenance_notes.trim(), maintenance_status: 'Dijadwalkan' });
      await db.entities.AuditLog.create({ action: 'schedule_maintenance', entity: 'Asset', entity_id: maintenanceAsset.id, entity_name: maintenanceAsset.name, module: 'operational_management', description: `Maintenance ${maintenanceAsset.name} dijadwalkan pada ${maintenanceForm.next_maintenance} dengan PIC ${maintenanceForm.maintenance_pic.trim()}`, user_id: user?.id || '', user_name: user?.full_name || 'Manajer Operasional', user_role: 'Manajer Operasional', timestamp: new Date().toISOString() });
      toast({ title: 'Maintenance berhasil dijadwalkan' }); setMaintenanceAsset(null); await load();
    } catch (error) { toast({ title: 'Gagal menjadwalkan maintenance', description: error.message, variant: 'destructive' }); }
    finally { setSavingMaintenance(false); }
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div><h1 className="text-lg font-semibold">Manajer Operasional</h1><p className="text-xs text-muted-foreground">Monitoring fasilitas, maintenance preventif, SDM non-medis, shift, dan produktivitas layanan.</p></div>
        <div className="flex flex-wrap gap-2 text-xs"><Link to="/facility" className="px-3 py-1.5 border border-border rounded-md hover:bg-muted">Kelola Aset</Link><Link to="/schedule" className="px-3 py-1.5 border border-border rounded-md hover:bg-muted">Kelola Shift</Link><Link to="/comms?tab=memo" className="btn-primary px-3 py-1.5 rounded-md">Buat Notes</Link></div>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800 flex items-start gap-2"><ClipboardCheck className="w-4 h-4 mt-0.5 shrink-0" /><span>Ruang lingkup role ini adalah supervisi operasional. Data gaji/margin dokter, rekam medis, diagnosis, resep, dan transaksi keuangan tidak ditampilkan.</span></div>
      <ModuleStatHeader stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-4"><div className="flex items-center justify-between gap-2 mb-3"><div><h3 className="text-sm font-semibold flex items-center gap-1.5"><Wrench className="w-4 h-4 text-amber-500" /> Maintenance Preventif</h3><p className="text-[11px] text-muted-foreground">Reminder, PIC, dan status jadwal alat.</p></div><Link to="/facility" className="text-xs text-primary">Buka aset →</Link></div>
          {loading ? <p className="text-xs text-muted-foreground text-center py-4">Memuat…</p> : overdueMaintenance.length === 0 && needsService.length === 0 && dueSoon.length === 0 ? <EmptyState icon={CheckCircle2} title="Tidak ada tindak lanjut" description="Semua maintenance berada dalam jadwal aman." /> : <div className="space-y-2 max-h-72 overflow-y-auto">{[...new Map([...overdueMaintenance, ...needsService, ...dueSoon].map((asset) => [asset.id, asset])).values()].map((asset) => { const overdue = asset.next_maintenance && asset.next_maintenance < today; return <div key={asset.id} className={`flex items-center gap-2 p-2 rounded-md border text-xs ${overdue || asset.condition === 'Rusak' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}><span className="shrink-0">{overdue || asset.condition === 'Rusak' ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <Wrench className="w-3.5 h-3.5 text-amber-600" />}</span><div className="flex-1 min-w-0"><p className="font-medium truncate">{asset.name}</p><p className="text-[10px] text-muted-foreground">{asset.next_maintenance ? `Jadwal: ${asset.next_maintenance}` : 'Belum ada jadwal'} • {asset.maintenance_pic || 'PIC belum ditentukan'}</p></div><button onClick={() => openMaintenance(asset)} className="text-primary font-medium hover:underline">Jadwalkan</button></div>; })}</div>}
        </div>

        <div className="panel p-4"><div className="flex items-center justify-between gap-2 mb-3"><div><h3 className="text-sm font-semibold flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" /> Kehadiran SDM Non-Medis</h3><p className="text-[11px] text-muted-foreground">Staf administrasi/operasional dan status shift hari ini.</p></div><Link to="/hr" className="text-xs text-primary">Buka SDM →</Link></div>
          {nonMedicalStaff.length === 0 ? <EmptyState icon={Users} title="Belum ada staf non-medis" /> : <div className="space-y-1.5 max-h-72 overflow-y-auto">{nonMedicalStaff.map((person) => { const shift = todaySchedules.find((schedule) => schedule.staff_id === person.id); return <div key={person.id} className="flex items-center gap-2 p-2 border border-border rounded-md text-xs"><div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">{person.full_name?.[0]?.toUpperCase()}</div><div className="flex-1 min-w-0"><p className="font-medium truncate">{person.full_name}</p><p className="text-[10px] text-muted-foreground">{person.role || 'Staff'} • {shift ? `${shift.shift} ${shift.start_time || ''}-${shift.end_time || ''}` : 'Belum dijadwalkan'}</p></div><span className={`pill ${STATUS_PILLS[shift?.status] || (person.is_active ? 'pill-inactive' : 'pill-critical')}`}>{shift?.status || (person.is_active ? 'Aktif' : 'Non-aktif')}</span></div>; })}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-4"><div className="flex items-center justify-between gap-2 mb-3"><div><h3 className="text-sm font-semibold flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-blue-500" /> Produktivitas Layanan</h3><p className="text-[11px] text-muted-foreground">Ringkasan kunjungan per unit/poli hari ini.</p></div><Link to="/queue" className="text-xs text-primary">Lihat antrean →</Link></div>{Object.keys(serviceByUnit).length === 0 ? <EmptyState icon={BarChart3} title="Belum ada kunjungan" /> : <div className="space-y-2">{Object.values(serviceByUnit).map((unit) => <div key={unit.unit} className="border border-border rounded-md p-2.5 text-xs"><div className="flex items-center justify-between"><span className="font-medium">{unit.unit}</span><span className="pill pill-info">{unit.total} kunjungan</span></div><div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground"><span>Aktif {unit.active}</span><span>Selesai {unit.completed}</span></div></div>)}</div>}</div>
        <div className="panel p-4"><div className="flex items-center justify-between gap-2 mb-3"><div><h3 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="w-4 h-4 text-primary" /> Utilisasi Ruang & Alat</h3><p className="text-[11px] text-muted-foreground">Distribusi aset berdasarkan lokasi dan layanan hari ini.</p></div><Link to="/facility" className="text-xs text-primary">Detail fasilitas →</Link></div><div className="space-y-2 text-xs"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Aset per lokasi</div>{Object.keys(assetByLocation).length === 0 ? <p className="text-muted-foreground">Belum ada data lokasi.</p> : Object.entries(assetByLocation).slice(0, 6).map(([location, count]) => <div key={location} className="flex items-center gap-2"><span className="flex-1 truncate">{location}</span><div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (count / Math.max(1, assets.length)) * 100)}%` }} /></div><span className="w-6 text-right text-muted-foreground">{count}</span></div>)}</div></div>
      </div>

      <div className="panel p-4"><div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="w-4 h-4 text-primary" /> Inventaris Aset</h3><p className="text-[11px] text-muted-foreground">Kondisi, lokasi, dan jadwal maintenance seluruh aset.</p></div><Link to="/facility" className="text-xs text-primary">Kelola aset →</Link></div>{assets.length === 0 ? <EmptyState icon={Building2} title="Belum ada aset terdaftar" /> : <div className="overflow-x-auto"><table className="w-full text-xs min-w-[780px]"><thead><tr className="text-left border-b border-border"><th className="py-1.5 px-2 font-medium text-muted-foreground">Kode</th><th className="py-1.5 px-2 font-medium text-muted-foreground">Nama</th><th className="py-1.5 px-2 font-medium text-muted-foreground">Lokasi</th><th className="py-1.5 px-2 font-medium text-muted-foreground">Kondisi</th><th className="py-1.5 px-2 font-medium text-muted-foreground">Jadwal Maintenance</th><th className="py-1.5 px-2 font-medium text-muted-foreground">PIC</th><th className="py-1.5 px-2 font-medium text-muted-foreground" /></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/30"><td className="py-1.5 px-2 font-mono">{asset.asset_code || '-'}</td><td className="py-1.5 px-2 font-medium">{asset.name}</td><td className="py-1.5 px-2 text-muted-foreground">{asset.location || '-'}</td><td className="py-1.5 px-2"><span className={`pill ${asset.condition === 'Baik' ? 'pill-success' : asset.condition === 'Rusak' ? 'pill-critical' : asset.condition === 'Perlu Servis' ? 'pill-warning' : 'pill-inactive'}`}>{asset.condition}</span></td><td className={`py-1.5 px-2 ${asset.next_maintenance && asset.next_maintenance < today ? 'text-rose-600 font-medium' : 'text-muted-foreground'}`}>{asset.next_maintenance || 'Belum dijadwalkan'}</td><td className="py-1.5 px-2 text-muted-foreground">{asset.maintenance_pic || '-'}</td><td className="py-1.5 px-2 text-right"><button onClick={() => openMaintenance(asset)} className="text-primary hover:underline">Jadwalkan</button></td></tr>)}</tbody></table></div>}</div>

      <div className="panel p-4"><div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="w-4 h-4 text-primary" /> Notes Operasional</h3><p className="text-[11px] text-muted-foreground">Informasi jadwal, seminar, cuti, dan pengumuman untuk role terkait.</p></div><Link to="/comms?tab=memo" className="text-xs text-primary">Buka komunikasi →</Link></div><MemoPanel /></div>

      {maintenanceAsset && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setMaintenanceAsset(null)}><div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl" onClick={(event) => event.stopPropagation()}><div className="px-4 py-3 border-b border-border flex items-center justify-between"><div><h2 className="text-sm font-semibold">Jadwalkan Maintenance</h2><p className="text-[11px] text-muted-foreground">{maintenanceAsset.name} • {maintenanceAsset.location || 'Lokasi belum ditentukan'}</p></div><button onClick={() => setMaintenanceAsset(null)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button></div><div className="p-4 space-y-3"><label className="block"><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tanggal maintenance *</span><input type="date" value={maintenanceForm.next_maintenance} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, next_maintenance: event.target.value })} className="w-full mt-1 px-2 py-1.5 border border-border rounded text-xs" /></label><label className="block"><span className="text-[10px] text-muted-foreground uppercase tracking-wider">PIC maintenance *</span><input value={maintenanceForm.maintenance_pic} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, maintenance_pic: event.target.value })} placeholder="Nama teknisi / penanggung jawab" className="w-full mt-1 px-2 py-1.5 border border-border rounded text-xs" /></label><label className="block"><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Catatan</span><textarea rows={3} value={maintenanceForm.maintenance_notes} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, maintenance_notes: event.target.value })} placeholder="Rencana pekerjaan atau kebutuhan alat" className="w-full mt-1 px-2 py-1.5 border border-border rounded text-xs" /></label></div><div className="px-4 py-3 border-t border-border flex justify-end gap-2"><button onClick={() => setMaintenanceAsset(null)} className="px-3 py-1.5 border border-border rounded text-xs">Batal</button><button onClick={saveMaintenance} disabled={savingMaintenance} className="btn-primary px-3 py-1.5 rounded text-xs disabled:opacity-50">{savingMaintenance ? 'Menyimpan…' : 'Simpan Jadwal'}</button></div></div></div>}
    </div>
  );
}
