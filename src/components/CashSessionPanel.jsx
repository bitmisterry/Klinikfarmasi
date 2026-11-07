import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Clock, LockKeyhole, Plus, Wallet } from 'lucide-react';

import { db } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const formatRupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function CashSessionPanel({ user, onSessionChange, refreshKey = 0 }) {
  const [session, setSession] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [activeSessions, allTransactions] = await Promise.all([
        db.entities.CashSession.filter({ status: 'Aktif' }, '-opened_at', 10).catch(() => []),
        db.entities.Transaction.list('-created_date', 500).catch(() => []),
      ]);
      const sessions = activeSessions || [];
      const active = sessions.find((item) => item.opened_by === user?.id)
        || (user?.id?.startsWith('demo-') ? sessions[0] : null);
      setSession(active);
      setTransactions(allTransactions || []);
      onSessionChange?.(active);
      if (active) setClosingCash(String(active.expected_cash ?? active.opening_cash ?? 0));
    } catch (error) {
      toast({ title: 'Gagal memuat shift kas', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey, user?.id]);

  const sessionTransactions = useMemo(() => {
    if (!session) return [];
    return transactions.filter((transaction) => {
      if (transaction.cash_session_id === session.id) return true;
      if (transaction.cash_session_id) return false;
      return session.opened_at && transaction.paid_at && new Date(transaction.paid_at) >= new Date(session.opened_at);
    });
  }, [session, transactions]);

  const cashSales = sessionTransactions
    .filter((transaction) => transaction.payment_status === 'Lunas' && transaction.payment_method === 'Tunai')
    .reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  const cashRefunds = sessionTransactions
    .filter((transaction) => transaction.payment_status === 'Refund' && transaction.payment_method === 'Tunai')
    .reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  const expectedCash = Number(session?.opening_cash || 0) + cashSales - cashRefunds;
  const enteredClosing = Number(closingCash || 0);
  const projectedDifference = enteredClosing - expectedCash;

  const userName = user?.full_name || user?.email || 'Kasir';

  const openShift = async () => {
    const amount = Number(openingCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: 'Saldo awal tidak valid', description: 'Masukkan angka saldo awal kas yang benar.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const created = await db.entities.CashSession.create({
        session_number: `CS-${today}-${String(Date.now()).slice(-4)}`,
        opened_by: user?.id || '',
        opened_by_name: userName,
        opened_at: new Date().toISOString(),
        opening_cash: amount,
        expected_cash: amount,
        closing_cash: 0,
        difference: 0,
        status: 'Aktif',
        total_transactions: 0,
        total_cash_sales: 0,
      });
      await db.entities.AuditLog.create({
        action: 'create', entity: 'CashSession', entity_id: created.id, entity_name: created.session_number,
        description: `Shift kas ${created.session_number} dibuka dengan saldo awal ${formatRupiah(amount)}`,
        user_id: user?.id || '', user_name: userName, user_role: 'Kasir', severity: 'Info',
        timestamp: new Date().toISOString(),
      });
      setOpeningCash('');
      setShowOpen(false);
      toast({ title: 'Shift kas dibuka', description: `${created.session_number} • Saldo awal ${formatRupiah(amount)}` });
      await load();
    } catch (error) {
      toast({ title: 'Gagal membuka shift', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const closeShift = async () => {
    if (!session) return;
    const amount = Number(closingCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: 'Saldo fisik tidak valid', description: 'Masukkan saldo kas fisik saat shift ditutup.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const closedAt = new Date().toISOString();
      const difference = amount - expectedCash;
      const updated = await db.entities.CashSession.update(session.id, {
        status: 'Tutup', closed_at: closedAt, closed_by: user?.id || '', closed_by_name: userName,
        closing_cash: amount, expected_cash: expectedCash, difference,
        total_transactions: sessionTransactions.filter((transaction) => transaction.payment_status === 'Lunas').length,
        total_cash_sales: cashSales,
      });
      await db.entities.AuditLog.create({
        action: 'update', entity: 'CashSession', entity_id: updated.id, entity_name: updated.session_number,
        description: `Shift kas ${updated.session_number} ditutup • Ekspektasi ${formatRupiah(expectedCash)} • Fisik ${formatRupiah(amount)} • Selisih ${formatRupiah(difference)}`,
        user_id: user?.id || '', user_name: userName, user_role: 'Kasir', severity: difference === 0 ? 'Info' : 'Warning',
        old_value: 'Aktif', new_value: 'Tutup', reason: difference === 0 ? 'Saldo sesuai' : 'Selisih kas dicatat saat penutupan',
        timestamp: closedAt,
      });
      setShowClose(false);
      setSession(null);
      onSessionChange?.(null);
      toast({
        title: 'Shift kas ditutup',
        description: difference === 0 ? 'Saldo fisik sesuai dengan saldo sistem.' : `Selisih ${formatRupiah(difference)} dicatat di audit trail.`,
      });
      await load();
    } catch (error) {
      toast({ title: 'Gagal menutup shift', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="panel h-24 animate-pulse bg-muted/30" />;

  return (
    <div className="panel p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Shift & Rekonsiliasi Kas</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Saldo fisik dibandingkan otomatis dengan pembayaran yang tercatat.</p>
        </div>
        {session ? (
          <span className="pill pill-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Aktif</span>
        ) : (
          <button onClick={() => setShowOpen(true)} className="btn-primary px-2.5 py-1.5 rounded text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Buka Shift</button>
        )}
      </div>

      {session ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <div className="rounded border border-border px-2.5 py-2"><p className="text-muted-foreground">Nomor Shift</p><p className="font-mono font-medium mt-0.5">{session.session_number}</p></div>
            <div className="rounded border border-border px-2.5 py-2"><p className="text-muted-foreground">Saldo Awal</p><p className="font-medium mt-0.5">{formatRupiah(session.opening_cash)}</p></div>
            <div className="rounded border border-border px-2.5 py-2"><p className="text-muted-foreground">Penerimaan Tunai</p><p className="font-medium mt-0.5">{formatRupiah(cashSales)}</p></div>
            <div className="rounded border border-border px-2.5 py-2"><p className="text-muted-foreground">Saldo Ekspektasi</p><p className="font-medium mt-0.5">{formatRupiah(expectedCash)}</p></div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2.5 py-2 text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {sessionTransactions.length} transaksi pada shift ini</span>
            <button onClick={() => { setClosingCash(String(expectedCash)); setShowClose(true); }} className="px-2.5 py-1.5 border border-rose-200 text-rose-700 rounded hover:bg-rose-50 flex items-center gap-1 font-medium"><LockKeyhole className="w-3.5 h-3.5" /> Tutup Kas / Shift</button>
          </div>
        </>
      ) : (
        <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> Belum ada shift kas aktif. Buka shift sebelum menerima pembayaran.</div>
      )}

      {showOpen && (
        <div className="rounded border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-semibold">Buka Shift Kas</p>
          <label className="block text-[11px] text-muted-foreground">Saldo awal fisik</label>
          <div className="flex gap-2">
            <div className="relative flex-1"><Banknote className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" /><input autoFocus type="number" min="0" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder="0" className="w-full pl-7 pr-2 py-1.5 border border-border rounded text-xs bg-card" /></div>
            <button onClick={openShift} disabled={saving} className="btn-primary px-3 py-1.5 rounded text-xs disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan'}</button>
            <button onClick={() => setShowOpen(false)} className="px-3 py-1.5 border border-border rounded text-xs">Batal</button>
          </div>
        </div>
      )}

      {showClose && session && (
        <div className="rounded border border-rose-200 bg-rose-50/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-rose-800">Tutup Kas / Shift {session.session_number}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div><p className="text-muted-foreground">Saldo ekspektasi</p><p className="font-semibold">{formatRupiah(expectedCash)}</p></div>
            <div><label className="text-muted-foreground block mb-1">Saldo fisik</label><input autoFocus type="number" min="0" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-xs bg-card" /></div>
            <div><p className="text-muted-foreground">Selisih</p><p className={`font-semibold ${projectedDifference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatRupiah(projectedDifference)}</p></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Selisih tidak dihapus atau disesuaikan manual; sistem akan menyimpannya sebagai bagian dari audit trail penutupan shift.</p>
          <div className="flex justify-end gap-2"><button onClick={() => setShowClose(false)} className="px-3 py-1.5 border border-border rounded text-xs">Batal</button><button onClick={closeShift} disabled={saving} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs disabled:opacity-50">{saving ? 'Menyimpan…' : 'Konfirmasi Tutup Kas'}</button></div>
        </div>
      )}
    </div>
  );
}
