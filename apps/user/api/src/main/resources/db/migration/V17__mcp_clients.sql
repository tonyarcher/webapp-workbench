-- G6: identity owns MCP client registrations. Tokens are signed JWTs; revocation
-- is bounded by their lifetime, while this row is the source of truth for consent.
create table if not exists mcp_clients (
    id uuid primary key,
    user_id uuid not null references users (id),
    label text not null,
    writes_enabled boolean not null default false,
    created_at timestamptz not null default now(),
    revoked_at timestamptz
);

create index if not exists mcp_clients_user_idx on mcp_clients (user_id);
