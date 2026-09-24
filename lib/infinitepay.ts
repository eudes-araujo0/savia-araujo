import type { Booking } from '../db/schema';
import { runtimeValue } from './runtime-env';

const API_BASE = 'https://api.checkout.infinitepay.io';

export type InfinitePayCheck = {
  success?: boolean;
  paid?: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
};

export type InfinitePayReference = {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
  receiptUrl?: string | null;
};

export async function createInfinitePayCheckout(booking: Booking, origin: string) {
  const handle = infinitePayHandle();
  if (!handle) throw new Error('INFINITEPAY_HANDLE não configurada.');
  const siteOrigin = trustedSiteOrigin(origin);
  const query = new URLSearchParams({
    payment: 'success',
    booking: booking.id,
    provider: 'infinitepay',
  });
  const response = await fetch(`${API_BASE}/links`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle,
      order_nsu: booking.id,
      redirect_url: `${siteOrigin}/agendar?${query.toString()}`,
      webhook_url: `${siteOrigin}/api/infinitepay/webhook`,
      customer: {
        name: booking.clientName,
        email: booking.email || undefined,
        phone_number: normalizePhone(booking.whatsapp),
      },
      items: [{
        quantity: 1,
        price: booking.paymentAmountCents,
        description: `${booking.paymentOption === 'full' ? 'Pagamento integral' : 'Sinal de 50%'} - ${booking.serviceLabel}`,
      }],
    }),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({})) as { url?: string; message?: string };
  if (!response.ok || !result.url) throw new Error(result.message || 'A InfinitePay não criou o link de pagamento.');
  const paymentUrl = safeCheckoutUrl(result.url);
  if (!paymentUrl) throw new Error('A InfinitePay devolveu um endereço de pagamento inválido.');
  return { preferenceId: booking.id, paymentUrl };
}

export async function checkInfinitePayPayment(reference: InfinitePayReference) {
  const handle = infinitePayHandle();
  if (!handle) throw new Error('INFINITEPAY_HANDLE não configurada.');
  const response = await fetch(`${API_BASE}/payment_check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle,
      order_nsu: reference.orderNsu,
      transaction_nsu: reference.transactionNsu,
      slug: reference.slug,
    }),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({})) as InfinitePayCheck & { message?: string };
  if (!response.ok || result.success === false) throw new Error(result.message || 'Não foi possível conferir o pagamento na InfinitePay.');
  return result;
}

export function assertInfinitePayPayment(booking: Booking, reference: InfinitePayReference, payment: InfinitePayCheck) {
  if (reference.orderNsu !== booking.id) throw new Error('O pagamento não pertence a esta reserva.');
  if (!reference.transactionNsu || !reference.slug) throw new Error('Identificação do pagamento incompleta.');
  if (!payment.paid) throw new Error('O pagamento ainda não foi aprovado pela InfinitePay.');
  if (Number(payment.amount || 0) < booking.paymentAmountCents) throw new Error('O valor aprovado é menor que o valor da reserva.');
}

export function infinitePayHandle() {
  const handle = runtimeValue('INFINITEPAY_HANDLE').replace(/^\$/, '').trim();
  return /^[A-Za-z0-9._-]{2,80}$/.test(handle) ? handle : '';
}

function trustedSiteOrigin(value: string) {
  const origin = new URL(value).origin;
  if (process.env.NODE_ENV === 'production' && !origin.startsWith('https://')) {
    throw new Error('NEXT_PUBLIC_SITE_URL deve usar HTTPS em produção.');
  }
  return origin;
}

function safeCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const trustedHostname = hostname === 'infinitepay.io'
      || hostname.endsWith('.infinitepay.io')
      || hostname === 'infinitepay.com.br'
      || hostname.endsWith('.infinitepay.com.br');
    return url.protocol === 'https:' && !url.username && !url.password && trustedHostname ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^55/, '');
  return digits ? `+55${digits}` : undefined;
}
