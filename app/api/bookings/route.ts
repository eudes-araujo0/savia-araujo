import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../lib/admin-auth';
import { createPaymentCheckout } from '../../../lib/mercado-pago';
import { createBooking, listBookings, updateBookingStatus, updatePaymentPreference } from '../../../db/bookings';
import type { Booking } from '../../../db/schema';

const allowedTimes = new Set(['08:00', '09:30', '11:00', '13:30', '15:00', '16:30', '18:00', '19:30']);

const serviceCatalog: Record<string, { label: string; priceCents: number }> = {
  social: { label: 'Maquiagem social', priceCents: 22000 },
  noiva: { label: 'Experiência noiva', priceCents: 79000 },
  editorial: { label: 'Editorial & ensaio', priceCents: 0 },
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const service = text(form, 'service');
    const clientName = text(form, 'name');
    const whatsapp = text(form, 'whatsapp');
    const appointmentDate = text(form, 'date');
    const appointmentTime = text(form, 'time');
    const catalogItem = serviceCatalog[service];

    if (!catalogItem || !clientName || !whatsapp || !appointmentDate || !appointmentTime) {
      return NextResponse.json({ error: 'Preencha os dados obrigatórios do agendamento.' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !allowedTimes.has(appointmentTime) || appointmentDate < todayInSaoPaulo()) {
      return NextResponse.json({ error: 'Data ou horário inválido.' }, { status: 400 });
    }

    const id = `SAV-${appointmentDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const depositCents = catalogItem.priceCents ? Math.round(catalogItem.priceCents * 0.5) : 0;
    const booking: Booking = {
      id,
      createdAt: Date.now(),
      clientName: clientName.slice(0, 120),
      whatsapp: whatsapp.slice(0, 30),
      email: text(form, 'email').slice(0, 160) || null,
      service,
      serviceLabel: catalogItem.label,
      appointmentDate,
      appointmentTime,
      priceCents: catalogItem.priceCents,
      depositCents,
      balanceCents: catalogItem.priceCents - depositCents,
      status: 'pendente',
      paymentStatus: depositCents ? 'aguardando' : 'nao_aplicavel',
      paymentProvider: null,
      paymentPreferenceId: null,
      paymentId: null,
      paymentUrl: null,
      paidAt: null,
      notes: text(form, 'notes').slice(0, 1200) || null,
      receiptKey: null,
      receiptName: null,
    };

    try {
      await createBooking(booking);
    } catch (databaseError) {
      const message = databaseError instanceof Error ? databaseError.message : '';
      if (/unique|constraint/i.test(message)) return NextResponse.json({ error: 'Este horário acabou de ser reservado. Escolha outro horário.' }, { status: 409 });
      throw databaseError;
    }

    if (!depositCents) return NextResponse.json({ id, depositCents, balanceCents: 0, paymentMode: 'unavailable', paymentUrl: null }, { status: 201 });

    try {
      const checkout = await createPaymentCheckout(booking, new URL(request.url).origin);
      await updatePaymentPreference(id, checkout.mode === 'demo' ? 'demo' : 'mercado_pago', checkout.preferenceId, checkout.paymentUrl);
      return NextResponse.json({ id, depositCents, balanceCents: booking.balanceCents, paymentMode: checkout.mode, paymentUrl: checkout.paymentUrl }, { status: 201 });
    } catch (paymentError) {
      console.error('payment-preference-failed', paymentError);
      return NextResponse.json({ id, depositCents, balanceCents: booking.balanceCents, paymentMode: 'unavailable', paymentUrl: null, paymentError: 'A reserva foi registrada, mas o pagamento está temporariamente indisponível.' }, { status: 201 });
    }
  } catch (error) {
    console.error('booking-create-failed', error);
    return NextResponse.json({ error: 'Não foi possível registrar agora. Tente novamente em instantes.' }, { status: 500 });
  }
}

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return NextResponse.json({ bookings: await listBookings() });
}

export async function PATCH(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = (await request.json()) as { id?: string; status?: string };
  if (!body.id || !body.status) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
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
