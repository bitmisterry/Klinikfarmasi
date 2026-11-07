import React, { useState, useEffect } from 'react';
import {
  Stethoscope, Pill, Calendar, ClipboardList, Save, AlertCircle, ArrowRightLeft, FileCheck, Minus, Maximize2, Plus
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TindakanPanel from '@/components/TindakanPanel';
import FreeTextPrescriptionComposer from '@/components/doctor/FreeTextPrescriptionComposer';

export default function ClinicalActions({
  record, setRecord, onComplete, saving,
  doctorId, patient, specialty, role, initialPanel = 'tindakan', actionPanelSize = 'standard', onActionPanelSizeChange,
}) {
  const [activePanel, setActivePanel] = useState(initialPanel);
  const [referralDoctors, setReferralDoctors] = useState([]);

  useEffect(() => {
    if (record?.returnedPrescription) {
      setActivePanel('resep');
    } else if (initialPanel) {
      setActivePanel(initialPanel === 'racikan' ? 'resep' : initialPanel);
    }
  }, [initialPanel, record?.returnedPrescription]);

  useEffect(() => {
    base44.entities.DoctorProfile.filter({ is_active: true })
      .then((rows) => setReferralDoctors((rows || []).filter((doctor) => (doctor.user_id || doctor.staff_id || doctor.id) !== doctorId)))
      .catch(() => setReferralDoctors([]));
  }, [doctorId]);

  const tindakanTotal = (record.procedures || []).reduce((s, p) => s + (p.subtotal || 0), 0);
  const rxItems = record.prescriptionItems || [];
  const regularRxItems = rxItems.filter((item) => !item.is_racikan);
  const approvedDocumentCount = Object.values(record.administrative_documents || {}).filter((document) => document?.approved).length;
  const setDocumentApproval = (key, approved) => setRecord((current) => ({
    ...current,
    administrative_documents: {
      ...(current.administrative_documents || {}),
      [key]: { ...(current.administrative_documents?.[key] || {}), approved },
    },
  }));

  const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary";
  const panelSizeOptions = [
    { key: 'compact', label: 'Kecil', icon: Minus },
    { key: 'standard', label: 'Normal', icon: Maximize2 },
    { key: 'wide', label: 'Lebar', icon: Plus },
  ];

  return (
    <div className="panel flex flex-col h-full max-h-[calc(100vh-180px)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <p className="micro-label">Panel aksi</p>
        <div className="hidden items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5 lg:flex" aria-label="Atur lebar panel aksi">
          {panelSizeOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onActionPanelSizeChange?.(key)}
              aria-label={`Lebar panel ${label.toLowerCase()}`}
              aria-pressed={actionPanelSize === key}
              title={`Panel ${label.toLowerCase()}`}
              className={`flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition-colors ${
                actionPanelSize === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3 w-3" /> <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-2 py-2 border-b border-border flex flex-wrap gap-1">
        {[
          { k: 'tindakan', l: 'Tindakan', icon: Stethoscope, badge: record.procedures?.length },
          { k: 'resep', l: 'Resep Teks Bebas', icon: Pill, badge: rxItems.length },
          { k: 'kontrol', l: 'Kontrol', icon: Calendar, active: !!record.follow_up_date },
          { k: 'rujukan', l: 'Rujukan Internal', icon: ArrowRightLeft, active: !!record.internal_referral?.target_doctor_id },
          { k: 'dokumen', l: 'Dokumen', icon: FileCheck, badge: approvedDocumentCount, active: approvedDocumentCount > 0 },
        ].map(btn => {
          const Icon = btn.icon;
          const active = activePanel === btn.k;
          return (
            <button
              key={btn.k}
              onClick={() => setActivePanel(btn.k)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70 text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {btn.l}
              {btn.badge > 0 && <span className="ml-0.5 text-[9px] bg-primary-foreground/20 px-1 rounded-full">{btn.badge}</span>}
              {btn.active && !btn.badge && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-3">
        {activePanel === 'tindakan' && (
          <TindakanPanel
            procedures={record.procedures || []}
            onChange={(procs) => setRecord(r => ({ ...r, procedures: procs }))}
            specialty={specialty}
            role={role}
          />
        )}

        {activePanel === 'resep' && (
          <FreeTextPrescriptionComposer record={record} setRecord={setRecord} patient={patient} />
        )}

        {activePanel === 'kontrol' && (
          <div className="space-y-3">
            <div>
              <p className="micro-label mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3 text-primary" /> Tanggal Kontrol</p>
              <input
                type="date"
                value={record.follow_up_date || ''}
                onChange={e => setRecord(r => ({ ...r, follow_up_date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="flex gap-1.5">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => {
                    const dt = new Date();
                    dt.setDate(dt.getDate() + d);
                    setRecord(r => ({ ...r, follow_up_date: dt.toISOString().split('T')[0] }));
                  }}
                  className="flex-1 px-2 py-1.5 border border-border rounded text-xs hover:bg-muted hover:border-primary/40"
                >
                  +{d} hari
                </button>
              ))}
            </div>
            <div>
              <p className="micro-label mb-1.5 flex items-center gap-1"><ClipboardList className="w-3 h-3 text-primary" /> Instruksi</p>
              <textarea
                value={record.follow_up_instructions || ''}
                onChange={e => setRecord(r => ({ ...r, follow_up_instructions: e.target.value }))}
                className={inputCls}
                rows={3}
                placeholder="Instruksi kontrol / anjuran pasien…"
              />
            </div>
            <div>
              <p className="micro-label mb-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3 text-primary" /> Edukasi Pasien</p>
              <input
                value={record.patient_education || ''}
                onChange={e => setRecord(r => ({ ...r, patient_education: e.target.value }))}
                className={inputCls}
                placeholder="Edukasi / anjuran"
              />
            </div>
          </div>
        )}

        {activePanel === 'rujukan' && (
          <div className="space-y-3">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
              Rujukan internal membuka rekam medis kunjungan ini hanya untuk dokter tujuan. Dokter tujuan dan alasan rujukan wajib dicatat sebagai jejak akses.
            </div>
            <div>
              <p className="micro-label mb-1.5">Dokter tujuan</p>
              <select
                value={record.internal_referral?.target_doctor_id || ''}
                onChange={(event) => {
                  const selected = referralDoctors.find((doctor) => (doctor.user_id || doctor.staff_id || doctor.id) === event.target.value);
                  setRecord((current) => ({
                    ...current,
                    internal_referral: {
                      ...(current.internal_referral || {}),
                      target_doctor_id: event.target.value,
                      target_doctor_name: selected?.display_name || selected?.full_name || '',
                    },
                  }));
                }}
                className={inputCls}
              >
                <option value="">Tidak dirujuk</option>
                {referralDoctors.map((doctor) => {
                  const id = doctor.user_id || doctor.staff_id || doctor.id;
                  return <option key={doctor.id} value={id}>{doctor.display_name || doctor.full_name} — {doctor.specialization || 'Dokter'}</option>;
                })}
              </select>
            </div>
            <div>
              <p className="micro-label mb-1.5">Alasan rujukan *</p>
              <textarea
                rows={3}
                value={record.internal_referral?.reason || ''}
                onChange={(event) => setRecord((current) => ({
                  ...current,
                  internal_referral: { ...(current.internal_referral || {}), reason: event.target.value },
                }))}
                className={inputCls}
                placeholder="Contoh: Memerlukan evaluasi dokter spesialis anak karena…"
              />
            </div>
            <div>
              <p className="micro-label mb-1.5">Ringkasan untuk dokter tujuan</p>
              <textarea
                rows={3}
                value={record.internal_referral?.clinical_summary || ''}
                onChange={(event) => setRecord((current) => ({
                  ...current,
                  internal_referral: { ...(current.internal_referral || {}), clinical_summary: event.target.value },
                }))}
                className={inputCls}
                placeholder="Ringkasan temuan, hal yang perlu dievaluasi, atau instruksi tindak lanjut"
              />
            </div>
          </div>
        )}

        {activePanel === 'dokumen' && (
          <div className="space-y-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
              Dokter hanya menetapkan dan menyetujui isi klinis dokumen di sini. Keenam dokumen di bawah dapat dicetak Front Office hanya setelah Visit difinalkan. Front Office tidak dapat mengubah isi, alasan, diagnosis, maupun otorisasi dokter.
            </div>

            <DocumentApprovalCard
              title="Setujui cetak resep"
              description="Resep final dikirim ke farmasi; Front Office hanya dapat mencetak salinan resep yang disetujui dokter."
              checked={Boolean(record.administrative_documents?.prescription_print?.approved)}
              onChange={(checked) => setDocumentApproval('prescription_print', checked)}
            />

            <section className="space-y-2 rounded-md border border-border p-3">
              <label className="flex items-start gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(record.administrative_documents?.sick_leave?.approved)}
                  onChange={(event) => setRecord((current) => ({
                    ...current,
                    administrative_documents: {
                      ...(current.administrative_documents || {}),
                      sick_leave: {
                        ...(current.administrative_documents?.sick_leave || {}),
                        approved: event.target.checked,
                        start_date: current.administrative_documents?.sick_leave?.start_date || current.visit_date || '',
                        end_date: current.administrative_documents?.sick_leave?.end_date || current.visit_date || '',
                      },
                    },
                  }))}
                />
                Setujui surat keterangan istirahat
              </label>
              {record.administrative_documents?.sick_leave?.approved && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label><span className="micro-label block mb-1">Mulai istirahat *</span><input type="date" value={record.administrative_documents.sick_leave.start_date || ''} onChange={(event) => setRecord((current) => ({ ...current, administrative_documents: { ...(current.administrative_documents || {}), sick_leave: { ...current.administrative_documents.sick_leave, start_date: event.target.value } } }))} className={inputCls} /></label>
                  <label><span className="micro-label block mb-1">Sampai *</span><input type="date" value={record.administrative_documents.sick_leave.end_date || ''} onChange={(event) => setRecord((current) => ({ ...current, administrative_documents: { ...(current.administrative_documents || {}), sick_leave: { ...current.administrative_documents.sick_leave, end_date: event.target.value } } }))} className={inputCls} /></label>
                  <label className="sm:col-span-2"><span className="micro-label block mb-1">Keterangan dokter</span><textarea rows={2} value={record.administrative_documents.sick_leave.notes || ''} onChange={(event) => setRecord((current) => ({ ...current, administrative_documents: { ...(current.administrative_documents || {}), sick_leave: { ...current.administrative_documents.sick_leave, notes: event.target.value } } }))} placeholder="Opsional; akan tercetak apa adanya." className={inputCls} /></label>
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-md border border-border p-3">
              <label className="flex items-start gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(record.administrative_documents?.external_referral?.approved)}
                  onChange={(event) => setRecord((current) => ({
                    ...current,
                    administrative_documents: {
                      ...(current.administrative_documents || {}),
                      external_referral: { ...(current.administrative_documents?.external_referral || {}), approved: event.target.checked },
                    },
                  }))}
                />
                Setujui surat rujukan eksternal
              </label>
              {record.administrative_documents?.external_referral?.approved && (
                <div className="space-y-2">
                  <label><span className="micro-label block mb-1">Dokter/fasilitas tujuan *</span><input value={record.administrative_documents.external_referral.destination || ''} onChange={(event) => setRecord((current) => ({ ...current, administrative_documents: { ...(current.administrative_documents || {}), external_referral: { ...current.administrative_documents.external_referral, destination: event.target.value } } }))} className={inputCls} placeholder="Contoh: Poli Anak RS …" /></label>
                  <label><span className="micro-label block mb-1">Alasan rujukan *</span><textarea rows={2} value={record.administrative_documents.external_referral.reason || ''} onChange={(event) => setRecord((current) => ({ ...current, administrative_documents: { ...(current.administrative_documents || {}), external_referral: { ...current.administrative_documents.external_referral, reason: event.target.value } } }))} className={inputCls} /></label>
                  <label><span className="micro-label block mb-1">Ringkasan klinis untuk tujuan</span><textarea rows={2} value={record.administrative_documents.external_referral.summary || ''} onChange={(event) => setRecord((current) => ({ ...current, administrative_documents: { ...(current.administrative_documents || {}), external_referral: { ...current.administrative_documents.external_referral, summary: event.target.value } } }))} className={inputCls} /></label>
                </div>
              )}
            </section>

            <DocumentApprovalCard
              title="Setujui cetak resume medis"
              description="Melepas ringkasan kunjungan yang telah difinalkan, bukan akses untuk menelusuri rekam medis pasien."
              checked={Boolean(record.administrative_documents?.medical_summary?.approved)}
              onChange={(checked) => setDocumentApproval('medical_summary', checked)}
            />

            <DocumentApprovalCard
              title="Setujui cetak instruksi / anjuran"
              description="Menggunakan edukasi pasien, rencana terapi, dan/atau instruksi follow-up yang dokter isi pada Visit ini."
              checked={Boolean(record.administrative_documents?.instructions?.approved)}
              onChange={(checked) => setDocumentApproval('instructions', checked)}
            />

            <DocumentApprovalCard
              title="Setujui cetak kartu kontrol"
              description="Menggunakan tanggal dan instruksi kontrol yang dokter tetapkan pada panel Kontrol."
              checked={Boolean(record.administrative_documents?.control_card?.approved)}
              onChange={(checked) => setDocumentApproval('control_card', checked)}
            />
          </div>
        )}
      </div>

      {/* Summary + Complete button */}
      <div className="px-3 py-2 border-t border-border space-y-2">
        <div className="flex items-center justify-between text-xs flex-wrap gap-1">
          {tindakanTotal > 0 && (
            <span className="text-emerald-600 font-medium">Tindakan: Rp {tindakanTotal.toLocaleString('id-ID')}</span>
          )}
          {regularRxItems.length > 0 && (
            <span className="text-blue-600 font-medium">{regularRxItems.length} obat</span>
          )}
          {record.racikanData && <span className="text-primary font-medium">1 racikan {String(record.racikanData.bentuk_racikan || 'obat').toLowerCase()}</span>}
          {record.follow_up_date && (
            <span className="text-purple-600 font-medium">Kontrol: {new Date(record.follow_up_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
          )}
          {record.internal_referral?.target_doctor_id && (
            <span className="text-blue-600 font-medium">Rujuk: {record.internal_referral.target_doctor_name}</span>
          )}
        </div>
        <button
          onClick={onComplete}
          disabled={saving}
          className="w-full btn-primary py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Menyimpan…</>
          ) : (
            <><Save className="w-4 h-4" /> {record?.returnedPrescription ? 'Kirim Resep Revisi ke Farmasi' : 'Selesaikan Pemeriksaan'}</>
          )}
        </button>
      </div>

    </div>
  );
}

function DocumentApprovalCard({ title, description, checked, onChange }) {
  return (
    <section className="rounded-md border border-border p-3">
      <label className="flex items-start gap-2 text-xs font-semibold">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{title}</span>
      </label>
      <p className="mt-1.5 pl-5 text-[11px] leading-4 text-muted-foreground">{description}</p>
    </section>
  );
}
