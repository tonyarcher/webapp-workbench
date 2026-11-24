alter table feeds
add column if not exists source_kind text not null default 'rss',
add column if not exists page_url text,
add column if not exists item_selector text,
add column if not exists last_scrape_at timestamptz;

create index if not exists feeds_source_kind_idx on feeds (source_kind);
