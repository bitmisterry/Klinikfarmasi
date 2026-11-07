export const BRANCH_ID = 'main-clinic';

export const VISIT_STATUS = Object.freeze({
  REGISTERED: 'REGISTERED',
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  INTAKE_DONE: 'INTAKE_DONE',
  IN_SERVICE: 'IN_SERVICE',
  COMPLETED: 'COMPLETED',
  READY_TO_CLOSE: 'READY_TO_CLOSE',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
});

export const PRESCRIPTION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SIGNED: 'SIGNED',
  SENT_TO_PHARMACY: 'SENT_TO_PHARMACY',
  RECEIVED: 'RECEIVED',
  VERIFIED: 'VERIFIED',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  DISPENSED: 'DISPENSED',
  RETURNED_TO_DOCTOR: 'RETURNED_TO_DOCTOR',
  PARTIAL: 'PARTIAL',
  NOT_COLLECTED: 'NOT_COLLECTED',
});

export const INVOICE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  VOIDED: 'VOIDED',
});

export const QUEUE_TO_VISIT_STATUS = Object.freeze({
  Terdaftar: VISIT_STATUS.REGISTERED,
  Menunggu: VISIT_STATUS.WAITING,
  Dipanggil: VISIT_STATUS.CALLED,
  'Menunggu Intake': VISIT_STATUS.CALLED,
  'Siap Dokter': VISIT_STATUS.INTAKE_DONE,
  Pemeriksaan: VISIT_STATUS.IN_SERVICE,
  'Perlu Revisi Dokter': VISIT_STATUS.IN_SERVICE,
  'Dikembalikan ke Dokter': VISIT_STATUS.IN_SERVICE,
  'Selesai Periksa': VISIT_STATUS.COMPLETED,
  'Di Apotek': VISIT_STATUS.COMPLETED,
  Kasir: VISIT_STATUS.READY_TO_CLOSE,
  Selesai: VISIT_STATUS.CLOSED,
  Batal: VISIT_STATUS.CANCELLED,
  'No-Show': VISIT_STATUS.NO_SHOW,
});

export const VISIT_TO_QUEUE_STATUS = Object.freeze({
  [VISIT_STATUS.REGISTERED]: 'Terdaftar',
  [VISIT_STATUS.WAITING]: 'Menunggu',
  [VISIT_STATUS.CALLED]: 'Dipanggil',
  [VISIT_STATUS.INTAKE_DONE]: 'Siap Dokter',
  [VISIT_STATUS.IN_SERVICE]: 'Pemeriksaan',
  [VISIT_STATUS.COMPLETED]: 'Selesai Periksa',
  [VISIT_STATUS.READY_TO_CLOSE]: 'Kasir',
  [VISIT_STATUS.CLOSED]: 'Selesai',
  [VISIT_STATUS.CANCELLED]: 'Batal',
  [VISIT_STATUS.NO_SHOW]: 'No-Show',
});

export const VISIT_TRANSITIONS = Object.freeze({
  [VISIT_STATUS.REGISTERED]: [VISIT_STATUS.WAITING, VISIT_STATUS.CANCELLED],
  [VISIT_STATUS.WAITING]: [VISIT_STATUS.CALLED, VISIT_STATUS.CANCELLED, VISIT_STATUS.NO_SHOW],
  [VISIT_STATUS.CALLED]: [VISIT_STATUS.WAITING, VISIT_STATUS.INTAKE_DONE, VISIT_STATUS.CANCELLED],
  [VISIT_STATUS.INTAKE_DONE]: [VISIT_STATUS.IN_SERVICE, VISIT_STATUS.CANCELLED],
  [VISIT_STATUS.IN_SERVICE]: [VISIT_STATUS.COMPLETED],
  [VISIT_STATUS.COMPLETED]: [VISIT_STATUS.READY_TO_CLOSE, VISIT_STATUS.IN_SERVICE],
  [VISIT_STATUS.READY_TO_CLOSE]: [VISIT_STATUS.CLOSED],
  [VISIT_STATUS.CLOSED]: [],
  [VISIT_STATUS.CANCELLED]: [],
  [VISIT_STATUS.NO_SHOW]: [],
});

export function visitStatusFromQueue(status) {
  return QUEUE_TO_VISIT_STATUS[status] || VISIT_STATUS.WAITING;
}

export function queueStatusFromVisit(status) {
  return VISIT_TO_QUEUE_STATUS[status] || 'Menunggu';
}

export function canTransitionVisit(from, to) {
  if (!from || from === to) return true;
  return (VISIT_TRANSITIONS[from] || []).includes(to);
}

export function isPrescriptionFinal(status) {
  return [
    PRESCRIPTION_STATUS.DISPENSED,
    PRESCRIPTION_STATUS.PARTIAL,
    PRESCRIPTION_STATUS.NOT_COLLECTED,
  ].includes(status);
}

export function isInvoiceFinal(status) {
  return [INVOICE_STATUS.PAID, INVOICE_STATUS.VOIDED].includes(status);
}

export function encounterIdForQueue(queueId) {
  return `encounter-${queueId}`;
}

export function nowIso() {
  return new Date().toISOString();
}
