import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, Download, FileText, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  loadPrintConfig, buildPrescriptionData, generatePrescriptionHTML,
  printPrescriptionHTML, downloadPrescriptionPDF, logPrintAction, getCachedConfig,
} from '@/lib/printEngine';

const PRINT_REASONS = [
  { value: 'Normal', label: 'Resep Baru / Normal' },
  { value: 'Tidak Ditebus', label: 'Tidak Ditebus — Cetak Resep' },
  { value: 'Belum Ditebus', label: 'Belum Ditebus' },
  { value: 'Ditebus Sebagian', label: 'Ditebus Sebagian' },
  { value: 'Obat Tidak Tersedia', label: 'Obat Tidak Tersedia' },
  { value: 'Iter', label: 'Iter (Ulang Resep)' },
];

export default function PrescriptionPrintModal({ rx, patient, doctor, initialPrintReason, allowIncomplete = false, onClose }) {
  const { user } = useAuth();
  const [config, setConfig] = useState(getCachedConfig());
  const [printReason, setPrintReason] = useState(initialPrintReason || (rx?.tebus_status === 'Tidak Ditebus' ? 'Tidak Ditebus' : 'Normal'));
  const [previewHTML, setPreviewHTML] = useState('');
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isUnredeemedFlow = rx?.tebus_status === 'Tidak Ditebus' || initialPrintReason === 'Tidak Ditebus';
  const missingPrintFields = useMemo(() => {
    const data = buildPrescriptionData(rx, patient, doctor, config);
    return [
      !data.clinic.name && 'nama fasilitas',
      !data.clinic.address && 'alamat fasilitas',
      !data.clinic.phone && 'telepon fasilitas',
      !(doctor?.display_name || doctor?.full_name || rx?.doctor_name) && 'nama dokter',
      !data.doctor.sip && 'SIP dokter',
      !(rx?.patient_name || patient?.full_name) && 'nama pasien',
      !(data.patient.age || data.patient.weight) && 'usia atau berat badan pasien',
      !data.patient.address && 'alamat pasien',
      !data.patient.phone && 'telepon pasien',
    ].filter(Boolean);
  }, [rx, patient, doctor, config]);

  const requiredPrintFields = allowIncomplete
    ? missingPrintFields.filter((field) => ['nama fasilitas', 'alamat fasilitas', 'telepon fasilitas', 'nama pasien'].includes(field))
    : missingPrintFields;

  useEffect(() => {
    (async () => {
      const cfg = await loadPrintConfig();
      setConfig(cfg);
      const data = buildPrescriptionData(rx, patient, doctor, cfg);
      setPreviewHTML(generatePrescriptionHTML(data, cfg, initialPrintReason || (rx?.tebus_status === 'Tidak Ditebus' ? 'Tidak Ditebus' : 'Normal')));
    })();
  }, [rx, patient, doctor]);

  useEffect(() => {
    const data = buildPrescriptionData(rx, patient, doctor, config);
    setPreviewHTML(generatePrescriptionHTML(data, config, printReason));
  }, [printReason, config, rx, patient, doctor]);

  const handlePrint = async () => {
    if (requiredPrintFields.length) return;
    setPrinting(true);
    try {
      printPrescriptionHTML(previewHTML, config.prescription_paper_size || 'A5');
      await logPrintAction({
        user,
        prescriptionNumber: rx?.prescription_number,
        printReason,
        documentType: 'Resep',
        details: { method: 'print' },
      });
    } catch (e) { console.error(e); }
    setPrinting(false);
  };

  const handleDownloadPDF = async () => {
    if (requiredPrintFields.length) return;
    setDownloading(true);
    try {
      const number = rx?.prescription_number || 'resep';
      await downloadPrescriptionPDF(
        previewHTML,
        config.prescription_paper_size || 'A5',
        `Resep-${number}.pdf`,
      );
      await logPrintAction({
        user,
        prescriptionNumber: rx?.prescription_number,
        printReason,
        documentType: 'Resep (PDF)',
        details: { method: 'download' },
      });
    } catch (e) { console.error(e); }
    setDownloading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-md shadow-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" /> Cetak Resep Profesional
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Status Penebusan:</span>
          </div>
          {isUnredeemedFlow ? (
            <span className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700">
              Tidak Ditebus — Cetak Resep Saja
            </span>
          ) : (
            <select
              value={printReason}
              onChange={e => setPrintReason(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs bg-card outline-none focus:border-primary"
            >
              {PRINT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            Ukuran: {config.prescription_paper_size || 'A5'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
          <div className="bg-white shadow-md mx-auto" style={{ maxWidth: '580px' }}>
            <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
          </div>
        </div>

        {missingPrintFields.length > 0 && (
          <div className={`px-4 py-2.5 border-y flex items-start gap-2 text-xs ${allowIncomplete ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{allowIncomplete ? 'Data tambahan belum tersedia pada data resep ini: ' : 'Cetak resep final dikunci sampai data dilengkapi: '}<strong>{missingPrintFields.join(', ')}</strong>{allowIncomplete ? '. Resep tetap dicetak memakai data yang tersedia tanpa mengubah teks asli dokter.' : '.'}</span>
          </div>
        )}

        {rx?.tebus_status === 'Tidak Ditebus' && (
          <div className="px-4 py-2 bg-rose-50 border-y border-rose-200 flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-3.5 h-3.5" />
            Resep tidak ditebus: dokumen ini hanya mencetak resep dokter dan tidak membuat proses POS, dispensing, atau etiket farmasi.
          </div>
        )}

        {rx?.tebus_status === 'Sebagian' && (
          <div className="px-4 py-2 bg-amber-50 border-y border-amber-200 flex items-center gap-2 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5" />
            Resep ditebus sebagian — {rx.tebus_remaining || 0} item belum diserahkan akan ditandai sebagai SISA.
          </div>
        )}

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <button
            onClick={handlePrint}
            disabled={printing || downloading || requiredPrintFields.length > 0}
            className="flex-1 flex items-center justify-center gap-1.5 btn-primary py-2.5 rounded text-sm font-medium disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> {printing ? 'Membuka…' : 'Print Langsung'}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={printing || downloading || requiredPrintFields.length > 0}
            className="flex-1 flex items-center justify-center gap-1.5 border border-primary text-primary hover:bg-primary/5 py-2.5 rounded text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {downloading ? 'Menyiapkan…' : 'Unduh PDF'}
          </button>
          <button onClick={onClose} className="px-4 border border-border rounded text-sm hover:bg-muted">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
