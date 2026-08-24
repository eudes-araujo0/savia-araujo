import { NextResponse } from 'next/server';
import { getBooking, updatePaymentResult } from '../../../../db/bookings';
import { getAdminSession } from '../../../../lib/admin-auth';
import { reconcileMercadoPagoBooking } from '../../../../lib/payment-reconciliation';
import { isSameOriginRequest } from '../../../../lib/request-security';

type ReconcileRequest = {
  bookingId?: string;
  paymentId?: string;
  action?: 'sync' | 'manual-paid';
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Formato de solicitação inválido.' }, { status: 415 });
  }
  const body = await request.json().catch(() => ({})) as ReconcileRequest;
  if (Object.keys(body).some((key) => !['bookingId', 'paymentId', 'action'].includes(key))) {
    return NextResponse.json({ error: 'A solicitação contém campos não permitidos.' }, { status: 400 });
  }
  const bookingId = body.bookingId?.trim() || '';
  const action = body.action || 'sync';
  if (!/^SAV-\d{8}-[A-Z0-9]{6}$/.test(bookingId) || !['sync', 'manual-paid'].includes(action) || (body.paymentId && !/^\d{1,30}$/.test(body.paymentId))) {
    return NextResponse.json({ error: 'Dados de pagamento inválidos.' }, { status: 400 });
  }

  const admin = await getAdminSession();
  if (action === 'manual-paid' && admin?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (action === 'sync' && !admin && !body.paymentId) return NextResponse.json({ error: 'Pagamento não informado.' }, { status: 401 });

  const booking = await getBooking(bookingId);
  if (!booking) return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });

  try {
    if (action === 'manual-paid') {
      if (booking.paymentAmountCents <= 0) throw new Error('Esta reserva não possui valor de pagamento definido.');
      await updatePaymentResult({
        bookingId: booking.id,
        paymentId: `MANUAL-${Date.now()}`,
        paymentStatus: 'pago',
        paidAt: Date.now(),
        confirmBooking: true,
      });
      return NextResponse.json({ ok: true, paymentStatus: 'pago', source: 'manual' }, { headers: { 'cache-control': 'no-store' } });
    }

    if (booking.paymentProvider === 'demo') {
      if (booking.paymentStatus === 'pago') return NextResponse.json({ ok: true, paymentStatus: 'pago', source: 'demo' });
      throw new Error('O pagamento demonstrativo ainda não foi concluído.');
    }

    const result = await reconcileMercadoPagoBooking(booking, body.paymentId?.trim() || undefined);
    return NextResponse.json({ ok: true, paymentStatus: result.paymentStatus, source: 'mercado_pago' }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível conferir o pagamento.' }, { status: 400 });
  }
}
