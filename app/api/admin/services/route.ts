import { NextResponse } from 'next/server';
import { listServices, updateService } from '../../../../db/services';
import { getAdminSession } from '../../../../lib/admin-auth';
import { isSameOriginRequest } from '../../../../lib/request-security';

export async function GET() {
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return NextResponse.json({ services: await listServices(true) }, { headers: { 'cache-control': 'no-store' } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Formato de solicitação inválido.' }, { status: 415 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const allowed = ['code', 'name', 'tagline', 'description', 'features', 'priceCents', 'durationMinutes', 'active'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return NextResponse.json({ error: 'Campo não permitido.' }, { status: 400 });
  try {
    const service = await updateService({
      code: typeof body.code === 'string' ? body.code : '',
      name: typeof body.name === 'string' ? body.name : '',
      tagline: typeof body.tagline === 'string' ? body.tagline : '',
      description: typeof body.description === 'string' ? body.description : '',
      features: Array.isArray(body.features) ? body.features.map(String) : [],
      priceCents: Number(body.priceCents),
      durationMinutes: Number(body.durationMinutes),
      active: body.active === true,
    });
    return NextResponse.json({ ok: true, service, services: await listServices(true) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o serviço.' }, { status: 400 });
  }
}
