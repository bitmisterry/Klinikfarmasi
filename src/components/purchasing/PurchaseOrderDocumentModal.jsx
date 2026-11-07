import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Printer, ShieldCheck, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { logAuditAction } from '@/lib/roles';
import {
  downloadHTMLPDF,
  generatePurchaseOrderHTML,
  getCachedConfig,
  loadPrintConfig,
  printAdministrativeDocumentHTML,
} from '@/lib/printEngine';

const PRINTABLE_STATUSES = new Set(['Disetujui', 'Dikirim', 'Diterima', 'Diterima Sebagian']);

export default function PurchaseOrderDocumentModal({ po, supplier, user, onClose, onSaved }) {
  const { toast } = useToast();
  const [config, setConfig] = useState(getCachedConfig());
  const [busy, setBusy] = useState('');
  // The workflow status is authoritative. Older local demo rows can contain
  // a stale approval_status and must not unlock printing prematurely.
  const workflowStatus = po?.status || po?.approval_status || 'Draft';
  const printable = PRINTABLE_STATUSES.has(workflowStatus);
  const html = useMemo(() => generatePurchaseOrderHTML({
    po,
    supplier,
    config,
    printedBy: user?.full_name || user?.email || 'Petugas Farmasi',
  }), [po, supplier, config, user]);

  useEffect(() => {
    let mounted = true;
    loadPrintConfig(true).then((nextConfig) => {
      if (mounted) setConfig(nextConfig);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const recordDocumentAction = async (method) => {
    const timestamp = new Date().toISOString();
    const field = method === 'print' ? 'document_printed_at' : 'document_downloaded_at';
    try {
      const updated = await base44.entities.PurchaseOrder.update(po.id, {
        [field]: timestamp,
        document_type: 'Surat Pesanan',
        document_status: 'Tersedia',
        last_document_action: method,
      });
      onSaved?.(updated);
    } catch (error) {
      // Printing already succeeded; a local audit/update failure should not
      // make the user believe the document itself failed.
      console.error('Purchase order document metadata failed:', error);
    }
    await logAuditAction({
      action: method === 'print' ? 'print' : 'download',
      entity: 'PurchaseOrder',
      entity_id: po.id,
      entity_name: po.po_number,
      module: 'purchasing',
      description: `${method === 'print' ? 'Mencetak' : 'Mengunduh PDF'} Surat Pesanan ${po.po_number}`,
      metadata: { document_type: 'Surat Pesanan', status: po.status },
    });
  };

  const handlePrint = async () => {
    if (!printable || busy) return;
    setBusy('print');
    try {
      if (!printAdministrativeDocumentHTML(html, 'A4')) throw new Error('Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi.');
      await recordDocumentAction('print');
      toast({ title: 'Preview cetak SP dibuka', description: `${po.po_number} siap dicetak.` });
    } catch (error) {
      toast({ title: 'SP belum dapat dicetak', description: error.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const handleDownload = async () => {
    if (!printable || busy) return;
    setBusy('pdf');
    try {
      await downloadHTMLPDF(html, 'A4', `${po.po_number || 'Surat-Pesanan'}.pdf`);
      await recordDocumentAction('download');
      toast({ title: 'PDF SP berhasil diunduh', description: `${po.po_number}.pdf` });
    } catch (error) {
      toast({ title: 'PDF SP belum dapat dibuat', description: error.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><div><h2 className="text-sm font-semibold">Dokumen Surat Pesanan</h2><p className="text-[11px] text-muted-foreground">{po.po_number} • {po.status || 'Draft'}</p></div></div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Tutup"><X className="h-4 w-4" /></button>
      </header>
      {!printable && <div className="mx-4 mt-3 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Dokumen dapat dipratinjau, tetapi Print dan PDF baru aktif setelah SP disetujui APJ.</span></div>}
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4">
        <div className="mx-auto min-h-[760px] max-w-[820px] bg-white p-8 shadow-sm" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
        <button type="button" onClick={onClose} className="rounded border border-border px-3 py-2 text-xs hover:bg-muted">Tutup</button>
        <button type="button" onClick={handleDownload} disabled={!printable || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">{busy === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Unduh PDF</button>
        <button type="button" onClick={handlePrint} disabled={!printable || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{busy === 'print' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} Print</button>
      </footer>
    </div>
  </div>;
}
