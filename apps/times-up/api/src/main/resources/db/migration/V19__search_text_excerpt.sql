-- V19: search_text no longer reads content_html.
--
-- The excerpt column (V18) is the list/search preview. Backfilling it in SQL
-- keeps search usable for rows whose async excerpt backfill has not run yet;
-- the result is a plain-text approximation, and the app overwrites it with the
-- canonical excerpt on next ingest/extract/backfill.
update articles
set
    excerpt = left(
        trim(regexp_replace(regexp_replace(coalesce(content_html, ''), '<[^>]+>', ' ', 'gi'), '\s+', ' ', 'g')),
        4000
    )
where
    (excerpt is null or excerpt = '')
    and content_html is not null
    and content_html <> '';

drop index if exists idx_articles_search_trgm;
alter table articles drop column if exists search_text;

alter table articles
add column search_text text generated always as (
    lower(
        coalesce(title, '') || ' '
        || coalesce(summary, '') || ' '
        || coalesce(author, '') || ' '
        || coalesce(domain, '') || ' '
        || coalesce(link, '') || ' '
        || coalesce(excerpt, '')
    )
) stored;

create index idx_articles_search_trgm
on articles using gin (search_text gin_trgm_ops);
