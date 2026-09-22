-- V8: scope editions to their owning user. Edition bodies embed that
-- reader's subscriptions and affinity, so rows must never be served
-- across users. Pre-release rows (if any) keep NULL and stay invisible.
ALTER TABLE editions ADD COLUMN user_id UUID NULL REFERENCES users (id) ON DELETE CASCADE;
CREATE INDEX idx_editions_user_created ON editions (user_id, created_at DESC);
