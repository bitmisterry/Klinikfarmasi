import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, Download, FlaskConical, Edit3, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  loadPrintConfig, buildRacikanLabelData, buildRacikanLabelHTML, printRacikanLabel,
  saveRacikanLabelPDF, logPrintAction, getLabelDimensions, getCachedConfig,
} from '@/lib/printEngine';

export default function RacikanLabelPrintModal({ racikan, computed, config: racikanConfig, onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState(getCachedConfig());
  const [editing, setEditing] = useState(false);
  const [storageInstructions, setStorageInstructions] = useState(
    racikan?.storage_instructions || racikan?.notes || ''
  );
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await loadPrintConfig();
      setConfig(cfg);
    })();
  }, []);

  const label = useMemo(() => {
    const base = buildRacikanLabelData(racikan, computed, config);
    return { ...base, storage_instructions: storageInstructions };
  }, [racikan, computed, config, storageInstructions]);

  const dims = getLabelDimensions(config);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printRacikanLabel(label, config);
      await logPrintAction({
        user,
        prescriptionNumber: label.rx_number,
        printReason: 'Normal',
        documentType: 'Label Racikan',
        details: { racikan_name: label.racikan_name },
      });
    } catch (e) {
      toast({ title: 'Gagal mencetak', description: e.message, variant: 'destructive' });
    }
    setPrinting(false);
  };

  const handleDownload = async () => {
    setPrinting(true);
    try {
      await saveRacikanLabelPDF(label, config, `Label-Racikan-${label.racikan_name || Date.now()}.pdf`);
      await logPrintAction({
        user,
        prescriptionNumber: label.rx_number,
        printReason: 'Normal',
        documentType: 'Label Racikan (PDF)',
        details: { racikan_name: label.racikan_name },
      });
    } catch (e) {
      toast({ title: 'Gagal generate PDF', description: e.message, variant: 'destructive' });
    }
    setPrinting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" /> Cetak Etiket Racikan
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Ukuran: {dims.w}×{dims.h} mm</span>
          <button
            onClick={() => setEditing(!editing)}
            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded ${editing ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Edit3 className="w-3 h-3" /> Edit Instruksi
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-muted/20 flex justify-center">
          <div
            className="shadow-sm"
            dangerouslySetInnerHTML={{ __html: buildRacikanLabelHTML(label, config) }}
          />
        </div>

        {editing && (
          <div className="px-4 py-3 border-t border-border bg-amber-50/30 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-700">
              <Lock className="w-3 h-3" />
              Instruksi penyimpanan pada racikan harus ditinjau farmasi; teks asli resep dokter tidak dapat diubah.
            </div>
            <div>
              <label className="micro-label">Instruksi Penyimpanan / Penggunaan</label>
              <input
                value={storageInstructions}
                onChange={e => setStorageInstructions(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded text-xs bg-card"
                placeholder="Kocok dahulu, simpan di lemari es, dll."
              />
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex-1 flex items-center justify-center gap-1.5 btn-primary py-2.5 rounded text-sm font-medium disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> {printing ? 'Memproses…' : 'Print'}
          </button>
          <button
            onClick={handleDownload}
            disabled={printing}
            className="flex items-center justify-center gap-1.5 px-4 border border-border rounded text-sm hover:bg-muted disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={onClose} className="px-4 border border-border rounded text-sm hover:bg-muted">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
