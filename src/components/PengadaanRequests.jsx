const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Package, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

export default function PengadaanRequests({ refreshKey }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [response, setResponse] = useState('');
  const { toast } = useToast();

  const load = async () => {
    try {
      const r = await db.entities.InternalRequest.filter(
        { type: 'Permintaan Pengadaan', status: { $in: ['Baru', 'Dilihat', 'Diproses'] } },
        '-created_date',
        50
      );
      setRequests(r || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const respond = async (req, status, responseText) => {
    try {
      await db.entities.InternalRequest.update(req.id, {
        status,
        response: responseText || status,
      });
      // Notify the doctor
      await db.entities.Notification.create({
        type: 'pengadaan',
        target_role: 'Dokter',
        title: `Respon Pengadaan: ${req.medicine_name || req.subject}`,
        body: `Apoteker: ${responseText || status}`,
        priority: 'Normal',
        related_entity: 'InternalRequest',
        related_id: req.id,
      });
      toast({ title: `Respon terkirim ke ${req.from_user_name}` });
      setResponding(null);
      setResponse('');
      load();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const RESPONSES = [
    { label: 'Tersedia', status: 'Selesai', color: 'text-emerald-600', border: 'border-emerald-300 hover:bg-emerald-50' },
    { label: 'Akan Dibeli', status: 'Diproses', color: 'text-amber-600', border: 'border-amber-300 hover:bg-amber-50' },
    { label: 'Tidak Tersedia', status: 'Ditolak', color: 'text-rose-600', border: 'border-rose-300 hover:bg-rose-50' },
    { label: 'Ada Alternatif', status: 'Diproses', color: 'text-blue-600', border: 'border-blue-300 hover:bg-blue-50' },
  ];

  return (
    <div className="divide-y divide-border">
      {loading && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Memuat…</p>}
      {!loading && requests.length === 0 && (
        <div className="px-3 py-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-emerald-600">Tidak ada permintaan pengadaan</p>
          <p className="text-[11px] text-muted-foreground">Semua permintaan dokter sudah ditangani</p>
        </div>
      )}
      {requests.map(req => (
        <div key={req.id} className="px-3 py-3">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{req.subject}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{req.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground">dari {req.from_user_name}</span>
                <span className={`pill ${req.priority === 'Penting' ? 'pill-warning' : 'pill-inactive'}`}>{req.priority}</span>
                <span className={`pill ${req.status === 'Baru' ? 'pill-info' : req.status === 'Diproses' ? 'pill-warning' : 'pill-inactive'}`}>{req.status}</span>
              </div>
            </div>
          </div>

          {responding === req.id ? (
            <div className="pl-10 space-y-2">
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                rows={2}
                placeholder="Catatan untuk dokter (opsional)…"
                className="w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary"
              />
              <div className="flex flex-wrap gap-1.5">
                {RESPONSES.map(r => (
                  <button
                    key={r.label}
                    onClick={() => respond(req, r.status, r.label + (response ? `: ${response}` : ''))}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded border ${r.border} ${r.color}`}
                  >
                    {r.label}
                  </button>
                ))}
                <button onClick={() => { setResponding(null); setResponse(''); }} className="text-xs px-2 py-1.5 text-muted-foreground hover:bg-muted rounded">
                  Batal
                </button>
              </div>
            </div>
          ) : req.response ? (
            <div className="pl-10 mt-1.5">
              <div className="flex items-start gap-1.5 text-xs bg-muted/50 rounded px-2 py-1.5">
                <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Respon: {req.response}</span>
              </div>
            </div>
          ) : (
            <div className="pl-10 mt-1.5">
              <button
                onClick={() => setResponding(req.id)}
                className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1"
              >
                <ArrowRight className="w-3 h-3" /> Tanggapi
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}