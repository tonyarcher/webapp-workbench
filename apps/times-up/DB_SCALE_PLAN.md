# Feed storage at scale — implementation plan

## Goal

Keep the Times Up API simple on Postgres until the workload actually needs another
store, and make each transition a contained change with a clear trigger.

## Metadata is the asset; article text is input

Links stick around on the internet. Article text is disposable once its
metadata is learned. Every feature reads learned metadata — topic keys,
evidence ids and text, scores, source links, reading state — and never re-reads
a body or full excerpt at request time. One-time extractors are the only code
allowed to read article text, and they write rows that outlive it. Bodies and
full excerpts stay available to the reader on demand, but no feature depends on
them being retained. Target: 90% of today's functionality with a fraction of the
stored text.

## Use cases this must serve

Read from the code, not from memory:

- One global article row per feed + guid (`articles`), fetched once and shared.
  Per-user reading lives in `article_state`, `subscriptions`, folders, affinity.
- Retention is 400 articles per feed (`MAX_ARTICLES_PER_FEED`). Ten million
  articles therefore means roughly 25k distinct feeds, not 10m per user.
- Reads are cursor pages by `hot`, `newest`, `oldest`, scoped to all, a folder,
  or a feed, with `NOT EXISTS` against `article_state` for unread filtering.
- Library load asks for unread counts per feed in one grouped query.
- Search is `LIKE '%token%'` over title, summary, `content_html` (up to 256 KB),
  author, domain and link, with a 400-row result window in the controller.
- Ingest recomputes popularity by grouping **all articles** by `norm_link`.
- The poller drains due feeds with concurrency 2 and per-feed backoff.

## What breaks first at ten million rows

1. Search: a leading-wildcard LIKE over TOAST text is a sequential scan.
2. Popularity: a full-table `GROUP BY norm_link` on every feed refresh.
3. Storage: 10m x ~1 KB of `content_html` is ~10 GB of TOAST (measured
   average 1 KB on the live library, 21 MB for the 20k articles older than a
   year). The trigram index is the bigger multiplier: 189 MB for 215k articles.
   Backups, vacuum and indexes become the limit before query latency does. Q1
   in `MOONSHOT.md` covers dynamic body fetching and out-of-database offload.
4. `article_state`: it grows with users x articles read and is the real
   long-term multiplier.
5. Hot-sort scoped by a subscription subquery: sorts broadly before filtering.

## Stage 0 — Postgres, no new service (now)

- [x] **Index article search.** V15 added a generated `search_text` column and a
      `pg_trgm` GIN index; V24 removed the stored copy and indexes the immutable
      `rss_search_text(title, summary, author, domain, link, excerpt)` function
      instead. `ArticleSpecs` calls that function in one LIKE per token, so the
      planner inlines it and uses the index. Substring semantics are unchanged.
      Acceptance: search tests pass; a 10m-row fixture explains a bitmap index
      scan, not a sequential scan. tsvector + FTS remains a Stage 1 option if
      relevance ranking needs it.
- [x] **Keep list reads narrow.** Moved to Q1 slices 2a/2b/V19/V20: bodies live in
      `article_bodies`, `search_text` no longer reads `content_html`, V20 dropped
      `articles.content_html`, and list/detail readers use `BodyStore`. Acceptance:
      the article-list query never selects a body column.
- [x] **Bound popularity work.** The existing `updatePopularity` query already
      limits the `norm_link` rollup to the links in this ingest (`ANY(:links)`)
      and to this feed's rows, with `idx_articles_norm_link` covering the
      lookup. No full-table aggregate. Kept as-is.
- [x] **Verify unread counts.** Library load already uses one grouped unread
      query, backed by the partial index on `article_state (user_id,
article_id) WHERE read`. No counter table needed at this size; measure
      before adding one.

## Q1 slices — body offload

The work order is Q1 in `MOONSHOT.md`. Each slice lands on its own with a
rollback path; none of them changes the global feed pool or per-user state.

1. **Body-store seam (now).** A `BodyStore` port keyed by article id, a
   `DbBodyStore` that keeps today's behavior, and a `BodyReadThrough` helper
   with fault-injection tests. No schema change, no live behavior change.
   Acceptance: a store failure becomes a cache miss; a failed fetch returns no
   body; a failed write still returns the fetched body.
2. **Narrow list reads.** Add `article_bodies` keyed by article id, backfill in
   bounded batches (V15's one-shot GIN build blocked startup for minutes), and
   make the store read from it. Keep `articles.content_html` until every reader
   has moved; switch `search_text` to a stored excerpt first. Acceptance: the
   article-list query never selects a body column; a rollback restores the old
   reads without a data migration. **Slice 2a implemented:** V17 creates the
   table, a bounded `@Scheduled` job backfills it, and the store reads the table
   with an `articles.content_html` fallback while dual-writing both copies.
   Ingest and on-demand extraction now write bodies through the store, so the
   table stays current. **Slice 2b implemented:** V18 adds excerpt and image
   to rticles; ingest and extraction fill them, a bounded backfill covers
   existing rows with targeted updates, ArticleListQuery projects them so the
   list read never selects content_html, and GET /articles/{id}/body serves
   the stored body to the reader on open. **V19** moves search_text off
   content_html (SQL excerpt backfill + regenerated GIN column). **V20** drops
   rticles.content_html; bodies live in rticle_bodies, readers/writers use
   BodyStore, and the Kotlin body backfills were removed. Front-page and
   edition builders read the list projection.
3. **Object-store tier (done, default on).** V21 adds `storage_key` and
   `byte_size` to `article_bodies` and makes `content_html` nullable. When a
   bucket is set, `DbBodyStore` writes content-addressed gzip objects
   (`sha256.html.gz`) through an S3-compatible client and stores the key in
   Postgres; reads fall back to `content_html` when an object is missing.
   `BodyOffloadService` moves bodies when `TIMES_UP_BODY_OFFLOAD_ENABLED=true`
   (`TIMES_UP_BODY_OFFLOAD_AFTER_DAYS`, bounded batches; **0 means every stored
   body**). The automated trigger is `StoragePressureService`: it reads
   `pg_database_size(current_database())` and the last backup duration supplied
   by `TIMES_UP_BACKUP_DURATION_MINUTES`, and gates offload when
   `TIMES_UP_BODY_OFFLOAD_REQUIRE_PRESSURE=true` (defaults 2 GB or 15 min, both
   configurable). `BodyPurgeService` deletes old cold objects in bounded
   batches under `TIMES_UP_BODY_PURGE_ENABLED`, clearing only the pointer; article
   rows and user state are never deleted. `GET /storage/status` reports the
   thresholds and `POST /storage/purge` is the confirmable action behind the
   same gate. `ColdBodyRestoreDrillTest` opens a cold body after a simulated
   Postgres-only restore, and verifies a missing object degrades to no body
   without breaking the open. No payloads in logs.
4. **Dynamic depth and purge UI (core done).** The reader already shows the
   summary first and fetches the stored body on open; `bodyLoadStatus` now makes
   that state visible with a busy/status line, and `canRefetchBody` refuses to
   promise a refetch for sources without a canonical link. The privacy settings
   screen exposes the purge action with an inline confirmation and a result
   line that states article rows survive. `smoke-body-load.ts` covers the load
   states, the source capability, and the confirm projection. Excerpt-on-scroll
   is in: rows carry a visibility marker, a scoped `IntersectionObserver` fetches
   `GET /articles/{id}/excerpt` once per visible row, and the cached excerpt
   renders without reading the body; `smoke-excerpts.ts` and the row test cover
   the narrow route, the cache, and the render. The API caches the same read in
   a bounded Caffeine cache manager (2,000 entries, 10 minutes) keyed by article
   id, and evicts on ingest and extraction writes. Section-only briefing fetches
   are in: `EditionService` loads excerpt text only for the article ids in the
   sections it publishes. The privacy-preserving counters themselves live in Q2.
5. **All article text in the store, gzip (V23).** `articles.excerpt_key` and
   `excerpt_bytes` point at the full excerpt, stored gzip under a separate
   prefix; `excerpt` keeps a bounded head (`TIMES_UP_EXCERPT_HEAD_CHARS`, default 800)
   because `rss_search_text`, list previews and cited-id lookups read it. `ExcerptOffloadService` moves the tail in bounded batches
   and trims the row in the same write, so no migration rewrites the table.
   Both offload queries have a partial index over pending rows only, so the
   steady state after the drain is cheap. `GET /articles/{id}/body.raw` returns
   the stored body still gzip with `Content-Encoding: gzip`, and the reader
   uses it, so the browser inflates a body instead of the API decoding it into
   JSON. `excerpt` text beyond the head is no longer searchable; that is the
   trade for keeping search local.
   **Reclaiming the files is a separate, manual step.** Nulling `content_html`
   and trimming `excerpt` leaves dead TOAST and index entries; Postgres reuses
   that space but does not shrink the files. After the drain, run
   `REINDEX INDEX CONCURRENTLY idx_articles_search_trgm` and
   `VACUUM (FULL) article_bodies`, then `VACUUM (FULL) articles` during a
   window that can take the API down. Do not schedule `VACUUM FULL` on its own.

## Stage 1 — dedicated search service (trigger: FTS misses relevance or p95)

- Add Meilisearch or Typesense as a **new deploy service**, fed from ingest.
  Meilisearch memory-maps its index so it can exceed RAM; Typesense keeps more
  in RAM and is faster on a single box. OpenSearch only when vector discovery
  is required and the cluster is justified.
- Index only `article_id`, feed/folder visibility keys, title, summary, author
  and a body excerpt. Never index per-user state.
- Keep Postgres authoritative; a failed index rebuild must never lose articles.
- Acceptance: p95 search under 200 ms at 10m documents; reindex is idempotent.

## Stage 2 — partition or split (trigger: >100m articles or state dominating)

- Do **not** partition `articles` by `published_at` without planning the
  primary key: a partitioned table's PK must include the partition key, and
  `article_state`, `article_scores`, `board_entries` and `saved_articles` all
  reference `articles(id)`. That is a coordinated migration, not a one-liner.
- Prefer hash partitioning by `feed_id` with a composite `(id, feed_id)` key,
  or move `article_state` to a key-value store (Scylla/Dynamo) while Postgres
  keeps metadata. Each is a separate service-level decision.
- Acceptance: a rollout can be staged and rolled back per partition.

## Non-goals

- No sharding "for practice". Ten million is not a sharding trigger.
- No change to the global feed pool: per-user article copies would multiply
  storage and break dedupe.
- No new Node database access, no service depending on another service's
  Postgres, and no change to `user-api`.
