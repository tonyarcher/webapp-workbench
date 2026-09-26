# User

Identity: the accounts landing page (`app/`) plus the shared identity API
(`api/`). `AGENTS.md` has the product notes; `app/AGENTS.md` and `api/AGENTS.md`
have the halves.

- The app is served at `/auth/` and calls the API at the origin-absolute
  `/user-api/` prefix, so one code path works behind the gateway and under the
  Vite dev proxy.
- The API is the IdP every other app authenticates against. It stores accounts
  and auth only and **must stay cloneable to its own repo** — never add another
  product's tables to it.
- Register other apps as OAuth clients in database rows, not in Kotlin.

Run both halves with `python deploy.py apps/user`. The per-workspace dev and test
scripts are in each half's `package.json`.
