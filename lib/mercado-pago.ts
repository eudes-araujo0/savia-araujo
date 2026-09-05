import type { Booking } from '../db/schema';
import { runtimeFlag, runtimeValue } from './runtime-env';
import { createInfinitePayCheckout, infinitePayHandle } from './infinitepay';

export type PaymentMode = 'infinitepay' | 'mercado_pago' | 'demo' | 'unavailable';

export type MercadoPagoPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string | null;
  date_created?: string | null;
};

export function getPaymentMode(): PaymentMode {
  if (runtimeFlag('PAYMENTS_DEMO_MODE')) return 'demo';
  const preferred = runtimeValue('PAYMENT_PROVIDER').toLowerCase();
  if (preferred === 'infinitepay') return infinitePayHandle() ? 'infinitepay' : 'unavailable';
  if (preferred === 'mercado_pago') return runtimeValue('MERCADO_PAGO_ACCESS_TOKEN') ? 'mercado_pago' : 'unavailable';
  if (infinitePayHandle()) return 'infinitepay';
  return runtimeValue('MERCADO_PAGO_ACCESS_TOKEN') ? 'mercado_pago' : 'unavailable';
}

export async function createPaymentCheckout(booking: Booking, origin: string, managementToken = '') {
  const mode = getPaymentMode();
  if (mode === 'demo') {
    const token = await createDemoToken(booking.id);
    return {
      mode,
      preferenceId: `DEMO-${booking.id}`,
      paymentUrl: `${origin}/agendar/pagamento-demo?booking=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(token)}${managementToken ? `&manage=${encodeURIComponent(managementToken)}` : ''}`,
    };
  }
  if (mode === 'unavailable') return { mode, preferenceId: null, paymentUrl: null };
  if (mode === 'infinitepay') {
    const checkout = await createInfinitePayCheckout(booking, origin);
    return { mode, ...checkout };
  }

  const accessToken = runtimeValue('MERCADO_PAGO_ACCESS_TOKEN');
  const expirationDate = new Date(booking.expiresAt || Date.now() + 30 * 60 * 1000).toISOString();
  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-idempotency-key': booking.id,
    },
    body: JSON.stringify({
      items: [{
        id: `sinal-${booking.id}`,
        title: `${booking.paymentOption === 'full' ? 'Pagamento integral' : 'Sinal de 50%'} · ${booking.serviceLabel}`,
        description: `Reserva ${booking.appointmentDate} às ${booking.appointmentTime}`,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: booking.paymentAmountCents / 100,
      }],
      payer: { name: booking.clientName, email: booking.email || undefined },
      external_reference: booking.id,
      notification_url: `${origin}/api/mercado-pago/webhook?source_news=webhooks`,
      back_urls: {
        success: `${origin}/agendar?payment=success&booking=${encodeURIComponent(booking.id)}`,
        pending: `${origin}/agendar?payment=pending&booking=${encodeURIComponent(booking.id)}`,
        failure: `${origin}/agendar?payment=failure&booking=${encodeURIComponent(booking.id)}`,
      },
      auto_return: 'approved',
      expires: true,
      expiration_date_to: expirationDate,
      statement_descriptor: 'SAVIA MAKEUP',
    }),
  });

  const result = await response.json() as { id?: string; init_point?: string; sandbox_init_point?: string; message?: string };
  if (!response.ok || !result.id || !result.init_point) {
    throw new Error(result.message || 'Mercado Pago não criou a preferência de pagamento.');
  }
  const isTest = accessToken.startsWith('TEST-');
  return {
    mode,
    preferenceId: result.id,
    paymentUrl: isTest ? (result.sandbox_init_point || result.init_point) : result.init_point,
  };
}

export async function verifyDemoToken(bookingId: string, token: string) {
  const expected = await createDemoToken(bookingId);
  return safeEqual(expected, token);
}

export async function verifyMercadoPagoWebhook(request: Request, dataId: string) {
  const secret = runtimeValue('MERCADO_PAGO_WEBHOOK_SECRET');
  if (!secret) return false;
  const xSignature = request.headers.get('x-signature') || '';
  const xRequestId = request.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(xSignature.split(',').map((part) => part.trim().split('=', 2)));
  if (!parts.ts || !parts.v1 || !xRequestId || !dataId) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  return safeEqual(bytesToHex(new Uint8Array(signature)), parts.v1);
}

export async function fetchMercadoPagoPayment(paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: `Bearer ${runtimeValue('MERCADO_PAGO_ACCESS_TOKEN')}` },
  });
  const result = await response.json() as MercadoPagoPayment;
  if (!response.ok || !result.id) throw new Error('Pagamento não encontrado no Mercado Pago.');
  return result;
}

export async function findMercadoPagoPayment(bookingId: string) {
  const url = new URL('https://api.mercadopago.com/v1/payments/search');
  url.searchParams.set('external_reference', bookingId);
  url.searchParams.set('sort', 'date_created');
  url.searchParams.set('criteria', 'desc');
  url.searchParams.set('limit', '20');
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${runtimeValue('MERCADO_PAGO_ACCESS_TOKEN')}` },
  });
  const result = await response.json() as { results?: MercadoPagoPayment[] };
  if (!response.ok) throw new Error('Não foi possível consultar o pagamento no Mercado Pago.');
  const payments = (result.results || []).filter((payment) => payment.external_reference === bookingId);
  return payments.find((payment) => payment.status === 'approved') || payments[0] || null;
}

export function mapMercadoPagoPaymentStatus(status: string) {
  if (status === 'approved') return 'pago';
  if (['pending', 'in_process', 'authorized'].includes(status)) return 'em_analise';
  if (['refunded', 'charged_back'].includes(status)) return 'estornado';
  if (status === 'cancelled') return 'cancelado';
  return 'rejeitado';
}

async function createDemoToken(bookingId: string) {
  const secret = runtimeValue('ADMIN_SESSION_SECRET');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`demo-payment:${bookingId}`));
  return bytesToHex(new Uint8Array(signature));
}

async function safeEqual(left: string, right: string) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(left)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(right)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < aa.length; index += 1) difference |= aa[index] ^ bb[index];
  return difference === 0;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
