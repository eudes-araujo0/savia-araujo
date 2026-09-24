import { database } from './bookings';

export type StoredAdminCredentials = {
  username: string;
  passwordHash: string;
  updatedAt: number;
};

let credentialsInitialized: Promise<void> | null = null;

async function ensureAdminCredentialsSchema() {
  if (credentialsInitialized) return credentialsInitialized;
  credentialsInitialized = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS admin_credentials (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      CONSTRAINT admin_credentials_singleton CHECK (id = 'master')
    )`;
    await sql`ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE admin_credentials FORCE ROW LEVEL SECURITY`;
    await sql`REVOKE ALL ON admin_credentials FROM PUBLIC`;
    await sql`DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = current_schema()
            AND tablename = 'admin_credentials'
            AND policyname = 'admin_credentials_backend_only'
        ) THEN
          CREATE POLICY admin_credentials_backend_only
            ON admin_credentials
            TO CURRENT_USER
            USING (true)
            WITH CHECK (true);
        END IF;
      END
    $$`;
  })().catch((error) => {
    credentialsInitialized = null;
    throw error;
  });
  return credentialsInitialized;
}

export async function getStoredAdminCredentials(): Promise<StoredAdminCredentials | null> {
  await ensureAdminCredentialsSchema();
  const rows = await database()`SELECT username, password_hash, updated_at FROM admin_credentials WHERE id = 'master' LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  return {
    username: String(row.username),
    passwordHash: String(row.password_hash),
    updatedAt: Number(row.updated_at),
  };
}

export async function saveAdminCredentials(username: string, passwordHash: string): Promise<StoredAdminCredentials> {
  await ensureAdminCredentialsSchema();
  const updatedAt = Date.now();
  await database()`INSERT INTO admin_credentials (id, username, password_hash, updated_at)
    VALUES ('master', ${username}, ${passwordHash}, ${updatedAt})
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      password_hash = EXCLUDED.password_hash,
      updated_at = EXCLUDED.updated_at`;
  return { username, passwordHash, updatedAt };
}
