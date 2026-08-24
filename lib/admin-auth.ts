import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { runtimeValue } from './runtime-env';

export const ADMIN_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-savia_admin_session' : 'savia_admin_session';
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

type AdminSession = { username: string; expiresAt: number; role: 'master' };

export async function verifyAdminCredentials(username: string, password: string) {
  const expectedUser = runtimeValue('ADMIN_USERNAME');
  const expectedHash = runtimeValue('ADMIN_PASSWORD_HASH');
  const expectedPassword = runtimeValue('ADMIN_PASSWORD');
  if (!expectedUser || (!expectedHash && !expectedPassword)) return false;
  const validPassword = expectedHash ? await verifyPasswordHash(password, expectedHash) : await safeTextEqual(password, expectedPassword);
  return (await safeTextEqual(username.trim(), expectedUser)) && validPassword;
}

export async function createAdminToken(username: string): Promise<string> {
  const session: AdminSession = { username, expiresAt: Date.now() + ADMIN_SESSION_SECONDS * 1000, role: 'master' };
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
  if (!(await safeTextEqual(providedSignature, expectedSignature))) return null;
  try {
    const value = JSON.parse(base64UrlDecode(payload)) as Partial<AdminSession>;
    const expiresAt = Number(value.expiresAt);
    if (!value.username || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    const expectedUser = runtimeValue('ADMIN_USERNAME');
    if (!expectedUser || !(await safeTextEqual(value.username, expectedUser))) return null;
    return { username: value.username, expiresAt, role: 'master' };
  } catch {
    return null;
  }
}

export async function loginRateLimitKey(request: Request, username: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip') || 'unknown';
  return sign(`login:${ip}:${username.trim().toLocaleLowerCase('pt-BR')}`);
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

async function verifyPasswordHash(password: string, encoded: string) {
  const [algorithm, roundsValue, saltValue, expectedValue] = encoded.split('$');
  const rounds = Number(roundsValue);
  if (algorithm !== 'pbkdf2-sha256' || !Number.isInteger(rounds) || rounds < 210000 || !saltValue || !expectedValue) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltValue), iterations: rounds }, key, 256);
    return safeTextEqual(bytesToHex(new Uint8Array(bits)), expectedValue.toLowerCase());
  } catch {
    return false;
  }
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

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) throw new Error('Hexadecimal inválido.');
  return Uint8Array.from(value.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
