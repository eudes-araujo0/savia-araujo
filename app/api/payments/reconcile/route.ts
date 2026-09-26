import { NextResponse } from 'next/server';
import { getBooking } from '../../../../db/bookings';
import { getAdminSession } from '../../../../lib/admin-auth';
import { reconcileInfinitePayBooking } from '../../../../lib/payment-reconciliation';
import { isSameOriginRequest } from '../../../../lib/request-security';
import { notifyBooking } from '../../../../lib/notifications';
import { isBookingId } from '../../../../lib/booking-validation';

type ReconcileRequest = {
  bookingId?: string;
  transactionNsu?: string;
  slug?: string;
  receiptUrl?: string;
  action?: 'sync';
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Formato de solicitação inválido.' }, { status: 415 });
  }
  const body = await request.json().catch(() => ({})) as ReconcileRequest;
  if (Object.keys(body).some((key) => !['bookingId', 'transactionNsu', 'slug', 'receiptUrl', 'action'].includes(key))) {
    return NextResponse.json({ error: 'A solicitação contém campos não permitidos.' }, { status: 400 });
  }
  const bookingId = body.bookingId?.trim() || '';
  const action = body.action || 'sync';
  if (!isBookingId(bookingId) || action !== 'sync') {
    return NextResponse.json({ error: 'Dados de pagamento inválidos.' }, { status: 400 });
  }

  const admin = await getAdminSession();
  if (!admin && !(body.transactionNsu && body.slug)) return NextResponse.json({ error: 'Pagamento não informado.' }, { status: 401 });

  const booking = await getBooking(bookingId);
  if (!booking) return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });

  try {
    if (booking.paymentProvider !== 'infinitepay') {
      throw new Error('Esta reserva não possui uma cobrança válida da InfinitePay.');
    }
    const transactionNsu = safeId(body.transactionNsu);
    const slug = safeId(body.slug);
    if (!transactionNsu || !slug) {
      if (admin) throw new Error('A confirmação manual foi desativada. O pagamento só é aprovado após validação direta na InfinitePay.');
      throw new Error('Identificação do pagamento InfinitePay incompleta.');
    }
    const result = await reconcileInfinitePayBooking(booking, { orderNsu: booking.id, transactionNsu, slug, receiptUrl: safeUrl(body.receiptUrl) });
    if (booking.paymentStatus !== 'pago') await notifyBooking({ ...booking, paymentStatus: 'pago', status: 'confirmado', paymentId: result.paymentId, paidAt: result.paidAt, paymentReceiptUrl: result.paymentReceiptUrl }, 'payment_approved').catch(() => undefined);
    return NextResponse.json({ ok: true, paymentStatus: result.paymentStatus, source: 'infinitepay' }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível conferir o pagamento.' }, { status: 400 });
  }
}

function safeId(value: unknown) { return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,180}$/.test(value) ? value : ''; }
function safeUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
}
