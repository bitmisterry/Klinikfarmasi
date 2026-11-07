import React from 'react';
import { Eye, Printer, X } from 'lucide-react';

export default function FrontDeskPrintPreviewModal({ entry, html, printDisabled, printing, onClose, onPrint }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3" onClick={onClose}>
    <section className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between border-b border-border px-4 py-3"><div className="flex min-w-0 items-start gap-2"><div className="rounded-md bg-primary/10 p-1.5 text-primary"><Eye className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold">Pratinjau {entry.document_label}</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{entry.patient_name} • {entry.patient_mr_number || 'No. RM belum tersedia'} • Visit {entry.visit_id || '—'}</p></div></div><button type="button" onClick={onClose} className="rounded p-1.5 hover:bg-muted" aria-label="Tutup pratinjau"><X className="h-4 w-4" /></button></header>
      <div className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-6"><div className="mx-auto min-h-[680px] max-w-[210mm] bg-white p-7 shadow-sm sm:p-10"><div dangerouslySetInnerHTML={{ __html: html }} /></div></div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3"><p className="text-[11px] text-muted-foreground">Pratinjau ini hanya-baca. Isi dokumen berasal dari persetujuan dokter pada Visit final.</p><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-2 text-xs hover:bg-muted">Kembali</button><button type="button" onClick={onPrint} disabled={printDisabled || printing} className="btn-primary inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs disabled:opacity-50"><Printer className="h-3.5 w-3.5" />{printing ? 'Membuka cetak…' : 'Cetak dari pratinjau'}</button></div></footer>
    </section>
  </div>;
}
