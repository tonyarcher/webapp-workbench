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
  task runs that build first. Static apps are published to the object store and
  served by the gateway; the two apps that keep a container (`football`,
  `user-web`) copy `dist/` into nginx. API images copy the host-built boot jar
  into a JRE image.
- **JVM images are JRE only and copy jars.** Do not run `tsc`, Vite, or Gradle
  inside Docker, and do not use a JDK base image at runtime. Do not delete the
  lockfile.
- Every image's build context is the **repo root**, so `.dockerignore` is what
  keeps the npm tree off the daemon. Do not move `deploy/` or change the contexts
  without checking that every image still builds.
- App images listen on `3000` internally. The gateway publishes host `80`
  always, and `443` **even with TLS off** — free the host port or drop the
  mapping if something else holds 443.
- `pgdata` is not migrated across a Postgres **major** bump: the stack will not
  start, and postgres says so plainly (`database files are incompatible with
server`). A local volume can be removed and re-seeded; one holding real data
  needs `pg_upgrade` or a dump and restore. See `deploy/README.md`.
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

## S3 object store (every static app)

Every static app's assets live in an S3-compatible object store that the gateway
nginx fronts on **both** hosts: the subpaths on the API origin and the asset
origin. The per-app UI containers are gone, so the store is **required** — an
unset `S3_BUCKET` fails the deploy rather than falling back.

- The document is the store's `index.html`, rendered by the publish step: the
  app's `#app-config` block is rewritten with its own API origin before upload,
  and the document's `base` is the app's `basePath` (from `apps.json`), so its
  script, stylesheet, manifest and icon links resolve on the asset origin
  unchanged. The client resolves its API base at runtime from that block (then a
  dev `VITE_API_BASE`, then the relative `${BASE_URL}api`), so the built dist/
  is host-independent. Every app's entry point reads the block at boot and hands
  it to `src/services/config.ts`, so the services stay free of DOM.
- One S3 seed drives the whole store: `S3_ENDPOINT`, `S3_BUCKET`, `S3_PREFIX`,
  `S3_REGION`, and one API-origin key per API-backed app (`PUBLIC_API_BASE`,
  `STOCK_GAME_API_BASE`, `FITNESS_API_BASE`, `RADIO_API_BASE`; see
  `.env.example`). `S3_BUCKET` is required: the gateway serves every static app
  from the store, so an unset bucket fails the deploy rather than falling back
  to a container that no longer exists.
- `gradle deploy` creates the bucket first (`mc mb --ignore-existing`, or
  `aws s3 mb`), then mirrors each static app's `dist/` into it with
  `aws s3 sync --delete`, adding `--endpoint-url $S3_ENDPOINT` only when it is
  set (SeaweedFS / an S3-compatible cloud); real AWS sends none, and it then
  uploads the rendered document (with the app's API origin) over the raw
  `index.html`. When the AWS CLI is not on PATH it falls back to the `mc`
  client (`mc mirror --overwrite --remove` + `mc cp`), reading
  `S3_ACCESS_KEY`/`S3_SECRET_KEY` and handing them to `mc` in
  `MC_HOST_<alias>` rather than argv. See `buildSrc/.../S3Support.kt`. The
  bucket is created by the publish rather than a one-shot seeder service, so
  there is no second store image to keep in sync. Either path needs a live
  store and credentials, so neither is exercised by a local check.
- The published set is every catalog app with a `basePath` and a JavaScript
  workspace — read `apps.json` rather than trusting a list here. Two static
  apps are deliberately excluded, each for a stated reason: `football` carries
  in-flight uncommitted work on this branch; `user-web` is the accounts landing
  page whose session is a SameSite=Lax cookie and whose API calls are
  origin-absolute `/user-api/`, so a separate asset origin would break sign-in.
  Both stay same-origin. Each one's gateway proxy location (the football and
  auth blocks in the nginx template) carries its own Content-Security-Policy
  header, read from that app's client source the same way the store policies
  are. The JVM APIs ship no `dist/` and are not published.
- One nginx container serves both origins via `server_name`: the existing API
  origin and the asset origin. The same generated per-app location set is
  emitted into both server blocks, so a subpath on the API origin and the asset
  origin serve an app identically from one definition. The asset-origin block
  itself is emitted only when `ASSETS_HOST` is set; the API origin's subpaths
  need only `S3_BUCKET`. Each app is served under its own base path so Vite's
  base-relative output resolves unchanged: the hashed
  `/assets/*`, the document, and the PWA files (`sw.js`, the web manifest, the
  icons) all come from the store. The document location carries a CSP
  (`default-src 'self'`, `script-src 'self'`, `style-src 'self'
'unsafe-inline'` — every client ships inline styles, see S3Csp —
  `img-src 'self'` data: https:), plus `connect-src` each API-backed app's
  own origin.
  There is no SPA fallback — only the base path serves the document — so a
  hash-routed app works as-is and a history-routed app needs a fallback added
  before it can move. A local SeaweedFS store (replacing MinIO, whose images no
  longer pull), reachable on a loopback-only host port so the host's AWS CLI can
  publish to it, backs it.
- The local store is SeaweedFS pinned at `chrislusf/seaweedfs:4.48`, built from
  `deploy/seaweedfs/`. Its S3 gateway rejects signed requests unless an identity
  is configured, so the image's entrypoint renders `/etc/seaweedfs/s3.json` at
  start from `S3_ACCESS_KEY`/`S3_SECRET_KEY` (identity `workbench`, actions
  `Admin,Read,Write,List,Tagging`) — the config shape is baked into the image,
  the secret never is. The S3 gateway listens on `8333` in-container and is
  published loopback-only on host `9000` (`S3_ENDPOINT=http://127.0.0.1:9000`);
  the gateway reaches it on the compose network as `http://seaweedfs:8333`.
- The identity file also carries an `anonymous` `Read` identity, and that is
  load-bearing: the asset-origin nginx proxies `/assets/*` to the store with a
  plain `proxy_pass`, which sends no AWS signature, so without anonymous read
  every asset would answer 403. The store is loopback-only and holds public
  assets, so that is the intended exposure — but it is why the identity cannot be
  dropped. The host port is `STORE_HOST_PORT`-overridable because the deploy
  tunnel's store forward claims the same port for a remote deploy.

**Asset-origin account rows:** the asset origin is a new browser origin, so each
app served from it needs an `oauth_redirect_uris` row for its client (the app
root on that origin, `<asset origin>/<basePath>`) and an entry in
`WEBAUTHN_ORIGINS` — add both, as with any non-localhost origin. When TLS is on,
`ASSETS_HOST` joins the minted leaf's SANs automatically; a provided cert
(`TLS_CERT_FILE`) must cover it too, or the deploy warns.

## Secrets

`deploy/.env` is created from `deploy/.env.example` and is gitignored. Compose
interpolates `${POSTGRES_*}` from it at **run** time, as a project-directory
`.env` — never as an image `COPY`. Never commit it.
