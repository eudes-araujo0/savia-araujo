import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { listSiteMediaLibrary, publishSiteMedia, restoreSiteMedia } from '../../../../db/media';
import { getAdminSession } from '../../../../lib/admin-auth';
import { getMediaSlot, type SiteMediaValue } from '../../../../lib/site-media';
import { isSameOriginRequest } from '../../../../lib/request-security';

export const dynamic = 'force-dynamic';

export async function GET() {
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    return NextResponse.json({ items: await listSiteMediaLibrary() }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return NextResponse.json({ error: 'Formato inválido.' }, { status: 415 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  try {
    if (body.action === 'publish') {
      assertKeys(body, ['action', 'slotId', 'url', 'pathname', 'alt', 'desktopX', 'desktopY', 'mobileX', 'mobileY', 'desktopZoom', 'mobileZoom']);
      const value: SiteMediaValue = {
        slotId: text(body.slotId, 80),
        url: text(body.url, 800),
        pathname: typeof body.pathname === 'string' ? body.pathname : null,
        alt: text(body.alt, 180),
        desktopX: Number(body.desktopX), desktopY: Number(body.desktopY),
        mobileX: Number(body.mobileX), mobileY: Number(body.mobileY),
        desktopZoom: Number(body.desktopZoom), mobileZoom: Number(body.mobileZoom),
        updatedAt: Date.now(),
      };
      const slot = getMediaSlot(value.slotId);
      if (!slot) throw new Error('Área de imagem inválida.');
      if (value.url !== slot.defaultUrl) {
        if (!value.pathname?.startsWith(`savia/site-media/${value.slotId}/`)) throw new Error('Caminho de arquivo inválido.');
        const uploadedUrl = new URL(value.url);
        if (decodeURIComponent(uploadedUrl.pathname.slice(1)) !== value.pathname) throw new Error('A URL não corresponde ao arquivo enviado.');
      }
      await publishSiteMedia(value);
    } else if (body.action === 'restore') {
      assertKeys(body, ['action', 'slotId', 'versionId']);
      await restoreSiteMedia(text(body.slotId, 80), text(body.versionId, 80));
    } else {
      throw new Error('Ação inválida.');
    }
    revalidatePath('/');
    revalidatePath('/agendar');
    revalidatePath('/admin/login');
    return NextResponse.json({ ok: true, items: await listSiteMediaLibrary() });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function text(value: unknown, max: number) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max) throw new Error('Campo inválido.');
  return result;
}

function assertKeys(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new Error('A solicitação contém campos não permitidos.');
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível atualizar as imagens.';
}
