import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../lib/admin-auth';
import { createPaymentCheckout } from '../../../lib/mercado-pago';
import { assertBookingAvailability, createBooking, listBookings, pendingExpiry, setManagementToken, updateBookingStatus, updatePaymentPreference } from '../../../db/bookings';
import type { Booking } from '../../../db/schema';
import { isSameOriginRequest, requestFingerprint } from '../../../lib/request-security';
import { BOOKING_TIMES, SERVICE_CATALOG } from '../../../lib/service-catalog';
import { notifyBooking } from '../../../lib/notifications';
import { runtimeValue } from '../../../lib/runtime-env';
import { checkBookingRateLimit, recordBookingAttempt } from '../../../db/security';

const allowedTimes = new Set(BOOKING_TIMES);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  try {
    const rateKey = await requestFingerprint(request, 'public-booking');
    const rate = await checkBookingRateLimit(rateKey);
    if (!rate.allowed) return NextResponse.json({ error: 'Muitas tentativas de agendamento. Aguarde um pouco e tente novamente.' }, { status: 429, headers: { 'retry-after': String(rate.retryAfter) } });
    await recordBookingAttempt(rateKey);
    const form = await request.formData();
    const allowedFields = new Set(['service', 'name', 'whatsapp', 'email', 'date', 'time', 'notes', 'paymentOption', 'consent']);
    if ([...form.keys()].some((key) => !allowedFields.has(key))) {
      return NextResponse.json({ error: 'O formulário contém campos não permitidos.' }, { status: 400 });
    }
    if ([...form.values()].some((value) => typeof value !== 'string')) {
      return NextResponse.json({ error: 'Uploads não são permitidos neste formulário.' }, { status: 403 });
    }
    const service = text(form, 'service');
    const clientName = text(form, 'name');
    const whatsapp = text(form, 'whatsapp');
    const email = text(form, 'email');
    const notes = text(form, 'notes');
    const appointmentDate = text(form, 'date');
    const appointmentTime = text(form, 'time');
    const consent = text(form, 'consent');
    const catalogItem = SERVICE_CATALOG[service];

    if (!catalogItem || !clientName || !whatsapp || !appointmentDate || !appointmentTime || consent !== 'accepted') {
      return NextResponse.json({ error: 'Preencha os dados obrigatórios do agendamento.' }, { status: 400 });
    }
    if (clientName.length < 2 || clientName.length > 120 || !/^[\p{L}\p{M} .'-]+$/u.test(clientName)) {
      return NextResponse.json({ error: 'Informe um nome válido.' }, { status: 400 });
    }
    const whatsappDigits = whatsapp.replace(/\D/g, '');
    if (whatsappDigits.length < 10 || whatsappDigits.length > 13) return NextResponse.json({ error: 'Informe um WhatsApp válido.' }, { status: 400 });
    if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    if (notes.length > 1200) return NextResponse.json({ error: 'As observações excedem o limite permitido.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !allowedTimes.has(appointmentTime) || appointmentDate < todayInSaoPaulo()) {
      return NextResponse.json({ error: 'Data ou horário inválido.' }, { status: 400 });
    }

    const id = `SAV-${appointmentDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const depositCents = catalogItem.priceCents ? Math.round(catalogItem.priceCents * 0.5) : 0;
    const requestedPaymentOption = text(form, 'paymentOption');
    if (requestedPaymentOption && !['deposit', 'full'].includes(requestedPaymentOption)) return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 });
    const paymentOption = requestedPaymentOption === 'full' ? 'full' : 'deposit';
    const paymentAmountCents = catalogItem.priceCents ? (paymentOption === 'full' ? catalogItem.priceCents : depositCents) : 0;
    const expiresAt = paymentAmountCents ? pendingExpiry() : null;
    const consentAt = Date.now();
    const managementToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
    const booking: Booking = {
      id,
      createdAt: Date.now(),
      clientName,
      whatsapp: whatsapp.slice(0, 30),
      email: email || null,
      service,
      serviceLabel: catalogItem.label,
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
      await assertBookingAvailability(appointmentDate, appointmentTime, service);
      await createBooking(booking);
      await setManagementToken(id, managementToken);
    } catch (databaseError) {
      const message = databaseError instanceof Error ? databaseError.message : '';
      if (/exclusiv|indisponível/i.test(message)) return NextResponse.json({ error: message }, { status: 409 });
      if (/unique|constraint/i.test(message)) return NextResponse.json({ error: 'Este horário acabou de ser reservado. Escolha outro horário.' }, { status: 409 });
      throw databaseError;
    }

    const origin = publicOrigin(request);
    const manageUrl = `${origin}/reserva/${encodeURIComponent(id)}?token=${encodeURIComponent(managementToken)}`;
    await notifyBooking(booking, 'booking_created', manageUrl).catch((notificationError) => console.error('booking-notification-failed', notificationError));

    if (!paymentAmountCents) return bookingResponse({ id, paymentAmountCents, balanceCents: 0, paymentMode: 'unavailable', paymentUrl: null, manageUrl }, id, managementToken);

    try {
      const checkout = await createPaymentCheckout(booking, origin, managementToken);
      await updatePaymentPreference(id, checkout.mode, checkout.preferenceId, checkout.paymentUrl);
      return bookingResponse({ id, paymentAmountCents, paymentOption, balanceCents: booking.balanceCents, paymentMode: checkout.mode, paymentUrl: checkout.paymentUrl, manageUrl }, id, managementToken);
    } catch (paymentError) {
      console.error('payment-preference-failed', paymentError);
      await updatePaymentPreference(id, 'unavailable', null, null);
      return bookingResponse({ id, paymentAmountCents, paymentOption, balanceCents: booking.balanceCents, paymentMode: 'unavailable', paymentUrl: null, manageUrl, paymentError: 'A reserva foi registrada, mas o pagamento está temporariamente indisponível.' }, id, managementToken);
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
  if (!body.id || !/^SAV-\d{8}-[A-Z0-9]{6}$/.test(body.id) || !body.status) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
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

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function bookingResponse(payload: Record<string, unknown>, id: string, token: string) {
  const response = NextResponse.json(payload, { status: 201 });
  response.cookies.set('savia_manage', `${id}.${token}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
  return response;
}
