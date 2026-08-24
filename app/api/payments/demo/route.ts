import { NextResponse } from 'next/server';
import { getBooking, updatePaymentResult } from '../../../../db/bookings';
import { verifyDemoToken } from '../../../../lib/mercado-pago';
import { runtimeFlag } from '../../../../lib/runtime-env';

export async function POST(request: Request) {
  if (!runtimeFlag('PAYMENTS_DEMO_MODE')) return NextResponse.json({ error: 'Modo demonstração desativado.' }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { booking?: string; token?: string };
  if (!body.booking || !body.token || !(await verifyDemoToken(body.booking, body.token))) {
    return NextResponse.json({ error: 'Pagamento demonstrativo inválido.' }, { status: 401 });
  }
  const booking = await getBooking(body.booking);
  if (!booking || booking.paymentProvider !== 'demo') return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });

  await updatePaymentResult({
    bookingId: booking.id,
    paymentId: `DEMO-${Date.now()}`,
    paymentStatus: 'pago',
    paidAt: Date.now(),
    confirmBooking: true,
  });
  return NextResponse.json({ ok: true });
}
