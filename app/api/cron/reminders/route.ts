import { NextResponse } from 'next/server';
import { listReminderCandidates } from '../../../../db/bookings';
import { notifyBooking } from '../../../../lib/notifications';
import { runtimeValue } from '../../../../lib/runtime-env';

export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = runtimeValue('CRON_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const base = new Date(`${today}T12:00:00Z`);
  const [tomorrow, afterTomorrow] = [addDays(base, 1), addDays(base, 2)];
  const [in24h, in48h] = await Promise.all([listReminderCandidates(iso(tomorrow)), listReminderCandidates(iso(afterTomorrow))]);
  const results = await Promise.all([
    ...in24h.map((booking) => notifyBooking(booking, 'reminder_24h')),
    ...in48h.map((booking) => notifyBooking(booking, 'reminder_48h')),
  ]);
  return NextResponse.json({ checked: results.length, delivered: results.filter((result) => result.delivered).length });
}

function addDays(value: Date, days: number) { const result = new Date(value); result.setUTCDate(result.getUTCDate() + days); return result; }
function iso(value: Date) { return value.toISOString().slice(0, 10); }
