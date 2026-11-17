create table if not exists boards (
    id uuid primary key,
    user_id uuid not null references users (id) on delete cascade,
    title text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists boards_user_order_idx
on boards (user_id, sort_order, created_at);

create table if not exists board_entries (
    id uuid primary key,
    board_id uuid not null references boards (id) on delete cascade,
    article_id text not null,
    feed_id uuid,
    feed_title text,
    title text not null,
    link text,
    author text,
    summary text,
    content_html text,
    published_at timestamptz,
    note text not null default '',
    sort_order integer not null default 0,
    added_at timestamptz not null default now(),
    unique (board_id, article_id)
);

create index if not exists board_entries_board_order_idx
on board_entries (board_id, sort_order, added_at);
