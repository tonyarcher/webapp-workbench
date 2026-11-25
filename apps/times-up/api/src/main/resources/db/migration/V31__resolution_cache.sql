-- V31: global resolution cache for source labels (R3).
CREATE TABLE IF NOT EXISTS resolution_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label_key varchar(255) NOT NULL UNIQUE,
    host varchar(255),
    method varchar(32) NOT NULL DEFAULT 'google-news-rss',
    confidence double precision NOT NULL DEFAULT 0.0,
    last_checked_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resolution_cache_key ON resolution_cache (label_key);
