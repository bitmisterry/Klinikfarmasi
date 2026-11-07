const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, BarChart3, ToggleRight, ToggleLeft, X, Sparkles } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole, isAdmin } from '@/lib/roles';

const CATEGORIES = ['Menu & Fitur', 'Cara Melakukan', 'Pertanyaan'];

export default function SearchHelpSettings() {
  const [tab, setTab] = useState('panduan');
  const [guides, setGuides] = useState([]);
  const [terms, setTerms] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editingTerm, setEditingTerm] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const clinicRole = getClinicRole(user);
  const canManage = isAdmin(clinicRole);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [g, t, l] = await Promise.all([
        db.entities.SearchGuide.list().catch(() => []),
        db.entities.SearchTerm.list().catch(() => []),
        db.entities.SearchLog.list('-searched_at', 200).catch(() => []),
      ]);
      setGuides(g || []);
      setTerms(t || []);
      setLogs(l || []);
    } catch {}
    setLoading(false);
  };

  const saveGuide = async (data) => {
    try {
      if (data.id) {
        await db.entities.SearchGuide.update(data.id, data);
      } else {
        await db.entities.SearchGuide.create({ ...data, is_default: false });
      }
      toast({ title: 'Panduan tersimpan' });
      setEditing(null);
      loadAll();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
  };

  const toggleGuide = async (g) => {
    try {
      await db.entities.SearchGuide.update(g.id, { is_active: !g.is_active });
      loadAll();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const deleteGuide = async (g) => {
    if (g.is_default) {
      toast({ title: 'Panduan bawaan tidak bisa dihapus', description: 'Nonaktifkan saja.', variant: 'destructive' });
      return;
    }
    if (!confirm('Hapus panduan ini?')) return;
    try {
      await db.entities.SearchGuide.delete(g.id);
      loadAll();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const saveTerm = async (data) => {
    try {
      if (data.id) {
        await db.entities.SearchTerm.update(data.id, data);
      } else {
        await db.entities.SearchTerm.create({ ...data, is_default: false });
      }
      toast({ title: 'Istilah tersimpan' });
      setEditingTerm(null);
      loadAll();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
  };

  const deleteTerm = async (t) => {
    if (t.is_default) {
      toast({ title: 'Istilah bawaan tidak bisa dihapus', variant: 'destructive' });
      return;
    }
    if (!confirm('Hapus istilah ini?')) return;
    try {
      await db.entities.SearchTerm.delete(t.id);
      loadAll();
    } catch (e) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  // Reports
  const foundLogs = logs.filter(l => l.found);
  const notFoundLogs = logs.filter(l => !l.found);
  const frequentMap = {};
  foundLogs.forEach(l => {
    const key = l.query?.toLowerCase().trim();
    if (key) frequentMap[key] = (frequentMap[key] || 0) + 1;
  });
  const frequentSorted = Object.entries(frequentMap).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const notFoundMap = {};
  notFoundLogs.forEach(l => {
    const key = l.query?.toLowerCase().trim();
    if (key) notFoundMap[key] = (notFoundMap[key] || 0) + 1;
  });
  const notFoundSorted = Object.entries(notFoundMap).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const TABS = [
    { k: 'panduan', l: 'Panduan', icon: Sparkles },
    { k: 'istilah', l: 'Istilah Pencarian', icon: Search },
    { k: 'laporan', l: 'Laporan Pencarian', icon: BarChart3 },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-section-title flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" /> Cari & Bantuan
        </h2>
        <p className="text-caption mt-0.5">Kelola istilah, panduan, dan lihat laporan pencarian pengguna.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.l}
          </button>
        ))}
      </div>

      {loading && <p className="text-caption text-center py-6">Memuat…</p>}

      {/* PANDUAN */}
      {tab === 'panduan' && !loading && (
        <div className="space-y-2">
          {canManage && (
            <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Tambah Panduan
            </button>
          )}
          <div className="panel divide-y divide-border">
            {guides.map(g => (
              <div key={g.id} className="px-3 py-2.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{g.title}</p>
                    <span className="pill pill-info">{g.category}</span>
                    {g.is_default && <span className="pill pill-inactive">Bawaan</span>}
                    {!g.is_active && <span className="pill pill-warning">Nonaktif</span>}
                  </div>
                  <p className="text-caption mt-0.5 line-clamp-1">{g.description}</p>
                  {(g.keywords || []).length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Kata: {(g.keywords || []).slice(0, 5).join(', ')}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{g.page_label || g.page_path}</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleGuide(g)} className="p-1.5 hover:bg-muted rounded" title={g.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                      {g.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <button onClick={() => setEditing(g)} className="p-1.5 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    {!g.is_default && <button onClick={() => deleteGuide(g)} className="p-1.5 hover:bg-rose-50 rounded text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ISTILAH */}
      {tab === 'istilah' && !loading && (
        <div className="space-y-2">
          {canManage && (
            <button onClick={() => setEditingTerm({})} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Tambah Istilah
            </button>
          )}
          <div className="panel divide-y divide-border">
            {terms.map(t => (
              <div key={t.id} className="px-3 py-2.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.canonical}</p>
                  <p className="text-caption mt-0.5">Kata lain: {(t.synonyms || []).join(', ')}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.page_label || t.page_path}</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditingTerm(t)} className="p-1.5 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    {!t.is_default && <button onClick={() => deleteTerm(t)} className="p-1.5 hover:bg-rose-50 rounded text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LAPORAN */}
      {tab === 'laporan' && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="panel">
            <div className="px-3 py-2.5 border-b border-border">
              <h3 className="text-sm font-semibold">Yang Sering Dicari</h3>
            </div>
            <div className="p-3 space-y-1.5">
              {frequentSorted.length === 0 && <p className="text-caption text-center py-4">Belum ada data</p>}
              {frequentSorted.map(([q, count]) => (
                <div key={q} className="flex justify-between text-xs px-2 py-1 bg-muted/30 rounded">
                  <span className="text-muted-foreground">{q}</span>
                  <span className="font-medium">{count}×</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="px-3 py-2.5 border-b border-border">
              <h3 className="text-sm font-semibold">Tidak Menemukan Jawaban</h3>
            </div>
            <div className="p-3 space-y-1.5">
              {notFoundSorted.length === 0 && <p className="text-caption text-center py-4 text-emerald-600">Tidak ada — semua pencarian ketemu 👍</p>}
              {notFoundSorted.map(([q, count]) => (
                <div key={q} className="flex justify-between text-xs px-2 py-1 bg-amber-50 rounded">
                  <span className="text-amber-700">"{q}"</span>
                  <span className="font-medium text-amber-700">{count}×</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit guide modal */}
      {editing && (
        <GuideEditor guide={editing} onSave={saveGuide} onClose={() => setEditing(null)} />
      )}
      {editingTerm && (
        <TermEditor term={editingTerm} onSave={saveTerm} onClose={() => setEditingTerm(null)} />
      )}
    </div>
  );
}

function GuideEditor({ guide, onSave, onClose }) {
  const [form, setForm] = useState({
    title: guide.title || '',
    category: guide.category || 'Menu & Fitur',
    keywords: (guide.keywords || []).join(', '),
    description: guide.description || '',
    steps: (guide.steps || []).join('\n'),
    page_path: guide.page_path || '',
    page_label: guide.page_label || '',
    action_label: guide.action_label || 'Buka',
    action_type: guide.action_type || 'navigate',
    action_param: guide.action_param || '',
    required_permission: guide.required_permission || '',
    is_active: guide.is_active !== false,
    ...guide,
  });

  const submit = () => {
    if (!form.title) return;
    onSave({
      ...form,
      keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
      steps: form.steps.split('\n').map(s => s.trim()).filter(Boolean),
    });
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">{guide.id ? 'Edit Panduan' : 'Tambah Panduan'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-caption">Judul</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-caption">Kategori</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-caption">Hak Akses (module key)</label>
              <input value={form.required_permission} onChange={e => setForm({ ...form, required_permission: e.target.value })} className={inputCls} placeholder="opsional" />
            </div>
          </div>
          <div>
            <label className="text-caption">Kata Pencarian (pisah koma)</label>
            <textarea value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} className={inputCls} rows={2} />
          </div>
          <div>
            <label className="text-caption">Penjelasan Singkat</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} rows={2} />
          </div>
          <div>
            <label className="text-caption">Langkah (satu per baris, untuk "Tunjukkan Caranya")</label>
            <textarea value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })} className={inputCls} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-caption">Path Halaman</label>
              <input value={form.page_path} onChange={e => setForm({ ...form, page_path: e.target.value })} className={inputCls} placeholder="/patients" />
            </div>
            <div>
              <label className="text-caption">Lokasi Tampil</label>
              <input value={form.page_label} onChange={e => setForm({ ...form, page_label: e.target.value })} className={inputCls} placeholder="Pelayanan › Pasien" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-caption">Teks Tombol</label>
              <input value={form.action_label} onChange={e => setForm({ ...form, action_label: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-caption">Tipe Aksi</label>
              <select value={form.action_type} onChange={e => setForm({ ...form, action_type: e.target.value })} className={inputCls}>
                <option value="navigate">Buka</option>
                <option value="navigate_with_param">Buka + Param</option>
              </select>
            </div>
            <div>
              <label className="text-caption">Param (mis. action=new)</label>
              <input value={form.action_param} onChange={e => setForm({ ...form, action_param: e.target.value })} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
            Aktif
          </label>
        </div>
        <div className="px-4 py-3 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted">Batal</button>
          <button onClick={submit} className="px-3 py-1.5 btn-primary rounded text-xs font-medium">Simpan</button>
        </div>
      </div>
    </div>
  );
}

function TermEditor({ term, onSave, onClose }) {
  const [form, setForm] = useState({
    canonical: term.canonical || '',
    synonyms: (term.synonyms || []).join(', '),
    page_path: term.page_path || '',
    page_label: term.page_label || '',
    is_active: term.is_active !== false,
    ...term,
  });

  const submit = () => {
    if (!form.canonical) return;
    onSave({
      ...form,
      synonyms: form.synonyms.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">{term.id ? 'Edit Istilah' : 'Tambah Istilah'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-caption">Istilah Resmi</label>
            <input value={form.canonical} onChange={e => setForm({ ...form, canonical: e.target.value })} className={inputCls} placeholder="Harga Beli / HPP Obat" />
          </div>
          <div>
            <label className="text-caption">Kata Lain / Sinonim (pisah koma)</label>
            <textarea value={form.synonyms} onChange={e => setForm({ ...form, synonyms: e.target.value })} className={inputCls} rows={3} placeholder="hpp, harga pokok, modal obat" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-caption">Path Halaman</label>
              <input value={form.page_path} onChange={e => setForm({ ...form, page_path: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-caption">Lokasi Tampil</label>
              <input value={form.page_label} onChange={e => setForm({ ...form, page_label: e.target.value })} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
            Aktif
          </label>
        </div>
        <div className="px-4 py-3 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted">Batal</button>
          <button onClick={submit} className="px-3 py-1.5 btn-primary rounded text-xs font-medium">Simpan</button>
        </div>
      </div>
    </div>
  );
}