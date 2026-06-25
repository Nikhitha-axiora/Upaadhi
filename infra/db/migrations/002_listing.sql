CREATE SCHEMA IF NOT EXISTS listing;

CREATE TABLE IF NOT EXISTS listing.listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('job', 'service', 'sell', 'rent')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_amount NUMERIC(12, 2) NOT NULL,
  price_unit TEXT NOT NULL CHECK (price_unit IN ('hour', 'day', 'week', 'month', 'fixed')),
  locality TEXT NOT NULL,
  city TEXT NOT NULL,
  distance_km NUMERIC(6, 2) NOT NULL DEFAULT 0,
  urgency TEXT NOT NULL CHECK (urgency IN ('immediate', 'today', 'this_week', 'flexible')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending_review', 'closed', 'rejected')),
  trust_score INTEGER NOT NULL DEFAULT 70,
  metadata JSONB NOT NULL DEFAULT '{}',
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_listings_feed
  ON listing.listings (status, type, city, locality, posted_at DESC);

CREATE TABLE IF NOT EXISTS listing.outbox_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

INSERT INTO listing.listings (
  id, owner_id, type, title, description, price_amount, price_unit, locality, city, distance_km, urgency, status, trust_score, metadata, posted_at
) VALUES
  (
    'lst_shop_helper',
    'usr_lakshmi',
    'job',
    'Helper needed at grocery shop',
    'Need one helper for billing support, shelf arrangement, and packing from 10 AM to 7 PM.',
    600,
    'day',
    'Ameerpet',
    'Hyderabad',
    1.8,
    'today',
    'active',
    86,
    '{"duration":"full-day","workersRequired":1,"foodProvided":true}'::jsonb,
    now() - interval '25 minutes'
  ),
  (
    'lst_logo_design',
    'usr_neha',
    'service',
    'Logo design for local shops',
    'Simple logo and poster design for stores, food stalls, and tuition centers.',
    999,
    'fixed',
    'SR Nagar',
    'Hyderabad',
    2.4,
    'flexible',
    'active',
    82,
    '{"deliveryDays":2,"revisions":2}'::jsonb,
    now() - interval '3 hours'
  ),
  (
    'lst_camera_rent',
    'usr_ravi',
    'rent',
    'DSLR camera for rent',
    'Canon DSLR available for events and college shoots. ID proof required.',
    500,
    'day',
    'Panjagutta',
    'Hyderabad',
    3.1,
    'this_week',
    'active',
    74,
    '{"depositRequired":true,"depositAmount":2000}'::jsonb,
    now() - interval '5 hours'
  )
ON CONFLICT (id) DO NOTHING;
