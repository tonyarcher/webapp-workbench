-- V25: learned topic metadata and persistent topic clusters.
-- Article text stays disposable: the key extractor reads it once and writes
-- only keys. Everything downstream reads these tables, never article text.
alter table articles add column if not exists topics_extracted_at timestamptz;
create index if not exists idx_articles_topics_pending
on articles (fetched_at) where topics_extracted_at is null;

create table if not exists article_topics (
    article_id varchar(64) not null references articles (id) on delete cascade,
    topic_key text not null,
    primary key (article_id, topic_key)
);
create index if not exists idx_article_topics_key on article_topics (topic_key);

create table if not exists topic_clusters (
    id varchar(64) primary key,
    label text not null,
    member_count integer not null,
    growth_rate double precision not null,
    first_seen timestamptz not null,
    last_seen timestamptz not null,
    updated_at timestamptz not null default now()
);

create table if not exists topic_cluster_members (
    cluster_id varchar(64) not null references topic_clusters (id) on delete cascade,
    article_id varchar(64) not null references articles (id) on delete cascade,
    primary key (cluster_id, article_id)
);
create index if not exists idx_topic_cluster_members_article on topic_cluster_members (article_id);
