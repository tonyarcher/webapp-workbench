create table if not exists saved_searches (
    id uuid primary key,
    user_id uuid not null references users (id) on delete cascade,
    title text not null,
    query text not null default '',
    scope_kind text not null default 'all',
    scope_id uuid,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists saved_searches_user_sort_idx
on saved_searches (user_id, sort_order asc, created_at asc);
