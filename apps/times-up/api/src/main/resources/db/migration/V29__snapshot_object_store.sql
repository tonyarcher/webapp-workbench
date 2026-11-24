-- Saved and board bodies move to the same compressed object store as article
-- bodies. Legacy content_html remains readable during rollout and as fallback.
alter table saved_articles add column if not exists content_storage_key text;
alter table board_entries add column if not exists content_storage_key text;
