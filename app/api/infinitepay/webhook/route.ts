import { NextResponse } from 'next/server';
import { getBooking, updatePaymentResult } from '../../../../db/bookings';
import { assertInfinitePayPayment, checkInfinitePayPayment } from '../../../../lib/infinitepay';
import { notifyBooking } from '../../../../lib/notifications';

type WebhookBody = {
  invoice_slug?: string;
  amount?: number;
  transaction_nsu?: string;
  order_nsu?: string;
  receipt_url?: string;
};

export async function POST(request: Request) {
  try {
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return NextResponse.json({ success: false, message: 'Formato inválido.' }, { status: 400 });
    }
    const body = await request.json().catch(() => null) as WebhookBody | null;
    const orderNsu = clean(body?.order_nsu, 80);
    const transactionNsu = clean(body?.transaction_nsu, 120);
    const slug = clean(body?.invoice_slug, 160);
    if (!bookingId(orderNsu) || !transactionNsu || !slug) {
      return NextResponse.json({ success: false, message: 'Identificação inválida.' }, { status: 400 });
    }

    const booking = await getBooking(orderNsu);
    if (!booking || booking.paymentProvider !== 'infinitepay') {
      return NextResponse.json({ success: false, message: 'Pedido não encontrado.' }, { status: 400 });
    }
    const reference = { orderNsu, transactionNsu, slug, receiptUrl: safeReceiptUrl(body?.receipt_url) };
    const payment = await checkInfinitePayPayment(reference);
    assertInfinitePayPayment(booking, reference, payment);
    await updatePaymentResult({
      bookingId: booking.id,
      paymentId: transactionNsu,
      paymentStatus: 'pago',
      paidAt: Date.now(),
      confirmBooking: true,
      paymentReceiptUrl: reference.receiptUrl,
    });
    if (booking.paymentStatus !== 'pago') {
      await notifyBooking({ ...booking, paymentStatus: 'pago', status: 'confirmado' }, 'payment_approved').catch((error) => console.error('infinitepay-notification-failed', error));
    }
    return NextResponse.json({ success: true, message: null });
  } catch (error) {
    console.error('infinitepay-webhook-failed', error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Falha ao validar pagamento.' }, { status: 400 });
  }
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' && value.length <= max ? value.trim() : '';
}
function bookingId(value: string) { return /^SAV-\d{8}-[A-Z0-9]{6}$/.test(value); }
function safeReceiptUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
}
