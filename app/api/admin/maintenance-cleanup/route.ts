import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { database } from '../../../../db/client';

export const dynamic = 'force-dynamic';

const TOKEN_HASH = 'd4757cb87991f5923f38c89e1ff6e5e88fd15d9ec873a2a5bedc63d9a0682797';

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const data = await snapshot();
  return NextResponse.json(
    { exportedAt: new Date().toISOString(), counts: counts(data), data },
    { headers: { 'cache-control': 'no-store, max-age=0' } },
  );
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (request.headers.get('x-cleanup-confirmation') !== 'LIMPAR-DADOS-DE-TESTE') {
    return NextResponse.json({ error: 'Confirmação inválida.' }, { status: 400 });
  }

  const before = await snapshot();
  const sql = database();
  await sql`DELETE FROM notification_deliveries`;
  await sql`DELETE FROM bookings`;
  await sql`DELETE FROM expenses`;
  await sql`DELETE FROM schedule_blocks`;
  await sql`DELETE FROM booking_attempts`;
  await sql`DELETE FROM login_attempts`;
  const after = await snapshot();

  return NextResponse.json({ ok: true, removed: counts(before), remaining: counts(after) }, { headers: { 'cache-control': 'no-store, max-age=0' } });
}

async function snapshot() {
  const sql = database();
  const [bookings, expenses, scheduleBlocks, notificationDeliveries, bookingAttempts, loginAttempts] = await Promise.all([
    sql`SELECT * FROM bookings ORDER BY created_at`,
    sql`SELECT * FROM expenses ORDER BY created_at`,
    sql`SELECT * FROM schedule_blocks ORDER BY created_at`,
    sql`SELECT * FROM notification_deliveries ORDER BY created_at`,
    sql`SELECT * FROM booking_attempts ORDER BY window_started`,
    sql`SELECT * FROM login_attempts ORDER BY window_started`,
  ]);
  return { bookings, expenses, scheduleBlocks, notificationDeliveries, bookingAttempts, loginAttempts };
}

function counts(data: Awaited<ReturnType<typeof snapshot>>) {
  return Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length]));
}

function authorized(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const received = Buffer.from(createHash('sha256').update(token).digest('hex'));
  const expected = Buffer.from(TOKEN_HASH);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
