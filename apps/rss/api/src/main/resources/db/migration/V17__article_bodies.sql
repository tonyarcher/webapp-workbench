-- Q1 slice 2: bodies get their own table. articles.content_html stays for
-- rollback and for readers that have not moved yet; a bounded job in the API
-- backfills this table after startup instead of rewriting 200k rows inside a
-- single migration (V15's one-shot index build blocked startup for minutes).
create table if not exists article_bodies (
    article_id text primary key references articles (id) on delete cascade,
    content_html text not null
);
