import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { runtimeValue } from './runtime-env';

export const ADMIN_COOKIE = 'savia_admin_session';
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

type AdminSession = { username: string; expiresAt: number };

export async function verifyAdminCredentials(username: string, password: string) {
  const expectedUser = runtimeValue('ADMIN_USERNAME');
  const expectedPassword = runtimeValue('ADMIN_PASSWORD');
  if (!expectedUser || !expectedPassword) return false;
  return (await safeTextEqual(username.trim(), expectedUser)) && (await safeTextEqual(password, expectedPassword));
}

export async function createAdminToken(username: string): Promise<string> {
  const session: AdminSession = { username, expiresAt: Date.now() + ADMIN_SESSION_SECONDS * 1000 };
  const payload = base64UrlEncode(JSON.stringify(session));
  return `${payload}.${await sign(payload)}`;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value ?? '');
}

export async function requireAdminSession(returnTo = '/admin'): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session) return session;
  redirect(`/admin/login?next=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) return null;
  const expectedSignature = await sign(payload);
  if (!safeTextEqual(providedSignature, expectedSignature)) return null;
  try {
    const value = JSON.parse(base64UrlDecode(payload)) as AdminSession;
    if (!value.username || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return null;
    return value;
  } catch {
    return null;
  }
}

async function sign(value: string) {
  const secret = runtimeValue('ADMIN_SESSION_SECRET');
  if (!secret) throw new Error('ADMIN_SESSION_SECRET não configurado.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function safeTextEqual(left: string, right: string) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(left)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(right)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < aa.length; index += 1) difference |= aa[index] ^ bb[index];
  return difference === 0;
}

function safeReturnPath(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/admin';
}

function base64UrlEncode(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
