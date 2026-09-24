import { NextResponse } from 'next/server';
import { getBusinessSchedule, saveBusinessSchedule } from '../../../../db/schedule';
import { getAdminSession } from '../../../../lib/admin-auth';
import { isSameOriginRequest } from '../../../../lib/request-security';
import { timeToMinutes } from '../../../../lib/business-hours';

const intervals = new Set([15, 30, 45, 60, 90, 120, 150, 180]);

export async function GET() {
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return NextResponse.json({ schedule: await getBusinessSchedule() }, { headers: { 'cache-control': 'no-store' } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return NextResponse.json({ error: 'Formato inválido.' }, { status: 415 });
  const body = await request.json().catch(() => null) as { openDays?: unknown; startTime?: unknown; endTime?: unknown; slotIntervalMinutes?: unknown } | null;
  if (!body || Object.keys(body).some((key) => !['openDays', 'startTime', 'endTime', 'slotIntervalMinutes'].includes(key))) return NextResponse.json({ error: 'Campos inválidos.' }, { status: 400 });
  const openDays = Array.isArray(body.openDays) ? [...new Set(body.openDays.map(Number))].sort() : [];
  const startTime = validTime(body.startTime);
  const endTime = validTime(body.endTime);
  const slotIntervalMinutes = Number(body.slotIntervalMinutes);
  if (!openDays.length || openDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return NextResponse.json({ error: 'Escolha pelo menos um dia de funcionamento.' }, { status: 400 });
  if (!startTime || !endTime || timeToMinutes(endTime) <= timeToMinutes(startTime)) return NextResponse.json({ error: 'O fim do expediente deve ser posterior ao início.' }, { status: 400 });
  if (!intervals.has(slotIntervalMinutes)) return NextResponse.json({ error: 'Intervalo inválido.' }, { status: 400 });
  if (timeToMinutes(endTime) - timeToMinutes(startTime) < slotIntervalMinutes) return NextResponse.json({ error: 'O expediente precisa comportar pelo menos um intervalo.' }, { status: 400 });
  const schedule = await saveBusinessSchedule({ openDays, startTime, endTime, slotIntervalMinutes });
  return NextResponse.json({ ok: true, schedule });
}

function validTime(value: unknown) {
  const time = typeof value === 'string' ? value : '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return '';
  return time;
}
