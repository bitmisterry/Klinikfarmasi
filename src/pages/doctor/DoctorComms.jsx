import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, FileText } from 'lucide-react';
import ChatPanel from '@/components/ChatPanel';
import MemoPanel from '@/components/MemoPanel';

export default function DoctorComms() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTabFromUrl = new URLSearchParams(location.search).get('tab') === 'memo' ? 'memo' : 'chat';
  const [tab, setTab] = useState(activeTabFromUrl);

  useEffect(() => setTab(activeTabFromUrl), [activeTabFromUrl]);

  const selectTab = (nextTab) => {
    setTab(nextTab);
    navigate(nextTab === 'memo' ? '/doctor/comms?tab=memo' : '/doctor/comms');
  };

  return (
    <div className="p-3 lg:p-5 max-w-5xl mx-auto space-y-3">
      <div>
        <h1 className="text-xl font-semibold">Komunikasi Internal</h1>
        <p className="text-xs text-muted-foreground">Live chat dengan staff & memo internal klinik</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => selectTab('chat')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Live Chat
        </button>
        <button
          onClick={() => selectTab('memo')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'memo' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" /> Memo Internal
        </button>
      </div>

      <div>
        {tab === 'chat' ? <ChatPanel /> : <MemoPanel />}
      </div>
    </div>
  );
}
