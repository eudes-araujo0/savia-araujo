import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStoredAdminCredentials, saveAdminCredentials } from '../db/admin-credentials';
import { runtimeValue } from './runtime-env';

export const ADMIN_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-savia_admin_session' : 'savia_admin_session';
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

type AdminSession = { username: string; expiresAt: number; role: 'master'; credentialVersion: number };

type ActiveAdminCredentials = {
  username: string;
  passwordHash?: string;
  password?: string;
  version: number;
};

export async function verifyAdminCredentials(username: string, password: string) {
  const credentials = await activeAdminCredentials();
  if (!credentials) return false;
  const validPassword = credentials.passwordHash
    ? await verifyPasswordHash(password, credentials.passwordHash)
    : await safeTextEqual(password, credentials.password || '');
  return (await safeTextEqual(username.trim(), credentials.username)) && validPassword;
}

export async function createAdminToken(username: string): Promise<string> {
  const credentials = await activeAdminCredentials();
  if (!credentials || !(await safeTextEqual(username, credentials.username))) throw new Error('Credenciais administrativas inválidas.');
  const session: AdminSession = {
    username,
    expiresAt: Date.now() + ADMIN_SESSION_SECONDS * 1000,
    role: 'master',
    credentialVersion: credentials.version,
  };
  const payload = base64UrlEncode(JSON.stringify(session));
  return `${payload}.${await sign(payload)}`;
}

export async function changeAdminCredentials(currentUsername: string, currentPassword: string, newUsername: string, newPassword: string) {
  const username = newUsername.trim();
  if (!(await verifyAdminCredentials(currentUsername, currentPassword))) throw new Error('A senha atual está incorreta.');
  if (!/^[\p{L}\p{N}._-]{3,60}$/u.test(username)) {
    throw new Error('Use de 3 a 60 caracteres no usuário: letras, números, ponto, traço ou sublinhado.');
  }
  if (newPassword.length < 12 || newPassword.length > 256) throw new Error('A nova senha deve ter entre 12 e 256 caracteres.');
  if (!/[a-z\p{Ll}]/u.test(newPassword) || !/[A-Z\p{Lu}]/u.test(newPassword) || !/\d/.test(newPassword)) {
    throw new Error('A nova senha precisa ter letra maiúscula, letra minúscula e número.');
  }
  const stored = await saveAdminCredentials(username, await hashPassword(newPassword));
  return { username: stored.username, credentialVersion: stored.updatedAt };
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
    const credentials = await activeAdminCredentials();
    const credentialVersion = Number(value.credentialVersion ?? 0);
    if (!credentials || !(await safeTextEqual(value.username, credentials.username)) || credentialVersion !== credentials.version) return null;
    return { username: value.username, expiresAt, role: 'master', credentialVersion };
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

async function activeAdminCredentials(): Promise<ActiveAdminCredentials | null> {
  if (process.env.DATABASE_URL?.trim()) {
    const stored = await getStoredAdminCredentials();
    if (stored) return { username: stored.username, passwordHash: stored.passwordHash, version: stored.updatedAt };
  }
  const username = runtimeValue('ADMIN_USERNAME');
  const passwordHash = runtimeValue('ADMIN_PASSWORD_HASH');
  const password = runtimeValue('ADMIN_PASSWORD');
  if (!username || (!passwordHash && !password)) return null;
  return { username, passwordHash: passwordHash || undefined, password: password || undefined, version: 0 };
}

async function hashPassword(password: string) {
  const rounds = 310000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256);
  return `pbkdf2-sha256$${rounds}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
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
