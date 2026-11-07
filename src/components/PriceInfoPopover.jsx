import React, { useState } from 'react';
import { HelpCircle, ShieldAlert, TrendingUp, AlertTriangle } from 'lucide-react';

// "Kenapa harga ini?" — penjelasan transparan untuk Harga Jual / Harga Minimum Aman.
export default function PriceInfoPopover({ hpp, minSafePrice, targetMargin, sellingPrice, protected: isProtected, highestOldHpp, oldStockValue, rounding }) {
  const [open, setOpen] = useState(false);
  const belowMin = sellingPrice > 0 && minSafePrice > 0 && sellingPrice < minSafePrice;
  // Seluruh modul pembelian memakai gross margin: (harga jual - HPP) / harga jual.
  // Jangan tampilkan markup di popover karena akan menyesatkan user saat membandingkan target.
  const actualMargin = hpp > 0 && sellingPrice > 0 ? ((sellingPrice - hpp) / sellingPrice) * 100 : 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-primary"
        title="Kenapa harga ini?"
      >
        <HelpCircle className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full right-0 mt-1 w-72 bg-card border border-border rounded-md shadow-lg p-3 text-[11px] space-y-2">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-border">
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              <p className="font-semibold text-xs">Kenapa harga ini?</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">HPP per unit</span>
                <span className="font-medium">Rp {(hpp || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target gross margin</span>
                <span className="font-medium">{targetMargin || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga Minimum Aman</span>
                <span className={`font-medium ${belowMin ? 'text-rose-600' : 'text-emerald-600'}`}>
                  Rp {(minSafePrice || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga jual</span>
                <span className="font-medium">Rp {(sellingPrice || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margin aktual</span>
                <span className={`font-medium ${actualMargin < (targetMargin || 0) ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {actualMargin.toFixed(1)}%
                </span>
              </div>
            </div>
            {isProtected && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5">
                <ShieldAlert className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-amber-800">
                  Perlindungan stok lama aktif. Masih ada stok HPP Rp {(highestOldHpp || 0).toLocaleString('id-ID')} (nilai Rp {(oldStockValue || 0).toLocaleString('id-ID')}).
                  Harga Minimum Aman dilindungi agar stok lama tidak rugi.
                </p>
              </div>
            )}
            {belowMin ? (
              <div className="bg-rose-50 border border-rose-200 rounded p-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 text-rose-600 mt-0.5 shrink-0" />
                <p className="text-rose-800">Harga jual di bawah Harga Minimum Aman. Akan otomatis dinaikkan saat faktur disimpan.</p>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded p-2 flex items-start gap-1.5">
                <TrendingUp className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-emerald-800">Harga jual aman — di atas Harga Minimum Aman dengan margin {actualMargin.toFixed(1)}%.</p>
              </div>
            )}
            {rounding > 0 && (
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Harga dibulatkan ke atas ke kelipatan Rp {rounding.toLocaleString('id-ID')}.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
