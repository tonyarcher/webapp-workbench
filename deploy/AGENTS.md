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

## S3 object store (reader)

The reader's static assets can move to their own browser origin (B1): one
gateway nginx container fronts an S3-compatible object store, which serves both
the document and the assets. The direction, not yet the default:

- The document is Vite's static `index.html` from the store. Its `base` is
  `/rss-reader/`, so its script, stylesheet, manifest and icon links resolve on
  the asset origin unchanged; the client takes its API origin from a build-time
  `VITE_API_BASE` (baked from `PUBLIC_API_BASE`) instead of a JVM-rendered shell.
- One S3 seed drives it: `S3_ENDPOINT`, `S3_BUCKET`, `S3_PREFIX`, `S3_REGION`,
  `PUBLIC_API_BASE` (see `.env.example`). Empty `S3_BUCKET` keeps the
  same-origin compose deploy untouched: no publish, no asset origin, no CSP.
- `gradle deploy` creates the reader's bucket first (`mc mb --ignore-existing`,
  or `aws s3 mb`), then mirrors `apps/rss/app/dist` into it with
  `aws s3 sync --delete`, adding `--endpoint-url $S3_ENDPOINT` only when it is
  set (SeaweedFS / an S3-compatible cloud); real AWS sends none. When the AWS
  CLI is not on PATH it falls back to the `mc` client (`mc mirror --overwrite
--remove`), reading `S3_ACCESS_KEY`/`S3_SECRET_KEY` and handing them to `mc`
  in `MC_HOST_<alias>` rather than argv. See `buildSrc/.../S3Support.kt`. The
  bucket is created by the publish rather than a one-shot seeder service, so
  there is no second store image to keep in sync. Either path needs a live
  store and credentials, so neither is exercised by a local check.
- One nginx container serves both origins via `server_name`: the existing API
  origin and the new asset origin. The asset-origin block (emitted only when
  `ASSETS_HOST` and `S3_BUCKET` are both set) serves the app under its
  `/rss-reader/` base path so
  Vite's `base: '/rss-reader/'` output resolves unchanged: the hashed
  `/assets/*`, the document, and the PWA files (`sw.js`, the web manifest, the
  icons) all come from the store, plus a CSP (`default-src 'self'`, `script-src`
  and `style-src` 'self', `connect-src` the API origin). The reader is
  hash-routed, so only the base path serves the document and no SPA fallback is
  needed. A local SeaweedFS store (replacing MinIO, whose images no longer
  pull), reachable on a loopback-only host port so the host's AWS CLI can
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

**Asset-origin account rows:** the asset origin is a new browser origin, so it
needs an `oauth_redirect_uris` row for client `rss-reader` (the app root on that
origin, `<asset origin>/rss-reader/`) and an entry in `WEBAUTHN_ORIGINS` — add
both, as with any non-localhost origin. When TLS is on, `ASSETS_HOST` joins the
minted leaf's SANs automatically; a provided cert (`TLS_CERT_FILE`) must cover
it too, or the deploy warns.

## Secrets

`deploy/.env` is created from `deploy/.env.example` and is gitignored. Compose
interpolates `${POSTGRES_*}` from it at **run** time, as a project-directory
`.env` — never as an image `COPY`. Never commit it.
