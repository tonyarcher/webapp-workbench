# RSS

Feed reader: a Vite + Lit UI (`app/`) backed by a Kotlin JSON API and feed
poller (`api/`). `AGENTS.md` has the product notes; `app/AGENTS.md` and
`api/AGENTS.md` have the halves.

- Readers sign in through `user-api` (OAuth2 Code + PKCE). There is no
  anonymous access, and the API identifies a user from the JWT `sub`.
- The API owns the feed pool: one row per URL, fetched once. Per-user reading
  state lives in subscriptions and folders, not in a per-reader fetch.
- The poller must stop on application dispose.

Run both halves with `python deploy.py apps/rss`. The per-workspace dev and test
scripts are in each half's `package.json`.
