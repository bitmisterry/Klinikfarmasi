const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Plus, X } from 'lucide-react';

const DEFAULT_ITEMS = [
  { label: 'Review antrean hari ini', category: 'Review', done: false },
  { label: 'Lengkapi catatan pemeriksaan', category: 'Catatan', done: false },
  { label: 'Review feedback Farmasi', category: 'Farmasi', done: false },
  { label: 'Konfirmasi jadwal praktik', category: 'Jadwal', done: false },
];

export default function DoctorChecklist({ doctorId, doctorName }) {
  const [checklist, setChecklist] = useState(null);
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!doctorId) return;
    (async () => {
      try {
        const existing = await db.entities.DoctorChecklist.filter({
          doctor_id: doctorId,
          checklist_date: today,
        });
        if (existing && existing.length > 0) {
          setChecklist(existing[0]);
          setItems(existing[0].items || DEFAULT_ITEMS);
        }
      } catch {}
    })();
  }, [doctorId, today]);

  const toggle = async (idx) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], done: !newItems[idx].done };
    setItems(newItems);
    await saveChecklist(newItems);
  };

  const addItem = async () => {
    if (!newLabel.trim()) return;
    const newItems = [...items, { label: newLabel, category: 'Review', done: false }];
    setItems(newItems);
    setNewLabel('');
    setShowAdd(false);
    await saveChecklist(newItems);
  };

  const removeItem = async (idx) => {
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
    await saveChecklist(newItems);
  };

  const saveChecklist = async (newItems) => {
    const completed = newItems.filter(i => i.done).length;
    const data = {
      doctor_id: doctorId,
      doctor_name: doctorName,
      checklist_date: today,
      items: newItems,
      completed_count: completed,
      total_count: newItems.length,
    };
    try {
      if (checklist) {
        await db.entities.DoctorChecklist.update(checklist.id, data);
      } else {
        const created = await db.entities.DoctorChecklist.create(data);
        setChecklist(created);
      }
    } catch {}
  };

  const completed = items.filter(i => i.done).length;
  const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  return (
    <div className="panel">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" /> Checklist Hari Ini
        </h3>
        <span className="text-[11px] text-muted-foreground">{completed}/{items.length}</span>
      </div>
      <div className="px-3 py-2">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 group">
              <button onClick={() => toggle(idx)} className="shrink-0">
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </button>
              <span className={`text-xs flex-1 ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {item.label}
              </span>
              <span className="pill pill-inactive text-[9px]">{item.category}</span>
              <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        {showAdd ? (
          <div className="flex items-center gap-1.5 mt-2">
            <input
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Tambah checklist…"
              className="flex-1 px-2 py-1 border border-border rounded text-xs outline-none focus:border-primary"
            />
            <button onClick={addItem} className="btn-primary px-2 py-1 rounded text-xs">Tambah</button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary-hover">
            <Plus className="w-3.5 h-3.5" /> Tambah item
          </button>
        )}
      </div>
    </div>
  );
}