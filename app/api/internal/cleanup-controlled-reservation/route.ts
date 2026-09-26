import { NextResponse } from 'next/server';
import { database } from '../../../../../db/client';

const TARGET_ID = 'SAV-20990102-D0E079';
const TOKEN_HASH = '7ea3b985d632be1028a4bf202f7849aaf19a748e3e634d9328581258e70e7a40';

export async function GET(request: Request) {
  if (!(await authorized(request))) return new NextResponse(null, { status: 404 });
  const rows = await database()`SELECT id, appointment_date, appointment_time, status, payment_status, service_label
    FROM bookings WHERE id = ${TARGET_ID} LIMIT 1`;
  const record = rows[0];
  return NextResponse.json({
    found: Boolean(record),
    record: record ? {
      id: String(record.id), appointmentDate: String(record.appointment_date), appointmentTime: String(record.appointment_time),
      status: String(record.status), paymentStatus: String(record.payment_status), serviceLabel: String(record.service_label),
    } : null,
  }, { headers: { 'cache-control': 'no-store' } });
}

export async function DELETE(request: Request) {
  if (!(await authorized(request))) return new NextResponse(null, { status: 404 });
  const sql = database();
  const rows = await sql`SELECT appointment_date, appointment_time FROM bookings WHERE id = ${TARGET_ID} LIMIT 1`;
  const record = rows[0];
  if (!record) return NextResponse.json({ ok: true, removed: false });
  if (String(record.appointment_date) !== '2099-01-02' || String(record.appointment_time) !== '08:00') {
    return NextResponse.json({ error: 'O alvo não corresponde à reserva controlada.' }, { status: 409 });
  }
  await sql`DELETE FROM notification_deliveries WHERE booking_id = ${TARGET_ID}`;
  const deleted = await sql`DELETE FROM bookings WHERE id = ${TARGET_ID} AND appointment_date = '2099-01-02' AND appointment_time = '08:00' RETURNING id`;
  return NextResponse.json({ ok: true, removed: deleted.length === 1 });
}

async function authorized(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (token.length !== 64) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  let difference = actual.length ^ TOKEN_HASH.length;
  for (let index = 0; index < Math.max(actual.length, TOKEN_HASH.length); index += 1) {
    difference |= (actual.charCodeAt(index) || 0) ^ (TOKEN_HASH.charCodeAt(index) || 0);
  }
  return difference === 0;
}
