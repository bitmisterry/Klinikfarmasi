import React, { useMemo } from 'react';
import { X, Printer, Download, FlaskConical } from 'lucide-react';
import { generateLabelData } from '@/lib/racikan';

export default function RacikanLabel({ racikan, computed, config, onClose }) {
  const label = useMemo(() => generateLabelData(racikan, computed, config), [racikan, computed, config]);

  const handlePrint = () => {
    const printContents = document.getElementById('racikan-label-print').innerHTML;
    const win = window.open('', '', 'width=400,height=600');
    win.document.write(`
      <html><head><title>Label Racikan - ${label.racikan_name}</title>
      <style>
        @page { size: 60mm 40mm; margin: 0; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 9px; margin: 0; padding: 4px; }
        .lbl-header { font-size: 10px; font-weight: 700; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 3px; }
        .lbl-row { display: flex; justify-content: space-between; margin: 1px 0; }
        .lbl-pasien { font-weight: 600; font-size: 10px; }
        .lbl-racikan { font-size: 9px; }
        .lbl-signa { font-size: 14px; font-weight: 700; text-align: center; background: #f0f0f0; padding: 3px; margin: 2px 0; border-radius: 2px; }
        .lbl-jumlah { font-size: 11px; font-weight: 600; }
        .lbl-components { font-size: 8px; color: #333; margin-top: 2px; }
        .lbl-footer { font-size: 7px; text-align: center; margin-top: 3px; border-top: 1px dotted #999; padding-top: 2px; }
      </style></head>
      <body>${printContents}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleDownloadPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [60, 40] });
      let y = 4;
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text(label.facility_name, 30, y, { align: 'center' });
      y += 3;
      doc.setLineWidth(0.2);
      doc.line(2, y, 58, y);
      y += 3;
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text(`Pasien:`, 2, y);
      doc.setFont(undefined, 'bold');
      doc.text(label.patient_name.slice(0, 28), 12, y);
      y += 3;
      doc.setFont(undefined, 'normal');
      doc.text(`${label.racikan_name} (${label.bentuk_racikan})`, 2, y);
      y += 3;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`Signa: ${label.signa}`, 30, y, { align: 'center' });
      y += 4;
      doc.setFontSize(8);
      doc.text(`Jumlah: ${label.jumlah} ${label.bentuk_racikan}`, 2, y);
      y += 3;
      doc.setFontSize(6);
      doc.setFont(undefined, 'normal');
      label.components.forEach(c => {
        doc.text(`• ${c.name.slice(0, 24)} ${c.dosis} (${c.ambil})`, 2, y);
        y += 2.5;
      });
      y += 1;
      if (label.instruksi) {
        doc.setFontSize(6);
        doc.text(`Cat: ${label.instruksi.slice(0, 40)}`, 2, y);
        y += 2.5;
      }
      doc.setLineWidth(0.1);
      doc.line(2, y, 58, y);
      y += 2;
      doc.setFontSize(5);
      doc.text(label.tanggal, 30, y, { align: 'center' });
      doc.save(`Label-${label.racikan_name}-${Date.now()}.pdf`);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" /> Cetak Label Racikan</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Label preview */}
        <div className="p-4 flex justify-center bg-muted/30">
          <div id="racikan-label-print" className="bg-white border border-slate-300 p-3 w-[220px] min-h-[140px] shadow-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            {label.label_header && <div className="lbl-header text-center text-[10px] font-bold border-b border-slate-400 pb-1 mb-1.5">{label.label_header}</div>}
            <div className="lbl-header text-center text-[10px] font-bold border-b border-slate-400 pb-1 mb-1.5">{label.facility_name}</div>
            <div className="text-[9px] flex justify-between mb-0.5">
              <span>Pasien:</span><span className="font-semibold">{label.patient_name}</span>
            </div>
            <div className="text-[9px] mb-1">{label.racikan_name} — {label.bentuk_racikan}</div>
            <div className="text-[13px] font-bold text-center bg-slate-100 py-1 my-1 rounded">Signa: {label.signa}</div>
            <div className="text-[10px] font-semibold mb-1">Jumlah: {label.jumlah} {label.bentuk_racikan}</div>
            <div className="text-[7px] text-slate-600 mt-1">
              {label.components.map((c, i) => <div key={i}>• {c.name} {c.dosis} ({c.ambil})</div>)}
            </div>
            {label.instruksi && <div className="text-[7px] mt-1 italic">Cat: {label.instruksi}</div>}
            <div className="text-[6px] text-center mt-2 border-t border-dotted border-slate-400 pt-1">{label.tanggal}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 py-2.5 border-t border-border flex gap-2">
          <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-1.5 btn-primary py-2 rounded text-xs font-medium">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={handleDownloadPDF} className="flex-1 flex items-center justify-center gap-1.5 border border-border py-2 rounded text-xs font-medium hover:bg-muted">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>
    </div>
  );
}