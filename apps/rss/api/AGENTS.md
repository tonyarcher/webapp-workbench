# AGENTS.md

RSS **API microservice**. Own process, own image, own database. The UI lives in
`apps/rss/app`. Identity is `user-api` (JWT `sub`); every reader signs in and
there are no anonymous users.

Do not put RSS tables in `user-api`. Do not add Node `pg` here.

## Rules

- The API is organised in **vertical feature slices**, not technical layers.
  Each slice under `rssapi/` owns its controller, service, entities, repos, and
  DTOs; cross-cutting infrastructure lives in `rssapi/platform/`. Keep files
  small and focused — one class per file, short functions. Do not reintroduce
  shared technical layers named for web, persist, or domain.
- `@Entity` plus `JpaRepository` for tables. Do not write JDBC DAOs.
- **Feeds are one global pool: one row per URL, fetched once.** Per-user reading
  state lives in subscriptions, folders, states, and affinity — do not
  re-fetch per reader.
- **The poller must stop on application dispose.** It is a Spring `@Scheduled` or
  `SmartLifecycle` bean, and a leaked poller fetches against a closed context.
- Auth is an OAuth2 resource server over JWKS; users provision from the JWT
  `sub`. There is no anonymous path.
- `DATABASE_URL` is required for data routes.
- Flyway `baselineOnMigrate` records the Node-era `rss` schema. **Do not wipe
  `pgdata`** — that is the only copy of the data.

## Contract

- Errors use the envelope `{error: string}` (see `ErrorAdvice.kt`).
- `GET /opml` returns `text/xml`, not JSON.
- `Authorization: Bearer <user-api JWT>` is required on everything except
  `/healthz`, `/readyz`, and the root discovery endpoint at `/`; a missing token
  answers `401 {"error":"unauthorized"}`.
- Data routes require `X-Api-Version: 1`. The probes stay unversioned.
- CORS is off unless `CORS_ALLOWED_ORIGINS` names origins; the Bearer-JWT API
  never sets `allowCredentials` (see `CorsConfig.kt`).

## Verification

- Domain logic (ranking, cursors, SSRF, sanitising, feed parsing) needs unit tests.
- HTTP routes need MockMvc or slice tests.
- Any poller change needs a test that it stops on dispose.
