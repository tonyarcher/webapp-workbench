-- V30: per-user interest records (R2).
CREATE TABLE IF NOT EXISTS interests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    kind varchar(16) NOT NULL,
    label varchar(255) NOT NULL,
    key varchar(255) NOT NULL,
    weight double precision NOT NULL DEFAULT 1.0,
    origin varchar(32) NOT NULL,
    feed_id uuid,
    enabled boolean NOT NULL DEFAULT true,
    decay_half_life_days int NOT NULL DEFAULT 30,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_hit_at timestamptz,
    UNIQUE (user_id, kind, key)
);
CREATE INDEX IF NOT EXISTS idx_interests_user ON interests (user_id);
CREATE INDEX IF NOT EXISTS idx_interests_key ON interests (user_id, key);
