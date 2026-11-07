import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardCheck, FileText, FlaskConical, LockKeyhole } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatMedicineLabel, parseFreeTextPrescription } from '@/lib/freeTextPrescription';
import { checkAllergies } from '@/lib/prescriptionSafety';

const SAMPLE = `R/ Paracetamol 500 mg No. X\nS. 3 dd tab 1 pc\nne iter`;

export default function FreeTextPrescriptionComposer({ record, setRecord, patient }) {
  const [dictionary, setDictionary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    base44.entities.PrescriptionAbbreviation.filter({ approval_status: 'Disetujui' }).then((dictionaryRows) => {
      if (!active) return;
      setDictionary(dictionaryRows || []);
    }).catch(() => {}).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const result = useMemo(() => parseFreeTextPrescription(record.prescriptionText || '', {
    dictionary,
    // Dokter menulis resep klinis bebas. Formulary, stok, dan pemilihan
    // produk adalah tanggung jawab farmasi saat verifikasi/dispensing.
    validateAgainstFormulary: false,
    collectValidationFlags: false,
  }), [record.prescriptionText, dictionary]);
  const hasText = Boolean(result.normalized_text);
  const allergyWarnings = useMemo(() => checkAllergies(
    result.racikan?.components || result.items || [],
    patient,
  ), [result, patient]);
  const allergyAcknowledged = Boolean(record.prescriptionAllergyAcknowledged)
    && Boolean(String(record.prescriptionAllergyOverrideReason || '').trim());
  const allergyNeedsAcknowledgement = allergyWarnings.length > 0 && !allergyAcknowledged;
  const blocking = allergyNeedsAcknowledgement;
  const confirmed = Boolean(record.prescriptionConfirmed);

  useEffect(() => {
    setRecord((current) => {
      const next = {
        ...current,
        freeTextPrescription: result,
        prescriptionItems: result.items || [],
        racikanData: result.racikan || null,
        prescriptionAllergyWarnings: allergyWarnings,
      };
      if (current.prescriptionParse?.normalized_text === result.normalized_text
        && current.prescriptionParse?.flags?.length === result.flags?.length
        && current.prescriptionItems?.length === result.items?.length
        && JSON.stringify(current.prescriptionAllergyWarnings || []) === JSON.stringify(allergyWarnings)) return current;
      return { ...next, prescriptionParse: result };
    });
  }, [result, allergyWarnings, setRecord]);

  const changeText = (value) => setRecord((current) => ({
    ...current,
    prescriptionText: value,
    prescriptionConfirmed: false,
    prescriptionConfirmedAt: '',
    prescriptionAllergyAcknowledged: false,
    prescriptionAllergyOverrideReason: '',
  }));

  const confirm = () => {
    if (!hasText || blocking) return;
    setRecord((current) => ({
      ...current,
      prescriptionConfirmed: true,
      prescriptionConfirmedAt: new Date().toISOString(),
    }));
  };

  return (
    <div className="space-y-3">
      {(record.returnedPrescription || record.returnReason) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Resep Dikembalikan oleh Farmasi / Apoteker</span>
          </div>
          <p className="mt-1 font-medium text-amber-950">
            Alasan: <span className="font-semibold">{record.returnReason || record.returnedPrescription?.return_reason || 'Perlu revisi obat / dosis'}</span>
          </p>
          <p className="mt-1 text-[11px] text-amber-700">
            Silakan sesuaikan teks resep di bawah ini, klik <strong>Konfirmasi resep</strong>, lalu selesaikan pemeriksaan untuk mengirim resep kembali ke Farmasi.
          </p>
        </div>
      )}

      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
        <p className="font-semibold">Resep teks bebas — teks dokter adalah dokumen hukum</p>
        <p className="mt-0.5">Tulis seperti blangko resep: <strong>R/</strong> dan praescriptio, <strong>M.f./Da in</strong> bila racikan, lalu <strong>S.</strong> (aturan pakai). Sistem hanya memberi interpretasi dan FLAG; tidak memilih obat, dosis, satuan, atau iter secara otomatis.</p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="micro-label flex items-center gap-1"><FileText className="h-3 w-3 text-primary" /> Teks resep asli</label>
          <button type="button" onClick={() => changeText(SAMPLE)} className="text-[11px] text-primary hover:underline">Isi contoh aman</button>
        </div>
        <textarea
          value={record.prescriptionText || ''}
          onChange={(event) => changeText(event.target.value)}
          rows={9}
          spellCheck={false}
          placeholder={'R/ Nama obat + kekuatan No. X\nM.f. pulv dtd No. X (bila racikan)\nDa in cap (bila perlu)\nS. 3 dd tab 1 pc\nne iter'}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          aria-label="Teks resep bebas"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">Mendukung R/Rp, S./Signa, No./N/#, angka Romawi/Arab, M.f./Misce fac, D.t.d., aa, ad, q.s., tab/cap/pulv, t.i.d./b.i.d./q.i.d., a.c./p.c./p.r.n./h.s., Da in, serta iter/ne iter. Kamus bawaan digabung dengan singkatan yang disetujui APJ.</p>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Memuat kamus singkatan…</p>}
      {hasText && (
        <>
          <section className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Resep siap dikonfirmasi dokter</p>
              <span>Verifikasi obat dilakukan farmasi</span>
            </div>
            <p className="mt-1">Teks asli dokter menjadi sumber resep. Sistem tidak menghubungkan penulisan ini ke stok atau formularium apoteker dan tidak mengubah pilihan obat, kekuatan, jumlah, maupun aturan pakai.</p>
          </section>
          <div className="grid gap-2 lg:grid-cols-2">
            <section className="rounded-md border border-border bg-muted/20 p-2.5">
              <p className="mb-1.5 text-[11px] font-semibold">Teks asli (dikunci saat dikonfirmasi)</p>
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-foreground">{result.original_text}</pre>
            </section>
            <section className="rounded-md border border-primary/25 bg-primary/5 p-2.5">
              <p className="mb-1.5 text-[11px] font-semibold text-primary">Ringkasan teks resep untuk diteruskan ke farmasi</p>
              {result.racikan ? (
                <div className="text-[11px] leading-5">
                  <p className="flex items-center gap-1 font-semibold"><FlaskConical className="h-3.5 w-3.5" /> {result.racikan.subscriptio}</p>
                  {result.racikan.components.map((component, index) => <p key={`${component.raw}-${index}`}>{index + 1}. {formatMedicineLabel(component.medicine_name, component.strength)}</p>)}
                  <p className="mt-1">Bentuk: {result.racikan.bentuk_racikan}{result.racikan.quantity ? ` • Jumlah: ${result.racikan.quantity}` : ''}{result.racikan.packaging ? ` • ${result.racikan.packaging}` : ''}</p>
                  <p className="mt-1">Signa: {result.racikan.signa.translation || 'belum lengkap'}</p>
                  <p>Etiket racikan: {result.racikan.shake_well ? 'kocok dahulu; ' : ''}instruksi simpan dan BUD akan dikonfirmasi farmasi.</p>
                </div>
              ) : result.translated_text ? <pre className="whitespace-pre-wrap break-words text-[11px] leading-5">{result.translated_text}</pre> : <p className="text-[11px] text-muted-foreground">Teks asli tetap diteruskan untuk dibaca dan diverifikasi farmasi.</p>}
              <p className="mt-2 text-[10px] text-muted-foreground">Iter dan detail dispensing dikonfirmasi farmasi berdasarkan teks asli.</p>
            </section>
          </div>

          {allergyWarnings.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-900">
              {allergyWarnings.map((warning, index) => (
                <p key={`${warning.medicine}-${warning.allergen}-${index}`} className="flex items-start gap-1.5">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span><strong>PERINGATAN ALERGI.</strong> {warning.message}</span>
                </p>
              ))}
            </div>
          )}

          {allergyWarnings.length > 0 && (
            <section className="space-y-2 rounded-md border border-rose-300 bg-rose-50 p-2.5">
              <p className="text-xs font-semibold text-rose-900">Keputusan dokter untuk peringatan alergi</p>
              <p className="text-[11px] text-rose-800">Resep tidak dapat dikonfirmasi sampai dokter mencatat alasan klinis dan menyatakan telah meninjau peringatan. Sistem tidak mengganti keputusan dokter secara otomatis.</p>
              <textarea
                value={record.prescriptionAllergyOverrideReason || ''}
                onChange={(event) => setRecord((current) => ({
                  ...current,
                  prescriptionAllergyOverrideReason: event.target.value,
                  prescriptionAllergyAcknowledged: false,
                  prescriptionConfirmed: false,
                }))}
                rows={2}
                className="w-full rounded-md border border-rose-300 bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-rose-500"
                placeholder="Alasan klinis / klarifikasi alergi yang telah diverifikasi…"
                aria-label="Alasan keputusan alergi"
              />
              <label className="flex items-start gap-2 text-[11px] text-rose-900">
                <input
                  type="checkbox"
                  checked={Boolean(record.prescriptionAllergyAcknowledged)}
                  disabled={!String(record.prescriptionAllergyOverrideReason || '').trim()}
                  onChange={(event) => setRecord((current) => ({
                    ...current,
                    prescriptionAllergyAcknowledged: event.target.checked,
                    prescriptionConfirmed: false,
                  }))}
                />
                Saya telah meninjau peringatan alergi dan alasan klinis di atas akan dicatat pada resep serta audit trail.
              </label>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-2.5">
            <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 shrink-0" /> Konfirmasi mengunci teks asli, hasil interpretasi, dan timestamp. Perubahan sesudahnya harus menjadi revisi resep baru.</p>
            <button
              type="button"
              onClick={confirm}
              disabled={!hasText || blocking || confirmed}
              className="btn-primary flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmed ? <><CheckCircle2 className="h-3.5 w-3.5" /> Telah dikonfirmasi</> : <><ClipboardCheck className="h-3.5 w-3.5" /> Konfirmasi resep</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
