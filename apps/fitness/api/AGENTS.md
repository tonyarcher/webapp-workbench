# AGENTS.md

Fitness **API microservice**. Own process, own image, own database. The UI lives
in `apps/fitness/app`. Identity is `user-api` (JWT `sub`).

Do not put fitness tables in `user-api`. Do not add Node `pg` here.

## Rules

- `@Entity` plus `JpaRepository` for tables. Do not write JDBC DAOs.
- `domain/` holds metric aliases, import collection, LTTB downsampling, and
  profile normalisation. It holds no entities and no Spring types.
- **Without a Bearer token, requests fall back to a legacy local user id** so the
  existing UI keeps working. Do not remove that path until the UI sends a
  `user-api` JWT.
- `DATABASE_URL` is required for data routes. Without it `/healthz` is still 200
  and every data route answers `503 {"error":"database offline"}`.
- Flyway `baselineOnMigrate` records an existing Node-era `fitness` schema (tables
  with no `flyway_schema_history`) and keeps it. **Do not wipe `pgdata` to cut
  over** — that is the only copy of the data.
- Errors use the envelope `{error: string}`.

## Verification

- Domain logic needs unit tests.
- HTTP routes need MockMvc assertions with a fake store. Cover import upsert,
  hide and override, a profile round trip, and an invalid `limit`.
