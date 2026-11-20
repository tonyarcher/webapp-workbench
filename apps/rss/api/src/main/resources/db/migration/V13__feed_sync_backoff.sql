alter table feed_sync
add column if not exists consecutive_failures integer not null default 0,
add column if not exists next_attempt_at timestamptz;

create index if not exists feed_sync_next_attempt_idx on feed_sync (next_attempt_at);
