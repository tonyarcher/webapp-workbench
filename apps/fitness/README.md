# Fitness

Fitness tracker product: a Vite + Lit tracker UI (`app/`) backed by a Kotlin
JSON API (`api/`, Spring Data JPA, Postgres `fitness`).

## Layout

```
app/                     tracker UI (Health Connect/CSV import, 5/3/1)
api/                     JSON API (Flyway migrations in api/src/main/resources/db/migration/)
```

Shared math and parsers live in `packages/fitness-core`, not copied here.

## Commands

```
npm run dev -w fitness        # Vite (proxies /api → :3003)
npm run dev -w fitness-api    # :3003, DATABASE_URL required
./deploy.sh apps/fitness      # both halves together
```

## More

See `AGENTS.md` for the shared product notes, `app/AGENTS.md` and
`api/AGENTS.md` for the halves.
