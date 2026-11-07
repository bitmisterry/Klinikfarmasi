const db = globalThis.__B44_DB__ || { auth:{ me:async()=>null }, entities:new Proxy({}, { get:()=>({ list:async()=>[], filter:async()=>[], create:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({}) } } };

import React, { useEffect, useRef, useState } from 'react';
import { ArchiveX, Plus, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const semesterLabel = () => {
  const now = new Date();
  return `Semester ${now.getMonth() < 6 ? 'I' : 'II'} ${now.getFullYear()}`;
};

export default function DestructionRequestPanel() {
  const [medicines, setMedicines] = useState([]);
  const [requests, setRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [semester, setSemester] = useState(semesterLabel());
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [medicineRows, requestRows] = await Promise.all([
        db.entities.Medicine.list(),
        db.entities.InternalRequest.filter({ type: 'Pengajuan Pemusnahan Obat' }, '-created_date', 30),
      ]);
      setMedicines(medicineRows || []);
      setRequests(requestRows || []);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const addItem = () => setItems((current) => [...current, { medicine_id: '', quantity: 1, reason: 'Kedaluwarsa' }]);
  const setItem = (index, field, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const removeItem = (index) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await db.integrations.Core.UploadFile({ file });
      setAttachment({ url: result.file_url || result.file_uri, name: file.name });
      toast({ title: 'Berita acara dilampirkan' });
    } catch (error) { toast({ title: 'Gagal mengunggah berita acara', description: error.message, variant: 'destructive' }); }
    event.target.value = '';
  };

  const submit = async () => {
    const normalizedItems = items.map((item) => {
      const medicine = medicines.find((row) => row.id === item.medicine_id);
      return { ...item, quantity: Number(item.quantity), medicine_name: medicine?.name || '' };
    }).filter((item) => item.medicine_id && item.quantity > 0);
    if (!normalizedItems.length) { toast({ title: 'Tambahkan minimal satu obat dan jumlahnya', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const user = await db.auth.me();
      const request = await db.entities.InternalRequest.create({
        request_number: `PMN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
        type: 'Pengajuan Pemusnahan Obat',
        from_user_id: user?.id,
        from_user_name: user?.full_name || user?.email || 'Farmasi',
        from_role: user?.clinic_role || user?.data?.clinic_role || 'Farmasi',
        to_role: 'Apoteker Penanggung Jawab',
        subject: `Pemusnahan obat ${semester}`,
        message: notes || 'Pengajuan pemusnahan obat untuk ditinjau APJ.',
        semester,
        items: normalizedItems,
        attachment_url: attachment?.url || '',
        attachment_name: attachment?.name || '',
        status: 'Diajukan',
        priority: 'Penting',
        created_date: new Date().toISOString(),
      });
      await db.entities.AuditLog.create({ action: 'create', entity: 'InternalRequest', entity_id: request.id, entity_name: request.subject, module: 'farmasi_pemusnahan', description: `Pengajuan pemusnahan ${normalizedItems.length} item untuk ${semester}.`, user_name: user?.full_name || 'Farmasi', timestamp: new Date().toISOString() });
      toast({ title: 'Pengajuan pemusnahan dikirim ke APJ' });
      setItems([]); setNotes(''); setAttachment(null); load();
    } catch (error) { toast({ title: 'Gagal mengajukan pemusnahan', description: error.message, variant: 'destructive' }); }
    setSaving(false);
  };

  return <div className="space-y-3">
    <div><h2 className="text-sm font-semibold flex items-center gap-2"><ArchiveX className="w-4 h-4 text-rose-600" /> Pengajuan Pemusnahan Obat</h2><p className="text-[11px] text-muted-foreground mt-0.5">Pengajuan semesteran: catat obat, alasan, jumlah, dan lampirkan berita acara bila tersedia. Stok tidak dikurangi sebelum persetujuan.</p></div>
    <div className="panel p-3 space-y-2">
      <div className="flex gap-2"><input value={semester} onChange={(e) => setSemester(e.target.value)} className="flex-1 px-2 py-1.5 border border-border rounded text-xs" placeholder="Semester" /><button onClick={addItem} className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded text-xs hover:bg-muted"><Plus className="w-3.5 h-3.5" /> Item</button></div>
      {items.map((item, index) => <div key={index} className="grid grid-cols-[1fr_72px_140px_28px] gap-1.5">
        <select value={item.medicine_id} onChange={(e) => setItem(index, 'medicine_id', e.target.value)} className="px-2 py-1.5 border border-border rounded text-xs bg-card"><option value="">Pilih obat</option>{medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name} • stok {medicine.stock_on_hand || 0}</option>)}</select>
        <input type="number" min="1" value={item.quantity} onChange={(e) => setItem(index, 'quantity', e.target.value)} className="px-2 py-1.5 border border-border rounded text-xs" />
        <select value={item.reason} onChange={(e) => setItem(index, 'reason', e.target.value)} className="px-2 py-1.5 border border-border rounded text-xs bg-card"><option>Kedaluwarsa</option><option>Rusak</option><option>Recall</option><option>Lainnya</option></select>
        <button onClick={() => removeItem(index)} className="p-1 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>)}
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Catatan pengajuan / nomor berita acara…" className="w-full px-2 py-1.5 border border-border rounded text-xs" />
      <input ref={fileRef} type="file" className="hidden" accept="application/pdf,image/*" onChange={upload} />
      <div className="flex items-center justify-between gap-2"><button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-primary hover:underline"><Upload className="w-3.5 h-3.5" /> {attachment ? attachment.name : 'Unggah berita acara (PDF/gambar)'}</button><button onClick={submit} disabled={saving} className="btn-primary px-3 py-1.5 rounded text-xs disabled:opacity-50">{saving ? 'Mengirim…' : 'Ajukan ke APJ'}</button></div>
    </div>
    <div className="panel divide-y divide-border"><div className="px-3 py-2 text-xs font-medium">Riwayat Pengajuan</div>{requests.length === 0 ? <p className="px-3 py-4 text-xs text-muted-foreground">Belum ada pengajuan pemusnahan.</p> : requests.map((request) => <div key={request.id} className="px-3 py-2 text-xs"><p className="font-medium">{request.subject}</p><p className="text-[11px] text-muted-foreground">{(request.items || []).length} item • {request.status || 'Diajukan'} {request.attachment_name ? `• ${request.attachment_name}` : ''}</p></div>)}</div>
  </div>;
}
