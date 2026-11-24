-- P12 first slice: unified source provenance. Feed rows name the connector that
-- owns them; article rows keep the source type and URLs needed for citations.
-- Last-run time and last error stay on feed_sync, which the poller already updates.
alter table feeds add column if not exists connector_id text;
alter table feeds add column if not exists connector_version text;

alter table articles add column if not exists source_kind text;
alter table articles add column if not exists connector_id text;
alter table articles add column if not exists connector_version text;
alter table articles add column if not exists canonical_url text;
alter table articles add column if not exists source_url text;
alter table articles add column if not exists fetch_mode text;

-- Existing rows predate the connector seam. Backfill from what the feed already
-- records so the provenance layer is not empty for the current corpus.
update feeds
set connector_id = source_kind, connector_version = '1'
where connector_id is null;

update articles a
set
    source_kind = f.source_kind,
    connector_id = coalesce(f.connector_id, f.source_kind),
    connector_version = coalesce(f.connector_version, '1'),
    canonical_url = a.norm_link,
    source_url = a.link,
    fetch_mode = case when f.source_kind = 'scrape' then 'scrape' else 'poll' end
from feeds f
where
    a.feed_id = f.id
    and a.source_kind is null;
