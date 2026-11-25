-- V34: separate sources from interests (R2 refinement).
CREATE TABLE IF NOT EXISTS sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    label varchar(255) NOT NULL,
    key varchar(255) NOT NULL,
    host varchar(255),
    feed_id uuid,
    resolved boolean NOT NULL DEFAULT false,
    validated boolean NOT NULL DEFAULT false,
    confidence double precision NOT NULL DEFAULT 0.0,
    last_checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_sources_user ON sources (user_id);
CREATE INDEX IF NOT EXISTS idx_sources_host ON sources (host);
