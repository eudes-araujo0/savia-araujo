import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminToken, getAdminSession, loginRateLimitKey, verifyAdminCredentials } from '../../../../lib/admin-auth';
import { checkLoginRateLimit, clearFailedLogins, recordFailedLogin } from '../../../../db/security';
import { isSameOriginRequest } from '../../../../lib/request-security';
import { loginBodyMayExceedLimit, parseLoginPayload } from '../../../../lib/login-validation';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Formato de solicitação inválido.' }, { status: 415 });
  }
  if (loginBodyMayExceedLimit(request.headers.get('content-length'))) {
    return NextResponse.json({ error: 'Solicitação muito grande.' }, { status: 413, headers: { 'cache-control': 'no-store' } });
  }
  const payload = parseLoginPayload(await request.text());
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: payload.status, headers: { 'cache-control': 'no-store' } });
  }
  const { username, password } = payload;
  if (!username || password.length < 8) {
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

export async function GET() {
  return NextResponse.json({ authenticated: Boolean(await getAdminSession()) }, { headers: { 'cache-control': 'no-store' } });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0, priority: 'high' });
  return response;
}
