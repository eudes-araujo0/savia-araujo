import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../../lib/admin-auth';
import { getMediaSlot } from '../../../../../lib/site-media';
import { isSameOriginRequest } from '../../../../../lib/request-security';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 });
  const isCompletion = body.type === 'blob.upload-completed';
  if (!isCompletion) {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
    if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) return NextResponse.json({ error: 'Conecte um Vercel Blob público ao projeto antes de enviar imagens.' }, { status: 503 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if ((await getAdminSession())?.role !== 'master') throw new Error('Não autorizado.');
        const payload = parsePayload(clientPayload);
        const slot = getMediaSlot(payload.slotId);
        if (!slot || !pathname.startsWith(`savia/site-media/${slot.id}/`)) throw new Error('Destino de imagem inválido.');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
          cacheControlMaxAge: 31536000,
          tokenPayload: JSON.stringify({ slotId: slot.id }),
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar a imagem.' }, { status: 400 });
  }
}

function parsePayload(value: string | null) {
  try {
    const payload = JSON.parse(value || '{}') as { slotId?: unknown };
    return { slotId: typeof payload.slotId === 'string' ? payload.slotId : '' };
  } catch {
    return { slotId: '' };
  }
}
