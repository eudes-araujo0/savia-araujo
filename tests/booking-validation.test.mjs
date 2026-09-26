import assert from 'node:assert/strict';
import test from 'node:test';
import { createBookingId, isBookingId, validatePublicBookingDateTime } from '../lib/booking-validation.ts';
import { maximumBookingDate, todayInSaoPaulo } from '../lib/business-hours.ts';

test('limita agendamentos aos próximos 24 meses', () => {
  assert.equal(maximumBookingDate('2026-09-25'), '2028-09-25');
  assert.equal(maximumBookingDate('2024-02-29'), '2026-02-28');
  const result = validatePublicBookingDateTime('2099-01-02', '08:00', '2026-09-25');
  assert.equal(result.ok, false);
  assert.match(result.message, /24 meses/);
});

test('rejeita data e horário malformados', () => {
  assert.equal(validatePublicBookingDateTime('', '', todayInSaoPaulo()).ok, false);
  assert.equal(validatePublicBookingDateTime('2026-02-31', '08:00', '2026-01-01').ok, false);
  assert.equal(validatePublicBookingDateTime('2026-12-01', '25:00', '2026-01-01').ok, false);
});

test('novos códigos de reserva possuem 128 bits aleatórios e os antigos continuam válidos', () => {
  const ids = new Set(Array.from({ length: 100 }, () => createBookingId()));
  assert.equal(ids.size, 100);
  for (const id of ids) assert.match(id, /^SAV-[A-F0-9]{32}$/);
  assert.equal(isBookingId('SAV-20990102-D0E079'), true);
  assert.equal(isBookingId('SAV-20260925-ABC'), false);
});
