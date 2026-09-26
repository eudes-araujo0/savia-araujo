import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const blobSource = 'https://*.public.blob.vercel-storage.com';
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data: ${blobSource}`,
    `media-src 'self' blob: ${blobSource}`,
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? ' ws: http: https:' : ` ${blobSource} https://blob.vercel-storage.com`}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.delete('x-powered-by');
  response.headers.delete('x-matched-path');
  return response;
}

export const config = {
  matcher: ['/', '/admin/:path*', '/agendar/:path*', '/reserva/:path*'],
};
