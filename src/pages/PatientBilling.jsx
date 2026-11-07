const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { CreditCard, Check } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

export default function PatientBilling() {
  const [patient, setPatient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const user = await db.auth.me();
        const patients = await db.entities.Patient.filter({ user_id: user.id }) || [];
        if (patients.length > 0) {
          setPatient(patients[0]);
          const txns = await db.entities.Transaction.filter({ patient_id: patients[0].id }, '-transaction_date', 50) || [];
          setTransactions(txns);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const unpaid = transactions.filter(t => t.payment_status === 'Belum Bayar');
  const paid = transactions.filter(t => t.payment_status === 'Lunas');

  const handlePay = (txn) => {
    toast({ title: 'Pembayaran online segera tersedia', description: `Silakan bayar di kasir klinik. Tagihan: Rp ${(txn.total || 0).toLocaleString('id-ID')}` });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (!patient) return <div className="max-w-md mx-auto mt-20 p-6 panel text-center"><p className="text-sm">Akun belum terhubung ke rekam medis. Hubungi admin.</p></div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Tagihan & Pembayaran</h1>

      <div>
        <p className="micro-label mb-2">Tagihan Belum Dibayar ({unpaid.length})</p>
        {unpaid.length === 0 ? (
          <div className="panel p-6 text-center text-muted-foreground">
            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-sm">Tidak ada tagihan tertunggak</p>
          </div>
        ) : (
          <div className="space-y-2">
            {unpaid.map(t => (
              <div key={t.id} className="panel p-3 border-l-2 border-l-rose-400">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">{t.invoice_number}</p>
                    <p className="text-[11px] text-muted-foreground">{t.type} • {t.transaction_date}</p>
                  </div>
                  <p className="text-lg font-bold text-rose-600">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                </div>
                <div className="text-[11px] space-y-0.5 mb-2 bg-muted/30 rounded p-2">
                  {t.consultation_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Jasa Konsultasi</span><span>Rp {(t.consultation_fee || 0).toLocaleString('id-ID')}</span></div>}
                  {t.items && t.items.map((it, i) => (
                    <div key={i} className="flex justify-between"><span className="text-muted-foreground">{it.medicine_name} x{it.quantity}</span><span>Rp {(it.subtotal || 0).toLocaleString('id-ID')}</span></div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handlePay(t)} className="flex-1 btn-primary py-2 rounded text-xs font-medium flex items-center justify-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Bayar Online
                  </button>
                  <button onClick={() => toast({ title: 'Silakan bayar di kasir klinik' })} className="px-3 py-2 border border-border rounded text-xs font-medium hover:bg-muted">
                    Bayar di Klinik
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="micro-label mb-2">Riwayat Pembayaran ({paid.length})</p>
        {paid.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Belum ada riwayat pembayaran</p>
        ) : (
          <div className="space-y-1.5">
            {paid.map(t => (
              <div key={t.id} className="panel p-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{t.invoice_number}</p>
                  <p className="text-[11px] text-muted-foreground">{t.type} • {t.transaction_date} • {t.payment_method}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-600">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                <span className="pill pill-success">Lunas</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}