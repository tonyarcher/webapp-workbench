# User

Identity product: the accounts landing page (`app/`, served at `/auth/`) plus
the shared identity API (`api/`, Kotlin, Spring Boot Web + Security + JPA,
Postgres `users`).

## Layout

```
app/                     Vite + Lit shell (uw-*); talks to api at /user-api/
api/                     OAuth2 Authorization Code + PKCE, JWKS, JWT, passkeys, TOTP
```

## Commands

```
npm run dev -w user-web    # Vite (proxies /user-api → :3004)
npm run dev -w user-api    # :3004, DATABASE_URL required
python deploy.py apps/user  # both halves together
```

## More

See `AGENTS.md` for the shared product notes, `app/AGENTS.md` and
`api/AGENTS.md` for the halves.
