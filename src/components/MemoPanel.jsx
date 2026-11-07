const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, X, Pin, PinOff, Paperclip, Download } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

const MEMO_TARGETS = ['All', 'Owner', 'Admin', 'Dokter', 'Apoteker', 'Kasir', 'Perawat', 'Staff'];

export default function MemoPanel() {
  const [user, setUser] = useState(null);
  const [clinicRole, setClinicRole] = useState('Staff');
  const [memos, setMemos] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      try {
        const u = await db.auth.me();
        setUser(u);
        setClinicRole(u?.data?.clinic_role || u?.clinic_role || 'Staff');
        const m = await db.entities.Memo.list('-created_date', 50) || [];
        setMemos(m);
      } catch {}
    };
    init();
    const unsubscribe = db.entities.Memo.subscribe((event) => {
      if (event.type === 'create') {
        setMemos(prev => [event.data, ...prev]);
      } else if (event.type === 'update') {
        setMemos(prev => prev.map(m => m.id === event.data.id ? event.data : m));
      } else if (event.type === 'delete') {
        setMemos(prev => prev.filter(m => m.id !== event.id));
      }
    });
    return unsubscribe;
  }, []);

  const visibleMemos = memos.filter(m => m.target_role === 'All' || m.target_role === clinicRole);
  const pinnedMemos = visibleMemos.filter(m => m.is_pinned);
  const otherMemos = visibleMemos.filter(m => !m.is_pinned);

  const markRead = async (memo) => {
    if (!user || (memo.read_by || []).includes(user.id)) return;
    try {
      await db.entities.Memo.update(memo.id, { read_by: [...(memo.read_by || []), user.id] });
    } catch {}
  };

  const openMemo = (memo) => {
    setSelectedMemo(memo);
    markRead(memo);
  };

  const togglePin = async (memo) => {
    try {
      await db.entities.Memo.update(memo.id, { is_pinned: !memo.is_pinned });
      toast({ title: memo.is_pinned ? 'Memo dilepas' : 'Memo disematkan' });
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const isUnread = (memo) => user && !(memo.read_by || []).includes(user.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Memo & pengumuman internal — {visibleMemos.length} memo</p>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Buat Memo
        </button>
      </div>

      {visibleMemos.length === 0 && (
        <div className="panel p-8 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Belum ada memo</p>
        </div>
      )}

      {pinnedMemos.length > 0 && (
        <div className="space-y-2">
          <p className="micro-label flex items-center gap-1"><Pin className="w-3 h-3" /> Disematkan</p>
          {pinnedMemos.map(m => <MemoCard key={m.id} memo={m} onOpen={openMemo} onTogglePin={togglePin} unread={isUnread(m)} />)}
        </div>
      )}

      {otherMemos.length > 0 && (
        <div className="space-y-2">
          {pinnedMemos.length > 0 && <p className="micro-label">Lainnya</p>}
          {otherMemos.map(m => <MemoCard key={m.id} memo={m} onOpen={openMemo} onTogglePin={togglePin} unread={isUnread(m)} />)}
        </div>
      )}

      {showCreate && <CreateMemoModal onClose={() => setShowCreate(false)} user={user} onCreated={() => setShowCreate(false)} />}
      {selectedMemo && <MemoDetailModal memo={selectedMemo} onClose={() => setSelectedMemo(null)} onTogglePin={togglePin} />}
    </div>
  );
}

function MemoCard({ memo, onOpen, onTogglePin, unread }) {
  const priorityPill = memo.priority === 'Mendesak' ? 'pill-critical' : memo.priority === 'Penting' ? 'pill-warning' : 'pill-inactive';
  return (
    <div className={`panel p-3 cursor-pointer hover:border-primary/40 transition-colors ${unread ? 'border-l-2 border-l-primary' : ''}`} onClick={() => onOpen(memo)}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {unread && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
            <p className="text-sm font-medium truncate">{memo.subject}</p>
            <span className={`pill ${priorityPill} shrink-0`}>{memo.priority}</span>
            {memo.is_pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{memo.body}</p>
          {memo.file_url && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
              <Paperclip className="w-3 h-3" /> {memo.file_name || 'Lampiran'}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">Dari: {memo.from_user_name} • {new Date(memo.created_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onTogglePin(memo); }} className="p-1 hover:bg-muted rounded text-muted-foreground">
          {memo.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function CreateMemoModal({ onClose, user, onCreated }) {
  const [form, setForm] = useState({ target_role: 'All', subject: '', body: '', priority: 'Normal' });
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      setPendingFile({ url: file_url, name: file.name });
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(false);
    e.target.value = '';
  };

  const submit = async () => {
    if (!form.subject || !form.body) { toast({ title: 'Subjek dan isi wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await db.entities.Memo.create({
        ...form,
        from_user_id: user.id,
        from_user_name: user.full_name || user.email,
        read_by: [],
        is_pinned: false,
        ...(pendingFile ? { file_url: pendingFile.url, file_name: pendingFile.name } : {}),
      });
      toast({ title: 'Memo terkirim' });
      onCreated();
    } catch (e) { toast({ title: 'Gagal', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Buat Memo Internal</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Target</label>
              <select value={form.target_role} onChange={e => set('target_role', e.target.value)} className={inputCls}>
                {MEMO_TARGETS.map(r => <option key={r}>{r === 'All' ? 'Semua Staff' : r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Prioritas</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
                {['Normal', 'Penting', 'Mendesak'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Subjek</label>
            <input value={form.subject} onChange={e => set('subject', e.target.value)} className={inputCls} placeholder="Judul memo…" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Isi Memo</label>
            <textarea value={form.body} onChange={e => set('body', e.target.value)} className={inputCls} rows={5} placeholder="Tulis memo atau pengumuman…" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Lampiran</label>
            <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx" />
            {pendingFile ? (
              <div className="flex items-center gap-2 px-2 py-1.5 border border-border rounded text-xs">
                <Paperclip className="w-3.5 h-3.5 text-primary" />
                <span className="truncate flex-1">{pendingFile.name}</span>
                <button onClick={() => setPendingFile(null)} className="p-0.5 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 px-2 py-1.5 border border-dashed border-border rounded text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50 w-full">
                {uploading ? <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />} {uploading ? 'Mengunggah…' : 'Lampirkan foto/dokumen'}
              </button>
            )}
          </div>
        </div>
        <div className="px-3 py-2.5 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded text-xs hover:bg-muted">Batal</button>
          <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2 rounded text-xs font-medium disabled:opacity-50">{saving ? 'Mengirim…' : 'Kirim Memo'}</button>
        </div>
      </div>
    </div>
  );
}

function MemoDetailModal({ memo, onClose, onTogglePin }) {
  const priorityPill = memo.priority === 'Mendesak' ? 'pill-critical' : memo.priority === 'Penting' ? 'pill-warning' : 'pill-inactive';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`pill ${priorityPill}`}>{memo.priority}</span>
            <span className="pill pill-info">{memo.target_role === 'All' ? 'Semua Staff' : memo.target_role}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <h2 className="text-base font-semibold">{memo.subject}</h2>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-3 h-3" />
            </div>
            <span>Dari: <strong>{memo.from_user_name}</strong> • {new Date(memo.created_date).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</span>
          </div>
          <div className="bg-muted/30 rounded p-3 text-sm whitespace-pre-wrap">{memo.body}</div>
          {memo.file_url && (
            <div>
              {memo.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <a href={memo.file_url} target="_blank" rel="noopener noreferrer">
                  <img src={memo.file_url} className="max-w-full max-h-64 rounded-lg border border-border object-cover" />
                </a>
              ) : (
                <a href={memo.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 border border-border rounded text-sm hover:bg-muted">
                  <FileText className="w-4 h-4 text-primary" /> {memo.file_name || 'Lampiran'} <Download className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Dibaca oleh {(memo.read_by || []).length} orang</p>
        </div>
        <div className="px-3 py-2.5 border-t border-border flex gap-2">
          <button onClick={() => onTogglePin(memo)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded text-xs hover:bg-muted">
            {memo.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />} {memo.is_pinned ? 'Lepas Semat' : 'Sematkan'}
          </button>
          <button onClick={onClose} className="flex-1 btn-primary py-2 rounded text-xs font-medium">Tutup</button>
        </div>
      </div>
    </div>
  );
}