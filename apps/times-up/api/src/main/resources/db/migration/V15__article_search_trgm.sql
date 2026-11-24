-- V15: one indexed text column for article search.
--
-- The old search OR-ed six LIKE predicates, three of them on large TOAST
-- columns (content_html up to 256 KB). A leading-wildcard LIKE cannot use a
-- B-tree, so every token scanned the whole table. pg_trgm's GIN index serves
-- substring matches from an index instead. search_text keeps the same
-- substring semantics as before; the body excerpt is capped so the index does
-- not duplicate the full article body into TOAST.
create extension if not exists pg_trgm;

alter table articles
add column if not exists search_text text generated always as (
    lower(
        coalesce(title, '') || ' '
        || coalesce(summary, '') || ' '
        || coalesce(author, '') || ' '
        || coalesce(domain, '') || ' '
        || coalesce(link, '') || ' '
        || left(coalesce(content_html, ''), 4000)
    )
) stored;

create index if not exists idx_articles_search_trgm
on articles using gin (search_text gin_trgm_ops);
