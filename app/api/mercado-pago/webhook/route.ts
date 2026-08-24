import { NextResponse } from 'next/server';
import { getBooking, updatePaymentResult } from '../../../../db/bookings';
import { fetchMercadoPagoPayment, verifyMercadoPagoWebhook } from '../../../../lib/mercado-pago';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({})) as { type?: string; data?: { id?: string | number } };
    if (body.type && body.type !== 'payment') return NextResponse.json({ received: true });
    const dataId = url.searchParams.get('data.id') || String(body.data?.id || '');
    if (!dataId || !(await verifyMercadoPagoWebhook(request, dataId))) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
    }

    const payment = await fetchMercadoPagoPayment(dataId);
    const bookingId = payment.external_reference || '';
    const booking = bookingId ? await getBooking(bookingId) : null;
    if (!booking || booking.paymentProvider !== 'mercado_pago') return NextResponse.json({ received: true });
    if (payment.currency_id !== 'BRL' || Math.round(Number(payment.transaction_amount || 0) * 100) < booking.depositCents) {
      return NextResponse.json({ error: 'Valor de pagamento divergente.' }, { status: 400 });
    }

    const approved = payment.status === 'approved';
    await updatePaymentResult({
      bookingId: booking.id,
      paymentId: String(payment.id),
      paymentStatus: mapPaymentStatus(payment.status || ''),
      paidAt: approved ? Date.parse(payment.date_approved || new Date().toISOString()) : null,
      confirmBooking: approved,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('mercado-pago-webhook-failed', error);
    return NextResponse.json({ error: 'Falha ao processar notificação.' }, { status: 500 });
  }
}

function mapPaymentStatus(status: string) {
  if (status === 'approved') return 'pago';
  if (['pending', 'in_process', 'authorized'].includes(status)) return 'em_analise';
  if (['refunded', 'charged_back'].includes(status)) return 'estornado';
  if (status === 'cancelled') return 'cancelado';
  return 'rejeitado';
}
