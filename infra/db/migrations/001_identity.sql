CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  locality TEXT NOT NULL,
  city TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  skills TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  response_time_minutes INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity.otp_challenges (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_otp_phone_created
  ON identity.otp_challenges (phone, created_at DESC);

INSERT INTO identity.users (
  id, phone, name, locality, city, roles, skills, rating, completed_count, response_time_minutes, verification_status
) VALUES
  ('usr_ravi', '+919876543210', 'Ravi Kumar', 'Ameerpet', 'Hyderabad', ARRAY['earner', 'service_provider'], ARRAY['helper', 'delivery', 'event support'], 4.7, 24, 8, 'phone_verified'),
  ('usr_lakshmi', '+919888777666', 'Lakshmi Stores', 'Ameerpet', 'Hyderabad', ARRAY['employer'], ARRAY['retail'], 4.5, 18, 12, 'employer_verified'),
  ('usr_neha', '+919111222333', 'Neha Designs', 'SR Nagar', 'Hyderabad', ARRAY['service_provider'], ARRAY['logo design', 'poster design', 'video editing'], 4.9, 42, 15, 'phone_verified')
ON CONFLICT (id) DO NOTHING;
