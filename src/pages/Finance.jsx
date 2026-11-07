const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt, Plus, X, Stethoscope, Coins, Pill, History } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import EmptyState from '@/components/EmptyState';
import TransactionHistory from '@/components/TransactionHistory';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

const TYPE_LABELS = {
  'Apotek/POS': 'Penjualan Obat',
  'Resep': 'Penjualan Obat',
  'Bebas': 'Penjualan Obat',
  'Klinik': 'Jasa Dokter',
  'Pendapatan Lain': 'Pendapatan Lain',
};
const TYPE_PILLS = {
  'Apotek/POS': 'pill-info',
  'Resep': 'pill-info',
  'Bebas': 'pill-info',
  'Klinik': 'pill-success',
  'Pendapatan Lain': 'pill-warning',
};

export default function Finance() {
  const [txns, setTxns] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [showExpense, setShowExpense] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = getClinicRole(user) === 'Owner';

  const reload = () => {
    Promise.all([
      db.entities.Transaction.list(),
      db.entities.Expense.list(),
    ]).then(([t, e]) => {
      setTxns(t || []);
      setExpenses(e || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(reload, []);

  const today = new Date().toISOString().split('T')[0];
  const paidTxns = txns.filter(t => t.payment_status === 'Lunas');
  const todayPaid = paidTxns.filter(t => t.transaction_date === today);

  // Revenue breakdown by category
  const obatRevenue = todayPaid.filter(t => TYPE_LABELS[t.type] === 'Penjualan Obat').reduce((s, t) => s + ((t.subtotal || 0) - (t.discount || 0)), 0);
  const jasaDokterRevenue = todayPaid.reduce((s, t) => s + (t.consultation_fee || 0), 0);
  const pendapatanLainRevenue = todayPaid.filter(t => t.type === 'Pendapatan Lain').reduce((s, t) => s + (t.total || 0), 0) + todayPaid.reduce((s, t) => s + (t.other_fees || 0), 0);
  const todayRevenue = obatRevenue + jasaDokterRevenue + pendapatanLainRevenue;

  // All-time breakdown
  const allObat = paidTxns.filter(t => TYPE_LABELS[t.type] === 'Penjualan Obat').reduce((s, t) => s + ((t.subtotal || 0) - (t.discount || 0)), 0);
  const allJasa = paidTxns.reduce((s, t) => s + (t.consultation_fee || 0), 0);
  const allLain = paidTxns.filter(t => t.type === 'Pendapatan Lain').reduce((s, t) => s + (t.total || 0), 0) + paidTxns.reduce((s, t) => s + (t.other_fees || 0), 0);

  const todayExpenses = expenses.filter(e => e.expense_date === today).reduce((s, e) => s + (e.amount || 0), 0);
  const netCash = todayRevenue - todayExpenses;
  const totalRevenue = allObat + allJasa + allLain;
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Kas & Keuangan</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              view === 'dashboard' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}>
            <Wallet className="w-3.5 h-3.5" /> Dashboard
          </button>
          <button onClick={() => setView('riwayat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              view === 'riwayat' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}>
            <History className="w-3.5 h-3.5" /> Riwayat Transaksi
          </button>
          {!isOwner && <button onClick={() => setShowIncome(true)} className="flex items-center gap-1.5 border border-emerald-300 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-emerald-100">
            <Plus className="w-3.5 h-3.5" /> Catat Pendapatan
          </button>}
          {!isOwner && <button onClick={() => setShowExpense(true)} className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded-md text-xs font-medium">
            <Plus className="w-3.5 h-3.5" /> Catat Pengeluaran
          </button>}
        </div>
      </div>

      {view === 'riwayat' ? (
        <TransactionHistory />
      ) : (
      <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <SummaryCard icon={TrendingUp} label="Omzet Hari Ini" value={`Rp ${todayRevenue.toLocaleString('id-ID')}`} color="text-emerald-600 bg-emerald-50" />
        <SummaryCard icon={TrendingDown} label="Pengeluaran Hari Ini" value={`Rp ${todayExpenses.toLocaleString('id-ID')}`} color="text-rose-600 bg-rose-50" />
        <SummaryCard icon={Wallet} label="Net Kas Hari Ini" value={`Rp ${netCash.toLocaleString('id-ID')}`} color={netCash >= 0 ? 'text-teal-600 bg-teal-50' : 'text-rose-600 bg-rose-50'} />
        <SummaryCard icon={Receipt} label="Total Transaksi" value={txns.length} color="text-blue-600 bg-blue-50" />
      </div>

      {/* Revenue breakdown by category */}
      <div className="panel">
        <div className="px-3 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Coins className="w-4 h-4 text-primary" /> Pendapatan per Kategori</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Hari ini & total — terpisah antara penjualan obat, jasa dokter, dan pendapatan lain</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-border">
          <CategoryCard icon={Pill} label="Penjualan Obat" todayValue={obatRevenue} totalValue={allObat} color="text-teal-600" />
          <CategoryCard icon={Stethoscope} label="Jasa Dokter" todayValue={jasaDokterRevenue} totalValue={allJasa} color="text-blue-600" />
          <CategoryCard icon={Coins} label="Pendapatan Lain" todayValue={pendapatanLainRevenue} totalValue={allLain} color="text-amber-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Transactions */}
        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold">Transaksi Terbaru</h2>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {txns.slice(0, 20).map(t => (
              <div key={t.id} className="px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium truncate">{t.invoice_number}</p>
                      <span className={`pill ${TYPE_PILLS[t.type] || 'pill-inactive'} shrink-0`}>{TYPE_LABELS[t.type] || t.type}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{t.patient_name || 'Walk-in'} • {t.payment_method}</p>
                  </div>
                  <span className="font-medium shrink-0">Rp {(t.total || 0).toLocaleString('id-ID')}</span>
                  <span className={`pill ${t.payment_status === 'Lunas' ? 'pill-success' : t.payment_status === 'Void' ? 'pill-critical' : 'pill-warning'} shrink-0`}>{t.payment_status}</span>
                </div>
                {(t.consultation_fee > 0 || (t.items && t.items.length > 0) || t.other_fees > 0) && (
                  <div className="flex items-center gap-3 ml-6 mt-1 text-[10px] text-muted-foreground">
                    {t.consultation_fee > 0 && <span className="flex items-center gap-0.5"><Stethoscope className="w-2.5 h-2.5 text-blue-500" /> Jasa: Rp {(t.consultation_fee || 0).toLocaleString('id-ID')}</span>}
                    {t.items && t.items.length > 0 && <span className="flex items-center gap-0.5"><Pill className="w-2.5 h-2.5 text-teal-500" /> Obat: Rp {((t.subtotal || 0) - (t.discount || 0)).toLocaleString('id-ID')} ({t.items.length} item)</span>}
                    {t.other_fees > 0 && <span className="flex items-center gap-0.5"><Coins className="w-2.5 h-2.5 text-amber-500" /> Lain: Rp {(t.other_fees || 0).toLocaleString('id-ID')}</span>}
                  </div>
                )}
              </div>
            ))}
            {txns.length === 0 && <div className="py-4"><EmptyState icon={Receipt} title="Belum ada transaksi" description="Transaksi akan muncul di sini setelah pembayaran" /></div>}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold">Pengeluaran Terbaru</h2>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {expenses.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <TrendingDown className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{e.description || e.category}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{e.category} • {e.expense_date}</p>
                </div>
                <span className="font-medium text-rose-600 shrink-0">Rp {(e.amount || 0).toLocaleString('id-ID')}</span>
              </div>
            ))}
            {expenses.length === 0 && <div className="py-4"><EmptyState icon={TrendingDown} title="Belum ada pengeluaran" description="Pengeluaran akan muncul di sini setelah dicatat" /></div>}
          </div>
        </div>
      </div>

      </>
      )}

      {showExpense && <ExpenseForm onClose={() => setShowExpense(false)} onSaved={() => { setShowExpense(false); reload(); }} />}
      {showIncome && <IncomeForm onClose={() => setShowIncome(false)} onSaved={() => { setShowIncome(false); reload(); }} />}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="panel px-3 py-2.5 flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-md flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
      <div className="min-w-0">
        <p className="micro-label truncate">{label}</p>
        <p className="text-lg font-semibold leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

function CategoryCard({ icon: Icon, label, todayValue, totalValue, color }) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <div className="space-y-1">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hari Ini</p>
          <p className={`text-base font-semibold ${color}`}>Rp {todayValue.toLocaleString('id-ID')}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-sm font-medium text-muted-foreground">Rp {totalValue.toLocaleString('id-ID')}</p>
        </div>
      </div>
    </div>
  );
}

function IncomeForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    income_type: 'Jasa Dokter',
    patient_name: '',
    description: '',
    amount: 0,
    payment_method: 'Tunai',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  const submit = async () => {
    if (!form.amount || form.amount <= 0) { toast({ title: 'Jumlah wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const today = form.transaction_date.replace(/-/g, '');
      const invNum = `INV${today}${String(Date.now()).slice(-4)}`;
      const isJasaDokter = form.income_type === 'Jasa Dokter';
      await db.entities.Transaction.create({
        invoice_number: invNum,
        type: isJasaDokter ? 'Klinik' : 'Pendapatan Lain',
        patient_name: form.patient_name || (isJasaDokter ? 'Walk-in' : '-'),
        items: [],
        subtotal: 0,
        consultation_fee: isJasaDokter ? form.amount : 0,
        other_fees: !isJasaDokter ? form.amount : 0,
        total: form.amount,
        payment_method: form.payment_method,
        payment_status: 'Lunas',
        paid_amount: form.amount,
        transaction_date: form.transaction_date,
        cashier_name: 'Sistem',
      });
      await db.entities.AuditLog.create({
        action: 'create', entity: 'Transaction',
        description: `Pendapatan ${form.income_type}: ${form.description || form.patient_name} Rp ${form.amount.toLocaleString('id-ID')}`,
        user_name: 'Sistem', severity: 'Info', timestamp: new Date().toISOString(),
      });
      toast({ title: `${form.income_type} dicatat`, description: `Rp ${form.amount.toLocaleString('id-ID')}` });
      onSaved();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Coins className="w-4 h-4 text-emerald-600" /> Catat Pendapatan</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground">Jenis Pendapatan</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button type="button" onClick={() => set('income_type', 'Jasa Dokter')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs border ${form.income_type === 'Jasa Dokter' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:bg-muted'}`}>
                <Stethoscope className="w-3.5 h-3.5" /> Jasa Dokter
              </button>
              <button type="button" onClick={() => set('income_type', 'Pendapatan Lain')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs border ${form.income_type === 'Pendapatan Lain' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:bg-muted'}`}>
                <Coins className="w-3.5 h-3.5" /> Pendapatan Lain
              </button>
            </div>
          </div>
          {form.income_type === 'Jasa Dokter' && (
            <div><label className="text-[11px] text-muted-foreground">Nama Pasien (opsional)</label><input value={form.patient_name} onChange={e=>set('patient_name',e.target.value)} className={inputCls} placeholder="Walk-in" /></div>
          )}
          <div><label className="text-[11px] text-muted-foreground">Deskripsi</label><input value={form.description} onChange={e=>set('description',e.target.value)} className={inputCls} placeholder={form.income_type === 'Jasa Dokter' ? 'Konsultasi umum' : 'Layanan tambahan'} /></div>
          <div><label className="text-[11px] text-muted-foreground">Jumlah (Rp)</label><input type="number" value={form.amount} onChange={e=>set('amount',+e.target.value)} className={inputCls} /></div>
          <div><label className="text-[11px] text-muted-foreground">Metode</label><select value={form.payment_method} onChange={e=>set('payment_method',e.target.value)} className={inputCls}>{['Tunai','Transfer','Debit','QRIS','BPJS'].map(m=><option key={m}>{m}</option>)}</select></div>
          <div><label className="text-[11px] text-muted-foreground">Tanggal</label><input type="date" value={form.transaction_date} onChange={e=>set('transaction_date',e.target.value)} className={inputCls} /></div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}

function ExpenseForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ category: 'Operasional', description: '', amount: 0, payment_method: 'Tunai', expense_date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  const submit = async () => {
    if (!form.amount || form.amount <= 0) { toast({ title: 'Jumlah wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await db.entities.Expense.create({ ...form, expense_number: `EXP${Date.now().toString().slice(-6)}` });
      await db.entities.AuditLog.create({ action: 'create', entity: 'Expense', description: `Pengeluaran: ${form.description || form.category} Rp ${form.amount}`, user_name: 'Sistem', severity: 'Info', timestamp: new Date().toISOString() });
      toast({ title: 'Pengeluaran dicatat' }); onSaved();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Catat Pengeluaran</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className="text-[11px] text-muted-foreground">Kategori</label><select value={form.category} onChange={e=>set('category',e.target.value)} className={inputCls}>{['Pembelian Obat','Gaji','Operasional','Utilitas','Maintenance','Lainnya'].map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="text-[11px] text-muted-foreground">Deskripsi</label><input value={form.description} onChange={e=>set('description',e.target.value)} className={inputCls} /></div>
          <div><label className="text-[11px] text-muted-foreground">Jumlah (Rp)</label><input type="number" value={form.amount} onChange={e=>set('amount',+e.target.value)} className={inputCls} /></div>
          <div><label className="text-[11px] text-muted-foreground">Metode</label><select value={form.payment_method} onChange={e=>set('payment_method',e.target.value)} className={inputCls}>{['Tunai','Transfer','Debit'].map(m=><option key={m}>{m}</option>)}</select></div>
          <div><label className="text-[11px] text-muted-foreground">Tanggal</label><input type="date" value={form.expense_date} onChange={e=>set('expense_date',e.target.value)} className={inputCls} /></div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-xs hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded-md text-xs font-medium disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}
