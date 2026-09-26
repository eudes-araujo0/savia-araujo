import { isBookableDate, isPastScheduleTime, maximumBookingDate, todayInSaoPaulo } from './business-hours.ts';

const LEGACY_BOOKING_ID = /^SAV-\d{8}-[A-Z0-9]{6}$/;
const SECURE_BOOKING_ID = /^SAV-[A-F0-9]{32}$/;
const BOOKING_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BookingAvailabilityError extends Error {
  readonly status: 400 | 409;

  constructor(message: string, status: 400 | 409) {
    super(message);
    this.name = 'BookingAvailabilityError';
    this.status = status;
  }
}

export function createBookingId() {
  return `SAV-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
}

export function isBookingId(value: unknown): value is string {
  return typeof value === 'string' && (SECURE_BOOKING_ID.test(value) || LEGACY_BOOKING_ID.test(value));
}

export function validatePublicBookingDateTime(date: string, time: string, today = todayInSaoPaulo()) {
  if (!isBookableDate(date, today) || !BOOKING_TIME.test(time)) {
    const message = date > maximumBookingDate(today)
      ? 'Escolha uma data dentro dos próximos 24 meses.'
      : 'Data ou horário inválido.';
    return { ok: false as const, message };
  }
  if (isPastScheduleTime(date, time)) return { ok: false as const, message: 'Este horário já passou. Escolha um horário futuro.' };
  return { ok: true as const };
}
