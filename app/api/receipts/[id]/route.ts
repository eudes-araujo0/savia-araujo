import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../lib/admin-auth';

export async function GET() {
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return NextResponse.json(
    { error: 'Comprovantes manuais não são utilizados. A confirmação vem diretamente do provedor de pagamento.' },
    { status: 410 },
  );
}

export async function POST() {
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return NextResponse.json({ error: 'Uploads manuais estão desativados.' }, { status: 403 });
}
