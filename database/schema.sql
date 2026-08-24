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
  price_cents INTEGER NOT NULL,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  payment_option TEXT NOT NULL DEFAULT 'deposit',
  payment_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  payment_provider TEXT,
  payment_preference_id TEXT,
  payment_id TEXT,
  payment_url TEXT,
  paid_at BIGINT,
  notes TEXT,
  receipt_key TEXT,
  receipt_name TEXT
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_option TEXT NOT NULL DEFAULT 'deposit';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_amount_cents INTEGER NOT NULL DEFAULT 0;
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot
  ON bookings(appointment_date, appointment_time)
  WHERE status != 'cancelado';

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

CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started BIGINT NOT NULL,
  blocked_until BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON login_attempts FROM PUBLIC;

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
END
$$;
