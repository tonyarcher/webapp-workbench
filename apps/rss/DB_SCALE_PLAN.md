# Feed storage at scale — implementation plan

## Goal

Keep the RSS API simple on Postgres until the workload actually needs another
store, and make each transition a contained change with a clear trigger.

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

- [x] **Index article search.** Generated `search_text` column plus a
      `pg_trgm` GIN index (V15); `ArticleSpecs` uses one indexed LIKE over that
      column instead of six LIKEs across TOAST columns. Substring semantics are
      unchanged. Acceptance: search tests pass; a 10m-row fixture explains a
      bitmap index scan, not a sequential scan. tsvector + FTS remains a Stage
      1 option if relevance ranking needs it.
- [ ] **Keep list reads narrow.** Move `content_html` into `article_bodies`
      keyed by article id, loaded only for the opened article. `search_text`
      must first switch from the body to a stored excerpt so search survives
      the column drop. This is the remaining Stage 0 item: it is the largest
      storage win (100-200 GB of TOAST at 10m articles) but touches ingest,
      the article extractor, the JSON mapper and every read path, so it gets
      its own change with a rollback plan. Acceptance: the article-list query
      never selects the body column.
- [x] **Bound popularity work.** The existing `updatePopularity` query already
      limits the `norm_link` rollup to the links in this ingest (`ANY(:links)`)
      and to this feed's rows, with `idx_articles_norm_link` covering the
      lookup. No full-table aggregate. Kept as-is.
- [x] **Verify unread counts.** Library load already uses one grouped unread
      query, backed by the partial index on `article_state (user_id,
article_id) WHERE read`. No counter table needed at this size; measure
      before adding one.

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
