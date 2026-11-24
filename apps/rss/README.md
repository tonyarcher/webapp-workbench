# Times Up

Feed reader: a Vite + Lit UI (`app/`) backed by a Kotlin JSON API and feed
poller (`api/`). `AGENTS.md` has the product rules; `app/AGENTS.md` and
`api/AGENTS.md` have the halves. `MOONSHOT.md` tracks shipped work and deferred
ideas; `VIEW_PLAN.md` tracks view-level defects and the attention work;
`DB_SCALE_PLAN.md` records the storage rule and its measurements.

- Readers sign in through `user-api` (OAuth2 Code + PKCE). There is no
  anonymous access, and the API identifies a user from the JWT `sub`.
- The API owns the feed pool: one row per URL, fetched once. Per-user reading
  state lives in subscriptions and folders, not in a per-reader fetch.
- Article text is a one-time input. Extractors learn topic keys and evidence
  into their own tables; no feature re-reads a body or full excerpt at request
  time. Bodies and full excerpts live in the object store and are fetched only
  when a reader opens an article.
- The poller and every extractor stop on application dispose.

## Views

Read the route table in `app/src/router.ts`; the sidebar is the navigation.
Highlights: a per-folder Interesting view that learns from reading signals,
Today's capped per-folder sections, keyword alerts from flagged saved searches,
a Feed health dashboard with recent-volume filters and explicit removal, a
full-featured search list, and a saved-for-later queue. The API exposes versioned
data routes; `/healthz`, `/readyz`, and the root discovery endpoint stay
unversioned.

## Help and exports

Press `?` in the list or in the open article for the in-app help dialog: a short
views guide plus the shortcut tables shared with the handlers. Organize offers
three export formats — OPML for standardized feed interchange, a versioned JSON
archive, and a line-separated text mirror of that archive. Import accepts OPML.

## Run

Use `python deploy.py apps/rss` for both halves. Dev and test scripts live in
each half's `package.json`; the API's canonical check is Gradle, not npm.
