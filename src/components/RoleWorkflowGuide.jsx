import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ClipboardCheck, Pill, Receipt, Stethoscope, UserRoundPlus } from 'lucide-react';

const GUIDE = {
  'Front Office': {
    icon: UserRoundPlus,
    label: 'Registrasi & serah-terima',
    input: 'Identitas pasien, keluhan awal, poli, dokter, dan jadwal praktik.',
    action: 'Buat satu Visit/Encounter, panggil pasien, lalu konfirmasi kedatangan.',
    output: 'Visit dan antrean yang sama diteruskan ke Perawat / Intake.',
    boundary: 'Tidak membuka rekam medis, harga layanan, atau laporan keuangan.',
  },
  Perawat: {
    icon: ClipboardCheck,
    label: 'Pemeriksaan awal',
    input: 'Visit yang sudah dikonfirmasi hadir oleh Front Office.',
    action: 'Catat keluhan, alergi, vital sign, kesiapan ruang, dan alat steril.',
    output: 'Intake tersimpan sebagai catatan tambahan dan pasien masuk antrean Dokter.',
    boundary: 'Tidak dapat menulis diagnosis, resep, atau mengubah catatan dokter.',
  },
  Dokter: {
    icon: Stethoscope,
    label: 'Pemeriksaan & order klinis',
    input: 'Visit yang ditugaskan dengan data intake read-only.',
    action: 'Terima pasien, finalisasi anamnesis, diagnosis, tindakan, resep, atau rujukan.',
    output: 'RME, order, resep, serta tagihan klinik terbentuk pada Visit yang sama.',
    boundary: 'Hanya pasien yang ditugaskan atau dirujuk yang dapat dibuka.',
  },
  Farmasi: {
    icon: Pill,
    label: 'Verifikasi & dispensing resep',
    input: 'Resep digital, item obat, alergi/peringatan relevan, dan Visit asal.',
    action: 'Verifikasi, siapkan, catat jumlah diserahkan, cetak etiket, atau kembalikan resep ke Dokter.',
    output: 'Status resep dan invoice farmasi diperbarui untuk Kasir.',
    boundary: 'Tidak dapat mengubah isi klinis resep atau membuka RME di luar resep terkait.',
  },
  Kasir: {
    icon: Receipt,
    label: 'Konsolidasi tagihan & pembayaran',
    input: 'Invoice Posted dari layanan klinik dan/atau Farmasi pada Visit yang sama.',
    action: 'Periksa rincian, catat metode dan nominal pembayaran, lalu terbitkan kuitansi.',
    output: 'Payment tersimpan; sistem hanya menutup Visit setelah seluruh prasyarat final.',
    boundary: 'Tidak dapat membuat tagihan baru atau mengubah harga layanan/obat.',
  },
};

const statusLabel = (visit) => visit?.workflow_status || visit?.status || 'Belum dipilih';
const shortId = (value) => value ? String(value).replace(/^encounter-/, 'ENC-').slice(0, 28) : '-';

export default function RoleWorkflowGuide({ role, visit = null, compact = false, collapsible = false }) {
  const guide = GUIDE[role];
  const [expanded, setExpanded] = useState(false);
  if (!guide) return null;
  const Icon = guide.icon;
  const encounterId = visit?.encounter_id || visit?.visit_id;
  const queueId = visit?.queue_entry_id || visit?.id;

  if (collapsible && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-expanded="false"
        className="flex w-full items-center justify-between rounded-md border border-primary/20 bg-primary/[0.035] px-3 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/[0.08]"
      >
        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> Tampilkan panduan peran dokter</span>
        <ChevronDown className="h-4 w-4" />
      </button>
    );
  }

  return (
    <section className={`rounded-md border border-primary/20 bg-primary/[0.035] ${compact ? 'px-3 py-2' : 'p-3'}`} aria-label={`Panduan peran ${role}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold">Peran Anda: {guide.label}</p>
            {visit && <span className="pill pill-info text-[10px]">Status: {statusLabel(visit)}</span>}
          </div>
          {!compact && (
            <div className="mt-1.5 grid gap-1 text-[11px] leading-relaxed md:grid-cols-2">
              <p><span className="font-medium">Input:</span> {guide.input}</p>
              <p><span className="font-medium">Aksi:</span> {guide.action}</p>
              <p className="text-emerald-800"><span className="font-medium">Hasil:</span> {guide.output}</p>
              <p className="text-amber-800"><span className="font-medium">Batasan:</span> {guide.boundary}</p>
            </div>
          )}
          {visit && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              <span>Patient ID: <b className="font-mono text-foreground">{shortId(visit.patient_id)}</b></span>
              <span>Visit ID: <b className="font-mono text-foreground">{shortId(encounterId)}</b></span>
              <span>Queue ID: <b className="font-mono text-foreground">{shortId(queueId)}</b></span>
              {visit.handoff_to && <span className="inline-flex items-center gap-1 text-primary">Serah-terima: {visit.handoff_to} <ArrowRight className="h-3 w-3" /></span>}
            </div>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded="true"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
            >
              <ChevronDown className="h-3.5 w-3.5 rotate-180" /> Sembunyikan panduan
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
