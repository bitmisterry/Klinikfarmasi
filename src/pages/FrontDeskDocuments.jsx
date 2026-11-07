import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Eye, FileCheck, FileText, Pill, RefreshCw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import FrontDeskPrintPreviewModal from '@/components/frontdesk/FrontDeskPrintPreviewModal';
import { generateAdministrativeDocumentHTML, getCachedConfig, loadPrintConfig, printAdministrativeDocumentHTML } from '@/lib/printEngine';

const TYPE_ICON = { prescription: Pill, sick_letter: FileCheck, external_referral: FileText, medical_summary: FileText, instructions: FileCheck, control_card: CalendarDays };
const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function FrontDeskDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [config, setConfig] = useState(getCachedConfig());
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState('');
  const [preview, setPreview] = useState(null);
  const [printing, setPrinting] = useState(false);
  const missingFacility = useMemo(() => ['clinic_name', 'clinic_address', 'clinic_phone'].filter((key) => !String(config?.[key] || '').trim()), [config]);

  const loadDocuments = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [queueResponse, printConfig] = await Promise.all([base44.functions.invoke('listFrontOfficeApprovedDocuments'), loadPrintConfig()]);
      setDocuments((queueResponse.data || queueResponse).documents || []);
      setConfig(printConfig);
    } catch (error) {
      toast({ title: 'Antrean dokumen belum dapat dimuat', description: error.message, variant: 'destructive' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const openPreview = async (entry) => {
    if (openingId) return;
    setOpeningId(entry.id);
    try {
      const response = await base44.functions.invoke('getFrontOfficeDocumentData', { patient_id: entry.patient_id, medical_record_id: entry.medical_record_id, type: entry.document_type });
      const documentData = response.data || response;
      setPreview({
        entry,
        documentData,
        html: generateAdministrativeDocumentHTML({ type: entry.document_type, patient: documentData.patient, medicalRecord: documentData.medical_record, config, printedBy: user?.full_name || 'Front Office' }),
      });
    } catch (error) {
      toast({ title: 'Dokumen belum dapat dibuka', description: error.message, variant: 'destructive' });
      await loadDocuments({ silent: true });
    } finally {
      setOpeningId('');
    }
  };

  const confirmPrint = async () => {
    if (!preview || printing) return;
    if (missingFacility.length) {
      toast({ title: 'Profil fasilitas belum lengkap', description: `Lengkapi ${missingFacility.join(', ')} di Pengaturan sebelum mencetak dokumen resmi.`, variant: 'destructive' });
      return;
    }
    setPrinting(true);
    try {
      if (!printAdministrativeDocumentHTML(preview.html, 'A4')) throw new Error('Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi.');
      await base44.functions.invoke('logAudit', {
        action: 'print', entity: 'MedicalRecord', entity_id: preview.documentData.medical_record?.id || preview.entry.medical_record_id,
        entity_name: preview.entry.patient_name, module: 'front_desk', description: `Front Office mencetak ${preview.entry.document_label} yang disetujui dokter`,
        metadata: { document_type: preview.entry.document_type, visit_id: preview.entry.visit_id },
      });
      toast({ title: 'Jendela cetak dibuka', description: 'Aksi cetak tercatat pada audit trail.' });
    } catch (error) {
      toast({ title: 'Dokumen belum dapat dicetak', description: error.message, variant: 'destructive' });
    } finally {
      setPrinting(false);
    }
  };

  return <div className="mx-auto max-w-6xl space-y-4 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-lg font-semibold">Dokumen Disetujui Dokter</h1><p className="mt-1 text-xs text-muted-foreground">Antrean otomatis dokumen dari Visit final. Tidak perlu mencari pasien atau memilih jenis dokumen secara manual.</p></div>
      <button type="button" onClick={() => loadDocuments()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Muat ulang</button>
    </div>
    <section className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11px] leading-4 text-blue-900"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Hanya dokumen yang telah disetujui dokter pada rekam medis final yang tampil di sini. Front Office dapat melihat pratinjau dan mencetak, tetapi tidak dapat mengubah isi klinis atau otorisasi dokter.</section>
    {missingFacility.length > 0 && <section className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">Pratinjau tetap dapat dibuka, tetapi cetak dokumen resmi dinonaktifkan sampai profil fasilitas dilengkapi: {missingFacility.join(', ')}.</section>}
    <section className="panel overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><FileCheck className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Siap diproses</h2></div><span className="pill pill-info">{documents.length} dokumen</span></header>
      {loading ? <p className="px-4 py-10 text-center text-xs text-muted-foreground">Memuat antrean dokumen…</p> : documents.length === 0 ? <div className="px-4 py-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" /><p className="mt-2 text-sm font-medium">Belum ada dokumen yang menunggu dicetak</p><p className="mt-1 text-xs text-muted-foreground">Dokumen akan muncul otomatis setelah dokter menyetujui dan memfinalkan Visit.</p></div> : <div className="divide-y divide-border">
        {documents.map((entry) => {
          const Icon = TYPE_ICON[entry.document_type] || FileText;
          const opening = openingId === entry.id;
          return <article key={entry.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"><div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="text-sm font-semibold">{entry.document_label}</h3><span className="pill pill-success">Disetujui dokter</span></div><p className="mt-1 text-xs font-medium">{entry.patient_name} <span className="font-normal text-muted-foreground">• {entry.patient_mr_number || 'No. RM belum tersedia'}</span></p><p className="mt-0.5 text-[11px] text-muted-foreground">Visit {entry.visit_id || '—'} • Dokter: {entry.doctor_name} • Disetujui {formatDateTime(entry.approved_at)}</p></div><button type="button" onClick={() => openPreview(entry)} disabled={Boolean(openingId)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50">{opening ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}{opening ? 'Menyiapkan…' : 'Lihat & Cetak'}</button></article>;
        })}
      </div>}
    </section>
    {preview && <FrontDeskPrintPreviewModal entry={preview.entry} html={preview.html} printDisabled={missingFacility.length > 0} printing={printing} onClose={() => setPreview(null)} onPrint={confirmPrint} />}
  </div>;
}
