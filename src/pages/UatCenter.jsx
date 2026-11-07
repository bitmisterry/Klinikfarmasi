import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, FileUp, RefreshCw, ShieldCheck, TestTube2, Users, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { DEMO_IDENTITIES } from '@/lib/demoIdentities';
import { useToast } from '@/components/ui/use-toast';

const STATUS_STEPS = [
  { key: 'front-office', label: 'Front Office', entity: 'Visit', ok: (rows) => rows.length > 0, note: 'Visit/antrean tersedia' },
  { key: 'nurse', label: 'Perawat', entity: 'Visit', ok: (rows) => rows.some((row) => row.intake_completed_at || row.status_history?.some((entry) => String(entry.to || entry.status).includes('INTAKE'))), note: 'Intake pernah dicatat' },
  { key: 'doctor', label: 'Dokter', entity: 'MedicalRecord', ok: (rows) => rows.length > 0, note: 'Rekam medis tersedia' },
  { key: 'pharmacy', label: 'Farmasi', entity: 'Prescription', ok: (rows) => rows.length > 0, note: 'Resep tersedia' },
  { key: 'cashier', label: 'Kasir', entity: 'Transaction', ok: (rows) => rows.length > 0, note: 'Transaksi tersedia' },
  { key: 'finance', label: 'Finance', entity: 'SupplierInvoice', ok: (rows) => rows.length > 0, note: 'Faktur supplier tersedia' },
  { key: 'owner-apj', label: 'Owner/APJ', entity: 'Role', ok: (rows) => rows.length > 0, note: 'Matriks role tersedia' },
];

function downloadJson(snapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `klinikfarma-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function UatCenter() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [scenarioData, setScenarioData] = useState({});
  const [returns, setReturns] = useState([]);
  const [audit, setAudit] = useState([]);
  const [pendingImport, setPendingImport] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const reload = async () => {
    const entityNames = [...new Set(STATUS_STEPS.map((step) => step.entity))];
    const [entityRows, returnRows, auditRows] = await Promise.all([
      Promise.all(entityNames.map(async (entity) => [entity, await base44.entities[entity].list()])),
      base44.entities.SupplierReturn.list(),
      base44.entities.AuditLog.list('-timestamp', 30),
    ]);
    setScenarioData(Object.fromEntries(entityRows));
    setReturns(returnRows || []);
    setAudit(auditRows || []);
    setDiagnostics(base44.localTools?.diagnostics?.() || null);
  };

  useEffect(() => { reload().catch((error) => toast({ title: 'Gagal memuat Pusat UAT', description: error.message, variant: 'destructive' })); }, []);

  const scenarioStatus = useMemo(() => STATUS_STEPS.map((step) => ({ ...step, passed: step.ok(scenarioData[step.entity] || []) })), [scenarioData]);

  const handleExport = () => {
    const snapshot = base44.localTools?.exportData?.();
    if (!snapshot) return toast({ title: 'Ekspor tidak tersedia', variant: 'destructive' });
    downloadJson(snapshot);
    toast({ title: 'Backup localStorage diunduh' });
  };

  const readImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const snapshot = JSON.parse(await file.text());
      if (!Array.isArray(snapshot.User) || !Array.isArray(snapshot.Role)) throw new Error('Struktur User/Role tidak ditemukan');
      setPendingImport({ fileName: file.name, snapshot });
    } catch (error) {
      toast({ title: 'Backup tidak valid', description: error.message, variant: 'destructive' });
    } finally {
      event.target.value = '';
    }
  };

  const applyImport = async () => {
    setBusy(true);
    try {
      base44.localTools.importData(pendingImport.snapshot);
      setPendingImport(null);
      await reload();
      toast({ title: 'Backup berhasil dipulihkan', description: 'Seluruh halaman membaca snapshot yang baru.' });
    } catch (error) {
      toast({ title: 'Impor gagal', description: error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const resetDemo = async () => {
    if (resetPhrase !== 'RESET UAT') return;
    setBusy(true);
    try {
      base44.localTools.resetDemoData();
      setShowReset(false);
      setResetPhrase('');
      await reload();
      toast({ title: 'Data demo berhasil di-reset', description: 'Skenario UAT kembali ke seed awal.' });
    } catch (error) {
      toast({ title: 'Reset gagal', description: error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-semibold"><TestTube2 className="h-5 w-5 text-primary" /> Pusat UAT Frontend</h1><p className="mt-1 text-xs text-muted-foreground">Validasi alur lintas-role, akun demo, backup/restore, dan kesehatan localStorage sebelum integrasi backend.</p></div>
        <button onClick={reload} className="flex items-center gap-1.5 rounded border border-border px-3 py-2 text-xs font-medium hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" /> Muat Ulang Status</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-3"><p className="micro-label">Versi penyimpanan</p><p className="mt-1 text-lg font-semibold">v{diagnostics?.storage_version || '-'}</p></div>
        <div className="panel p-3"><p className="micro-label">Revision</p><p className="mt-1 text-lg font-semibold">{diagnostics?.revision ?? '-'}</p></div>
        <div className="panel p-3"><p className="micro-label">Entitas tersimpan</p><p className="mt-1 text-lg font-semibold">{Object.keys(diagnostics?.entity_counts || {}).length}</p></div>
        <div className="panel p-3"><p className="micro-label">Retur aktif</p><p className="mt-1 text-lg font-semibold">{returns.filter((item) => !['Selesai', 'Ditolak', 'Dibatalkan'].includes(item.status)).length}</p></div>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Status skenario lintas-role</h2></div>
        <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-4">{scenarioStatus.map((step, index) => <div key={step.key} className={`rounded border p-3 ${step.passed ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}><div className="flex items-center justify-between"><strong>{index + 1}. {step.label}</strong>{step.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}</div><p className="mt-1 text-[11px] text-muted-foreground">{step.note}</p></div>)}</div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <section className="panel overflow-hidden"><div className="border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" /> Akun UAT valid</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Password semua akun: <strong>Demo1234!</strong>. Buka role berbeda di tab berbeda.</p></div><div className="max-h-[420px] overflow-auto divide-y divide-border">{Object.values(DEMO_IDENTITIES).map((identity) => <div key={identity.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"><div><p className="font-medium">{identity.clinic_role}</p><p className="text-muted-foreground">{identity.full_name}</p></div><code className="select-all rounded bg-muted px-2 py-1 text-[11px]">{identity.email}</code></div>)}</div></section>

        <section className="panel overflow-hidden"><div className="border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-primary" /> Backup, restore, dan reset</h2></div><div className="space-y-3 p-4 text-xs"><div className="rounded border border-blue-200 bg-blue-50 p-3 text-blue-900">Backup mencakup seluruh database lokal, role, audit, transaksi, dan status workflow. Impor selalu divalidasi sebelum mengganti snapshot aktif.</div><button onClick={handleExport} className="flex w-full items-center justify-center gap-2 rounded border border-border px-3 py-2 font-medium hover:bg-muted"><Download className="h-4 w-4" /> Ekspor Backup JSON</button><button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded border border-border px-3 py-2 font-medium hover:bg-muted"><FileUp className="h-4 w-4" /> Impor Backup JSON</button><input ref={fileRef} type="file" accept="application/json,.json" onChange={readImport} className="hidden" /><button onClick={() => setShowReset(true)} className="flex w-full items-center justify-center gap-2 rounded border border-rose-300 px-3 py-2 font-medium text-rose-700 hover:bg-rose-50"><RefreshCw className="h-4 w-4" /> Reset Data Demo</button><p className="text-[11px] text-muted-foreground">Terakhir disimpan: {diagnostics?.updated_at ? new Date(diagnostics.updated_at).toLocaleString('id-ID') : '-'}</p></div></section>
      </div>

      <section className="panel overflow-hidden"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Timeline perubahan terbaru</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Jejak siapa melakukan apa, kapan, dan modul yang berubah.</p></div><div className="max-h-[360px] overflow-auto divide-y divide-border">{audit.map((entry) => <div key={entry.id} className="grid gap-1 px-4 py-2.5 text-xs md:grid-cols-[150px_140px_1fr]"><span className="text-muted-foreground">{new Date(entry.timestamp || entry.created_at || Date.now()).toLocaleString('id-ID')}</span><span className="font-medium">{entry.user_name || entry.actor_name || entry.changed_by || '-'}</span><span><strong>{entry.module || entry.entity || 'Sistem'}</strong> — {entry.description || entry.action}</span></div>)}{!audit.length && <p className="p-4 text-xs text-muted-foreground">Belum ada audit log.</p>}</div></section>

      {pendingImport && <ConfirmModal title="Pulihkan backup localStorage" onClose={() => setPendingImport(null)} onConfirm={applyImport} busy={busy} confirmLabel="Pulihkan Backup"><p>File <strong>{pendingImport.fileName}</strong> berisi {Object.keys(pendingImport.snapshot).length} kelompok data. Snapshot aktif akan diganti, tetapi dapat dipulihkan kembali jika sebelumnya sudah diekspor.</p></ConfirmModal>}
      {showReset && <ConfirmModal title="Reset seluruh data demo" onClose={() => { setShowReset(false); setResetPhrase(''); }} onConfirm={resetDemo} busy={busy} confirmLabel="Reset Data" disabled={resetPhrase !== 'RESET UAT'} danger><p className="mb-3">Tindakan ini mengganti semua data lokal dengan seed UAT. Ketik <strong>RESET UAT</strong> untuk melanjutkan.</p><input value={resetPhrase} onChange={(event) => setResetPhrase(event.target.value)} className="w-full rounded border border-border px-3 py-2" placeholder="RESET UAT" /></ConfirmModal>}
    </div>
  );
}

function ConfirmModal({ title, children, onClose, onConfirm, busy = false, confirmLabel = 'Konfirmasi', disabled = false, danger = false }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}><div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">{title}</h3><button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="p-4 text-xs leading-relaxed">{children}</div><div className="flex justify-end gap-2 border-t border-border px-4 py-3"><button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs font-medium">Batal</button><button onClick={onConfirm} disabled={busy || disabled} className={`rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 ${danger ? 'bg-rose-600' : 'bg-primary'}`}>{busy ? 'Memproses…' : confirmLabel}</button></div></div></div>;
}
