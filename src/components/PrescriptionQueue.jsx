const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { Pill, AlertTriangle, AlertCircle, FileText, CheckCircle2, ChevronRight, FlaskConical, ShieldAlert, Info, Printer, Upload, RotateCcw, X } from 'lucide-react';

import { checkPrescriptionFlags, convertDoseToUnits } from '@/lib/pharmacy';
import { useAuth } from '@/lib/AuthContext';
import { formatMedicineLabel } from '@/lib/freeTextPrescription';

const prescriptionTimestamp = (rx) => {
  const values = [rx?.created_date, rx?.received_at, rx?.doctor_confirmed_at, rx?.signed_at, rx?.prescription_date];
  const parsed = values.map((value) => Date.parse(value || '')).find(Number.isFinite);
  return parsed ?? 0;
};

const sortNewestFirst = (items) => [...(items || [])].sort((left, right) => {
  const timeDiff = prescriptionTimestamp(right) - prescriptionTimestamp(left);
  if (timeDiff !== 0) return timeDiff;
  return String(right?.prescription_number || right?.id || '').localeCompare(
    String(left?.prescription_number || left?.id || ''),
    'id',
    { numeric: true },
  );
});

export default function PrescriptionQueue({ onDispense, onPrint, refreshKey = 0, onTebus, onPIO, onScan, onLabel, onQuickPatient, onDrugInfo }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [actionError, setActionError] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returningRx, setReturningRx] = useState(null);
  const [returnCategory, setReturnCategory] = useState('stok_habis');
  const [returnCustomNote, setReturnCustomNote] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    load();
  }, [refreshKey]);

  const load = async () => {
    setLoading(true);
    try {
      const [rxs, meds] = await Promise.all([
        db.entities.Prescription.filter(
          { status: { $in: ['Diresepkan', 'Terkonfirmasi Dokter', 'Terverifikasi Farmasi', 'Dispensing'] } },
          '-created_date',
          50
        ),
        db.entities.Medicine.list(),
      ]);
      // Seed/legacy data may not have created_date. Sorting again on the client
      // keeps the visible queue newest-first using the best available timestamp
      // and the prescription number as a deterministic tie-breaker.
      setPrescriptions(sortNewestFirst(rxs));
      setMedicines(meds || []);
    } catch {}
    setLoading(false);
  };

  const getFlags = (rx) => {
    const parserFlags = (rx.active_flags || []).map((flag) => ({
      ...flag,
      source: 'parser',
      severity: flag.severity === 'red' ? 'critical' : 'warning',
    }));
    return [...parserFlags, ...checkPrescriptionFlags(rx.items || [], medicines)];
  };

  const getItemStock = (medicine_id) => {
    const m = medicines.find(x => x.id === medicine_id);
    return m ? (m.stock_on_hand || 0) : 0;
  };

  const isVerified = (rx) => rx.workflow_status === 'VERIFIED' || rx.status === 'Terverifikasi Farmasi' || rx.status === 'Dispensing';

  const handleVerify = async (rx) => {
    const hasBlockingFlag = (rx.active_flags || []).some((flag) => flag.severity === 'red');
    if (hasBlockingFlag) {
      setActionError('Resep masih memiliki FLAG MERAH. Kembalikan ke dokter untuk revisi; farmasi tidak boleh meneruskan resep ini.');
      return;
    }
    await db.entities.Prescription.update(rx.id, {
      status: 'Terverifikasi Farmasi',
      workflow_status: 'VERIFIED',
      received_at: rx.received_at || new Date().toISOString(),
      verified_at: new Date().toISOString(),
      verified_by: user?.full_name || 'Apoteker',
      verified_by_id: user?.id || '',
      verification_note: 'Teks asli, interpretasi sistem, dan FLAG ditinjau oleh farmasi.',
      verification_flags_snapshot: rx.active_flags || [],
    });
    setActionError('');
    load();
  };

  const handleDispense = async (rx) => {
    if (!isVerified(rx)) {
      setActionError('Verifikasi farmasi wajib dilakukan setelah membaca teks asli dan interpretasi resep sebelum dispensing.');
      return;
    }
    if (rx.status !== 'Dispensing') {
      await db.entities.Prescription.update(rx.id, {
        status: 'Dispensing',
        workflow_status: 'PROCESSING',
        received_at: new Date().toISOString(),
      });
      const orders = await db.entities.Order.filter({ source_id: rx.id });
      for (const order of orders) await db.entities.Order.update(order.id, { status: 'PROCESSING' });
    }
    onDispense?.(rx);
    setActionError('');
    load();
  };

  const openReturnModal = (rx) => {
    setReturningRx(rx);
    const unavailableItems = (rx.items || []).filter((item) => {
      if (item.is_racikan || item.racikan_template_id) return false;
      return getItemStock(item.medicine_id) < Number(item.quantity || 1);
    });
    if (unavailableItems.length > 0) {
      setReturnCategory('stok_habis');
      setReturnCustomNote(`Stok obat tidak mencukupi untuk: ${unavailableItems.map((item) => formatMedicineLabel(item.medicine_name, item.strength)).join(', ')}`);
    } else {
      setReturnCategory('dosis_racikan');
      setReturnCustomNote('');
    }
    setReturnModalOpen(true);
  };

  const handleConfirmReturn = async () => {
    if (!returningRx) return;
    setIsSubmittingReturn(true);
    setActionError('');
    try {
      const reasonLabel = {
        stok_habis: 'Stok obat tidak mencukupi / habis di apotek',
        dosis_racikan: 'Perlu konfirmasi / penyesuaian dosis atau bentuk racikan',
        substitusi: 'Obat tidak tersedia di formularium / perlu alternatif',
        aturan_pakai: 'Signa / aturan pakai perlu klarifikasi dokter',
        lainnya: 'Catatan farmasi',
      }[returnCategory] || 'Perlu revisi dokter';

      const fullReason = returnCustomNote.trim()
        ? `${reasonLabel}: ${returnCustomNote.trim()}`
        : reasonLabel;

      const unavailableItems = (returningRx.items || [])
        .filter((item) => !item.is_racikan && !item.racikan_template_id && getItemStock(item.medicine_id) < Number(item.quantity || 1))
        .map((item) => ({ medicine_id: item.medicine_id, medicine_name: item.medicine_name }));

      await db.entities.Prescription.update(returningRx.id, {
        status: 'Dikembalikan ke Dokter',
        workflow_status: 'RETURNED_TO_DOCTOR',
        returned_to_doctor: true,
        return_reason: fullReason,
        unavailable_items: unavailableItems,
      });

      let queueEntryId = returningRx.queue_entry_id;
      const visitId = returningRx.visit_id || returningRx.encounter_id;
      if (!queueEntryId && visitId) {
        try {
          const matchedQueues = await db.entities.QueueEntry.filter({ visit_id: visitId });
          if (matchedQueues.length) queueEntryId = matchedQueues[0].id;
        } catch {}
      }
      if (!queueEntryId && returningRx.patient_id) {
        try {
          const matchedQueues = await db.entities.QueueEntry.filter({ patient_id: returningRx.patient_id });
          if (matchedQueues.length) queueEntryId = matchedQueues[0].id;
        } catch {}
      }

      if (queueEntryId) {
        try {
          await db.entities.QueueEntry.update(queueEntryId, {
            status: 'Perlu Revisi Dokter',
            workflow_status: 'RETURNED_TO_DOCTOR',
            return_reason: fullReason,
          });
        } catch (e) {
          console.warn('QueueEntry update:', e);
        }
      }

      if (visitId) {
        try {
          await db.entities.Visit.update(visitId, {
            status: 'Perlu Revisi Dokter',
          });
        } catch (e) {
          console.warn('Visit update:', e);
        }
      }

      await db.entities.ClinicalFeedback.create({
        type: 'Stock Alert',
        from_role: 'Apoteker',
        from_name: user?.full_name || 'Apoteker',
        to_role: 'Dokter',
        to_name: returningRx.doctor_name,
        to_user_id: returningRx.doctor_id,
        doctor_id: returningRx.doctor_id,
        prescription_id: returningRx.id,
        queue_entry_id: queueEntryId || returningRx.queue_entry_id,
        subject: `Resep ${returningRx.prescription_number} perlu keputusan dokter`,
        message: fullReason,
        status: 'Baru',
      });

      await db.entities.Notification.create({
        type: 'prescription_returned',
        target_role: 'Dokter',
        target_user_id: returningRx.doctor_id,
        title: `Resep ${returningRx.prescription_number} dikembalikan`,
        body: fullReason,
        priority: 'Penting',
        related_entity: 'Prescription',
        related_id: returningRx.id,
        action_type: 'navigate',
        action_payload: queueEntryId ? `/doctor/exam?queue=${queueEntryId}&tab=resep` : `/doctor/exam?rx=${returningRx.id}&tab=resep`,
      });

      setReturnModalOpen(false);
      setReturningRx(null);
      setExpanded(null);
      await load();
    } catch (e) {
      setActionError(e.message || 'Gagal mengembalikan resep ke dokter');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground px-3 py-4">Memuat antrean resep…</p>;
  }

  if (prescriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-xs">Tidak ada resep menunggu</p>
        <p className="text-[11px]">Resep dari dokter akan muncul di sini</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {prescriptions.map(rx => {
        const flags = getFlags(rx);
        const isExpanded = expanded === rx.id;
        const verified = isVerified(rx);
        const criticalCount = flags.filter(f => f.severity === 'critical').length;
        const warningCount = flags.filter(f => f.severity === 'warning').length;
        return (
          <div key={rx.id} className="px-3 py-2.5">
            <div className="w-full flex items-start gap-2">
              <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
                <Pill className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : rx.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`prescription-detail-${rx.id}`}
                  className="w-full flex items-center gap-2 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-xs font-mono font-semibold text-primary">{rx.prescription_number}</span>
                  {rx.source === 'Eksternal' && <span className="pill pill-info">Eksternal</span>}
                  {rx.is_racikan && <span className="pill pill-info flex items-center gap-0.5"><FlaskConical className="w-3 h-3" /> Racikan</span>}
                  {rx.tebus_status === 'Seluruhnya' && <span className="pill pill-success">Tebus: {rx.tebus_status}</span>}
                  {rx.tebus_status === 'Sebagian' && <span className="pill pill-warning">Tebus: {rx.tebus_status}</span>}
                  {rx.tebus_status === 'Tidak Ditebus' && <span className="pill pill-critical">Tebus: {rx.tebus_status}</span>}
                  {rx.retention_category === 'Narkotika' && <span className="pill pill-critical flex items-center gap-0.5"><ShieldAlert className="w-3 h-3" /> Retensi 5thn</span>}
                  <span className="ml-auto flex items-center gap-1">
                    {criticalCount > 0 && <span className="pill pill-critical flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> {criticalCount}</span>}
                    {warningCount > 0 && <span className="pill pill-warning flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> {warningCount}</span>}
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </span>
                </button>
                {rx.patient_id ? (
                  <button
                    type="button"
                    onClick={() => onQuickPatient?.({ id: rx.patient_id, name: rx.patient_name })}
                    className="text-xs font-medium truncate text-left text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {rx.patient_name}
                  </button>
                ) : (
                  <p className="text-xs font-medium truncate">{rx.patient_name}</p>
                )}
                <p className="text-[11px] text-muted-foreground truncate">
                  {rx.doctor_name || '—'} • {(rx.items || []).length} item
                  {rx.tebus_notation && <span className="font-mono ml-1">• {rx.tebus_notation}</span>}
                </p>
              </div>
            </div>

            {isExpanded && (
              <div id={`prescription-detail-${rx.id}`} className="mt-2 ml-10 space-y-2">
                {actionError && <div className="flex items-start gap-1.5 rounded bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{actionError}</div>}
                {rx.original_text && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <section className="rounded border border-border bg-muted/20 p-2 text-[11px]">
                      <p className="mb-1 font-semibold">Teks resep asli dokter</p>
                      <pre className="whitespace-pre-wrap break-words font-mono leading-4">{rx.original_text}</pre>
                    </section>
                    <section className="rounded border border-primary/20 bg-primary/5 p-2 text-[11px]">
                      <p className="mb-1 font-semibold text-primary">{(rx.interpretation_mode || rx.parse_result?.interpretation_mode) === 'assisted-loose' ? 'Interpretasi bantuan format bebas — wajib ditinjau' : 'Interpretasi sistem — wajib ditinjau'}</p>
                      <pre className="whitespace-pre-wrap break-words leading-4">{rx.translated_text || 'Resep lama/tidak terstruktur — gunakan teks asli dan pemeriksaan apoteker.'}</pre>
                      <p className="mt-1 text-[10px] text-muted-foreground">Status dokter: {rx.doctor_confirmed_at ? `dikonfirmasi ${new Date(rx.doctor_confirmed_at).toLocaleString('id-ID')}` : 'resep lama'}.</p>
                    </section>
                  </div>
                )}
                {rx.parse_result && (
                  <div className={`rounded px-2 py-1.5 text-[11px] ${
                    rx.parse_result.review_state === 'BLOCKED'
                      ? 'bg-rose-50 text-rose-800'
                      : rx.parse_result.review_state === 'NEEDS_PHARMACIST_REVIEW'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    <strong>Status pembacaan: </strong>
                    {rx.parse_result.review_state === 'BLOCKED'
                      ? 'Diblokir — perlu revisi dokter.'
                      : rx.parse_result.review_state === 'NEEDS_PHARMACIST_REVIEW'
                        ? 'Perlu tinjauan apoteker sebelum dispensing.'
                        : 'Struktur terbaca dan menunggu verifikasi farmasi.'}
                  </div>
                )}
                {rx.parse_result?.line_results?.length > 0 && (
                  <details className="rounded border border-border bg-card px-2 py-1.5 text-[11px]">
                    <summary className="cursor-pointer font-semibold">Lihat rincian pembacaan per baris</summary>
                    <div className="mt-1.5 space-y-1">
                      {rx.parse_result.line_results.map((line, index) => (
                        <div key={`${line.line_number}-${index}`} className={`rounded px-2 py-1 ${
                          line.status === 'matched' ? 'bg-emerald-50 text-emerald-800' : line.status === 'review' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'
                        }`}>
                          <div className="flex flex-wrap justify-between gap-2"><code className="whitespace-pre-wrap break-words">Baris {line.line_number}: {line.raw}</code><span className="font-semibold">{line.status === 'matched' ? 'Terbaca' : line.status === 'review' ? 'Perlu tinjauan' : 'Belum terbaca'}</span></div>
                          {line.message && <p>{line.message}</p>}
                          {line.status !== 'matched' && line.candidate_medicines?.length > 0 && <p>Kandidat: {line.candidate_medicines.join(', ')} — wajib dikonfirmasi manual.</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <div className={`rounded px-2 py-1.5 text-[11px] ${verified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {verified ? `Terverifikasi farmasi oleh ${rx.verified_by || 'Apoteker'}${rx.verified_at ? ` • ${new Date(rx.verified_at).toLocaleString('id-ID')}` : ''}` : 'Belum diverifikasi: baca teks asli, interpretasi, dan seluruh FLAG sebelum menyiapkan obat.'}
                </div>
                {/* Flags */}
                {flags.length > 0 && (
                  <div className="space-y-1">
                    {flags.map((f, i) => (
                      <div key={i} className={`flex items-start gap-1.5 text-[11px] rounded px-2 py-1.5 ${
                        f.severity === 'critical' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {f.severity === 'critical'
                          ? <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                          : <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />}
                        <span>{f.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Items */}
                <div className="space-y-1">
                  {(rx.items || []).map((it, i) => {
                    const isRacikan = Boolean(it.is_racikan || it.racikan_template_id);
                    const stock = isRacikan ? null : getItemStock(it.medicine_id);
                    const out = !isRacikan && stock <= 0;
                    const low = !isRacikan && stock > 0 && stock <= (it.quantity || 1);
                    const med = medicines.find(m => m.id === it.medicine_id);
                    const isNarcotic = med?.category === 'Narkotika/Psikotropika';
                    // Dose conversion: if dosage contains mg/mcg, show converted units
                    const doseMatch = (it.dosage || '').match(/([\d.]+)\s*(mg|mcg)/i);
                    const conversion = doseMatch && med?.strength
                      ? convertDoseToUnits(parseFloat(doseMatch[1]), med.strength, med.form)
                      : null;
                    return (
                      <div key={i} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5 text-xs">
                        <Pill className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 font-medium">{formatMedicineLabel(it.medicine_name, it.strength)}</span>
                        {med?.interactions && <span className="pill pill-warning" title={med.interactions}>Interaksi</span>}
                        {med?.pregnancy_category && <span className="pill pill-info" title={`Kategori kehamilan ${med.pregnancy_category}`}>Hamil {med.pregnancy_category}</span>}
                        {isNarcotic && <span className="pill pill-critical flex items-center gap-0.5"><ShieldAlert className="w-3 h-3" /> Narkotik</span>}
                        {it.dosage && <span className="text-muted-foreground">{it.dosage}</span>}
                        <span className="text-muted-foreground">{it.quantity} unit</span>
                        {isRacikan ? (
                          <span className="pill pill-info bg-purple-50 text-purple-700 border border-purple-200">
                            Racikan {it.form ? `(${it.form})` : ''}
                          </span>
                        ) : out ? (
                          <span className="pill pill-critical">Habis</span>
                        ) : low ? (
                          <span className="pill pill-warning">Stok {stock}</span>
                        ) : (
                          <span className="pill pill-success">Stok {stock}</span>
                        )}
                        {med && <button onClick={() => onDrugInfo?.(med)} className="p-1 rounded text-primary hover:bg-primary/10" title="Lihat informasi obat, interaksi, dan kehamilan"><Info className="w-3 h-3" /></button>}
                      </div>
                    );
                  })}
                </div>

                {/* Dose conversion warning */}
                {(rx.items || []).some(it => {
                  const med = medicines.find(m => m.id === it.medicine_id);
                  const doseMatch = (it.dosage || '').match(/([\d.]+)\s*(mg|mcg)/i);
                  const conv = doseMatch && med?.strength ? convertDoseToUnits(parseFloat(doseMatch[1]), med.strength, med.form) : null;
                  return conv?.is_odd_fraction;
                }) && (
                  <div className="flex items-start gap-1.5 text-[11px] bg-amber-50 text-amber-700 rounded px-2 py-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>Beberapa item memiliki hasil konversi dosis pecahan ganjil — verifikasi jumlah unit sediaan sebelum dispensing.</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  {!verified && (
                    <button
                      onClick={() => handleVerify(rx)}
                      className="col-span-2 flex items-center justify-center gap-1 border border-emerald-300 bg-emerald-50 py-1.5 rounded text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Verifikasi Resep & Interpretasi
                    </button>
                  )}
                  <button
                    onClick={() => onTebus?.(rx)}
                    className="flex items-center justify-center gap-1 border border-border py-1.5 rounded text-[11px] font-medium hover:bg-muted"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Status Tebus
                  </button>
                  <button
                    onClick={() => onPIO?.(rx)}
                    className="flex items-center justify-center gap-1 border border-border py-1.5 rounded text-[11px] font-medium hover:bg-muted"
                  >
                    <Info className="w-3 h-3" /> Catat PIO
                  </button>
                  {rx.source === 'Eksternal' && (
                    <button
                      onClick={() => onScan?.(rx)}
                      className="flex items-center justify-center gap-1 border border-border py-1.5 rounded text-[11px] font-medium hover:bg-muted"
                    >
                      <Upload className="w-3 h-3" /> Scan Resep
                    </button>
                  )}
                  {rx.tebus_status !== 'Tidak Ditebus' && (
                    <button
                      onClick={() => onLabel?.({ rx, item: (rx.items || [])[0] })}
                      className="flex items-center justify-center gap-1 border border-border py-1.5 rounded text-[11px] font-medium hover:bg-muted"
                    >
                      <Printer className="w-3 h-3" /> Etiket
                    </button>
                  )}
                  {rx.source !== 'Eksternal' && (
                    <button
                      onClick={() => openReturnModal(rx)}
                      className="col-span-2 flex items-center justify-center gap-1 border border-amber-300 bg-amber-50 text-amber-800 py-1.5 rounded text-[11px] font-medium hover:bg-amber-100"
                    >
                      <RotateCcw className="w-3 h-3" /> Tandai Tidak Tersedia & Kembalikan ke Dokter
                    </button>
                  )}
                </div>

                {/* A prescription that is not redeemed must never enter POS or
                    dispensing. It remains printable as the doctor's prescription. */}
                {rx.tebus_status === 'Tidak Ditebus' ? (
                  <button
                    onClick={() => onPrint?.(rx)}
                    className="w-full btn-primary py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Cetak Resep (Tidak Ditebus)
                  </button>
                ) : (
                  <button
                    onClick={() => handleDispense(rx)}
                    className="w-full btn-primary py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {verified ? (rx.is_racikan ? 'Siapkan Racikan / Ke POS' : 'Lepas ke POS / Dispensing') : 'Verifikasi resep terlebih dahulu'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Return to Doctor Modal Form */}
      {returnModalOpen && returningRx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-card-foreground">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <h3 className="font-semibold text-sm">Kembalikan Resep ke Dokter</h3>
              </div>
              <button
                type="button"
                onClick={() => { setReturnModalOpen(false); setReturningRx(null); }}
                className="text-muted-foreground hover:text-foreground rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-amber-900">
                <p className="font-medium text-xs">
                  Pasien: <span className="font-bold">{returningRx.patient_name}</span> &bull; Resep: <span className="font-mono">{returningRx.prescription_number}</span>
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Dokter: {returningRx.doctor_name || 'Dokter Pemeriksa'}. Resep akan dikembalikan ke status revisi dokter.
                </p>
              </div>

              <div>
                <label className="block font-medium text-xs text-foreground mb-1.5">
                  Pilih Alasan Pengembalian:
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'stok_habis', label: 'Stok obat tidak mencukupi / habis di apotek' },
                    { id: 'dosis_racikan', label: 'Perlu konfirmasi / penyesuaian dosis atau bentuk racikan' },
                    { id: 'substitusi', label: 'Obat tidak tersedia di formularium / perlu alternatif' },
                    { id: 'aturan_pakai', label: 'Signa / aturan pakai perlu klarifikasi dokter' },
                    { id: 'lainnya', label: 'Lainnya / Catatan khusus' },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        returnCategory === opt.id
                          ? 'border-primary bg-primary/5 font-medium text-primary'
                          : 'border-border hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        name="returnCategory"
                        value={opt.id}
                        checked={returnCategory === opt.id}
                        onChange={() => setReturnCategory(opt.id)}
                        className="text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-xs text-foreground mb-1">
                  Penjelasan / Catatan untuk Dokter:
                </label>
                <textarea
                  rows={3}
                  value={returnCustomNote}
                  onChange={(e) => setReturnCustomNote(e.target.value)}
                  placeholder="Contoh: Stok Cefadroxil 500mg habis, mohon konfirmasi ganti Cefixime 100mg atau racikan dosis 75mg disesuaikan sediaan 200mg..."
                  className="w-full text-xs rounded-lg border border-input bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => { setReturnModalOpen(false); setReturningRx(null); }}
                disabled={isSubmittingReturn}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={isSubmittingReturn}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isSubmittingReturn ? 'Mengembalikan...' : 'Konfirmasi Kembalikan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
