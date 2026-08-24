import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../lib/admin-auth';

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return NextResponse.json(
    { error: 'Comprovantes manuais não são utilizados. A confirmação vem diretamente do Mercado Pago.' },
    { status: 410 },
  );
}
