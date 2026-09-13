-- V4: track login recency so the batch poller can back off stale users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
UPDATE users SET last_seen_at = now() WHERE last_seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at);
