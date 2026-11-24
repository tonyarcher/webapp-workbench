-- V24: stop storing a second copy of article text for search.
--
-- The STORED generated search_text column repeated title, summary, author,
-- domain, link and excerpt in every row. An immutable SQL function gives both
-- the query and the GIN index the same text without that second copy. The
-- planner inlines the function, so the index expression still matches the LIKE
-- predicate; the stored value and its heap/TOAST space are gone.
drop index if exists idx_articles_search_trgm;
alter table articles drop column if exists search_text;

create or replace function rss_search_text(
    title text,
    summary text,
    author text,
    domain text,
    link text,
    excerpt text
) returns text language sql immutable parallel safe as $fn$
    select lower(
        coalesce(title, '') || ' '
        || coalesce(summary, '') || ' '
        || coalesce(author, '') || ' '
        || coalesce(domain, '') || ' '
        || coalesce(link, '') || ' '
        || coalesce(excerpt, '')
    )
$fn$;

create index idx_articles_search_trgm
on articles using gin (rss_search_text(title, summary, author, domain, link, excerpt) gin_trgm_ops);
