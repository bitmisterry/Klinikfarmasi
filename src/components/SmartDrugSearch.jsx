const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ScanLine, Pill, MapPin, Tag, Info, ArrowRight, Package } from 'lucide-react';

import { recordSubstitution } from '@/lib/pharmacy';
import DrugInfoDrawer from './DrugInfoDrawer';
import SubstitutionPanel from './SubstitutionPanel';

export default function SmartDrugSearch({ onSelect, compact = false, onRequestPengadaan = null, otcOnly = false }) {
  const [query, setQuery] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [subMed, setSubMed] = useState(null);

  useEffect(() => {
    db.entities.Medicine.list().then(m => {
      setMedicines(m || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return medicines
      .filter(m => !otcOnly || ['Obat Bebas', 'Obat Bebas Terbatas'].includes(m.category))
      .map(m => {
        let score = 0;
        const name = (m.name || '').toLowerCase();
        const generic = (m.generic_name || '').toLowerCase();
        const substance = (m.active_substance || '').toLowerCase();
        const barcode = m.barcode || '';
        const strength = (m.strength || '').toLowerCase();

        if (barcode === q) score = 1000;
        else if (name.startsWith(q)) score = 100;
        else if (generic.startsWith(q) || substance.startsWith(q)) score = 90;
        else if (name.includes(q)) score = 70;
        else if (generic.includes(q) || substance.includes(q)) score = 60;
        else if (strength.includes(q)) score = 40;
        else if (m.manufacturer?.toLowerCase().includes(q)) score = 20;

        const isBarcode = /^\d{8,}$/.test(query.trim());
        if (isBarcode && barcode.includes(q)) score = 1000;

        return { ...m, _score: score };
      })
      .filter(m => m._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 12);
  }, [query, medicines, otcOnly]);

  // Find alternatives by active substance
  const getAlternatives = (med) => {
    if (!med?.active_substance) return [];
    return medicines.filter(m =>
      m.id !== med.id &&
      m.active_substance?.toLowerCase() === med.active_substance.toLowerCase()
    );
  };

  return (
    <>
      <div className="panel-accent">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="w-4 h-4 text-primary" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Cari obat: nama, generik, atau barcode…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded border border-border hover:bg-muted">
            <ScanLine className="w-3.5 h-3.5" /> Scan
          </button>
        </div>

        {showResults && query.trim() && (
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Mencari…</p>}
            {!loading && results.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Tidak ada obat ditemukan untuk "{query}"</p>
            )}
            {results.map(m => {
              const outOfStock = (m.stock_on_hand || 0) <= 0;
              const lowStock = (m.stock_on_hand || 0) > 0 && (m.stock_on_hand || 0) <= (m.min_stock || 0);
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 px-3 py-2 border-b border-border last:border-0 hover:bg-slate-50 cursor-pointer ${outOfStock ? 'opacity-60' : ''}`}
                  onClick={() => { setSelected(m); setShowResults(false); }}
                >
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.name}</span>
                      {m.product_type && m.product_type !== 'Obat' && (
                        <span className="pill pill-inactive">{m.product_type}</span>
                      )}
                      {outOfStock ? (
                        <span className="pill pill-critical">STOK HABIS</span>
                      ) : lowStock ? (
                        <span className="pill pill-warning">Stok Rendah</span>
                      ) : (
                        <span className="pill pill-success">Tersedia</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span>{m.active_substance} {m.strength}</span>
                      <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{m.shelf_location || '-'}</span>
                      <span className="flex items-center gap-0.5"><Tag className="w-3 h-3" />Rp {(m.selling_price || 0).toLocaleString('id-ID')}</span>
                      <span>Tersedia {m.stock_on_hand || 0} {m.unit}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelected(m); }}
                    className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                    title="Lihat Informasi Obat"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {outOfStock && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSubMed(m); }}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700 px-2 py-1 rounded border border-amber-300 hover:bg-amber-50 flex items-center gap-0.5"
                      title="Lihat Obat Sejenis"
                    >
                      <ArrowRight className="w-3 h-3" /> Obat Sejenis
                    </button>
                  )}
                  {outOfStock && onRequestPengadaan && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRequestPengadaan(m); }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded border border-blue-300 hover:bg-blue-50 flex items-center gap-0.5"
                      title="Ajukan pengadaan ke apotek"
                    >
                      <Package className="w-3 h-3" /> Ajukan
                    </button>
                  )}
                  {!outOfStock && onSelect && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(m); }}
                      className="text-xs font-medium text-primary hover:text-primary-hover px-2 py-1 rounded border border-primary/30 hover:bg-primary/5"
                    >
                      + Tambah
                    </button>
                  )}
                </div>
              );
            })}
            {!loading && results.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/50">
                {results.length} obat ditemukan • Obat habis tetap ditampilkan (meredup)
              </div>
            )}
          </div>
        )}

        {!query.trim() && !compact && (
          <div className="px-3 py-4">
            <p className="text-xs text-muted-foreground mb-2">Cari obat berdasarkan nama dagang, generik, zat aktif, atau barcode.</p>
            <div className="flex flex-wrap gap-1.5">
              {['amox', 'paracetamol', 'obat demam', 'antialergi', 'maag'].map(tag => (
                <button key={tag} onClick={() => setQuery(tag)} className="pill pill-info hover:bg-teal-100 cursor-pointer">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {subMed && (
        <SubstitutionPanel
          medicine={subMed}
          allMedicines={medicines}
          onSelect={(m) => {
            recordSubstitution(subMed, m, 'AutoLearned');
            onSelect?.(m);
            setSubMed(null);
          }}
          onClose={() => setSubMed(null)}
        />
      )}

      {selected && (
        <DrugInfoDrawer
          medicine={selected}
          onClose={() => setSelected(null)}
          onSelect={onSelect}
        />
      )}
    </>
  );
}
