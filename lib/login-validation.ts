const MAX_LOGIN_BODY_BYTES = 2_048;

type ValidLoginPayload = { ok: true; username: string; password: string };
type InvalidLoginPayload = { ok: false; status: 400 | 413; error: string };

export type LoginPayloadResult = ValidLoginPayload | InvalidLoginPayload;

export function parseLoginPayload(rawBody: string): LoginPayloadResult {
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_LOGIN_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Solicitação muito grande.' };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: 'Solicitação inválida.' };
  }

  if (!isPlainRecord(value)) return { ok: false, status: 400, error: 'Solicitação inválida.' };
  if (Object.keys(value).some((key) => !['username', 'password'].includes(key))) {
    return { ok: false, status: 400, error: 'Solicitação inválida.' };
  }
  if (typeof value.username !== 'string' || typeof value.password !== 'string') {
    return { ok: false, status: 400, error: 'Solicitação inválida.' };
  }

  const username = value.username.normalize('NFKC').trim();
  const password = value.password;
  if (username.length > 80 || password.length > 256) {
    return { ok: false, status: 400, error: 'Solicitação inválida.' };
  }
  return { ok: true, username, password };
}

export function loginBodyMayExceedLimit(contentLength: string | null) {
  if (!contentLength) return false;
  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > MAX_LOGIN_BODY_BYTES;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
