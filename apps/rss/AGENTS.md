# AGENTS.md

RSS product: reader UI (`app`) plus JSON API and feed poller (`api`). Root
`AGENTS.md` covers workflow, git, and monorepo rules.

- `app/` — see `apps/rss/app/AGENTS.md` for the reader UI, its auth, and its
  cache-key rules.
- `api/` — see `apps/rss/api/AGENTS.md` for the API, the global feed pool, and
  the poller's shutdown rule. It owns the `rss` database; do not put RSS tables
  in `user-api`.
- Identity is `user-api` (OAuth2 Code + PKCE via `user-client`). Every reader
  signs in, and the API identifies a user from the JWT subject — there is no
  per-browser cookie.
- Work on both halves together: `python deploy.py apps/rss`, `python build.py apps/rss`.
