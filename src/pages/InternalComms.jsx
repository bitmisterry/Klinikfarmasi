const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { MessageSquare, FileText, Send, Bell, Users } from 'lucide-react';

import ChatPanel from '@/components/ChatPanel';
import MemoPanel from '@/components/MemoPanel';
import ModuleStatHeader from '@/components/ModuleStatHeader';

export default function InternalComms() {
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') === 'memo' ? 'memo' : 'chat');
  const [stats, setStats] = useState({ messages: 0, memos: 0, unreadMemos: 0, channels: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [msgs, memos] = await Promise.all([
          db.entities.ChatMessage.list().catch(() => []) || [],
          db.entities.Memo.list().catch(() => []) || [],
        ]);
        setStats({
          messages: msgs.length,
          memos: memos.length,
          unreadMemos: memos.filter(m => !m.is_read).length,
          channels: new Set(msgs.map(m => m.channel || m.room || 'general')).size,
        });
      } catch {}
    };
    load();
  }, []);

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div>
        <h1 className="text-lg font-medium">Komunikasi Internal</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Live chat antar staff & memo pengumuman internal klinik</p>
      </div>

      <ModuleStatHeader stats={[
        { icon: Send, label: 'Total Pesan', value: stats.messages, color: 'text-blue-600' },
        { icon: Users, label: 'Channel Aktif', value: stats.channels, color: 'text-teal-600' },
        { icon: FileText, label: 'Total Memo', value: stats.memos, color: 'text-amber-600' },
        { icon: Bell, label: 'Memo Belum Dibaca', value: stats.unreadMemos, color: 'text-rose-600' },
      ]} />

      <div className="flex gap-1 border-b border-border">
        {[
          { k: 'chat', l: 'Live Chat', icon: MessageSquare },
          { k: 'memo', l: 'Memo', icon: FileText },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.l}
          </button>
        ))}
      </div>

      {tab === 'chat' ? <ChatPanel /> : <MemoPanel />}
    </div>
  );
}
