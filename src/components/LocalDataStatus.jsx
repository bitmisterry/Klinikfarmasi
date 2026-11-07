import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export default function LocalDataStatus() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleConflict = (event) => setMessage(event.detail?.message || 'Data berubah di tab lain. Muat ulang sebelum melanjutkan.');
    globalThis.addEventListener?.('local-db-conflict', handleConflict);
    return () => globalThis.removeEventListener?.('local-db-conflict', handleConflict);
  }, []);

  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] w-[min(440px,calc(100vw-2rem))] rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 shadow-xl">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="flex-1"><strong>Perubahan lintas-tab terdeteksi</strong><p className="mt-1 leading-relaxed">{message}</p><button onClick={() => globalThis.location?.reload()} className="mt-2 inline-flex items-center gap-1 rounded border border-amber-400 bg-white px-2 py-1 font-medium"><RefreshCw className="h-3 w-3" /> Muat ulang data</button></div>
        <button onClick={() => setMessage('')} className="rounded p-1 hover:bg-amber-100"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
