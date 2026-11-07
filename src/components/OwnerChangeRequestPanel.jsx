const db = globalThis.__B44_DB__ || { auth:{ me: async()=>null }, entities:new Proxy({}, { get:()=>({ list:async()=>[], filter:async()=>[] }) }), functions:{ invoke:async()=>({}) } };

import React, { useEffect, useState } from 'react';
import { ClipboardPenLine, Send, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getClinicRole } from '@/lib/roles';

export default function OwnerChangeRequestPanel({ user }) {
  const role = getClinicRole(user);
  const isOwner = role === 'Owner';
  const isAdmin = role === 'Admin';
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ scope: 'Operasional / Konfigurasi', subject: '', message: '', priority: 'Normal' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const rows = await db.entities.InternalRequest.filter({ type: 'Permintaan Perubahan Owner' }, '-created_date', 30);
      setRequests((rows || []).filter((row) => isAdmin || row.from_user_id === user?.id));
    } catch { setRequests([]); }
  };

  useEffect(() => { load(); }, [user?.id, isAdmin]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await db.functions.invoke('submitOwnerChangeRequest', form);
      toast({ title: 'Permintaan dikirim ke Admin', description: 'Owner tidak mengubah data operasional secara langsung.' });
      setForm({ scope: 'Operasional / Konfigurasi', subject: '', message: '', priority: 'Normal' });
      load();
    } catch (error) { toast({ title: 'Gagal mengirim permintaan', description: error.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const review = async (request, action) => {
    const review_notes = window.prompt(action === 'approve' ? 'Catatan implementasi Admin (opsional)' : 'Alasan penolakan (wajib)') || '';
    if (action === 'reject' && !review_notes.trim()) return;
    try {
      await db.functions.invoke('reviewOwnerChangeRequest', { request_id: request.id, action, review_notes });
      toast({ title: action === 'approve' ? 'Permintaan disetujui Admin' : 'Permintaan ditolak Admin' });
      load();
    } catch (error) { toast({ title: 'Gagal memperbarui permintaan', description: error.message, variant: 'destructive' }); }
  };

  return (
    <div className="panel overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
        <ClipboardPenLine className="w-4 h-4 text-primary" />
        <div><p className="text-sm font-semibold">Permintaan Perubahan Owner</p><p className="text-[11px] text-muted-foreground">Perubahan data diproses oleh Admin agar audit trail tetap jelas.</p></div>
      </div>
      {isOwner && (
        <form onSubmit={submit} className="p-3 grid gap-2 border-b border-border">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.scope} onChange={(e) => setForm((current) => ({ ...current, scope: e.target.value }))} className="px-2 py-1.5 border border-border rounded text-xs bg-card">
              <option>Operasional / Konfigurasi</option><option>Harga / Kebijakan</option><option>KPI / Target Bisnis</option><option>Budget / Anggaran</option><option>Master Data</option><option>Hak Akses</option>
            </select>
            <select value={form.priority} onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))} className="px-2 py-1.5 border border-border rounded text-xs bg-card">
              <option>Normal</option><option>Penting</option><option>Mendesak</option>
            </select>
          </div>
          <input required value={form.subject} onChange={(e) => setForm((current) => ({ ...current, subject: e.target.value }))} placeholder="Judul perubahan" className="px-2 py-1.5 border border-border rounded text-xs" />
          <textarea required value={form.message} onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))} placeholder="Jelaskan perubahan dan alasannya…" rows={2} className="px-2 py-1.5 border border-border rounded text-xs" />
          <button disabled={saving} className="justify-self-end flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded text-xs disabled:opacity-50"><Send className="w-3.5 h-3.5" /> {saving ? 'Mengirim…' : 'Kirim ke Admin'}</button>
        </form>
      )}
      <div className="divide-y divide-border max-h-52 overflow-y-auto">
        {requests.length === 0 ? <p className="px-3 py-4 text-xs text-muted-foreground">Belum ada permintaan perubahan.</p> : requests.map((request) => (
          <div key={request.id} className="px-3 py-2.5 flex gap-2">
            <div className="flex-1 min-w-0"><p className="text-xs font-medium">{request.subject}</p><p className="text-[11px] text-muted-foreground line-clamp-2">{request.message}</p><p className="text-[10px] text-muted-foreground mt-1">{request.scope} • {request.status || 'Baru'}</p></div>
            {isAdmin && request.status === 'Baru' && <div className="flex gap-1 self-start"><button onClick={() => review(request, 'approve')} className="p-1.5 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50" title="Setujui"><Check className="w-3.5 h-3.5" /></button><button onClick={() => review(request, 'reject')} className="p-1.5 rounded border border-rose-200 text-rose-700 hover:bg-rose-50" title="Tolak"><X className="w-3.5 h-3.5" /></button></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
