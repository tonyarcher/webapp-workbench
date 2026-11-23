-- V23: article text moves to the object store, compressed.
--
-- `excerpt` stays in Postgres as a bounded head: it feeds the generated
-- search_text column, the list preview, and cited-id lookups, all of which must
-- stay local and cheap. The full excerpt lives in the object store under
-- excerpt_key. No column here holds a large value, so this migration is instant
-- and does not rewrite rows; the offload job trims `excerpt` in batches.
alter table articles add column if not exists excerpt_key text;
alter table articles add column if not exists excerpt_bytes bigint;
-- The offload pass asks for pending rows oldest-first every couple of seconds.
-- A partial index keeps that lookup proportional to the backlog, and it
-- shrinks to empty once every row has an object key.
create index if not exists idx_articles_excerpt_pending
on articles (fetched_at)
where excerpt_key is null and excerpt is not null;
-- Same shape for bodies: pending rows only, so the empty steady state is cheap.
create index if not exists idx_article_bodies_pending
on article_bodies (article_id)
where storage_key is null and content_html is not null;
