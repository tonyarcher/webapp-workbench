-- V9: per-feed icon (channel image / favicon) for card fallbacks.
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS icon text;
