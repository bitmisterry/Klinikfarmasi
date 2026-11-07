import React, { useState } from 'react';
import { Stethoscope, Plus, Trash2, Search, X } from 'lucide-react';
import { getClinicalCatalog } from '@/lib/clinicalCatalogs';

export const COMMON_TINDAKAN = getClinicalCatalog({ role: 'Dokter Umum' }).procedures;

export default function TindakanPanel({ procedures, onChange, specialty, role }) {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const catalog = getClinicalCatalog({ specialization: specialty, role });

  const filtered = catalog.procedures.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase())
  );

  const addTindakan = (t) => {
    onChange([...procedures, { ...t, quantity: 1, subtotal: t.fee }]);
    setShowSearch(false);
    setSearch('');
  };

  const addCustom = () => {
    onChange([...procedures, { name: 'Tindakan Custom', code: 'TND-CUSTOM', fee: 0, quantity: 1, subtotal: 0 }]);
  };

  const updateItem = (idx, field, value) => {
    const items = [...procedures];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'fee' || field === 'quantity') {
      items[idx].subtotal = (items[idx].fee || 0) * (items[idx].quantity || 1);
    }
    onChange(items);
  };

  const removeItem = (idx) => {
    onChange(procedures.filter((_, i) => i !== idx));
  };

  const total = procedures.reduce((s, p) => s + (p.subtotal || 0), 0);

  return (
    <div className="space-y-2">
      {/* Add tindakan */}
      <div className="flex gap-2">
        <button onClick={() => setShowSearch(!showSearch)} className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-md text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Pilih Tindakan
        </button>
        <button onClick={addCustom} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs hover:bg-muted">
          <Plus className="w-3.5 h-3.5" /> Tindakan Custom
        </button>
      </div>

      {/* Search dropdown */}
      {showSearch && (
        <div className="panel relative">
          <p className="border-b border-border bg-muted/30 px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Katalog tindakan {catalog.label}</p>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari tindakan…"
              className="flex-1 bg-transparent outline-none text-xs"
            />
            <button onClick={() => setShowSearch(false)} className="p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-border">
            {filtered.map(t => (
              <button key={t.code} onClick={() => addTindakan(t)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left text-xs">
                <Stethoscope className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.code}</p>
                </div>
                <span className="font-medium text-emerald-600">Rp {t.fee.toLocaleString('id-ID')}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Tidak ditemukan</p>}
          </div>
        </div>
      )}

      {/* Tindakan list */}
      {procedures.length > 0 ? (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="px-3 py-2 micro-label">Tindakan</th>
                <th className="px-2 py-2 micro-label text-right">Tarif (Rp)</th>
                <th className="px-2 py-2 micro-label text-center">Qty</th>
                <th className="px-2 py-2 micro-label text-right">Subtotal</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {procedures.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input
                      value={p.name}
                      onChange={e => updateItem(i, 'name', e.target.value)}
                      className="w-full bg-transparent outline-none font-medium text-xs"
                    />
                    <input
                      value={p.code}
                      onChange={e => updateItem(i, 'code', e.target.value)}
                      className="w-full bg-transparent outline-none text-[10px] text-muted-foreground"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      value={p.fee}
                      onChange={e => updateItem(i, 'fee', +e.target.value)}
                      className="w-24 px-1 py-1 border border-border rounded text-right text-xs bg-card"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="number"
                      value={p.quantity}
                      min={1}
                      onChange={e => updateItem(i, 'quantity', +e.target.value)}
                      className="w-12 px-1 py-1 border border-border rounded text-center text-xs bg-card"
                    />
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-emerald-600">Rp {(p.subtotal || 0).toLocaleString('id-ID')}</td>
                  <td className="px-1 py-2">
                    <button onClick={() => removeItem(i)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border">
                <td colSpan={3} className="px-3 py-2.5 text-right font-semibold text-xs">Total Tindakan</td>
                <td className="px-2 py-2.5 text-right font-bold text-sm text-emerald-600">Rp {total.toLocaleString('id-ID')}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="panel p-6 text-center">
          <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs text-muted-foreground">Belum ada tindakan. Klik "Pilih Tindakan" untuk menambahkan.</p>
        </div>
      )}
    </div>
  );
}
