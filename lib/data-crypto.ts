import { runtimeValue } from './runtime-env';

const PREFIX = 'enc:v1:';

export async function encryptSensitive(value: string | null) {
  if (value === null || value === '') return value;
  if (value.startsWith(PREFIX)) return value;
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return `${PREFIX}${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSensitive(value: unknown) {
  if (value === null || value === undefined || value === '') return value ? String(value) : null;
  const encoded = String(value);
  if (!encoded.startsWith(PREFIX)) return encoded;
  const [ivValue, payloadValue] = encoded.slice(PREFIX.length).split('.', 2);
  if (!ivValue || !payloadValue) throw new Error('Dado criptografado inválido.');
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivValue) },
    await encryptionKey(),
    fromBase64Url(payloadValue),
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptionKey() {
  const secret = runtimeValue('DATA_ENCRYPTION_KEY');
  if (!secret || secret.length < 32) throw new Error('DATA_ENCRYPTION_KEY deve ter ao menos 32 caracteres.');
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
