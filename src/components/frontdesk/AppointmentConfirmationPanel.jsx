import React from 'react';
import { CalendarClock, CheckCircle2, MessageSquare, Send } from 'lucide-react';

const CONFIRMABLE_STATUSES = new Set(['Terjadwalkan', 'Dijadwalkan', 'Pending']);

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(`${value}T12:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function AppointmentConfirmationPanel({ appointments = [], onConfirm, busyId = null, compact = false }) {
  const visibleAppointments = appointments.slice(0, compact ? 5 : 10);

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-primary" /> Janji temu & notifikasi
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Konfirmasi jadwal dan catat kanal WA/SMS sebelum pasien datang.</p>
        </div>
        <span className="pill pill-info">Front Office</span>
      </div>

      {visibleAppointments.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Belum ada janji temu yang perlu dikonfirmasi.</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {visibleAppointments.map((appointment) => {
            const canConfirm = CONFIRMABLE_STATUSES.has(appointment.status || 'Pending');
            const confirmed = appointment.notification_status === 'Tercatat' || appointment.status === 'Dikonfirmasi';
            const busy = busyId === appointment.id;
            return (
              <div key={appointment.id} className="border border-border rounded-md p-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{appointment.patient_name || 'Pasien'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {formatDate(appointment.appointment_date)} • {appointment.time_slot || '-'} • {appointment.poli || 'Poli belum ditentukan'} • {appointment.doctor_name || 'Dokter belum ditentukan'}
                    </p>
                  </div>
                  <span className={`pill ${confirmed ? 'pill-success' : 'pill-warning'}`}>
                    {confirmed ? 'Terkonfirmasi' : (appointment.status || 'Pending')}
                  </span>
                </div>

                {canConfirm && !confirmed ? (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-5">
                    <span className="text-[10px] text-muted-foreground mr-1">Kirim simulasi:</span>
                    {['WA', 'SMS'].map((channel) => (
                      <button
                        key={channel}
                        type="button"
                        disabled={busy}
                        onClick={() => onConfirm(appointment, channel)}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-primary/40 rounded text-[10px] font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" /> {busy ? 'Menyimpan…' : channel}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-2 pl-5 text-[10px] text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    {confirmed ? `Notifikasi ${appointment.confirmation_channel || 'WA/SMS'} tercatat` : 'Kunjungan sudah diproses'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
