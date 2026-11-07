const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, FileCheck, Shield } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { CLINIC_ROLES } from '@/lib/roles';
import { logAuditAction } from '@/lib/roles';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';

const OWNER_TYPE_OPTIONS = ['Dokter', 'Staf', 'Pasien', 'Peralatan', 'Klinik', 'Supplier'];

export default function RequiredDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const all = await db.entities.RequiredDocument.list();
      setItems(all || []);
    } catch (e) {
      toast({ title: 'Gagal memuat', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setEditing({ owner_type: 'Dokter', clinic_role: '', document_name: '', category: '', has_expiry: false, sort_order: 0, is_active: true });
    setShowForm(true);
  };

  const save = async () => {
    if (!editing.document_name.trim()) { toast({ title: 'Nama dokumen wajib', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editing.id) {
        const { id, created_date, updated_date, created_by_id, ...data } = editing;
        await db.entities.RequiredDocument.update(id, data);
        await logAuditAction({ action: 'update', entity: 'RequiredDocument', entityId: id, entityName: editing.document_name, description: `Mengubah dokumen wajib "${editing.document_name}"`, module: 'user_role', severity: 'Warning' });
        toast({ title: 'Dokumen wajib diperbarui' });
      } else {
        const created = await db.entities.RequiredDocument.create(editing);
        await logAuditAction({ action: 'create', entity: 'RequiredDocument', entityId: created.id, entityName: editing.document_name, description: `Menambah dokumen wajib "${editing.document_name}"`, module: 'user_role', severity: 'Warning' });
        toast({ title: 'Dokumen wajib ditambahkan' });
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!confirm(`Hapus dokumen wajib "${item.document_name}"?`)) return;
    try {
      await db.entities.RequiredDocument.delete(item.id);
      await logAuditAction({ action: 'delete', entity: 'RequiredDocument', entityId: item.id, entityName: item.document_name, description: `Menghapus dokumen wajib "${item.document_name}"`, module: 'user_role', severity: 'Warning' });
      toast({ title: 'Dokumen wajib dihapus' });
      load();
    } catch (e) {
      toast({ title: 'Gagal menghapus', description: e.message, variant: 'destructive' });
    }
  };

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";

  // Group by owner_type
  const grouped = OWNER_TYPE_OPTIONS.map(ot => ({
    ownerType: ot,
    items: items.filter(i => i.owner_type === ot && i.is_active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  })).filter(g => g.items.length > 0);

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">Dokumen Wajib</h1>
          <p className="text-caption mt-0.5">Tentukan dokumen yang wajib dimiliki per jabatan — untuk cek kelengkapan</p>
        </div>
        <button onClick={startCreate} className="btn-primary px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      <ModuleStatHeader stats={[
        { icon: FileCheck, label: 'Total Dokumen Wajib', value: items.filter(i => i.is_active).length, color: 'text-teal-600' },
        { icon: Shield, label: 'Jenis Data', value: new Set(items.map(i => i.owner_type)).size, color: 'text-blue-600' },
        { icon: FileCheck, label: 'Dengan Masa Berlaku', value: items.filter(i => i.is_active && i.has_expiry).length, color: 'text-amber-600' },
      ]} />

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="panel"><EmptyState icon={FileCheck} title="Belum ada dokumen wajib" description="Tambahkan dokumen yang wajib dimiliki oleh dokter, staf, atau data lainnya" /></div>
      ) : (
        <div className="space-y-3">
          {grouped.map(g => (
            <div key={g.ownerType} className="panel">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <p className="text-section-title">{g.ownerType}</p>
                <span className="pill pill-inactive">{g.items.length} dokumen</span>
              </div>
              <div className="divide-y divide-border">
                {g.items.map(item => (
                  <div key={item.id} className="px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors group">
                    <FileCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium">{item.document_name}</p>
                        {item.category && <span className="pill pill-inactive text-[9px] px-1 py-0">{item.category}</span>}
                        {item.has_expiry && <span className="pill pill-warning text-[9px] px-1 py-0">Berlaku</span>}
                      </div>
                      {item.clinic_role && <p className="text-[10px] text-muted-foreground mt-0.5">Jabatan: {item.clinic_role}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing({ ...item }); setShowForm(true); }} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary" title="Edit"><Save className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(item)} className="p-1.5 hover:bg-rose-50 rounded text-rose-500" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">{editing.id ? 'Edit' : 'Tambah'} Dokumen Wajib</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-2.5">
              <div>
                <label className="micro-label">Nama Dokumen *</label>
                <input value={editing.document_name} onChange={e => setEditing({ ...editing, document_name: e.target.value })} className={inputCls} placeholder="mis. CV, STR, SIP, Kontrak" />
              </div>
              <div>
                <label className="micro-label">Jenis Data</label>
                <select value={editing.owner_type} onChange={e => setEditing({ ...editing, owner_type: e.target.value })} className={inputCls}>
                  {OWNER_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="micro-label">Jabatan (opsional)</label>
                <select value={editing.clinic_role || ''} onChange={e => setEditing({ ...editing, clinic_role: e.target.value })} className={inputCls}>
                  <option value="">Semua jabatan</option>
                  {CLINIC_ROLES.filter(r => !['Pasien', 'Staff'].includes(r)).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="micro-label">Kategori</label>
                <input value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} className={inputCls} placeholder="mis. Identitas, Izin & Profesi" />
              </div>
              <button
                onClick={() => setEditing(prev => ({ ...prev, has_expiry: !prev.has_expiry }))}
                className="flex items-center gap-2 text-xs font-medium hover:text-primary"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${editing.has_expiry ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                  {editing.has_expiry && <FileCheck className="w-3 h-3" />}
                </div>
                Dokumen ini memiliki masa berlaku
              </button>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-3 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted">Batal</button>
              <button onClick={save} disabled={saving} className="btn-primary px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}