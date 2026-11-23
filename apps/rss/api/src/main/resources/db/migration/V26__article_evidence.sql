-- V26: provenance evidence is learned once and stored as metadata.
-- The provenance endpoint must never read an article body at request time.
alter table articles add column if not exists evidence_extracted_at timestamptz;
create index if not exists idx_articles_evidence_pending
on articles (fetched_at) where evidence_extracted_at is null;

create table if not exists article_evidence (
    id varchar(64) primary key,
    article_id varchar(64) not null references articles (id) on delete cascade,
    kind varchar(16) not null,
    evidence_text text not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_article_evidence_article on article_evidence (article_id);
