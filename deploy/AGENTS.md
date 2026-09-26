# AGENTS.md

Docker Compose reverse-proxy stack. Workflow and monorepo rules: repo-root
`AGENTS.md`.

## Generated files

- `nginx/default.conf` is **generated** from `default.conf.template` on every
  deploy run. Never edit it. Edit the template.
- The template gains a 443 server and cert paths only when `TLS_HOSTS` is set.
- `gateway/certs/` holds a generated leaf cert and key plus the local CA. It is
  gitignored. **Never commit a key.**
- `hello/index.html` is the page at `/`. Link **text** is the project name; the
  `href` is the subpath, which is `/auth/` for Accounts.

## Rules

- TypeScript and Kotlin compile on the **host** through Gradle, and the deploy
  task runs that build first. Static images copy `dist/` into nginx; API images
  copy the host-built boot jar into a JRE image.
- **JVM images are JRE only and copy jars.** Do not run `tsc`, Vite, or Gradle
  inside Docker, and do not use a JDK base image at runtime. Do not delete the
  lockfile.
- Every image's build context is the **repo root**, so `.dockerignore` is what
  keeps the npm tree off the daemon. Do not move `deploy/` or change the contexts
  without checking that every image still builds.
- App images listen on `3000` internally. The gateway publishes host `80`
  always, and `443` **even with TLS off** — free the host port or drop the
  mapping if something else holds 443.
- `APP_BASE_PATH` is public, not a secret. It is baked at the **host** Vite build
  so assets and service workers resolve under the subpath. Editing `dist/` by
  hand to fix paths does not survive the next build.
- The gateway strips each app's prefix. Routes are hand-authored in
  `default.conf.template`; only some apps carry a `basePath` in `apps.json`, so
  adding an app means editing both.

## Services

Identity is `user-api`. Every other API is its own compose service with its own
database. **Do not route product data through `user-api`.**

OAuth redirect URIs live in the `oauth_redirect_uris` table, and WebAuthn
origins come from `WEBAUTHN_ORIGINS`. If the origin is not localhost or
127.0.0.1, add matching redirect rows for it — **do not expect the Kotlin to
derive them from the environment.**

## Secrets

`deploy/.env` is created from `deploy/.env.example` and is gitignored. Compose
interpolates `${POSTGRES_*}` from it at **run** time, as a project-directory
`.env` — never as an image `COPY`. Never commit it.
