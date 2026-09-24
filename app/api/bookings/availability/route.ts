import { NextResponse } from 'next/server';
import { listUnavailableTimes } from '../../../../db/bookings';
import { getService } from '../../../../db/services';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const date = searchParams.get('date') || '';
  const service = searchParams.get('service') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  const catalogItem = service ? await getService(service) : null;
  if (service && !catalogItem) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 400 });
  return NextResponse.json({ unavailable: await listUnavailableTimes(date, service, catalogItem?.durationMinutes) });
}
