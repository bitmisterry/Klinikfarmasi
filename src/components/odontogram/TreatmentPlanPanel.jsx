// @ts-nocheck -- Dental treatment sessions use evolving local schemas.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { Plus, CheckCircle2, Circle, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function TreatmentPlanPanel({ patient, plan, onRefresh, doctor }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newSession, setNewSession] = useState({ description: '', estimated_cost: 0, scheduled_date: '' });

  if (!patient) {
    return (
      <div className="panel p-4">
        <h3 className="text-sm font-semibold mb-2">Rencana Perawatan</h3>
        <p className="text-xs text-muted-foreground">Pilih pasien untuk melihat rencana perawatan.</p>
      </div>
    );
  }

  const addSession = async () => {
    if (!plan) return;
    if (!newSession.description.trim()) {
      toast({ title: 'Deskripsi sesi wajib diisi', variant: 'destructive' });
      return;
    }
    try {
      const sessionNumber = (plan.sessions?.length || 0) + 1;
      const sessions = [...(plan.sessions || []), {
        session_number: sessionNumber,
        description: newSession.description,
        estimated_cost: Number(newSession.estimated_cost) || 0,
        scheduled_date: newSession.scheduled_date,
        status: 'Dijadwalkan',
      }];
      const total_estimate = sessions.reduce((sum, s) => sum + (s.estimated_cost || 0), 0);
      await db.entities.TreatmentPlan.update(plan.id, { sessions, total_estimate });
      toast({ title: 'Sesi perawatan ditambahkan' });
      setNewSession({ description: '', estimated_cost: 0, scheduled_date: '' });
      setShowForm(false);
      onRefresh?.();
    } catch (e) {
      toast({ title: 'Gagal menambah sesi', description: e.message, variant: 'destructive' });
    }
  };

  const completeSession = async (idx) => {
    if (!plan) return;
    const sessions = plan.sessions.map((s, i) =>
      i === idx ? { ...s, status: 'Selesai', completed_date: new Date().toISOString().split('T')[0] } : s
    );
    const total_paid = sessions.filter(s => s.status === 'Selesai').reduce((sum, s) => sum + (s.estimated_cost || 0), 0);
    const allDone = sessions.every(s => s.status === 'Selesai');
    try {
      await db.entities.TreatmentPlan.update(plan.id, {
        sessions,
        total_paid,
        status: allDone ? 'Selesai' : 'Aktif',
      });
      toast({ title: 'Sesi selesai' });
      onRefresh?.();
    } catch (e) {
      toast({ title: 'Gagal update sesi', variant: 'destructive' });
    }
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Rencana Perawatan Bertahap</h3>
        {plan && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover">
            <Plus className="w-3.5 h-3.5" /> Tambah Sesi
          </button>
        )}
      </div>

      {!plan && (
        <p className="text-xs text-muted-foreground">Belum ada rencana perawatan. Buat dari pemeriksaan dokter.</p>
      )}

      {plan && (
        <>
          <div className="flex items-center gap-2 mb-3 text-xs">
            <span className="font-medium">{plan.plan_name}</span>
            <span className={`pill ${plan.status === 'Aktif' ? 'pill-info' : plan.status === 'Selesai' ? 'pill-success' : 'pill-inactive'}`}>
              {plan.status}
            </span>
          </div>

          {showForm && (
            <div className="mb-3 p-3 bg-muted/50 rounded-md space-y-2">
              <input
                value={newSession.description}
                onChange={e => setNewSession({ ...newSession, description: e.target.value })}
                placeholder="Deskripsi tindakan sesi ini"
                className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newSession.estimated_cost}
                  onChange={e => setNewSession({ ...newSession, estimated_cost: e.target.value })}
                  placeholder="Estimasi biaya"
                  className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-card"
                />
                <input
                  type="date"
                  value={newSession.scheduled_date}
                  onChange={e => setNewSession({ ...newSession, scheduled_date: e.target.value })}
                  className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-card"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addSession} className="btn-primary text-xs px-3 py-1.5 rounded">Simpan Sesi</button>
                <button onClick={() => setShowForm(false)} className="text-xs px-3 py-1.5 rounded border border-border">Batal</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(plan.sessions || []).map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-2 border border-border rounded-md">
                <button
                  type="button"
                  onClick={() => completeSession(i)}
                  disabled={s.status === 'Selesai'}
                  aria-label={s.status === 'Selesai' ? `Sesi ${s.session_number} selesai` : `Tandai sesi ${s.session_number} selesai`}
                  title={s.status === 'Selesai' ? 'Sesi sudah selesai' : 'Tandai sesi selesai'}
                  className="mt-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-default"
                >
                  {s.status === 'Selesai' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground hover:text-primary" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">Sesi {s.session_number}</span>
                    <span className={`pill ${s.status === 'Selesai' ? 'pill-success' : 'pill-warning'}`}>{s.status}</span>
                  </div>
                  <p className="text-xs text-foreground mt-0.5">{s.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                    {s.scheduled_date && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{s.scheduled_date}</span>}
                    <span>Rp {(s.estimated_cost || 0).toLocaleString('id-ID')}</span>
                    {s.completed_date && <span className="text-emerald-600">Selesai: {s.completed_date}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs">
            <span className="text-muted-foreground">Total Estimasi: <span className="font-medium text-foreground">Rp {(plan.total_estimate || 0).toLocaleString('id-ID')}</span></span>
            <span className="text-muted-foreground">Terbayar: <span className="font-medium text-emerald-600">Rp {(plan.total_paid || 0).toLocaleString('id-ID')}</span></span>
          </div>
        </>
      )}
    </div>
  );
}
