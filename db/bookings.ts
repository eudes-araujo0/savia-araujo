import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { Booking } from './schema';

let client: NeonQueryFunction<false, false> | null = null;
let initialized: Promise<void> | null = null;

function database() {
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
      price_cents INTEGER NOT NULL,
      deposit_cents INTEGER NOT NULL DEFAULT 0,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      payment_provider TEXT,
      payment_preference_id TEXT,
      payment_id TEXT,
      payment_url TEXT,
      paid_at BIGINT,
      notes TEXT,
      receipt_key TEXT,
      receipt_name TEXT
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date ON bookings(appointment_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_status_date ON bookings(status, appointment_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_id ON bookings(payment_id) WHERE payment_id IS NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot ON bookings(appointment_date, appointment_time) WHERE status != 'cancelado'`;
  })().catch((error) => {
    initialized = null;
    throw error;
  });

  return initialized;
}

export async function createBooking(booking: Booking) {
  await ensureBookingsSchema();
  const sql = database();
  await sql`INSERT INTO bookings (
    id, created_at, client_name, whatsapp, email, service, service_label,
    appointment_date, appointment_time, price_cents, deposit_cents, balance_cents,
    status, payment_status, payment_provider, payment_preference_id, payment_id,
    payment_url, paid_at, notes, receipt_key, receipt_name
  ) VALUES (
    ${booking.id}, ${booking.createdAt}, ${booking.clientName}, ${booking.whatsapp}, ${booking.email},
    ${booking.service}, ${booking.serviceLabel}, ${booking.appointmentDate}, ${booking.appointmentTime},
    ${booking.priceCents}, ${booking.depositCents}, ${booking.balanceCents}, ${booking.status},
    ${booking.paymentStatus}, ${booking.paymentProvider}, ${booking.paymentPreferenceId},
    ${booking.paymentId}, ${booking.paymentUrl}, ${booking.paidAt}, ${booking.notes},
    ${booking.receiptKey}, ${booking.receiptName}
  )`;
}

export async function listBookings(): Promise<Booking[]> {
  await ensureBookingsSchema();
  const sql = database();
  const rows = await sql`SELECT * FROM bookings ORDER BY appointment_date ASC, appointment_time ASC`;
  return rows.map((row) => mapBooking(row as Record<string, unknown>));
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
  const sql = database();
  const rows = await sql`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`;
  return rows[0] ? mapBooking(rows[0] as Record<string, unknown>) : null;
}

export async function listUnavailableTimes(appointmentDate: string): Promise<string[]> {
  await ensureBookingsSchema();
  const sql = database();
  const rows = await sql`SELECT appointment_time FROM bookings WHERE appointment_date = ${appointmentDate} AND status != 'cancelado'`;
  return rows.map((row) => String(row.appointment_time));
}

export async function updatePaymentPreference(id: string, provider: string, preferenceId: string | null, paymentUrl: string | null) {
  await ensureBookingsSchema();
  const sql = database();
  await sql`UPDATE bookings
    SET payment_provider = ${provider}, payment_preference_id = ${preferenceId}, payment_url = ${paymentUrl}, payment_status = 'aguardando'
    WHERE id = ${id}`;
}

export async function updatePaymentResult(input: {
  bookingId: string;
  paymentId: string;
  paymentStatus: string;
  paidAt: number | null;
  confirmBooking: boolean;
}) {
  await ensureBookingsSchema();
  const sql = database();
  await sql`UPDATE bookings
    SET payment_id = ${input.paymentId},
        payment_status = ${input.paymentStatus},
        paid_at = ${input.paidAt},
        status = CASE WHEN ${input.confirmBooking} THEN 'confirmado' ELSE status END
    WHERE id = ${input.bookingId}`;
}

function mapBooking(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id),
    createdAt: Number(row.created_at),
    clientName: String(row.client_name),
    whatsapp: String(row.whatsapp),
    email: row.email ? String(row.email) : null,
    service: String(row.service),
    serviceLabel: String(row.service_label),
    appointmentDate: String(row.appointment_date),
    appointmentTime: String(row.appointment_time),
    priceCents: Number(row.price_cents),
    depositCents: Number(row.deposit_cents ?? 0),
    balanceCents: Number(row.balance_cents ?? 0),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    paymentProvider: row.payment_provider ? String(row.payment_provider) : null,
    paymentPreferenceId: row.payment_preference_id ? String(row.payment_preference_id) : null,
    paymentId: row.payment_id ? String(row.payment_id) : null,
    paymentUrl: row.payment_url ? String(row.payment_url) : null,
    paidAt: row.paid_at ? Number(row.paid_at) : null,
    notes: row.notes ? String(row.notes) : null,
    receiptKey: row.receipt_key ? String(row.receipt_key) : null,
    receiptName: row.receipt_name ? String(row.receipt_name) : null,
  };
}
