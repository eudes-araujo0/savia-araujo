import { database } from './bookings';
import {
  SITE_MEDIA_SLOTS,
  clampMediaNumber,
  defaultMediaValue,
  getMediaSlot,
  type SiteMediaLibraryItem,
  type SiteMediaValue,
} from '../lib/site-media';

let mediaInitialized: Promise<void> | null = null;

export async function ensureMediaSchema() {
  if (mediaInitialized) return mediaInitialized;
  mediaInitialized = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS site_media (
      slot_id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      pathname TEXT,
      alt_text TEXT NOT NULL,
      desktop_x NUMERIC(5,2) NOT NULL DEFAULT 50,
      desktop_y NUMERIC(5,2) NOT NULL DEFAULT 50,
      mobile_x NUMERIC(5,2) NOT NULL DEFAULT 50,
      mobile_y NUMERIC(5,2) NOT NULL DEFAULT 50,
      desktop_zoom NUMERIC(4,2) NOT NULL DEFAULT 1,
      mobile_zoom NUMERIC(4,2) NOT NULL DEFAULT 1,
      updated_at BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS site_media_versions (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      url TEXT NOT NULL,
      pathname TEXT,
      alt_text TEXT NOT NULL,
      desktop_x NUMERIC(5,2) NOT NULL,
      desktop_y NUMERIC(5,2) NOT NULL,
      mobile_x NUMERIC(5,2) NOT NULL,
      mobile_y NUMERIC(5,2) NOT NULL,
      desktop_zoom NUMERIC(4,2) NOT NULL,
      mobile_zoom NUMERIC(4,2) NOT NULL,
      created_at BIGINT NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_site_media_versions_slot ON site_media_versions(slot_id, created_at DESC)`;
    await sql`ALTER TABLE site_media ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE site_media FORCE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE site_media_versions ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE site_media_versions FORCE ROW LEVEL SECURITY`;
    await sql`REVOKE ALL ON site_media, site_media_versions FROM PUBLIC`;
    await sql`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'site_media' AND policyname = 'site_media_backend_only') THEN
          CREATE POLICY site_media_backend_only ON site_media TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'site_media_versions' AND policyname = 'site_media_versions_backend_only') THEN
          CREATE POLICY site_media_versions_backend_only ON site_media_versions TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
      END
    $$`;
  })().catch((error) => {
    mediaInitialized = null;
    throw error;
  });
  return mediaInitialized;
}

export async function listSiteMedia(): Promise<SiteMediaValue[]> {
  await ensureMediaSchema();
  const rows = await database()`SELECT * FROM site_media`;
  return rows.map(mapMediaRow).filter((value): value is SiteMediaValue => Boolean(value));
}

export async function listSiteMediaLibrary(): Promise<SiteMediaLibraryItem[]> {
  await ensureMediaSchema();
  const [currentRows, versionRows] = await Promise.all([
    database()`SELECT * FROM site_media`,
    database()`SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY slot_id ORDER BY created_at DESC) AS row_number
      FROM site_media_versions
    ) ranked WHERE row_number <= 8 ORDER BY created_at DESC`,
  ]);
  const current = new Map(currentRows.map((row) => [String(row.slot_id), mapMediaRow(row as Record<string, unknown>)]));
  const versions = new Map<string, SiteMediaValue[]>();
  for (const row of versionRows) {
    const value = mapMediaRow(row as Record<string, unknown>);
    if (!value) continue;
    value.versionId = String(row.id);
    versions.set(value.slotId, [...(versions.get(value.slotId) || []), value]);
  }
  return SITE_MEDIA_SLOTS.map((slot) => ({
    ...slot,
    current: current.get(slot.id) || defaultMediaValue(slot),
    versions: versions.get(slot.id) || [],
  }));
}

export async function publishSiteMedia(input: SiteMediaValue) {
  const value = validateMediaValue(input);
  await ensureMediaSchema();
  const versionId = `MED-${crypto.randomUUID()}`;
  const now = Date.now();
  const sql = database();
  await sql`INSERT INTO site_media_versions (
    id, slot_id, url, pathname, alt_text, desktop_x, desktop_y, mobile_x, mobile_y, desktop_zoom, mobile_zoom, created_at
  ) VALUES (
    ${versionId}, ${value.slotId}, ${value.url}, ${value.pathname}, ${value.alt}, ${value.desktopX}, ${value.desktopY}, ${value.mobileX}, ${value.mobileY}, ${value.desktopZoom}, ${value.mobileZoom}, ${now}
  )`;
  await sql`INSERT INTO site_media (
    slot_id, url, pathname, alt_text, desktop_x, desktop_y, mobile_x, mobile_y, desktop_zoom, mobile_zoom, updated_at
  ) VALUES (
    ${value.slotId}, ${value.url}, ${value.pathname}, ${value.alt}, ${value.desktopX}, ${value.desktopY}, ${value.mobileX}, ${value.mobileY}, ${value.desktopZoom}, ${value.mobileZoom}, ${now}
  ) ON CONFLICT (slot_id) DO UPDATE SET
    url = EXCLUDED.url, pathname = EXCLUDED.pathname, alt_text = EXCLUDED.alt_text,
    desktop_x = EXCLUDED.desktop_x, desktop_y = EXCLUDED.desktop_y,
    mobile_x = EXCLUDED.mobile_x, mobile_y = EXCLUDED.mobile_y,
    desktop_zoom = EXCLUDED.desktop_zoom, mobile_zoom = EXCLUDED.mobile_zoom,
    updated_at = EXCLUDED.updated_at`;
  return versionId;
}

export async function restoreSiteMedia(slotId: string, versionId: string) {
  const slot = getMediaSlot(slotId);
  if (!slot || !/^MED-[0-9a-f-]{36}$/i.test(versionId)) throw new Error('Versão inválida.');
  await ensureMediaSchema();
  const rows = await database()`SELECT * FROM site_media_versions WHERE id = ${versionId} AND slot_id = ${slotId} LIMIT 1`;
  const value = rows[0] ? mapMediaRow(rows[0] as Record<string, unknown>) : null;
  if (!value) throw new Error('Versão não encontrada.');
  await publishSiteMedia(value);
}

function validateMediaValue(input: SiteMediaValue): SiteMediaValue {
  const slot = getMediaSlot(input.slotId);
  if (!slot) throw new Error('Área de imagem inválida.');
  const url = String(input.url || '').trim();
  const isDefault = url === slot.defaultUrl;
  if (!isDefault) {
    const parsed = safeUrl(url);
    if (!parsed || parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.public.blob.vercel-storage.com')) throw new Error('A imagem não pertence ao armazenamento público autorizado.');
  }
  const alt = String(input.alt || '').trim().slice(0, 180);
  if (alt.length < 3) throw new Error('Descreva a imagem para acessibilidade.');
  return {
    slotId: slot.id,
    url,
    pathname: input.pathname ? String(input.pathname).slice(0, 500) : null,
    alt,
    desktopX: clampMediaNumber(input.desktopX, 0, 100, slot.desktopX),
    desktopY: clampMediaNumber(input.desktopY, 0, 100, slot.desktopY),
    mobileX: clampMediaNumber(input.mobileX, 0, 100, slot.mobileX),
    mobileY: clampMediaNumber(input.mobileY, 0, 100, slot.mobileY),
    desktopZoom: clampMediaNumber(input.desktopZoom, 1, 2, 1),
    mobileZoom: clampMediaNumber(input.mobileZoom, 1, 2, 1),
    updatedAt: Date.now(),
  };
}

function mapMediaRow(row: Record<string, unknown>): SiteMediaValue | null {
  const slot = getMediaSlot(String(row.slot_id));
  if (!slot) return null;
  return {
    slotId: slot.id,
    url: String(row.url),
    pathname: row.pathname ? String(row.pathname) : null,
    alt: String(row.alt_text),
    desktopX: clampMediaNumber(row.desktop_x, 0, 100, slot.desktopX),
    desktopY: clampMediaNumber(row.desktop_y, 0, 100, slot.desktopY),
    mobileX: clampMediaNumber(row.mobile_x, 0, 100, slot.mobileX),
    mobileY: clampMediaNumber(row.mobile_y, 0, 100, slot.mobileY),
    desktopZoom: clampMediaNumber(row.desktop_zoom, 1, 2, 1),
    mobileZoom: clampMediaNumber(row.mobile_zoom, 1, 2, 1),
    updatedAt: Number(row.updated_at || row.created_at) || null,
  };
}

function safeUrl(value: string) {
  try { return new URL(value); } catch { return null; }
}
