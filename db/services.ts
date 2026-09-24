import { database } from './client';
import { BOOKABLE_SERVICE_CODES, BOOKABLE_SERVICES, type BookableService, type ServiceGroup } from '../lib/service-catalog';

let servicesInitialized: Promise<void> | null = null;

export async function ensureServicesSchema() {
  if (process.env.NODE_ENV === 'production') return;
  if (servicesInitialized) return servicesInitialized;
  servicesInitialized = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS service_catalog (
      code TEXT PRIMARY KEY,
      service_group TEXT NOT NULL,
      group_label TEXT NOT NULL,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      features TEXT NOT NULL DEFAULT '[]',
      price_cents INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
    for (const item of BOOKABLE_SERVICES) {
      await sql`INSERT INTO service_catalog (
        code, service_group, group_label, name, tagline, description, features,
        price_cents, duration_minutes, active, sort_order, updated_at
      ) VALUES (
        ${item.code}, ${item.group}, ${item.groupLabel}, ${item.name}, ${item.tagline}, ${item.description}, ${JSON.stringify(item.features)},
        ${item.priceCents}, ${item.durationMinutes}, ${item.active}, ${item.sortOrder}, ${Date.now()}
      ) ON CONFLICT (code) DO NOTHING`;
    }
    await sql`ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE service_catalog FORCE ROW LEVEL SECURITY`;
    await sql`REVOKE ALL ON service_catalog FROM PUBLIC`;
    await sql`DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = current_schema()
            AND tablename = 'service_catalog'
            AND policyname = 'service_catalog_backend_only'
        ) THEN
          CREATE POLICY service_catalog_backend_only ON service_catalog TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
      END
    $$`;
  })().catch((error) => {
    servicesInitialized = null;
    throw error;
  });
  return servicesInitialized;
}

export async function listServices(includeInactive = false): Promise<BookableService[]> {
  await ensureServicesSchema();
  const rows = includeInactive
    ? await database()`SELECT * FROM service_catalog ORDER BY sort_order`
    : await database()`SELECT * FROM service_catalog WHERE active = TRUE ORDER BY sort_order`;
  return rows.map((row) => mapService(row as Record<string, unknown>)).filter((item): item is BookableService => Boolean(item));
}

export async function getService(code: string, includeInactive = false): Promise<BookableService | null> {
  if (!BOOKABLE_SERVICE_CODES.has(code)) return null;
  await ensureServicesSchema();
  const rows = includeInactive
    ? await database()`SELECT * FROM service_catalog WHERE code = ${code} LIMIT 1`
    : await database()`SELECT * FROM service_catalog WHERE code = ${code} AND active = TRUE LIMIT 1`;
  return rows[0] ? mapService(rows[0] as Record<string, unknown>) : null;
}

export async function updateService(input: Pick<BookableService, 'code' | 'name' | 'tagline' | 'description' | 'features' | 'priceCents' | 'durationMinutes' | 'active'>) {
  const defaults = BOOKABLE_SERVICES.find((item) => item.code === input.code);
  if (!defaults) throw new Error('Serviço inválido.');
  const value = validateService(input, defaults);
  await ensureServicesSchema();
  const updatedAt = Date.now();
  const rows = await database()`UPDATE service_catalog SET
    name = ${value.name}, tagline = ${value.tagline}, description = ${value.description}, features = ${JSON.stringify(value.features)},
    price_cents = ${value.priceCents}, duration_minutes = ${value.durationMinutes}, active = ${value.active}, updated_at = ${updatedAt}
    WHERE code = ${value.code}
    RETURNING *`;
  const saved = rows[0] ? mapService(rows[0] as Record<string, unknown>) : null;
  if (!saved) throw new Error('O serviço não foi encontrado no catálogo. Atualize a página e tente novamente.');
  return saved;
}

function validateService(input: Pick<BookableService, 'code' | 'name' | 'tagline' | 'description' | 'features' | 'priceCents' | 'durationMinutes' | 'active'>, defaults: BookableService) {
  const name = clean(input.name, 2, 80, 'Informe o nome da experiência.');
  const tagline = clean(input.tagline, 2, 100, 'Informe a chamada curta.');
  const description = clean(input.description, 5, 500, 'Informe uma descrição válida.');
  const features = input.features.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
  if (features.some((item) => item.length > 120)) throw new Error('Cada item incluso deve ter até 120 caracteres.');
  const priceCents = Number(input.priceCents);
  const durationMinutes = Number(input.durationMinutes);
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 10_000_000) throw new Error('Informe um valor válido.');
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 1440) throw new Error('A duração deve ficar entre 30 e 1.440 minutos.');
  return { code: defaults.code, name, tagline, description, features, priceCents, durationMinutes, active: input.active === true };
}

function mapService(row: Record<string, unknown>): BookableService | null {
  const code = String(row.code);
  const defaults = BOOKABLE_SERVICES.find((item) => item.code === code);
  if (!defaults) return null;
  return {
    code,
    group: String(row.service_group) as ServiceGroup,
    groupLabel: String(row.group_label),
    name: String(row.name),
    tagline: String(row.tagline),
    description: String(row.description),
    features: parseFeatures(row.features),
    priceCents: Number(row.price_cents),
    durationMinutes: Number(row.duration_minutes),
    active: row.active === true,
    sortOrder: Number(row.sort_order),
    updatedAt: Number(row.updated_at) || null,
  };
}

function parseFeatures(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || '[]')) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 8) : [];
  } catch { return []; }
}

function clean(value: unknown, minimum: number, maximum: number, message: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < minimum || text.length > maximum) throw new Error(message);
  return text;
}
