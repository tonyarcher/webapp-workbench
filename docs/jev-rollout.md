# Jev rollout plan

Smart uses for decision models in this monorepo. One rule first.

## Ground rules (copy from `rss-api`)

- Key arrives only via `TYPESAFE_API_KEY` in untracked `deploy/.env`.
- Key never leaves the Kotlin API. No browser calls. Lit stays on `console`.
- One batched `/v1/systemone` call. Thresholds live in code.
- Missing or malformed per-item answers fall back per item. List failure falls back for the batch.
- Quota is consume-before-call. `429` propagates. Never log titles or payloads.
- Cache scored rows with `scored_at` and `model` so review reads no model calls.

## Phase 1 — done now

### RSS spam screen (`apps/rss/api`)

`DecisionScoreProvider` asks a fourth question per candidate: `_spam` noul.
`worthy` is scaled by `(1 - spam)`. Spam missing or malformed defaults to `0`
so old batches still score. Batch cap drops from `20` to `16` because
`16 * 4 = 64` questions.

### Radio safety (`apps/radio-station/api`)

New `radioapi.ai` package mirrors `rssapi.ai` without any database:
`AiConfig`, `AiBackend`, `DecisionBackend`. The backend sends the Bearer key
only to `https://` hosts (or local loopback proxies) and refuses anything
else. New `radioapi.safety`
`TrackSafetyProvider` scores a batch of catalog tracks with two questions per
track: `_explicit` noul and `_fit` score. Missing answers fall back per track
to the `explicit` column. Generate stays deterministic. Safety is annotation
only until a wired endpoint consumes it.

## Phase 2 — calendar done, rest next

### Calendar match endpoint (`apps/calendar-sync/api`) — done

Same `ai` package plus per-user `ai_quota` table (`V3__ai_quota.sql`).
`MatchProvider` resolves exact normalized-title matches in code. Remaining
pairs are dealt round-robin so every unmatched Trakt event gets model coverage
before any event repeats, capped at `20` pairs. Each pair asks one noul over
shared state, threshold `0.8`. `POST /match/suggest` is auth-gated, rejects
payloads over `AI_MAX_INPUT_CHARS` total title chars with `413`, consumes
quota only when `AI_PROVIDER=decision` with a key, and falls back to exact
matches on any model failure. The backend applies the same `https`-only key
rule as radio. Never persists events. `src/core` stays pure.

### Fitness import check (`apps/fitness/api`)

Code parses first. Jev checks after. `Noul`: does the source row support this
parsed value. `Score`: plausibility against recent history. Flag low rows for
review. Never block the import. Never log sample payloads.

### Stock-game order intent (`apps/stock-game/api`)

New `POST /orders/parse` behind auth and quota. `Noul` screen first for
trade intent. `Choice` over buy, sell, or unknown. Slot fill only for known
fields. Emit existing `PlaceOrderRequest`. Unknown routes to the form.

## Phase 3 — later

- `lemmy-vertical-scroll` and `clipstack` moderation and rerank. Needs a server
  endpoint first. Keep the deterministic `classifyPost` rules until then.
- RSS hierarchical topic: second `Choice` only for the winning branch.
- Shared quota service only if one budget must span APIs. Never merge databases.

## Not doing

- `baseball`, `basketball`, `football` reducers stay deterministic.
- `coldwater` core stays seeded and pure.
- `user-api` stays product-free. No taste or risk tables there.
