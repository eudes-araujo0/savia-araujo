import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { Booking, Expense, ScheduleBlock } from './schema';
import { decryptSensitive, encryptSensitive } from '../lib/data-crypto';
import { BOOKING_TIMES, isBridalService, SERVICE_CATALOG } from '../lib/service-catalog';

let client: NeonQueryFunction<false, false> | null = null;
let initialized: Promise<void> | null = null;

const PENDING_TTL_MS = 30 * 60 * 1000;

export function database() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL não configurada.');
  if (!client) client = neon(connectionString);
  return client;
}

export async function ensureBookingsSchema() {
  if (initialized) return initialized;

  initialized = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      created_at BIGINT NOT NULL,
      client_name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT,
      service TEXT NOT NULL,
      service_label TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 90,
      price_cents INTEGER NOT NULL,
      deposit_cents INTEGER NOT NULL DEFAULT 0,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      payment_option TEXT NOT NULL DEFAULT 'deposit',
      payment_amount_cents INTEGER NOT NULL DEFAULT 0,
      balance_paid_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      payment_provider TEXT,
      payment_preference_id TEXT,
      payment_id TEXT,
      payment_url TEXT,
      payment_receipt_url TEXT,
      paid_at BIGINT,
      balance_paid_at BIGINT,
      expires_at BIGINT,
      consent_at BIGINT,
      management_token_hash TEXT,
      notes TEXT,
      receipt_key TEXT,
      receipt_name TEXT
    )`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_option TEXT NOT NULL DEFAULT 'deposit'`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_amount_cents INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 90`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_paid_cents INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_paid_at BIGINT`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at BIGINT`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS consent_at BIGINT`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS management_token_hash TEXT`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT`;
    await sql`UPDATE bookings SET payment_amount_cents = deposit_cents WHERE payment_amount_cents = 0 AND deposit_cents > 0`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date ON bookings(appointment_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_status_date ON bookings(status, appointment_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_id ON bookings(payment_id) WHERE payment_id IS NOT NULL`;
    await sql`DROP INDEX IF EXISTS idx_bookings_active_slot`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot ON bookings(appointment_date, appointment_time) WHERE status NOT IN ('cancelado', 'expirado')`;
    await sql`CREATE TABLE IF NOT EXISTS schedule_blocks (
      id TEXT PRIMARY KEY,
      block_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      reason TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(block_date)`;
    await sql`CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      expense_date TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      created_at BIGINT NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`;
    await sql`CREATE TABLE IF NOT EXISTS notification_deliveries (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      delivered_at BIGINT,
      error TEXT
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_once ON notification_deliveries(booking_id, kind)`;
    await sql`ALTER TABLE bookings ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE bookings FORCE ROW LEVEL SECURITY`;
    await sql`REVOKE ALL ON bookings FROM PUBLIC`;
    await sql`ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE schedule_blocks FORCE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE expenses ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE expenses FORCE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE notification_deliveries FORCE ROW LEVEL SECURITY`;
    await sql`REVOKE ALL ON schedule_blocks, expenses, notification_deliveries FROM PUBLIC`;
    await sql`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'bookings' AND policyname = 'bookings_backend_only') THEN
          CREATE POLICY bookings_backend_only ON bookings TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
      END
    $$`;
    await sql`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'schedule_blocks' AND policyname = 'schedule_blocks_backend_only') THEN
          CREATE POLICY schedule_blocks_backend_only ON schedule_blocks TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'expenses' AND policyname = 'expenses_backend_only') THEN
          CREATE POLICY expenses_backend_only ON expenses TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'notification_deliveries' AND policyname = 'notification_deliveries_backend_only') THEN
          CREATE POLICY notification_deliveries_backend_only ON notification_deliveries TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
      END
    $$`;
    const legacyRows = await sql`SELECT id, client_name, whatsapp, email, notes FROM bookings
      WHERE client_name NOT LIKE 'enc:v1:%' OR whatsapp NOT LIKE 'enc:v1:%' OR (email IS NOT NULL AND email NOT LIKE 'enc:v1:%') OR (notes IS NOT NULL AND notes NOT LIKE 'enc:v1:%')
      LIMIT 1000`;
    for (const row of legacyRows) {
      const [clientName, whatsapp, email, notes] = await Promise.all([
        encryptSensitive(String(row.client_name)),
        encryptSensitive(String(row.whatsapp)),
        encryptSensitive(row.email ? String(row.email) : null),
        encryptSensitive(row.notes ? String(row.notes) : null),
      ]);
      await sql`UPDATE bookings SET client_name = ${clientName}, whatsapp = ${whatsapp}, email = ${email}, notes = ${notes} WHERE id = ${String(row.id)}`;
    }
  })().catch((error) => {
    initialized = null;
    throw error;
  });

  return initialized;
}

export async function createBooking(booking: Booking, managementTokenHash: string | null = null) {
  await ensureBookingsSchema();
  const sql = database();
  const [clientName, whatsapp, email, notes] = await Promise.all([
    encryptSensitive(booking.clientName),
    encryptSensitive(booking.whatsapp),
    encryptSensitive(booking.email),
    encryptSensitive(booking.notes),
  ]);
  await sql`INSERT INTO bookings (
    id, created_at, client_name, whatsapp, email, service, service_label,
    appointment_date, appointment_time, duration_minutes, price_cents, deposit_cents, balance_cents, payment_option, payment_amount_cents, balance_paid_cents,
    status, payment_status, payment_provider, payment_preference_id, payment_id,
    payment_url, payment_receipt_url, paid_at, balance_paid_at, expires_at, consent_at, management_token_hash, notes, receipt_key, receipt_name
  ) VALUES (
    ${booking.id}, ${booking.createdAt}, ${clientName}, ${whatsapp}, ${email},
    ${booking.service}, ${booking.serviceLabel}, ${booking.appointmentDate}, ${booking.appointmentTime}, ${booking.durationMinutes},
    ${booking.priceCents}, ${booking.depositCents}, ${booking.balanceCents}, ${booking.paymentOption}, ${booking.paymentAmountCents}, ${booking.balancePaidCents}, ${booking.status},
    ${booking.paymentStatus}, ${booking.paymentProvider}, ${booking.paymentPreferenceId},
    ${booking.paymentId}, ${booking.paymentUrl}, ${booking.paymentReceiptUrl}, ${booking.paidAt}, ${booking.balancePaidAt}, ${booking.expiresAt}, ${booking.consentAt}, ${managementTokenHash}, ${notes},
    ${booking.receiptKey}, ${booking.receiptName}
  )`;
}

export async function listBookings(): Promise<Booking[]> {
  await ensureBookingsSchema();
  await expireStaleBookings();
  const sql = database();
  const rows = await sql`SELECT * FROM bookings ORDER BY appointment_date ASC, appointment_time ASC`;
  return Promise.all(rows.map((row) => mapBooking(row as Record<string, unknown>)));
}

export async function updateBookingStatus(id: string, status: string) {
  await ensureBookingsSchema();
  const allowed = new Set(['pendente', 'confirmado', 'concluido', 'cancelado']);
  if (!allowed.has(status)) throw new Error('Status inválido.');
  const current = await getBooking(id);
  if (!current) throw new Error('Agendamento não encontrado.');
  if (status === 'confirmado' && current.depositCents > 0 && current.paymentStatus !== 'pago') {
    throw new Error('A reserva só pode ser confirmada após o pagamento de 50%.');
  }
  const sql = database();
  await sql`UPDATE bookings SET status = ${status} WHERE id = ${id}`;
}

export async function getBooking(id: string): Promise<Booking | null> {
  await ensureBookingsSchema();
  await expireStaleBookings();
  const sql = database();
  const rows = await sql`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`;
  return rows[0] ? await mapBooking(rows[0] as Record<string, unknown>) : null;
}

export async function listUnavailableTimes(appointmentDate: string, requestedService = ''): Promise<string[]> {
  await ensureBookingsSchema();
  await expireStaleBookings();
  const sql = database();
  const rows = await sql`SELECT appointment_time, service, duration_minutes FROM bookings WHERE appointment_date = ${appointmentDate} AND status NOT IN ('cancelado', 'expirado')`;
  const blocks = await sql`SELECT start_time, end_time FROM schedule_blocks WHERE block_date = ${appointmentDate}`;
  if (blocks.some((block) => !block.start_time || !block.end_time) || (isBridalService(requestedService) && rows.length > 0) || rows.some((row) => isBridalService(String(row.service)))) {
    return BOOKING_TIMES;
  }
  const requestedDuration = serviceDuration(requestedService);
  return BOOKING_TIMES.filter((time) => {
    const start = timeToMinutes(time);
    const end = start + requestedDuration;
    const bookingCollision = rows.some((row) => rangesOverlap(start, end, timeToMinutes(String(row.appointment_time)), timeToMinutes(String(row.appointment_time)) + Number(row.duration_minutes || 90)));
    const blockCollision = blocks.some((block) => rangesOverlap(start, end, timeToMinutes(String(block.start_time)), timeToMinutes(String(block.end_time))));
    return bookingCollision || blockCollision;
  });
}

export async function assertBookingAvailability(appointmentDate: string, appointmentTime: string, requestedService: string, excludeId = '') {
  await ensureBookingsSchema();
  await expireStaleBookings();
  const sql = database();
  const rows = await sql`SELECT appointment_time, service, duration_minutes FROM bookings WHERE appointment_date = ${appointmentDate} AND status NOT IN ('cancelado', 'expirado') AND (${excludeId} = '' OR id != ${excludeId})`;
  const blocks = await sql`SELECT start_time, end_time FROM schedule_blocks WHERE block_date = ${appointmentDate}`;
  if (blocks.some((block) => !block.start_time || !block.end_time)) throw new Error('Esta data está bloqueada na agenda.');
  if (isBridalService(requestedService) && rows.length > 0) {
    throw new Error('Esta data não está disponível para o Dia da Noiva, pois a experiência é exclusiva.');
  }
  if (rows.some((row) => isBridalService(String(row.service)))) {
    throw new Error('Esta data está reservada com exclusividade para uma noiva.');
  }
  const start = timeToMinutes(appointmentTime);
  const end = start + serviceDuration(requestedService);
  if (rows.some((row) => rangesOverlap(start, end, timeToMinutes(String(row.appointment_time)), timeToMinutes(String(row.appointment_time)) + Number(row.duration_minutes || 90)))) {
    throw new Error('Este horário está indisponível. Escolha outro horário.');
  }
  if (blocks.some((block) => rangesOverlap(start, end, timeToMinutes(String(block.start_time)), timeToMinutes(String(block.end_time))))) throw new Error('Este período está bloqueado na agenda.');
}

export async function updatePaymentPreference(id: string, provider: string, preferenceId: string | null, paymentUrl: string | null) {
  await ensureBookingsSchema();
  const sql = database();
  const paymentStatus = provider === 'unavailable' ? 'configuracao_pendente' : 'aguardando';
  await sql`UPDATE bookings
    SET payment_provider = ${provider}, payment_preference_id = ${preferenceId}, payment_url = ${paymentUrl}, payment_status = ${paymentStatus}
    WHERE id = ${id}`;
}

export async function updatePaymentResult(input: {
  bookingId: string;
  paymentId: string;
  paymentStatus: string;
  paidAt: number | null;
  confirmBooking: boolean;
  paymentReceiptUrl?: string | null;
}) {
  await ensureBookingsSchema();
  const sql = database();
  await sql`UPDATE bookings
    SET payment_id = ${input.paymentId},
        payment_status = ${input.paymentStatus},
        paid_at = ${input.paidAt},
        payment_receipt_url = COALESCE(${input.paymentReceiptUrl || null}, payment_receipt_url),
        status = CASE WHEN ${input.confirmBooking} THEN 'confirmado' ELSE status END,
        expires_at = CASE WHEN ${input.confirmBooking} THEN NULL ELSE expires_at END
    WHERE id = ${input.bookingId}`;
}

async function mapBooking(row: Record<string, unknown>): Promise<Booking> {
  const [clientName, whatsapp, email, notes] = await Promise.all([
    decryptSensitive(row.client_name),
    decryptSensitive(row.whatsapp),
    decryptSensitive(row.email),
    decryptSensitive(row.notes),
  ]);
  return {
    id: String(row.id),
    createdAt: Number(row.created_at),
    clientName: clientName || '',
    whatsapp: whatsapp || '',
    email,
    service: String(row.service),
    serviceLabel: String(row.service_label),
    appointmentDate: String(row.appointment_date),
    appointmentTime: String(row.appointment_time),
    durationMinutes: Number(row.duration_minutes ?? 90),
    priceCents: Number(row.price_cents),
    depositCents: Number(row.deposit_cents ?? 0),
    balanceCents: Number(row.balance_cents ?? 0),
    paymentOption: row.payment_option === 'full' ? 'full' : 'deposit',
    paymentAmountCents: Number(row.payment_amount_cents ?? row.deposit_cents ?? 0),
    balancePaidCents: Number(row.balance_paid_cents ?? 0),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    paymentProvider: row.payment_provider ? String(row.payment_provider) : null,
    paymentPreferenceId: row.payment_preference_id ? String(row.payment_preference_id) : null,
    paymentId: row.payment_id ? String(row.payment_id) : null,
    paymentUrl: row.payment_url ? String(row.payment_url) : null,
    paymentReceiptUrl: row.payment_receipt_url ? String(row.payment_receipt_url) : null,
    paidAt: row.paid_at ? Number(row.paid_at) : null,
    balancePaidAt: row.balance_paid_at ? Number(row.balance_paid_at) : null,
    expiresAt: row.expires_at ? Number(row.expires_at) : null,
    consentAt: row.consent_at ? Number(row.consent_at) : null,
    notes,
    receiptKey: row.receipt_key ? String(row.receipt_key) : null,
    receiptName: row.receipt_name ? String(row.receipt_name) : null,
  };
}

export async function expireStaleBookings() {
  await ensureBookingsSchema();
  await database()`UPDATE bookings SET status = 'expirado', payment_status = 'expirado'
    WHERE status = 'pendente' AND payment_status IN ('aguardando', 'configuracao_pendente') AND expires_at IS NOT NULL AND expires_at <= ${Date.now()}`;
}

export function pendingExpiry() { return Date.now() + PENDING_TTL_MS; }

export async function listScheduleBlocks(): Promise<ScheduleBlock[]> {
  await ensureBookingsSchema();
  const rows = await database()`SELECT * FROM schedule_blocks ORDER BY block_date ASC, start_time ASC`;
  return rows.map((row) => ({ id: String(row.id), blockDate: String(row.block_date), startTime: row.start_time ? String(row.start_time) : null, endTime: row.end_time ? String(row.end_time) : null, reason: String(row.reason), createdAt: Number(row.created_at) }));
}

export async function createScheduleBlock(input: Omit<ScheduleBlock, 'id' | 'createdAt'>) {
  await ensureBookingsSchema();
  const id = `BLK-${crypto.randomUUID()}`;
  await database()`INSERT INTO schedule_blocks (id, block_date, start_time, end_time, reason, created_at) VALUES (${id}, ${input.blockDate}, ${input.startTime}, ${input.endTime}, ${input.reason}, ${Date.now()})`;
  return id;
}

export async function deleteScheduleBlock(id: string) {
  await ensureBookingsSchema();
  await database()`DELETE FROM schedule_blocks WHERE id = ${id}`;
}

export async function listExpenses(): Promise<Expense[]> {
  await ensureBookingsSchema();
  const rows = await database()`SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC`;
  return rows.map((row) => ({ id: String(row.id), expenseDate: String(row.expense_date), description: String(row.description), category: String(row.category), amountCents: Number(row.amount_cents), createdAt: Number(row.created_at) }));
}

export async function createExpense(input: Omit<Expense, 'id' | 'createdAt'>) {
  await ensureBookingsSchema();
  const id = `EXP-${crypto.randomUUID()}`;
  await database()`INSERT INTO expenses (id, expense_date, description, category, amount_cents, created_at) VALUES (${id}, ${input.expenseDate}, ${input.description}, ${input.category}, ${input.amountCents}, ${Date.now()})`;
  return id;
}

export async function deleteExpense(id: string) {
  await ensureBookingsSchema();
  await database()`DELETE FROM expenses WHERE id = ${id}`;
}

export async function updateBookingDetails(id: string, input: { clientName: string; whatsapp: string; email: string | null; service: string; appointmentDate: string; appointmentTime: string; notes: string | null }) {
  await ensureBookingsSchema();
  const catalog = SERVICE_CATALOG[input.service];
  if (!catalog) throw new Error('Serviço inválido.');
  await assertBookingAvailability(input.appointmentDate, input.appointmentTime, input.service, id);
  const [clientName, whatsapp, email, notes] = await Promise.all([encryptSensitive(input.clientName), encryptSensitive(input.whatsapp), encryptSensitive(input.email), encryptSensitive(input.notes)]);
  const priceCents = catalog.priceCents;
  const current = await getBooking(id);
  if (!current) throw new Error('Agendamento não encontrado.');
  const paymentAmountCents = current.paymentStatus === 'pago' ? current.paymentAmountCents : Math.round(priceCents * (current.paymentOption === 'full' ? 1 : .5));
  await database()`UPDATE bookings SET client_name = ${clientName}, whatsapp = ${whatsapp}, email = ${email}, service = ${input.service}, service_label = ${catalog.label}, appointment_date = ${input.appointmentDate}, appointment_time = ${input.appointmentTime}, duration_minutes = ${catalog.durationMinutes}, price_cents = ${priceCents}, deposit_cents = ${Math.round(priceCents * .5)}, balance_cents = ${Math.max(0, priceCents - paymentAmountCents)}, payment_amount_cents = ${paymentAmountCents}, notes = ${notes} WHERE id = ${id}`;
}

export async function markBalanceReceived(id: string, amountCents: number) {
  await ensureBookingsSchema();
  const booking = await getBooking(id);
  if (!booking || booking.paymentStatus !== 'pago') throw new Error('A reserva precisa estar paga antes de registrar o saldo.');
  const open = Math.max(0, booking.priceCents - booking.paymentAmountCents - booking.balancePaidCents);
  if (amountCents <= 0 || amountCents > open) throw new Error('Valor do saldo inválido.');
  await database()`UPDATE bookings SET balance_paid_cents = balance_paid_cents + ${amountCents}, balance_paid_at = ${Date.now()}, balance_cents = GREATEST(0, balance_cents - ${amountCents}) WHERE id = ${id}`;
}

export async function setManagementToken(id: string, token: string) {
  await ensureBookingsSchema();
  await database()`UPDATE bookings SET management_token_hash = ${await hashToken(token)} WHERE id = ${id}`;
}

export async function getManagedBooking(id: string, token: string) {
  await ensureBookingsSchema();
  if (!token || token.length < 32) return null;
  const rows = await database()`SELECT management_token_hash FROM bookings WHERE id = ${id} LIMIT 1`;
  const expected = rows[0]?.management_token_hash ? String(rows[0].management_token_hash) : '';
  if (!expected || !safeEqual(expected, await hashToken(token))) return null;
  return getBooking(id);
}

export async function cancelManagedBooking(id: string) {
  await ensureBookingsSchema();
  await database()`UPDATE bookings SET status = 'cancelado' WHERE id = ${id}`;
}

export async function renewPendingBooking(id: string, expiresAt: number) {
  await ensureBookingsSchema();
  await database()`UPDATE bookings SET status = 'pendente', payment_status = 'aguardando', expires_at = ${expiresAt}, payment_id = NULL, paid_at = NULL WHERE id = ${id} AND payment_status != 'pago'`;
}

export async function anonymizeBooking(id: string) {
  await ensureBookingsSchema();
  const [name, whatsapp] = await Promise.all([encryptSensitive('Cliente removida'), encryptSensitive('Não disponível')]);
  await database()`UPDATE bookings SET client_name = ${name}, whatsapp = ${whatsapp}, email = NULL, notes = NULL, management_token_hash = NULL WHERE id = ${id}`;
}

export async function reserveNotification(bookingId: string, kind: string) {
  await ensureBookingsSchema();
  const id = `NTF-${crypto.randomUUID()}`;
  const rows = await database()`INSERT INTO notification_deliveries (id, booking_id, kind, status, created_at) VALUES (${id}, ${bookingId}, ${kind}, 'pending', ${Date.now()}) ON CONFLICT (booking_id, kind) DO UPDATE SET id = EXCLUDED.id, status = 'pending', created_at = EXCLUDED.created_at, error = NULL WHERE notification_deliveries.status = 'failed' RETURNING id`;
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function finishNotification(id: string, delivered: boolean, error = '') {
  await ensureBookingsSchema();
  await database()`UPDATE notification_deliveries SET status = ${delivered ? 'delivered' : 'failed'}, delivered_at = ${delivered ? Date.now() : null}, error = ${error || null} WHERE id = ${id}`;
}

export async function listReminderCandidates(date: string) {
  await ensureBookingsSchema();
  await expireStaleBookings();
  const rows = await database()`SELECT * FROM bookings WHERE appointment_date = ${date} AND payment_status = 'pago' AND status = 'confirmado' ORDER BY appointment_time`;
  return Promise.all(rows.map((row) => mapBooking(row as Record<string, unknown>)));
}

async function hashToken(token: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function serviceDuration(service: string) {
  return SERVICE_CATALOG[service]?.durationMinutes || 90;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}
