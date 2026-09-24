import { NextResponse } from 'next/server';
import { getBookingAvailability } from '../../../../db/bookings';
import { getService } from '../../../../db/services';
import { isValidIsoDate, todayInSaoPaulo } from '../../../../lib/business-hours';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const date = searchParams.get('date') || '';
  const service = searchParams.get('service') || '';
  if (!isValidIsoDate(date) || date < todayInSaoPaulo()) return NextResponse.json({ error: 'Escolha uma data válida a partir de hoje.' }, { status: 400 });
  const catalogItem = service ? await getService(service) : null;
  if (service && !catalogItem) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 400 });
  return NextResponse.json(await getBookingAvailability(date, service, catalogItem?.durationMinutes), { headers: { 'cache-control': 'no-store' } });
}
