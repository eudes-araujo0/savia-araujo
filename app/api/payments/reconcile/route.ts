import { NextResponse } from 'next/server';
import { getBooking, updatePaymentResult } from '../../../../db/bookings';
import { getAdminSession } from '../../../../lib/admin-auth';
import { reconcileInfinitePayBooking, reconcileMercadoPagoBooking } from '../../../../lib/payment-reconciliation';
import { isSameOriginRequest } from '../../../../lib/request-security';
import { notifyBooking } from '../../../../lib/notifications';

type ReconcileRequest = {
  bookingId?: string;
  paymentId?: string;
  transactionNsu?: string;
  slug?: string;
  receiptUrl?: string;
  action?: 'sync' | 'manual-paid';
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Formato de solicitação inválido.' }, { status: 415 });
  }
  const body = await request.json().catch(() => ({})) as ReconcileRequest;
  if (Object.keys(body).some((key) => !['bookingId', 'paymentId', 'transactionNsu', 'slug', 'receiptUrl', 'action'].includes(key))) {
    return NextResponse.json({ error: 'A solicitação contém campos não permitidos.' }, { status: 400 });
  }
  const bookingId = body.bookingId?.trim() || '';
  const action = body.action || 'sync';
  if (!/^SAV-\d{8}-[A-Z0-9]{6}$/.test(bookingId) || !['sync', 'manual-paid'].includes(action) || (body.paymentId && !/^\d{1,30}$/.test(body.paymentId))) {
    return NextResponse.json({ error: 'Dados de pagamento inválidos.' }, { status: 400 });
  }

  const admin = await getAdminSession();
  if (action === 'manual-paid' && admin?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (action === 'sync' && !admin && !body.paymentId && !(body.transactionNsu && body.slug)) return NextResponse.json({ error: 'Pagamento não informado.' }, { status: 401 });

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
      if (booking.paymentStatus !== 'pago') await notifyBooking({ ...booking, paymentStatus: 'pago', status: 'confirmado' }, 'payment_approved').catch(() => undefined);
      return NextResponse.json({ ok: true, paymentStatus: 'pago', source: 'manual' }, { headers: { 'cache-control': 'no-store' } });
    }

    if (booking.paymentProvider === 'demo') {
      if (booking.paymentStatus === 'pago') return NextResponse.json({ ok: true, paymentStatus: 'pago', source: 'demo' });
      throw new Error('O pagamento demonstrativo ainda não foi concluído.');
    }

    if (booking.paymentProvider === 'infinitepay') {
      const transactionNsu = safeId(body.transactionNsu);
      const slug = safeId(body.slug);
      if (!transactionNsu || !slug) {
        if (admin) throw new Error('Abra a reserva após o retorno da cliente para sincronizar a InfinitePay automaticamente.');
        throw new Error('Identificação do pagamento InfinitePay incompleta.');
      }
      const result = await reconcileInfinitePayBooking(booking, { orderNsu: booking.id, transactionNsu, slug, receiptUrl: safeUrl(body.receiptUrl) });
      if (booking.paymentStatus !== 'pago') await notifyBooking({ ...booking, paymentStatus: 'pago', status: 'confirmado' }, 'payment_approved').catch(() => undefined);
      return NextResponse.json({ ok: true, paymentStatus: result.paymentStatus, source: 'infinitepay' }, { headers: { 'cache-control': 'no-store' } });
    }

    const result = await reconcileMercadoPagoBooking(booking, body.paymentId?.trim() || undefined);
    if (result.approved && booking.paymentStatus !== 'pago') await notifyBooking({ ...booking, paymentStatus: 'pago', status: 'confirmado' }, 'payment_approved').catch(() => undefined);
    return NextResponse.json({ ok: true, paymentStatus: result.paymentStatus, source: 'mercado_pago' }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível conferir o pagamento.' }, { status: 400 });
  }
}

function safeId(value: unknown) { return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,180}$/.test(value) ? value : ''; }
function safeUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
}
