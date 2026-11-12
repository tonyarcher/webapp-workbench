-- V3: per-user rolling quotas for the decision-model order parser.
CREATE TABLE IF NOT EXISTS ai_quota (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    hour_start timestamptz NOT NULL DEFAULT now(),
    hour_count integer NOT NULL DEFAULT 0,
    day_count integer NOT NULL DEFAULT 0,
    day_start timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 0
);
