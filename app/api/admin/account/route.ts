import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  changeAdminCredentials,
  createAdminToken,
  getAdminSession,
} from '../../../../lib/admin-auth';
import { isSameOriginRequest } from '../../../../lib/request-security';

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Formato de solicitação inválido.' }, { status: 415 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const allowedFields = ['currentPassword', 'newUsername', 'newPassword', 'confirmPassword'];
  if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
    return NextResponse.json({ error: 'A solicitação contém campos não permitidos.' }, { status: 400 });
  }
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newUsername = typeof body.newUsername === 'string' ? body.newUsername : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  if (!currentPassword || !newUsername || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'A confirmação da nova senha não confere.' }, { status: 400 });
  }

  try {
    const credentials = await changeAdminCredentials(session.username, currentPassword, newUsername, newPassword);
    const response = NextResponse.json(
      { ok: true, username: credentials.username },
      { headers: { 'cache-control': 'no-store' } },
    );
    response.cookies.set(ADMIN_COOKIE, await createAdminToken(credentials.username), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ADMIN_SESSION_SECONDS,
      priority: 'high',
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível alterar o acesso.' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }
}
