-- V27: a saved search can be promoted to a keyword alert.
-- Matching reuses the existing saved-search parser and articleSpec over
-- metadata only; no article body is read. Alerts are materialised on read,
-- so no new rows are written per ingest.
alter table saved_searches add column if not exists alert boolean not null default false;
create index if not exists idx_saved_searches_alert on saved_searches (user_id) where alert;
