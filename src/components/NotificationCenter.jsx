import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell, X, AlertTriangle, Pill, Package, Activity, ChevronRight,
  MessageSquare, FileText, CheckCircle2, Clock, Send, CheckCircle, Reply
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const TYPE_ICONS = {
  pengadaan: Package, stok: Pill, anomali: AlertTriangle, sistem: Activity,
  persiapan_pasien: CheckCircle, broadcast: Bell,
};

const PRIORITY_STYLES = {
  Normal: 'pill-inactive', Penting: 'pill-warning', Mendesak: 'pill-critical',
};

const STATUS_STYLES = {
  Baru: 'pill-info', Dibaca: 'pill-inactive', Ditanggapi: 'pill-warning', Selesai: 'pill-success',
};

const TABS = [
  { k: 'all', l: 'Semua' },
  { k: 'chat', l: 'Chat' },
  { k: 'memo', l: 'Memo' },
  { k: 'anomaly', l: 'Perlu Diperiksa' },
  { k: 'system', l: 'Pemberitahuan' },
];

function getRole(user) {
  return user?.data?.clinic_role || user?.clinic_role || user?.role || 'user';
}

const isPharmacyRole = (role) => ['Apoteker', 'Apoteker Penanggung Jawab', 'Apoteker Pendamping', 'Admin Farmasi', 'TTK/Asisten Farmasi'].includes(role);

export default function NotificationCenter({ user: propUser }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const user = propUser || authUser;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [systemNotifs, setSystemNotifs] = useState([]);
  const [memos, setMemos] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const dropdownRef = useRef(null);

  const role = getRole(user);

  const loadAll = async () => {
    try {
      const [notifs, memoList, anomalyList, chatList] = await Promise.all([
        base44.entities.Notification.list('-created_date', 50).catch(() => []),
        base44.entities.Memo.list('-created_date', 20).catch(() => []),
        base44.entities.Anomaly.filter({ status: 'Baru' }, '-detected_at', 20).catch(() => []),
        base44.entities.ChatMessage.list('-timestamp', 10).catch(() => []),
      ]);
      setSystemNotifs((notifs || []).filter(n =>
        n.target_user_id === user?.id || n.target_role === role || (n.target_role === 'Apoteker' && isPharmacyRole(role)) || n.target_role === 'Semua' || !n.target_role
      ));
      setMemos((memoList || []).filter(m => m.target_role === 'All' || m.target_role === role));
      setAnomalies(anomalyList || []);
      setChatMsgs(chatList || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (user) loadAll(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      base44.entities.Notification.subscribe(() => loadAll()),
      base44.entities.Memo.subscribe(() => loadAll()),
      base44.entities.Anomaly.subscribe(() => loadAll()),
      base44.entities.ChatMessage.subscribe(() => loadAll()),
    ];
    return () => unsubs.forEach(u => u && u());
  }, [user]);

  const unreadMemos = memos.filter(m => user && !(m.read_by || []).includes(user.id));
  const unreadSystem = systemNotifs.filter(n => !n.is_read && n.status !== 'Selesai');
  const newAnomalies = anomalies;

  const allItems = [
    ...chatMsgs.map(m => ({
      id: `chat-${m.id}`, type: 'chat', _raw: m,
      title: m.sender_name, body: m.message, time: m.timestamp,
      priority: 'Normal', status: 'Selesai', isRead: true, path: '/comms',
      icon: MessageSquare, iconColor: 'bg-teal-50 text-teal-600',
    })),
    ...unreadMemos.map(m => ({
      id: `memo-${m.id}`, type: 'memo', _raw: m,
      title: m.subject, body: m.body, time: m.created_date,
      priority: m.priority || 'Normal', status: 'Baru', isRead: false, path: '/comms',
      icon: FileText, iconColor: m.priority === 'Mendesak' ? 'bg-rose-50 text-rose-600' : m.priority === 'Penting' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600',
    })),
    ...newAnomalies.map(a => ({
      id: `anomaly-${a.id}`, type: 'anomaly', _raw: a,
      title: a.description, body: `Perlu diperiksa: ${a.type}`, time: a.detected_at,
      priority: a.severity === 'critical' ? 'Mendesak' : 'Penting', status: 'Baru', isRead: false, path: '/kontrol-usaha',
      icon: AlertTriangle, iconColor: a.severity === 'critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600',
    })),
    ...unreadSystem.map(n => ({
      id: `system-${n.id}`, type: 'system', _raw: n,
      title: n.title, body: n.body, time: n.created_date,
      priority: n.priority || 'Normal', status: n.status || 'Baru', isRead: n.is_read,
      path: n.action_payload ? safeParsePath(n.action_payload) : null,
      icon: TYPE_ICONS[n.type] || Bell,
      iconColor: n.priority === 'Mendesak' ? 'bg-rose-50 text-rose-600' : n.priority === 'Penting' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-muted-foreground',
      actionLabel: n.action_label, reply: n.reply, from_user_name: n.from_user_name,
    })),
  ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

  const badgeCount = unreadMemos.length + newAnomalies.length + unreadSystem.length;
  const filtered = tab === 'all' ? allItems : allItems.filter(i => i.type === tab);

  const markRead = async (item) => {
    if (item.type === 'system' && item._raw?.id && !item._raw.is_read) {
      await base44.entities.Notification.update(item._raw.id, { is_read: true, status: item._raw.status === 'Baru' ? 'Dibaca' : item._raw.status }).catch(() => {});
      loadAll();
    }
    if (item.type === 'memo' && item._raw?.id && user) {
      await base44.entities.Memo.update(item._raw.id, { read_by: [...(item._raw.read_by || []), user.id] }).catch(() => {});
      loadAll();
    }
    if (item.type === 'anomaly' && item._raw?.id) {
      await base44.entities.Anomaly.update(item._raw.id, { status: 'Dilihat' }).catch(() => {});
      loadAll();
    }
  };

  const handleItemClick = (item) => {
    markRead(item);
    if (item.type === 'system') {
      setExpandedId(expandedId === item.id ? null : item.id);
      setReplyText(item._raw?.reply || '');
    } else if (item.path) {
      navigate(item.path);
      setOpen(false);
    }
  };

  const sendReply = async (item) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await base44.entities.Notification.update(item._raw.id, {
        reply: replyText.trim(),
        replied_by: user?.full_name || user?.email || 'Pengguna',
        replied_at: new Date().toISOString(),
        status: 'Ditanggapi',
      });
      setReplyText('');
      setExpandedId(null);
      loadAll();
    } catch {}
    setReplying(false);
  };

  const markSelesai = async (item) => {
    try {
      await base44.entities.Notification.update(item._raw.id, { status: 'Selesai' });
      setExpandedId(null);
      loadAll();
    } catch {}
  };

  const markAllRead = async () => {
    for (const n of unreadSystem) {
      await base44.entities.Notification.update(n.id, { is_read: true, status: n.status === 'Baru' ? 'Dibaca' : n.status }).catch(() => {});
    }
    if (user) {
      for (const m of unreadMemos) {
        await base44.entities.Memo.update(m.id, { read_by: [...(m.read_by || []), user.id] }).catch(() => {});
      }
    }
    for (const a of newAnomalies) {
      await base44.entities.Anomaly.update(a.id, { status: 'Dilihat' }).catch(() => {});
    }
    loadAll();
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <>
      <button onClick={() => setOpen(!open)} className="relative p-1.5 hover:bg-muted rounded-md transition-colors" title="Pemberitahuan">
        <Bell className="w-4 h-4" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div ref={dropdownRef} className="absolute right-0 top-10 z-50 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-md shadow-xl">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <h3 className="text-section-title flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Pemberitahuan
                {badgeCount > 0 && <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full">{badgeCount}</span>}
              </h3>
              <div className="flex items-center gap-1">
                {badgeCount > 0 && <button onClick={markAllRead} className="text-caption text-primary hover:text-primary-hover font-medium">Tandai semua dibaca</button>}
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="flex border-b border-border overflow-x-auto">
              {TABS.map(t => {
                const count = t.k === 'all' ? badgeCount :
                  t.k === 'chat' ? chatMsgs.length :
                  t.k === 'memo' ? unreadMemos.length :
                  t.k === 'anomaly' ? newAnomalies.length :
                  unreadSystem.length;
                return (
                  <button key={t.k} onClick={() => setTab(t.k)}
                    className={`px-3 py-1.5 text-caption font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    {t.l}
                    {count > 0 && <span className="ml-1 text-[10px] bg-muted px-1 py-0.5 rounded">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[480px] overflow-y-auto">
              {loading && <p className="px-3 py-6 text-center text-caption text-muted-foreground">Memuat…</p>}
              {!loading && filtered.length === 0 && (
                <div className="px-3 py-10 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                  <p className="text-caption text-muted-foreground">Tidak ada pemberitahuan</p>
                </div>
              )}
              {filtered.map(item => {
                const Icon = item.icon;
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id} className={`border-b border-border last:border-0 ${!item.isRead ? 'bg-primary/5' : ''}`}>
                    <div className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer" onClick={() => handleItemClick(item)}>
                      <div className="flex items-start gap-2">
                        <div className={`w-7 h-7 rounded shrink-0 flex items-center justify-center ${item.iconColor}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-body font-medium truncate">{item.title}</p>
                            {!item.isRead && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                          </div>
                          <p className="text-caption mt-0.5 line-clamp-2">{item.body}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`pill ${PRIORITY_STYLES[item.priority] || 'pill-inactive'}`}>{item.priority}</span>
                            {item.status && item.status !== 'Selesai' && <span className={`pill ${STATUS_STYLES[item.status] || 'pill-inactive'}`}>{item.status}</span>}
                            <span className="text-caption text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {formatTime(item.time)}</span>
                            {item.from_user_name && <span className="text-caption text-muted-foreground">• dari {item.from_user_name}</span>}
                          </div>
                        </div>
                        {item.type === 'system' ? (
                          <Reply className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : item.path ? (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : null}
                      </div>
                    </div>

                    {/* Expanded reply section for system notifications */}
                    {isExpanded && item.type === 'system' && (
                      <div className="px-3 pb-3 pt-1 bg-muted/30 border-t border-border">
                        {item.reply && (
                          <div className="mb-2 px-2.5 py-2 bg-card border border-border rounded text-caption">
                            <p className="font-medium text-foreground mb-0.5">Tanggapan Anda:</p>
                            <p>{item.reply}</p>
                            {item._raw?.replied_at && <p className="text-muted-foreground mt-1">{new Date(item._raw.replied_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>}
                          </div>
                        )}
                        {item.status !== 'Selesai' ? (
                          <>
                            <textarea
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Tulis tanggapan..."
                              className="w-full px-2.5 py-2 border border-border rounded text-caption outline-none focus:border-primary resize-none"
                              rows={2}
                            />
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => sendReply(item)}
                                disabled={!replyText.trim() || replying}
                                className="flex items-center gap-1.5 btn-primary px-3 py-1.5 rounded text-caption font-medium disabled:opacity-50"
                              >
                                <Send className="w-3 h-3" /> Kirim Tanggapan
                              </button>
                              <button
                                onClick={() => markSelesai(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-caption font-medium hover:bg-muted"
                              >
                                <CheckCircle className="w-3 h-3" /> Tandai Selesai
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-caption text-emerald-600 flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> Pemberitahuan sudah selesai</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-3 py-2 border-t border-border flex items-center justify-between">
              <Link to="/comms" className="text-caption text-primary hover:text-primary-hover font-medium flex items-center gap-1" onClick={() => setOpen(false)}>
                <MessageSquare className="w-3 h-3" /> Buka Komunikasi Internal
              </Link>
              <span className="text-caption text-muted-foreground">{filtered.length} item</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function safeParsePath(payload) {
  try { return JSON.parse(payload)?.path || null; } catch { return null; }
}
