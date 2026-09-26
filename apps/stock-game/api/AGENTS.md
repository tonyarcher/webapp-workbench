# AGENTS.md

Stock game **API microservice**. Own process, own image, own database. The UI
lives in `apps/stock-game` — see its `AGENTS.md`. Do not add Node `pg` here.

## Rules

- `@Entity` plus `JpaRepository` for tables. Do not write JDBC DAOs.
- Domain logic (fills, NYSE hours, positions, cash) stays out of controllers
  and out of the JPA entities. Price fetching is behind `provider/`, so a
  provider can be swapped or stubbed without touching trading logic.
- The scheduler is a Spring `@Scheduled` bean and **must cancel its work on
  shutdown**. A leaked scheduler fires against a closed context.
- `DATABASE_URL` is required for data routes. Without it the data routes
  answer `503`, and only the probes stay healthy.
- Portfolios are per user. `Authorization: Bearer <user-api JWT>` is required
  on everything except `/healthz` and `/readyz`, and a missing token answers
  `401 {"error":"unauthorized"}`. Errors use the envelope `{error: string}`.
- The `X-Api-Version: 1` header is required on data routes; the probes stay
  unversioned.

## Verification

- Domain logic (fills, hours, backdated and scheduled fills) needs unit tests.
- HTTP routes need MockMvc assertions with a fake store.
