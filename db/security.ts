import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
let client: NeonQueryFunction<false, false> | null = null;
let initialized: Promise<void> | null = null;

function database() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL não configurada.');
  if (!client) client = neon(connectionString);
  return client;
}

async function ensureSecuritySchema() {
  if (initialized) return initialized;
  initialized = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS login_attempts (
      key_hash TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      window_started BIGINT NOT NULL,
      blocked_until BIGINT NOT NULL DEFAULT 0
    )`;
    await sql`ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE login_attempts FORCE ROW LEVEL SECURITY`;
    await sql`REVOKE ALL ON login_attempts FROM PUBLIC`;
    await sql`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'login_attempts' AND policyname = 'login_attempts_backend_only') THEN
          CREATE POLICY login_attempts_backend_only ON login_attempts TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
      END
    $$`;
  })().catch((error) => { initialized = null; throw error; });
  return initialized;
}

export async function checkLoginRateLimit(keyHash: string) {
  await ensureSecuritySchema();
  const now = Date.now();
  const rows = await database()`SELECT attempts, window_started, blocked_until FROM login_attempts WHERE key_hash = ${keyHash} LIMIT 1`;
  const row = rows[0];
  if (!row) return { allowed: true, retryAfter: 0 };
  const blockedUntil = Number(row.blocked_until || 0);
  if (blockedUntil > now) return { allowed: false, retryAfter: Math.ceil((blockedUntil - now) / 1000) };
  if (Number(row.window_started) + WINDOW_MS <= now) return { allowed: true, retryAfter: 0 };
  return { allowed: Number(row.attempts) < MAX_ATTEMPTS, retryAfter: Math.ceil(WINDOW_MS / 1000) };
}

export async function recordFailedLogin(keyHash: string) {
  await ensureSecuritySchema();
  const sql = database();
  const now = Date.now();
  const rows = await sql`SELECT attempts, window_started FROM login_attempts WHERE key_hash = ${keyHash} LIMIT 1`;
  const row = rows[0];
  const reset = !row || Number(row.window_started) + WINDOW_MS <= now;
  const attempts = reset ? 1 : Number(row.attempts) + 1;
  const windowStarted = reset ? now : Number(row.window_started);
  const blockedUntil = attempts >= MAX_ATTEMPTS ? now + WINDOW_MS : 0;
  await sql`INSERT INTO login_attempts (key_hash, attempts, window_started, blocked_until)
    VALUES (${keyHash}, ${attempts}, ${windowStarted}, ${blockedUntil})
    ON CONFLICT (key_hash) DO UPDATE SET attempts = EXCLUDED.attempts, window_started = EXCLUDED.window_started, blocked_until = EXCLUDED.blocked_until`;
}

export async function clearFailedLogins(keyHash: string) {
  await ensureSecuritySchema();
  await database()`DELETE FROM login_attempts WHERE key_hash = ${keyHash}`;
}
