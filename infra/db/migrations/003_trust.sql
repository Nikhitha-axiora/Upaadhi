CREATE SCHEMA IF NOT EXISTS trust;

CREATE TABLE IF NOT EXISTS trust.reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT,
  reported_user_id TEXT,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (listing_id IS NOT NULL OR reported_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_trust_reports_status_created
  ON trust.reports (status, created_at DESC);

