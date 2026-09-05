CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  client_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  service TEXT NOT NULL,
  service_label TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90,
  price_cents INTEGER NOT NULL,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  payment_option TEXT NOT NULL DEFAULT 'deposit',
  payment_amount_cents INTEGER NOT NULL DEFAULT 0,
  balance_paid_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  payment_provider TEXT,
  payment_preference_id TEXT,
  payment_id TEXT,
  payment_url TEXT,
  payment_receipt_url TEXT,
  paid_at BIGINT,
  balance_paid_at BIGINT,
  expires_at BIGINT,
  consent_at BIGINT,
  management_token_hash TEXT,
  notes TEXT,
  receipt_key TEXT,
  receipt_name TEXT
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_option TEXT NOT NULL DEFAULT 'deposit';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 90;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_paid_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_paid_at BIGINT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at BIGINT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS consent_at BIGINT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS management_token_hash TEXT;
UPDATE bookings SET payment_amount_cents = deposit_cents WHERE payment_amount_cents = 0 AND deposit_cents > 0;

CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date
  ON bookings(appointment_date);

CREATE INDEX IF NOT EXISTS idx_bookings_status_date
  ON bookings(status, appointment_date);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_status
  ON bookings(payment_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_id
  ON bookings(payment_id)
  WHERE payment_id IS NOT NULL;

DROP INDEX IF EXISTS idx_bookings_active_slot;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot
  ON bookings(appointment_date, appointment_time)
  WHERE status NOT IN ('cancelado', 'expirado');

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON bookings FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'bookings'
      AND policyname = 'bookings_backend_only'
  ) THEN
    CREATE POLICY bookings_backend_only
      ON bookings
      TO CURRENT_USER
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id TEXT PRIMARY KEY,
  block_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  reason TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(block_date);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  expense_date TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  delivered_at BIGINT,
  error TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_once ON notification_deliveries(booking_id, kind);

ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON schedule_blocks, expenses, notification_deliveries FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'schedule_blocks' AND policyname = 'schedule_blocks_backend_only') THEN
    CREATE POLICY schedule_blocks_backend_only ON schedule_blocks TO CURRENT_USER USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'expenses' AND policyname = 'expenses_backend_only') THEN
    CREATE POLICY expenses_backend_only ON expenses TO CURRENT_USER USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'notification_deliveries' AND policyname = 'notification_deliveries_backend_only') THEN
    CREATE POLICY notification_deliveries_backend_only ON notification_deliveries TO CURRENT_USER USING (true) WITH CHECK (true);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started BIGINT NOT NULL,
  blocked_until BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS booking_attempts (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started BIGINT NOT NULL,
  blocked_until BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON login_attempts FROM PUBLIC;
ALTER TABLE booking_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON booking_attempts FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'login_attempts'
      AND policyname = 'login_attempts_backend_only'
  ) THEN
    CREATE POLICY login_attempts_backend_only
      ON login_attempts
      TO CURRENT_USER
      USING (true)
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'booking_attempts'
      AND policyname = 'booking_attempts_backend_only'
  ) THEN
    CREATE POLICY booking_attempts_backend_only
      ON booking_attempts
      TO CURRENT_USER
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
