import React, { useEffect, useState } from 'react';
import { Clock3, Plus, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const EMPTY = { abbreviation: '', aliases: '', standard_meaning: '', context: 'Signa', notes: '' };

export default function PrescriptionDictionaryPanel({ clinicRole, user }) {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState('');
  const { toast } = useToast();
  const isAdminFarmasi = clinicRole === 'Admin Farmasi';
  const isApj = clinicRole === 'Apoteker Penanggung Jawab';

  const load = async () => {
    try { setEntries(await base44.entities.PrescriptionAbbreviation.list()); } catch { setEntries([]); }
  };
  useEffect(() => { load(); }, []);

  const saveProposal = async (event) => {
    event.preventDefault();
    if (!form.abbreviation.trim() || !form.standard_meaning.trim()) {
      toast({ title: 'Singkatan dan arti baku wajib diisi', variant: 'destructive' });
      return;
    }
    const payload = {
      ...form,
      abbreviation: form.abbreviation.trim(),
      aliases: form.aliases.trim(),
      standard_meaning: form.standard_meaning.trim(),
      approval_status: 'Diajukan',
      submitted_by: user?.full_name || 'Admin Farmasi',
      submitted_at: new Date().toISOString(),
    };
    try {
      if (editingId) await base44.entities.PrescriptionAbbreviation.update(editingId, payload);
      else await base44.entities.PrescriptionAbbreviation.create(payload);
      toast({ title: 'Usulan kamus disimpan', description: 'Entri baru hanya aktif setelah disetujui APJ.' });
      setForm(EMPTY); setEditingId(''); load();
    } catch (error) { toast({ title: 'Gagal menyimpan usulan', description: error.message, variant: 'destructive' }); }
  };

  const approve = async (entry, approval_status) => {
    try {
      await base44.entities.PrescriptionAbbreviation.update(entry.id, {
        approval_status,
        approved_by: user?.full_name || 'APJ',
        approved_at: new Date().toISOString(),
      });
      toast({ title: approval_status === 'Disetujui' ? 'Kamus disetujui' : 'Usulan ditolak' });
      load();
    } catch (error) { toast({ title: 'Gagal memperbarui persetujuan', description: error.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
        Parser hanya membaca singkatan berstatus <strong>Disetujui</strong>. Admin Farmasi mengajukan atau memperbarui arti/alias; APJ yang memberi persetujuan. Semua aksi tercatat pada audit trail.
      </div>
      {isAdminFarmasi && (
        <form onSubmit={saveProposal} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
          <p className="md:col-span-2 text-xs font-semibold">{editingId ? 'Ubah usulan kamus' : 'Usulkan singkatan baru'}</p>
          <input value={form.abbreviation} onChange={(event) => setForm((current) => ({ ...current, abbreviation: event.target.value }))} className="rounded border border-border px-2 py-1.5 text-xs" placeholder="Singkatan, mis. TDD" />
          <input value={form.aliases} onChange={(event) => setForm((current) => ({ ...current, aliases: event.target.value }))} className="rounded border border-border px-2 py-1.5 text-xs" placeholder="Alias dipisah koma" />
          <input value={form.standard_meaning} onChange={(event) => setForm((current) => ({ ...current, standard_meaning: event.target.value }))} className="rounded border border-border px-2 py-1.5 text-xs" placeholder="Arti baku" />
          <select value={form.context} onChange={(event) => setForm((current) => ({ ...current, context: event.target.value }))} className="rounded border border-border px-2 py-1.5 text-xs"><option>Signa</option><option>Subscriptio</option><option>Racikan</option><option>Header resep</option><option>Penutup resep</option></select>
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="md:col-span-2 rounded border border-border px-2 py-1.5 text-xs" rows={2} placeholder="Catatan alasan perubahan (opsional)" />
          <div className="md:col-span-2 flex gap-2 justify-end"><button type="button" onClick={() => { setForm(EMPTY); setEditingId(''); }} className="rounded border border-border px-3 py-1.5 text-xs">Batal</button><button className="btn-primary flex items-center gap-1.5 rounded px-3 py-1.5 text-xs"><Save className="h-3.5 w-3.5" /> Ajukan ke APJ</button></div>
        </form>
      )}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground"><tr><th className="px-3 py-2">Singkatan / alias</th><th className="px-3 py-2">Arti baku</th><th className="px-3 py-2">Konteks</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aksi</th></tr></thead>
          <tbody className="divide-y divide-border">{entries.map((entry) => <tr key={entry.id}><td className="px-3 py-2 font-mono">{entry.abbreviation}<span className="ml-1 font-sans text-muted-foreground">{entry.aliases ? `(${entry.aliases})` : ''}</span></td><td className="px-3 py-2">{entry.standard_meaning}</td><td className="px-3 py-2">{entry.context}</td><td className="px-3 py-2">{entry.approval_status === 'Disetujui' ? <span className="text-emerald-700">Disetujui</span> : entry.approval_status === 'Diajukan' ? <span className="text-amber-700">Diajukan</span> : <span className="text-rose-700">Ditolak</span>}</td><td className="px-3 py-2 whitespace-nowrap">{isAdminFarmasi && <button onClick={() => { setEditingId(entry.id); setForm({ abbreviation: entry.abbreviation || '', aliases: entry.aliases || '', standard_meaning: entry.standard_meaning || '', context: entry.context || 'Signa', notes: entry.notes || '' }); }} className="mr-2 text-primary hover:underline">Ubah</button>}{isApj && entry.approval_status === 'Diajukan' && <><button onClick={() => approve(entry, 'Disetujui')} className="mr-2 text-emerald-700 hover:underline">Setujui</button><button onClick={() => approve(entry, 'Ditolak')} className="text-rose-700 hover:underline">Tolak</button></>}</td></tr>)}</tbody>
        </table>
        {!entries.length && <p className="p-4 text-center text-xs text-muted-foreground">Belum ada entri kamus.</p>}
      </div>
      {isApj && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Tinjau arti dan alias sebelum menyetujui; entri yang disetujui langsung menjadi referensi parser.</p>}
      {isAdminFarmasi && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Plus className="h-3.5 w-3.5" /> Perubahan yang sudah disetujui tetap diajukan ulang bila artinya diubah.</p>}
    </div>
  );
}
