import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../../lib/admin-auth';
import { getMediaSlot } from '../../../../../lib/site-media';
import { isSameOriginRequest } from '../../../../../lib/request-security';

const SMALL_UPLOAD_LIMIT = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
  if ((await getAdminSession())?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) return NextResponse.json({ error: 'Conecte um Vercel Blob público ao projeto antes de enviar imagens.' }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const slotId = params.get('slotId') || '';
  const slot = getMediaSlot(slotId);
  const filename = safeFilename(params.get('filename') || 'imagem.jpg');
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!slot) return NextResponse.json({ error: 'Área de imagem inválida.' }, { status: 400 });
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) return NextResponse.json({ error: 'Formato de imagem não permitido.' }, { status: 415 });
  if (contentLength > SMALL_UPLOAD_LIMIT) return NextResponse.json({ error: 'Arquivo acima do limite do envio rápido.' }, { status: 413 });
  try {
    const file = await request.blob();
    if (!file.size || file.size > SMALL_UPLOAD_LIMIT) throw new Error('A imagem deve ter no máximo 4 MB neste envio.');
    const blob = await put(`savia/site-media/${slot.id}/${filename}`, file, {
      access: 'public', addRandomSuffix: true, contentType, cacheControlMaxAge: 31536000,
    });
    return NextResponse.json(blob);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar a imagem.' }, { status: 400 });
  }
}

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
          allowedContentTypes: ALLOWED_IMAGE_TYPES,
          maximumSizeInBytes: 50 * 1024 * 1024,
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

function safeFilename(value: string) {
  const extension = value.toLowerCase().match(/\.(jpe?g|png|webp|avif)$/)?.[0] || '.jpg';
  const name = value.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'imagem';
  return `${name}${extension}`;
}
