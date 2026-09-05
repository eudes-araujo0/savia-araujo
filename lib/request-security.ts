export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function requestFingerprint(request: Request, purpose: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const address = forwarded || request.headers.get('x-real-ip') || 'unknown';
  const agent = request.headers.get('user-agent')?.slice(0, 240) || 'unknown';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${purpose}:${address}:${agent}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
