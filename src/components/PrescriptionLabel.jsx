import React, { useEffect, useMemo, useState } from 'react';
import { X, Printer, Download, Pill } from 'lucide-react';
import { classifyLabelRoute, getCachedConfig, loadPrintConfig } from '@/lib/printEngine';

/**
 * Etiket untuk resep non-racikan.
 * Warna mengikuti rute pemakaian: putih untuk obat dalam dan biru untuk obat luar.
 */
export default function PrescriptionLabel({ rx, item, onClose }) {
  const [printConfig, setPrintConfig] = useState(() => getCachedConfig());
  const route = useMemo(() => classifyLabelRoute(item), [item]);
  const isExternal = route.type === 'blue';

  useEffect(() => {
    let active = true;
    loadPrintConfig().then((config) => {
      if (active) setPrintConfig(config);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const labelColor = isExternal ? 'blue' : 'white';
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const labelData = useMemo(() => ({
    patient_name: rx?.patient_name || '—',
    medicine_name: item?.medicine_name || '—',
    strength: item?.strength || '',
    dosage: item?.dosage || item?.instructions || '',
    quantity: item?.quantity || 0,
    date: today,
    is_external: isExternal,
    clinic_name: printConfig.clinic_name || 'KlinikFarma',
  }), [rx, item, today, isExternal, printConfig.clinic_name]);

  const handlePrint = () => {
    const printContents = document.getElementById('prescription-label-print').innerHTML;
    const win = window.open('', '', 'width=400,height=600');
    win.document.write(`
      <html><head><title>Etiket - ${labelData.medicine_name}</title>
      <style>
        @page { size: 70mm 40mm; margin: 0; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 9px; margin: 0; padding: 3px; }
        .lbl-bg-${labelColor} { background: ${isExternal ? '#dbeafe' : '#ffffff'}; border: 1px solid ${isExternal ? '#3b82f6' : '#cbd5e1'}; }
        .lbl-header { font-size: 9px; font-weight: 700; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 2px; }
        .lbl-pasien { font-weight: 600; font-size: 10px; }
        .lbl-obat { font-size: 9px; font-weight: 600; }
        .lbl-signa { font-size: 12px; font-weight: 700; text-align: center; background: ${isExternal ? '#bfdbfe' : '#f0f0f0'}; padding: 2px; margin: 2px 0; border-radius: 2px; }
        .lbl-jumlah { font-size: 9px; font-weight: 600; }
        .lbl-footer { font-size: 7px; text-align: center; margin-top: 2px; border-top: 1px dotted #999; padding-top: 1px; }
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
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [70, 40] });
      let y = 3;
      // Background color for external
      if (isExternal) {
        doc.setFillColor(219, 234, 254);
        doc.rect(0, 0, 70, 40, 'F');
      }
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text(labelData.clinic_name.slice(0, 32), 35, y, { align: 'center' });
      y += 2;
      doc.setLineWidth(0.2);
      doc.line(2, y, 68, y);
      y += 3;
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text('Pasien:', 2, y);
      doc.setFont(undefined, 'bold');
      doc.text(labelData.patient_name.slice(0, 28), 12, y);
      y += 3;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text(labelData.medicine_name.slice(0, 30), 2, y);
      if (labelData.strength) {
        y += 2.5;
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(labelData.strength, 2, y);
      }
      y += 3;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`Signa: ${labelData.dosage || '-'}`, 35, y, { align: 'center' });
      y += 4;
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text(`Jumlah: ${labelData.quantity}`, 2, y);
      y += 2;
      if (isExternal) {
        doc.setFontSize(6);
        doc.text('Obat Luar', 2, y);
        y += 2;
      }
      doc.setLineWidth(0.1);
      doc.line(2, y, 68, y);
      y += 2;
      doc.setFontSize(5);
      doc.text(labelData.date, 35, y, { align: 'center' });
      doc.save(`Etiket-${labelData.medicine_name}-${Date.now()}.pdf`);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" /> Cetak Etiket
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 flex justify-center bg-muted/30">
          <div id="prescription-label-print" className={`p-3 w-[240px] min-h-[130px] shadow-sm border-2 ${isExternal ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-300'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
            <div className="text-center text-[9px] font-bold border-b border-slate-400 pb-1 mb-1.5">{labelData.clinic_name}</div>
            <div className="text-[9px] flex justify-between mb-0.5">
              <span>Pasien:</span><span className="font-semibold">{labelData.patient_name}</span>
            </div>
            <div className="text-[10px] font-bold mb-0.5">{labelData.medicine_name}</div>
            {labelData.strength && <div className="text-[8px] text-slate-600 mb-1">{labelData.strength}</div>}
            <div className={`text-[12px] font-bold text-center py-1 my-1 rounded ${isExternal ? 'bg-blue-200' : 'bg-slate-100'}`}>
              Signa: {labelData.dosage || '-'}
            </div>
            <div className="text-[9px] font-semibold">Jumlah: {labelData.quantity}</div>
            {isExternal && <div className="text-[7px] text-blue-700 font-semibold mt-1">Obat Luar</div>}
            <div className="text-[6px] text-center mt-2 border-t border-dotted border-slate-400 pt-1">{labelData.date}</div>
          </div>
        </div>

        <div className="px-3 py-2 flex items-center gap-2 bg-muted/20">
          <span className={`pill ${isExternal ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-slate-700 border-slate-300'}`}>
            {isExternal ? '🔵 Etiket Biru (Obat Luar)' : '⚪ Etiket Putih (Obat Dalam)'}
          </span>
          {route.requiresVerification && <span className="text-[10px] text-amber-700">Rute belum diverifikasi — lengkapi di Master Obat sebelum cetak.</span>}
        </div>

        <div className="px-3 py-2.5 border-t border-border flex gap-2">
          <button onClick={handlePrint} disabled={route.requiresVerification} className="flex-1 flex items-center justify-center gap-1.5 btn-primary py-2 rounded text-xs font-medium disabled:opacity-50">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={handleDownloadPDF} disabled={route.requiresVerification} className="flex-1 flex items-center justify-center gap-1.5 border border-border py-2 rounded text-xs font-medium hover:bg-muted disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>
    </div>
  );
}
