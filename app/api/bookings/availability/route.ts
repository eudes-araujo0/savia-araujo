import { NextResponse } from 'next/server';
import { getBookingAvailability, getMonthBookingAvailability } from '../../../../db/bookings';
import { getService } from '../../../../db/services';
import { isBookableDate, maximumBookingDate, todayInSaoPaulo } from '../../../../lib/business-hours';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const date = searchParams.get('date') || '';
  const month = searchParams.get('month') || '';
  const service = searchParams.get('service') || '';
  if (month) {
    const today = todayInSaoPaulo();
    const maximumMonth = maximumBookingDate(today).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month) || month < today.slice(0, 7) || month > maximumMonth) return NextResponse.json({ error: 'Escolha um mês válido.' }, { status: 400 });
    const catalogItem = service ? await getService(service) : null;
    if (service && !catalogItem) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 400 });
    return NextResponse.json({ days: await getMonthBookingAvailability(month, service, catalogItem?.durationMinutes) }, { headers: { 'cache-control': 'private, max-age=15' } });
  }
  if (!isBookableDate(date)) return NextResponse.json({ error: 'Escolha uma data válida dentro dos próximos 24 meses.' }, { status: 400 });
  const catalogItem = service ? await getService(service) : null;
  if (service && !catalogItem) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 400 });
  return NextResponse.json(await getBookingAvailability(date, service, catalogItem?.durationMinutes), { headers: { 'cache-control': 'no-store' } });
}
