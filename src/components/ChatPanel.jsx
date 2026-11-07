const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Stethoscope, Pill, Receipt, User, MessageSquare, Paperclip, Download, X, FileText } from 'lucide-react';

const CHANNELS = [
  { id: 'all-staff', label: 'Semua Staff', icon: Users, color: 'text-primary' },
  { id: 'dokter', label: 'Dokter', icon: Stethoscope, color: 'text-blue-600' },
  { id: 'apoteker', label: 'Apoteker', icon: Pill, color: 'text-teal-600' },
  { id: 'kasir', label: 'Kasir', icon: Receipt, color: 'text-amber-600' },
];

export default function ChatPanel() {
  const [user, setUser] = useState(null);
  const [clinicRole, setClinicRole] = useState('Staff');
  const [users, setUsers] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('all-staff');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const u = await db.auth.me();
        setUser(u);
        setClinicRole(u?.data?.clinic_role || u?.clinic_role || 'Staff');
        const ul = await db.entities.User.list().catch(() => []);
        setUsers((ul || []).filter(x => x.id !== u.id));
      } catch {}
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    const loadMessages = async () => {
      try {
        const msgs = await db.entities.ChatMessage.filter({ channel: selectedChannel }, 'timestamp', 100) || [];
        setMessages(msgs);
      } catch { setMessages([]); }
    };
    loadMessages();
    const unsubscribe = db.entities.ChatMessage.subscribe((event) => {
      if (event.data?.channel === selectedChannel) {
        if (event.type === 'create') {
          setMessages(prev => prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data]);
        }
      }
    });
    return unsubscribe;
  }, [selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      setPendingFile({ url: file_url, name: file.name, isImage: file.type.startsWith('image/') });
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(false);
    e.target.value = '';
  };

  const send = async () => {
    if ((!input.trim() && !pendingFile) || !user) return;
    const msg = {
      channel: selectedChannel,
      sender_id: user.id,
      sender_name: user.full_name || user.email,
      sender_role: clinicRole,
      message: input.trim(),
      timestamp: new Date().toISOString(),
      ...(pendingFile ? { file_url: pendingFile.url, file_name: pendingFile.name } : {}),
    };
    setInput('');
    setPendingFile(null);
    try {
      await db.entities.ChatMessage.create(msg);
    } catch (e) {
      setInput(msg.message);
    }
  };

  const dmChannel = (otherUser) => {
    if (!user) return '';
    const ids = [user.id, otherUser.id].sort();
    return `dm-${ids[0]}-${ids[1]}`;
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const today = new Date().toISOString().split('T')[0];
    const msgDate = d.toISOString().split('T')[0];
    if (msgDate === today) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  const channelLabel = CHANNELS.find(c => c.id === selectedChannel)?.label ||
    users.find(u => dmChannel(u) === selectedChannel)?.full_name ||
    'Pesan Langsung';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-3 h-[calc(100vh-200px)]">
      {/* Channel list */}
      <div className="panel flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <p className="micro-label">Channel</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {CHANNELS.map(ch => (
            <button key={ch.id} onClick={() => setSelectedChannel(ch.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                selectedChannel === ch.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              }`}>
              <ch.icon className={`w-3.5 h-3.5 ${ch.color}`} /> {ch.label}
            </button>
          ))}
          {users.length > 0 && (
            <>
              <p className="micro-label mt-3 mb-1 px-2">Pesan Langsung</p>
              {users.map(u => {
                const dmCh = dmChannel(u);
                return (
                  <button key={u.id} onClick={() => setSelectedChannel(dmCh)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      selectedChannel === dmCh ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                    }`}>
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-3 h-3" />
                    </div>
                    <span className="truncate">{u.full_name || u.email}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="panel flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">{channelLabel}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Belum ada pesan. Mulai percakapan!</p>
            </div>
          )}
          {messages.map(m => {
            const isOwn = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{m.sender_name} • {m.sender_role}</p>
                  )}
                  {m.message && (
                    <div className={`px-3 py-1.5 rounded-lg text-xs ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {m.message}
                    </div>
                  )}
                  {m.file_url && (
                    <div className="mt-1">
                      {m.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={m.file_url} className="max-w-[180px] max-h-[120px] rounded-lg object-cover border border-border" />
                        </a>
                      ) : (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${isOwn ? 'bg-primary/80 text-primary-foreground' : 'bg-muted'} hover:opacity-80`}>
                          <FileText className="w-3.5 h-3.5" /> {m.file_name || 'Lampiran'} <Download className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(m.timestamp)}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        {pendingFile && (
          <div className="border-t border-border px-3 py-1.5 flex items-center gap-2 bg-muted/30">
            {pendingFile.isImage ? (
              <img src={pendingFile.url} className="w-10 h-10 rounded object-cover" />
            ) : (
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><FileText className="w-4 h-4 text-muted-foreground" /></div>
            )}
            <span className="text-xs truncate flex-1">{pendingFile.name}</span>
            <button onClick={() => setPendingFile(null)} className="p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <div className="border-t border-border p-2 flex items-center gap-2">
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-1.5 hover:bg-muted rounded text-muted-foreground disabled:opacity-50" title="Lampirkan foto/dokumen">
            {uploading ? <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ketik pesan…"
            className="flex-1 px-3 py-1.5 border border-border rounded text-xs outline-none focus:border-primary"
          />
          <button onClick={send} disabled={!input.trim() && !pendingFile} className="btn-primary px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 disabled:opacity-50">
            <Send className="w-3.5 h-3.5" /> Kirim
          </button>
        </div>
      </div>
    </div>
  );
}