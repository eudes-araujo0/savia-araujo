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
