import { NextResponse } from 'next/server';
import { assertBookingAvailability, cancelManagedBooking, getManagedBooking, pendingExpiry, renewPendingBooking, updateBookingDetails, updatePaymentPreference } from '../../../../db/bookings';
import { createPaymentCheckout } from '../../../../lib/mercado-pago';
import { notifyBooking } from '../../../../lib/notifications';
import { isSameOriginRequest } from '../../../../lib/request-security';
import { runtimeValue } from '../../../../lib/runtime-env';
import { BOOKING_TIMES } from '../../../../lib/service-catalog';

type ManageBody = { id?: string; token?: string; action?: 'cancel' | 'reschedule' | 'retry-payment'; date?: string; time?: string };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return NextResponse.json({ error: 'Formato inválido.' }, { status: 415 });
  const body = await request.json().catch(() => ({})) as ManageBody;
  if (Object.keys(body).some((key) => !['id', 'token', 'action', 'date', 'time'].includes(key))) return NextResponse.json({ error: 'Campos não permitidos.' }, { status: 400 });
  const id = body.id?.trim() || '';
  const token = body.token?.trim() || '';
  if (!/^SAV-\d{8}-[A-Z0-9]{6}$/.test(id) || !body.action) return NextResponse.json({ error: 'Reserva inválida.' }, { status: 400 });
  const booking = await getManagedBooking(id, token);
  if (!booking) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 401 });

  try {
    if (body.action === 'cancel') {
      if (booking.status === 'cancelado') return NextResponse.json({ ok: true, status: 'cancelado' });
      await cancelManagedBooking(id);
      await notifyBooking({ ...booking, status: 'cancelado' }, 'cancelled').catch(() => undefined);
      return NextResponse.json({ ok: true, status: 'cancelado' });
    }

    if (body.action === 'reschedule') {
      const date = body.date?.trim() || '';
      const time = body.time?.trim() || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayInSaoPaulo() || !BOOKING_TIMES.includes(time)) return NextResponse.json({ error: 'Data ou horário inválido.' }, { status: 400 });
      if (booking.status === 'cancelado') return NextResponse.json({ error: 'Uma reserva cancelada não pode ser reagendada por este link.' }, { status: 409 });
      if (booking.status === 'expirado') return NextResponse.json({ error: 'A pré-reserva expirou. Primeiro verifique o horário e gere um novo pagamento.' }, { status: 409 });
      if (hoursUntil(booking.appointmentDate, booking.appointmentTime) < 48) return NextResponse.json({ error: 'Para alterações com menos de 48 horas, fale diretamente com Sávia pelo WhatsApp.' }, { status: 409 });
      await updateBookingDetails(id, { clientName: booking.clientName, whatsapp: booking.whatsapp, email: booking.email, service: booking.service, appointmentDate: date, appointmentTime: time, notes: booking.notes });
      const updated = { ...booking, appointmentDate: date, appointmentTime: time };
      await notifyBooking(updated, 'rescheduled', `${publicOrigin(request)}/reserva/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`).catch(() => undefined);
      return NextResponse.json({ ok: true, booking: publicBooking(updated) });
    }

    if (booking.paymentStatus === 'pago') return NextResponse.json({ error: 'Este pagamento já foi aprovado.' }, { status: 409 });
    await assertBookingAvailability(booking.appointmentDate, booking.appointmentTime, booking.service, booking.id);
    const expiresAt = pendingExpiry();
    await renewPendingBooking(id, expiresAt);
    const checkout = await createPaymentCheckout({ ...booking, status: 'pendente', paymentStatus: 'aguardando', expiresAt }, publicOrigin(request), token);
    await updatePaymentPreference(id, checkout.mode, checkout.preferenceId, checkout.paymentUrl);
    if (!checkout.paymentUrl) return NextResponse.json({ error: 'O pagamento está temporariamente indisponível.' }, { status: 503 });
    const response = NextResponse.json({ ok: true, paymentUrl: checkout.paymentUrl });
    response.cookies.set('savia_manage', `${id}.${token}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar a reserva.' }, { status: 400 });
  }
}

function publicBooking(booking: Awaited<ReturnType<typeof getManagedBooking>> & object) {
  if (!booking) return null;
  return { id: booking.id, serviceLabel: booking.serviceLabel, appointmentDate: booking.appointmentDate, appointmentTime: booking.appointmentTime, status: booking.status, paymentStatus: booking.paymentStatus };
}

function publicOrigin(request: Request) {
  const configured = runtimeValue('NEXT_PUBLIC_SITE_URL');
  try { return configured ? new URL(configured).origin : new URL(request.url).origin; } catch { return new URL(request.url).origin; }
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function hoursUntil(date: string, time: string) {
  return (Date.parse(`${date}T${time}:00-03:00`) - Date.now()) / 3_600_000;
}
