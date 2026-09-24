import type { Booking } from '../db/schema';
import { updatePaymentResult } from '../db/bookings';
import { assertInfinitePayPayment, checkInfinitePayPayment, type InfinitePayReference } from './infinitepay';

export async function reconcileInfinitePayBooking(booking: Booking, reference: InfinitePayReference) {
  if (booking.paymentProvider !== 'infinitepay') throw new Error('Esta reserva não utiliza a InfinitePay.');
  const payment = await checkInfinitePayPayment(reference);
  assertInfinitePayPayment(booking, reference, payment);
  const paidAt = Date.now();
  await updatePaymentResult({
    bookingId: booking.id,
    paymentId: reference.transactionNsu,
    paymentStatus: 'pago',
    paidAt,
    confirmBooking: true,
    paymentReceiptUrl: reference.receiptUrl || null,
  });
  return { paymentId: reference.transactionNsu, paymentStatus: 'pago', approved: true, paidAt, paymentReceiptUrl: reference.receiptUrl || null };
}
