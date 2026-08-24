import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminToken, loginRateLimitKey, verifyAdminCredentials } from '../../../../lib/admin-auth';
import { checkLoginRateLimit, clearFailedLogins, recordFailedLogin } from '../../../../db/security';
import { isSameOriginRequest } from '../../../../lib/request-security';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Formato de solicitação inválido.' }, { status: 415 });
  }
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  if (Object.keys(body).some((key) => !['username', 'password'].includes(key))) {
    return NextResponse.json({ error: 'A solicitação contém campos não permitidos.' }, { status: 400 });
  }
  const username = body.username?.trim() || '';
  const password = body.password || '';
  if (!username || username.length > 80 || password.length < 8 || password.length > 256) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  const rateKey = await loginRateLimitKey(request, username);
  const rateLimit = await checkLoginRateLimit(rateKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' },
      { status: 429, headers: { 'retry-after': String(rateLimit.retryAfter), 'cache-control': 'no-store' } },
    );
  }
  if (!(await verifyAdminCredentials(username, password))) {
    await recordFailedLogin(rateKey);
    return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  await clearFailedLogins(rateKey);

  const response = NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  response.cookies.set(ADMIN_COOKIE, await createAdminToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_SECONDS,
    priority: 'high',
  });
  return response;
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/admin/login', request.url));
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0, priority: 'high' });
  return response;
}
