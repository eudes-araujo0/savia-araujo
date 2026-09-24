import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../lib/admin-auth';
import { sendResendTestSuite } from '../../../../lib/notifications';
import { isSameOriginRequest } from '../../../../lib/request-security';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Formato de solicitação inválido.' }, { status: 415 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== 'email')) return NextResponse.json({ error: 'Campo não permitido.' }, { status: 400 });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  }
  try {
    const result = await sendResendTestSuite(email);
    return NextResponse.json({ ok: true, sent: result.sent }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar os testes.' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
}
