CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label text NOT NULL DEFAULT 'local',
    created_at timestamptz NOT NULL DEFAULT now(),
    subject text NOT NULL,
    username text,
    last_seen_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_subject ON users (subject);
