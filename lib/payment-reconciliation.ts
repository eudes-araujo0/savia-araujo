import type { Booking } from '../db/schema';
import { updatePaymentResult } from '../db/bookings';
import {
  fetchMercadoPagoPayment,
  findMercadoPagoPayment,
  mapMercadoPagoPaymentStatus,
  type MercadoPagoPayment,
} from './mercado-pago';

export async function reconcileMercadoPagoBooking(booking: Booking, paymentId?: string) {
  if (booking.paymentProvider !== 'mercado_pago') {
    throw new Error('Esta reserva não utiliza o Mercado Pago.');
  }

  const payment = paymentId
    ? await fetchMercadoPagoPayment(paymentId)
    : await findMercadoPagoPayment(booking.id);
  if (!payment) throw new Error('Nenhum pagamento foi localizado para esta reserva.');
  validatePayment(booking, payment);

  const approved = payment.status === 'approved';
  const paymentStatus = mapMercadoPagoPaymentStatus(payment.status || '');
  await updatePaymentResult({
    bookingId: booking.id,
    paymentId: String(payment.id),
    paymentStatus,
    paidAt: approved ? Date.parse(payment.date_approved || new Date().toISOString()) : null,
    confirmBooking: approved,
  });
  return { paymentId: String(payment.id), paymentStatus, approved };
}

function validatePayment(booking: Booking, payment: MercadoPagoPayment) {
  if (payment.external_reference !== booking.id) {
    throw new Error('O pagamento não pertence a esta reserva.');
  }
  if (payment.currency_id !== 'BRL') throw new Error('Moeda de pagamento divergente.');
  if (Math.round(Number(payment.transaction_amount || 0) * 100) < booking.paymentAmountCents) {
    throw new Error('O valor aprovado é menor que o valor desta reserva.');
  }
}
