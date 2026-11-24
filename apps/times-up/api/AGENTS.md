# AGENTS.md

Times Up **API microservice**. Own process, own image, own database. The UI lives in
`apps/times-up/app`. Identity is `user-api` (JWT `sub`); every reader signs in and
there are no anonymous users.

Do not put Times Up tables in `user-api`. Do not add Node `pg` here.

## Rules

- The API is organised in **vertical feature slices**, not technical layers.
  Each slice under `timesupapi/` owns its controller, service, entities, repos, and
  DTOs; cross-cutting infrastructure lives in `timesupapi/platform/`. Keep files
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

## MCP (G6)

- `POST /mcp` is the one transport: JSON-RPC 2.0 over Spring MVC, JSON
  responses, no SSE. It requires `X-Api-Version: 1` and the normal
  `Authorization: Bearer` JWT, validated by the existing JWKS filter chain.
  `McpPrincipalService` accepts only tokens carrying an `mcp_client_id` claim;
  a browser access token cannot call MCP.
- Client registration, consent and revocation live in `user-api` at
  `/oauth/mcp/clients`. It issues a short-lived signed JWT with `sub` = user id,
  `aud` = `times-up`, plus `mcp_client_id` and `mcp_writes` claims. times-up-api
  makes no runtime call to identity; revocation is bounded by the token TTL.
- Read tools are always available: list feeds/folders, search, open summary,
  fetch body, quote highlights. Write tools are advertised only when the token
  carries `mcp_writes=true`, and each call needs a `confirm` argument equal to
  the tool name. No arbitrary SQL, URL fetch, or payload-bearing log line.
- times-up-api stores no MCP credential and needs no extra deploy secret.

## Verification

- Domain logic (ranking, cursors, SSRF, sanitising, feed parsing) needs unit tests.
- HTTP routes need MockMvc or slice tests.
- Any poller change needs a test that it stops on dispose.
