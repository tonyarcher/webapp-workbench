create table if not exists saved_articles (
    id uuid primary key,
    user_id uuid not null references users (id) on delete cascade,
    article_id text,
    feed_id uuid,
    feed_title text,
    title text not null,
    link text,
    author text,
    summary text,
    content_html text,
    published_at timestamptz,
    saved_at timestamptz not null default now(),
    unique (user_id, article_id)
);

create index if not exists saved_articles_user_saved_idx
on saved_articles (user_id, saved_at desc);
