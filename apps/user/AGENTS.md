# AGENTS.md

Identity product: accounts landing page (`app`, served at `/auth/`) plus the
shared identity API (`api`). Root `AGENTS.md` covers workflow, git, and
monorepo rules.

- `app/` — see `apps/user/app/AGENTS.md` for the `uw-*` shell, CSRF handling,
  and the return-path allow-list.
- `api/` — see `apps/user/api/AGENTS.md` for the OAuth, session, and WebAuthn
  rules. It owns the `users` database.
- `api` is the shared identity service, not one product's backend: `rss` and
  `stock-game` sign in through it today and `fitness-api` already accepts its
  JWT, so a change here reaches every signed-in surface. Two consequences: keep
  it cloneable to its own repo (accounts and auth only, never product tables),
  and register clients as OAuth rows in the database rather than in code.
- Work on both halves together: `python deploy.py apps/user`, `python build.py apps/user`.
