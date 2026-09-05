import { NextResponse } from 'next/server';
import {
  anonymizeBooking, assertBookingAvailability, createBooking, createExpense, createScheduleBlock,
  deleteExpense, deleteScheduleBlock, listExpenses, listScheduleBlocks, markBalanceReceived,
  setManagementToken, updateBookingDetails,
} from '../../../../db/bookings';
import type { Booking } from '../../../../db/schema';
import { getAdminSession } from '../../../../lib/admin-auth';
import { isSameOriginRequest } from '../../../../lib/request-security';
import { BOOKING_TIMES, SERVICE_CATALOG } from '../../../../lib/service-catalog';

export async function GET() {
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const [blocks, expenses] = await Promise.all([listScheduleBlocks(), listExpenses()]);
  return NextResponse.json({ blocks, expenses }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = await jsonBody(request);
  if (!body) return NextResponse.json({ error: 'Formato inválido.' }, { status: 415 });
  try {
    if (body.action === 'create-block') {
      assertKeys(body, ['action', 'date', 'fullDay', 'startTime', 'endTime', 'reason']);
      const date = validDate(body.date);
      const fullDay = body.fullDay === true;
      const startTime = fullDay ? null : validTime(body.startTime);
      const endTime = fullDay ? null : validTime(body.endTime);
      const reason = validText(body.reason, 2, 120, 'Informe o motivo do bloqueio.');
      if (!fullDay && timeToMinutes(startTime!) >= timeToMinutes(endTime!)) throw new Error('O fim do bloqueio deve ser posterior ao início.');
      const id = await createScheduleBlock({ blockDate: date, startTime, endTime, reason });
      return NextResponse.json({ ok: true, id });
    }
    if (body.action === 'create-expense') {
      assertKeys(body, ['action', 'date', 'description', 'category', 'amountCents']);
      const id = await createExpense({ expenseDate: validDate(body.date), description: validText(body.description, 2, 160, 'Informe a descrição.'), category: validText(body.category, 2, 60, 'Informe a categoria.'), amountCents: validMoney(body.amountCents) });
      return NextResponse.json({ ok: true, id });
    }
    if (body.action === 'create-booking') {
      assertKeys(body, ['action', 'clientName', 'whatsapp', 'email', 'service', 'date', 'time', 'paymentOption', 'paid', 'notes']);
      const service = validService(body.service);
      const catalog = SERVICE_CATALOG[service];
      const date = validDate(body.date);
      const time = validBookingTime(body.time);
      await assertBookingAvailability(date, time, service);
      const paymentOption = body.paymentOption === 'full' ? 'full' : 'deposit';
      const paymentAmountCents = paymentOption === 'full' ? catalog.priceCents : Math.round(catalog.priceCents * .5);
      const paid = body.paid === true;
      const now = Date.now();
      const id = `SAV-${date.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const booking: Booking = {
        id, createdAt: now, clientName: validText(body.clientName, 2, 120, 'Informe o nome da cliente.'), whatsapp: validPhone(body.whatsapp), email: optionalEmail(body.email),
        service, serviceLabel: catalog.label, appointmentDate: date, appointmentTime: time, durationMinutes: catalog.durationMinutes,
        priceCents: catalog.priceCents, depositCents: Math.round(catalog.priceCents * .5), balanceCents: catalog.priceCents - (paid ? paymentAmountCents : 0), paymentOption, paymentAmountCents,
        balancePaidCents: 0, status: paid ? 'confirmado' : 'pendente', paymentStatus: paid ? 'pago' : 'aguardando', paymentProvider: 'manual', paymentPreferenceId: null, paymentId: paid ? `MANUAL-${now}` : null, paymentUrl: null,
        paidAt: paid ? now : null, balancePaidAt: null, expiresAt: null, consentAt: now, notes: optionalText(body.notes, 1200), receiptKey: null, receiptName: null, paymentReceiptUrl: null,
      };
      await createBooking(booking);
      await setManagementToken(id, `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`);
      return NextResponse.json({ ok: true, id });
    }
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível concluir.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = await jsonBody(request);
  if (!body) return NextResponse.json({ error: 'Formato inválido.' }, { status: 415 });
  try {
    const id = validBookingId(body.id);
    if (body.action === 'update-booking') {
      assertKeys(body, ['action', 'id', 'clientName', 'whatsapp', 'email', 'service', 'date', 'time', 'notes']);
      await updateBookingDetails(id, { clientName: validText(body.clientName, 2, 120, 'Informe o nome.'), whatsapp: validPhone(body.whatsapp), email: optionalEmail(body.email), service: validService(body.service), appointmentDate: validDate(body.date), appointmentTime: validBookingTime(body.time), notes: optionalText(body.notes, 1200) });
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'receive-balance') {
      assertKeys(body, ['action', 'id', 'amountCents']);
      await markBalanceReceived(id, validMoney(body.amountCents));
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'anonymize-booking') {
      assertKeys(body, ['action', 'id']);
      await anonymizeBooking(id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const id = params.get('id') || '';
  if (!/^(BLK|EXP)-[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400 });
  if (type === 'block') await deleteScheduleBlock(id);
  else if (type === 'expense') await deleteExpense(id);
  else return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

async function jsonBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null;
  return request.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}
function validText(value: unknown, min: number, max: number, message: string) { const text = typeof value === 'string' ? value.trim() : ''; if (text.length < min || text.length > max) throw new Error(message); return text; }
function optionalText(value: unknown, max: number) { const text = typeof value === 'string' ? value.trim() : ''; if (text.length > max) throw new Error('Texto acima do limite permitido.'); return text || null; }
function validDate(value: unknown) { const date = typeof value === 'string' ? value : ''; if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) throw new Error('Data inválida.'); return date; }
function validTime(value: unknown) { const time = typeof value === 'string' ? value : ''; if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('Horário inválido.'); return time; }
function validBookingTime(value: unknown) { const time = validTime(value)!; if (!BOOKING_TIMES.includes(time)) throw new Error('Horário fora da agenda.'); return time; }
function validService(value: unknown) { const service = typeof value === 'string' ? value : ''; if (!SERVICE_CATALOG[service]) throw new Error('Serviço inválido.'); return service; }
function validMoney(value: unknown) { const amount = Number(value); if (!Number.isInteger(amount) || amount <= 0 || amount > 100000000) throw new Error('Valor inválido.'); return amount; }
function validPhone(value: unknown) { const phone = validText(value, 10, 30, 'Informe um WhatsApp válido.'); const digits = phone.replace(/\D/g, ''); if (digits.length < 10 || digits.length > 13) throw new Error('Informe um WhatsApp válido.'); return phone; }
function optionalEmail(value: unknown) { const email = typeof value === 'string' ? value.trim() : ''; if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('E-mail inválido.'); return email || null; }
function validBookingId(value: unknown) { const id = typeof value === 'string' ? value : ''; if (!/^SAV-\d{8}-[A-Z0-9]{6}$/.test(id)) throw new Error('Reserva inválida.'); return id; }
function timeToMinutes(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }
function assertKeys(body: Record<string, unknown>, allowed: string[]) { if (Object.keys(body).some((key) => !allowed.includes(key))) throw new Error('A solicitação contém campos não permitidos.'); }
