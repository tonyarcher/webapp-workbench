# Page-as-source plan (P5)

Goal: follow a page that publishes no RSS, Atom or JSON Feed. Reuse the
SSRF-safe page fetcher and the Jsoup extraction code already used by
“expanded article” instead of building a second scraper.

This is a living plan. Check off phases as they land; keep the constraints
below true for every phase.

## Constraints (every phase)

- Sources are explicit and user-added. Nothing auto-subscribes from a page.
- Fetch through `PageFetcher` / `HttpPageFetcher`: public-host check, bounded
  redirects, timeout, size cap. Never fetch a user-supplied host directly.
- Fetch politely: bounded concurrency, cache the last page per source, and
  obey robots/terms before a source is allowed to poll.
- Page content is untrusted: no script execution, URLs go through `safeHttpUrl`,
  HTML goes through `sanitizeHtml` before it is stored or rendered.
- Store provenance for every imported article: source kind (`scrape`), source
  URL, canonical article URL, extractor id, fetched and published timestamps.
- Extractor failures are visible in feed health (D4) with an actionable error,
  never silent. A layout change must show up as a broken source.

## Architecture

One small class per page shape, behind a shared interface so new difficult
sites add a class instead of growing a switch:

```text
PageFetcher (existing) -> PageScrapeService -> PageExtractor implementations
                                  |            - JsonLdListExtractor
                                  |            - SemanticListExtractor
                                  |            - SelectorListExtractor (user pattern)
                                  v
                          ScrapeResult(candidates, strategy, confidence)
```

An extractor answers two questions: “how likely is this my kind of page?”
(`confidence`) and “what are the candidate articles?” (`extract`). The service
picks the highest-confidence extractor. A user-supplied CSS selector wins
outright, which is the Feedly-style escape hatch for stubborn layouts.

Candidate articles are a preview, not an import. The reader picks which ones
to keep; only then do they become articles. Full text for a chosen article
reuses `extractArticleHtml` from the expanded-article path.

## Phases

### Phase 0 — preview engine (this change)

- [x] `ScrapeCandidate`, `ScrapeResult`, `PageExtractor` contract.
- [x] `JsonLdListExtractor`: JSON-LD `ItemList` / article arrays.
- [x] `SemanticListExtractor`: `<article>`, list items with a linked heading.
- [x] `SelectorListExtractor`: user-supplied CSS selector for the list.
- [x] `PageScrapeService` picks a strategy; `POST /sources/preview` returns
      candidates with the strategy name and confidence.
- [x] Golden tests per extractor plus a controller slice test.

### Phase 1 — persistence and UI

- [ ] Flyway migration: `source_kind`, `page_url`, `item_selector`, `last_scrape_at`.
- [ ] `POST /sources` creates a watched page from a previewed candidate set.
- [ ] Settings → “Add from a page”: URL field, optional selector, preview list
      with checkboxes, chosen pattern shown to the user.
- [ ] Refetch a watched page with the stored selector; diff by canonical URL
      and content hash so layout changes do not spam duplicates.

### Phase 2 — robustness

- [ ] h-feed / microformats extractor for pages that advertise `h-feed`.
- [ ] Pagination rules (next-link, numbered pages) with a hard page cap.
- [ ] Per-source robots/etag/last-modified checks and backoff.
- [ ] Import full text with the existing `extractArticleHtml`; keep the
      extractor id on each article for debugging.
- [ ] Feed-health surfacing for extractor errors and empty pages.

## Decisions to revisit

- Selector syntax: CSS only for now. XPath-like hints are a later ergonomics
  decision, not a reason to delay the first picker.
- Confidence scores are local heuristics, not model calls. They must stay
  deterministic and cheap; Jev is not needed to choose a list shape.
- A scraped source is best-effort. The UI must say so and make repair (change
  the selector) easier than deleting and re-adding.
