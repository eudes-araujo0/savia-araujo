import type { Booking } from '../db/schema';
import { createInfinitePayCheckout, infinitePayHandle } from './infinitepay';

export type PaymentMode = 'infinitepay' | 'unavailable';

export function getPaymentMode(): PaymentMode {
  return infinitePayHandle() ? 'infinitepay' : 'unavailable';
}

export async function createPaymentCheckout(booking: Booking, origin: string) {
  if (getPaymentMode() === 'unavailable') {
    throw new Error('A InfiniteTag ainda não foi configurada para pagamentos em produção.');
  }
  const checkout = await createInfinitePayCheckout(booking, origin);
  return { mode: 'infinitepay' as const, ...checkout };
}
