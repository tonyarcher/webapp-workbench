# RSS

Feed reader product: a Vite + Lit reader UI (`app/`) backed by a Kotlin JSON
API + poller (`api/`, Spring Data JPA, Postgres `rss`).

## Layout

```
app/                     reader UI (TanStack core, hash router, PWA)
api/                     JSON API + poller (Flyway migrations in api/src/main/resources/db/migration/)
```

## Commands

```
npm run dev -w rss-reader    # Vite (proxies /api → :3001, /user-api → :3004)
npm run dev -w rss-api       # :3001, DATABASE_URL required
./deploy.sh apps/rss         # both halves together
```

Readers sign in through `user-api` (OAuth2 Code + PKCE); API calls carry
`Authorization: Bearer` plus `X-Api-Version: 1`.

## More

See `AGENTS.md` for the shared product notes, `app/AGENTS.md` and
`api/AGENTS.md` for the halves.
