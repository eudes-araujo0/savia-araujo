import type { BusinessSchedule } from './schema';
import { database } from './client';

export const DEFAULT_BUSINESS_SCHEDULE: BusinessSchedule = {
  openDays: [1, 2, 3, 4, 5, 6],
  startTime: '08:00',
  endTime: '20:00',
  slotIntervalMinutes: 90,
  updatedAt: null,
};

let initialized: Promise<void> | null = null;

async function ensureScheduleSchema() {
  if (process.env.NODE_ENV === 'production') return;
  if (initialized) return initialized;
  initialized = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS business_schedule (
      id TEXT PRIMARY KEY,
      open_days TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_interval_minutes INTEGER NOT NULL,
      updated_at BIGINT NOT NULL,
      CONSTRAINT business_schedule_singleton CHECK (id = 'main')
    )`;
    await sql`ALTER TABLE business_schedule ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE business_schedule FORCE ROW LEVEL SECURITY`;
    await sql`REVOKE ALL ON business_schedule FROM PUBLIC`;
    await sql`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'business_schedule' AND policyname = 'business_schedule_backend_only') THEN
          CREATE POLICY business_schedule_backend_only ON business_schedule TO CURRENT_USER USING (true) WITH CHECK (true);
        END IF;
      END
    $$`;
  })().catch((error) => {
    initialized = null;
    throw error;
  });
  return initialized;
}

export async function getBusinessSchedule(): Promise<BusinessSchedule> {
  await ensureScheduleSchema();
  const rows = await database()`SELECT open_days, start_time, end_time, slot_interval_minutes, updated_at FROM business_schedule WHERE id = 'main' LIMIT 1`;
  if (!rows[0]) return DEFAULT_BUSINESS_SCHEDULE;
  const parsed = safeOpenDays(rows[0].open_days);
  return {
    openDays: parsed,
    startTime: String(rows[0].start_time),
    endTime: String(rows[0].end_time),
    slotIntervalMinutes: Number(rows[0].slot_interval_minutes),
    updatedAt: Number(rows[0].updated_at),
  };
}

export async function saveBusinessSchedule(schedule: Omit<BusinessSchedule, 'updatedAt'>) {
  await ensureScheduleSchema();
  const updatedAt = Date.now();
  await database()`INSERT INTO business_schedule (id, open_days, start_time, end_time, slot_interval_minutes, updated_at)
    VALUES ('main', ${JSON.stringify(schedule.openDays)}, ${schedule.startTime}, ${schedule.endTime}, ${schedule.slotIntervalMinutes}, ${updatedAt})
    ON CONFLICT (id) DO UPDATE SET open_days = EXCLUDED.open_days, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, slot_interval_minutes = EXCLUDED.slot_interval_minutes, updated_at = EXCLUDED.updated_at`;
  return { ...schedule, updatedAt };
}

function safeOpenDays(value: unknown) {
  try {
    const days = JSON.parse(String(value)) as unknown;
    if (!Array.isArray(days)) return DEFAULT_BUSINESS_SCHEDULE.openDays;
    return [...new Set(days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  } catch {
    return DEFAULT_BUSINESS_SCHEDULE.openDays;
  }
}
