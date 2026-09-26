import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../lib/admin-auth';
import { createPaymentCheckout, getPaymentMode } from '../../../lib/payments';
import { assertBookingAvailability, createBooking, listBookings, pendingExpiry, setManagementToken, updateBookingStatus, updatePaymentPreference } from '../../../db/bookings';
import type { Booking } from '../../../db/schema';
import { isSameOriginRequest, requestFingerprint } from '../../../lib/request-security';
import { notifyBooking } from '../../../lib/notifications';
import { runtimeValue } from '../../../lib/runtime-env';
import { consumeBookingRateLimit } from '../../../db/security';
import { getService } from '../../../db/services';
import { BookingAvailabilityError, createBookingId, isBookingId, validatePublicBookingDateTime } from '../../../lib/booking-validation';

const MAX_BOOKING_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  try {
    const rateKey = await requestFingerprint(request, 'public-booking');
    const rate = await consumeBookingRateLimit(rateKey);
    if (!rate.allowed) return NextResponse.json({ error: 'Muitas tentativas de agendamento. Aguarde um pouco e tente novamente.' }, { status: 429, headers: rateHeaders(rate) });
    const contentType = request.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      return NextResponse.json({ error: 'Formato de formulário inválido.' }, { status: 400, headers: rateHeaders(rate) });
    }
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BOOKING_BODY_BYTES) {
      return NextResponse.json({ error: 'O formulário excede o tamanho permitido.' }, { status: 413, headers: rateHeaders(rate) });
    }
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Não foi possível ler o formulário enviado.' }, { status: 400, headers: rateHeaders(rate) });
    const allowedFields = new Set(['service', 'name', 'whatsapp', 'email', 'date', 'time', 'notes', 'paymentOption', 'consent']);
    if ([...form.keys()].some((key) => !allowedFields.has(key))) {
      return NextResponse.json({ error: 'O formulário contém campos não permitidos.' }, { status: 400 });
    }
    if ([...form.values()].some((value) => typeof value !== 'string')) {
      return NextResponse.json({ error: 'Uploads não são permitidos neste formulário.' }, { status: 403 });
    }
    if ([...allowedFields].some((key) => form.getAll(key).length > 1)) {
      return NextResponse.json({ error: 'O formulário contém campos duplicados.' }, { status: 400 });
    }
    const payloadBytes = [...form.entries()].reduce((total, [key, value]) => total + key.length + (typeof value === 'string' ? value.length : value.size), 0);
    if (payloadBytes > MAX_BOOKING_BODY_BYTES) return NextResponse.json({ error: 'O formulário excede o tamanho permitido.' }, { status: 413 });
    const service = text(form, 'service');
    const clientName = text(form, 'name');
    const whatsapp = text(form, 'whatsapp');
    const email = text(form, 'email');
    const notes = text(form, 'notes');
    const appointmentDate = text(form, 'date');
    const appointmentTime = text(form, 'time');
    const consent = text(form, 'consent');
    const catalogItem = await getService(service);

    if (!catalogItem || !clientName || !whatsapp || !email || !appointmentDate || !appointmentTime || consent !== 'accepted') {
      return NextResponse.json({ error: 'Preencha os dados obrigatórios do agendamento.' }, { status: 400 });
    }
    if (clientName.length < 2 || clientName.length > 120 || !/^[\p{L}\p{M} .'-]+$/u.test(clientName)) {
      return NextResponse.json({ error: 'Informe um nome válido.' }, { status: 400 });
    }
    const whatsappDigits = whatsapp.replace(/\D/g, '');
    if (whatsappDigits.length < 10 || whatsappDigits.length > 13) return NextResponse.json({ error: 'Informe um WhatsApp válido.' }, { status: 400 });
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Informe um e-mail válido para receber a confirmação.' }, { status: 400 });
    if (notes.length > 1200) return NextResponse.json({ error: 'As observações excedem o limite permitido.' }, { status: 400 });
    const dateTime = validatePublicBookingDateTime(appointmentDate, appointmentTime);
    if (!dateTime.ok) return NextResponse.json({ error: dateTime.message }, { status: 400 });

    const id = createBookingId();
    const depositCents = catalogItem.priceCents ? Math.round(catalogItem.priceCents * 0.5) : 0;
    const requestedPaymentOption = text(form, 'paymentOption');
    if (requestedPaymentOption && !['deposit', 'full'].includes(requestedPaymentOption)) return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 });
    const paymentOption = requestedPaymentOption === 'full' ? 'full' : 'deposit';
    const paymentAmountCents = catalogItem.priceCents ? (paymentOption === 'full' ? catalogItem.priceCents : depositCents) : 0;
    if (paymentAmountCents && getPaymentMode() !== 'infinitepay') {
      return NextResponse.json({ error: 'O pagamento pela InfinitePay ainda não está configurado. Tente novamente mais tarde.' }, { status: 503 });
    }
    const expiresAt = paymentAmountCents ? pendingExpiry() : null;
    const consentAt = Date.now();
    const managementToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
    const booking: Booking = {
      id,
      createdAt: Date.now(),
      clientName,
      whatsapp: whatsapp.slice(0, 30),
      email,
      service,
      serviceLabel: catalogItem.name,
      appointmentDate,
      appointmentTime,
      durationMinutes: catalogItem.durationMinutes,
      priceCents: catalogItem.priceCents,
      depositCents,
      balanceCents: catalogItem.priceCents - paymentAmountCents,
      paymentOption,
      paymentAmountCents,
      balancePaidCents: 0,
      status: 'pendente',
      paymentStatus: depositCents ? 'aguardando' : 'nao_aplicavel',
      paymentProvider: null,
      paymentPreferenceId: null,
      paymentId: null,
      paymentUrl: null,
      paymentReceiptUrl: null,
      paidAt: null,
      balancePaidAt: null,
      expiresAt,
      consentAt,
      notes: notes || null,
      receiptKey: null,
      receiptName: null,
    };

    try {
      await assertBookingAvailability(appointmentDate, appointmentTime, service, '', catalogItem.durationMinutes);
      await createBooking(booking);
      await setManagementToken(id, managementToken);
    } catch (databaseError) {
      if (databaseError instanceof BookingAvailabilityError) return NextResponse.json({ error: databaseError.message }, { status: databaseError.status });
      const message = databaseError instanceof Error ? databaseError.message : '';
      if (/unique|constraint/i.test(message)) return NextResponse.json({ error: 'Este horário acabou de ser reservado. Escolha outro horário.' }, { status: 409 });
      throw databaseError;
    }

    const origin = publicOrigin(request);
    const manageUrl = `${origin}/reserva/${encodeURIComponent(id)}?token=${encodeURIComponent(managementToken)}`;
    await notifyBooking(booking, 'booking_created', manageUrl).catch((notificationError) => console.error('booking-notification-failed', notificationError));

    if (!paymentAmountCents) return bookingResponse({ id, paymentAmountCents, balanceCents: 0, paymentMode: 'unavailable', paymentUrl: null, manageUrl }, id, managementToken);

    try {
      const checkout = await createPaymentCheckout(booking, origin);
      await updatePaymentPreference(id, checkout.mode, checkout.preferenceId, checkout.paymentUrl);
      return bookingResponse({ id, paymentAmountCents, paymentOption, balanceCents: booking.balanceCents, paymentMode: checkout.mode, paymentUrl: checkout.paymentUrl, manageUrl }, id, managementToken);
    } catch (paymentError) {
      console.error('payment-preference-failed', paymentError);
      await updatePaymentPreference(id, 'unavailable', null, null);
      return bookingResponse({ id, paymentAmountCents, paymentOption, balanceCents: booking.balanceCents, paymentMode: 'unavailable', paymentUrl: null, manageUrl, paymentError: 'A pré-reserva foi registrada, mas a InfinitePay está temporariamente indisponível. Tente gerar o pagamento novamente pela página da reserva.' }, id, managementToken);
    }
  } catch (error) {
    console.error('booking-create-failed', error);
    return NextResponse.json({ error: 'Não foi possível registrar agora. Tente novamente em instantes.' }, { status: 500 });
  }
}

function publicOrigin(request: Request) {
  const configured = runtimeValue('NEXT_PUBLIC_SITE_URL');
  try { return configured ? new URL(configured).origin : new URL(request.url).origin; } catch { return new URL(request.url).origin; }
}

export async function GET() {
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return NextResponse.json({ bookings: await listBookings() }, { headers: { 'cache-control': 'no-store' } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return NextResponse.json({ error: 'Formato inválido.' }, { status: 415 });
  const body = await request.json().catch(() => ({})) as { id?: string; status?: string };
  if (Object.keys(body).some((key) => !['id', 'status'].includes(key))) return NextResponse.json({ error: 'A solicitação contém campos não permitidos.' }, { status: 400 });
  if (!isBookingId(body.id) || !body.status) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  try {
    await updateBookingStatus(body.id, body.status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar.' }, { status: 400 });
  }
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function bookingResponse(payload: Record<string, unknown>, id: string, token: string) {
  const response = NextResponse.json(payload, { status: 201 });
  response.cookies.set('savia_manage', `${id}.${token}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
  return response;
}

function rateHeaders(rate: { limit: number; remaining: number; retryAfter: number }) {
  const headers: Record<string, string> = {
    'x-ratelimit-limit': String(rate.limit),
    'x-ratelimit-remaining': String(rate.remaining),
  };
  if (rate.retryAfter > 0) headers['retry-after'] = String(rate.retryAfter);
  return headers;
}
