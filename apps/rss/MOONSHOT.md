# RSS Moonshot: the super app (cooler than Feedly, better than Google News)

A working wishlist for the reader in `apps/rss`. Each item is a work order:
promote one to an issue, build it across both halves where noted, and delete
the line here when it ships. A line's presence means it is still wanted.
Nothing here is agreed until it has an owner.

How to read an item: **Why** is the user value, **What** is the shape,
**Half** says where the code goes (`app`, `api`, or `both`), **Effort** is a
rough size (`S` under a day, `M` two to four days, `L` one to two weeks,
`XL` three weeks or more), and **First test** names where the assertions
live (client smoke suites, API JUnit plus Flyway tests, or seeded
accessibility audits for new screens).

Conventions every work order follows without restating them: one database
per API with versioned migrations, identity stays in the identity provider,
new server data is JPA plus Flyway, data routes carry the version header,
and new screens get seeded accessibility audits. The app and API halves
ship together through the repo deploy entry points.

AI convention (applies to every item that mentions assistance, ranking,
summaries, briefings, clustering signals, or explanations): **Jev is the
sole AI**. Use Jev decision primitives (classify, score, check, triage,
extractive judgments) for ranking, routing, labeling, why-this-row signals,
cluster membership judgments, contradiction/correction flags, and cited
evidence selection. No open-ended chatbot, no browser-called model keys,
no logged prompts, and no payload-bearing logs; keys stay server-side.
Surfaced "summaries", "answers", "primers", and "briefs" are assemblies of
Jev-selected, cited excerpts and rows from the user's corpus, never invented
prose. Any future non-Jev capability is out of scope unless this file is
updated to name it explicitly.

## The vision: a day in the life

You open the app at dawn and it already knows the day. A presidential
briefing waits: sixty seconds of what changed overnight, five minutes of
what matters, thirty minutes of depth if you want it — each tier one tap
deeper than the last, every claim one tap from its sources. Then you pick
a thread and pull: thousands of articles across your feeds become an
investigation workbench with storylines, timelines, dossiers on the people
and organizations involved, side-by-side framing from every angle, and an
evidence tray where you pin quotes and rows into a case file. Jev-powered
assistance is ambient, not a separate tab: every row can show why it ranked
and link its evidence, every cluster shows its shape, every briefing links
its receipts. By evening the app hands you a review of what you learned and
a queue of what can wait. Feedly is a
river you drown in; Google News is a front page you cannot steer. This is a
desk you sit at all day: briefing in the morning, investigation at noon,
serendipity in the gaps, and a clean shutdown at night.

Depth here means mastery, not addiction. Nothing in this file optimizes
time-on-site, streaks-as-guilt, or infinite scroll. Sessions end with done
screens, queues have bottoms, and every digest says what it left out.

## Where we stand

What already beats the default reader: a per-folder Interesting view that
learns from stars, reads, dwells, shares, summaries and explicit
not-interested signals; a strictness slider when the auto bar is not enough;
a word-map inspector hint; a Today view; an AI Brief; a Frontpage with
generated editions; full-text search with operators and saved searches as
sidebar rows; mute rules; extractive row highlights and why-this-row in the
article panel; a saved-for-later queue; bulk selection with bulk star and
bulk derank; keyboard shortcuts with a shortcuts dialog; OPML import, export
and migration; Mastodon plus multi-network share targets; read-time
estimates; video handling; and a PWA shell with virtualized lists.

Honest gaps against Feedly, which the middle of this file attacks: no boards
or collections beyond stars, no keyword alerts, no audio way to read, no
offline pack for planes, no user highlights or margin notes, no feed
discovery, no feed health story, no ingestion beyond RSS/Atom feeds (no JSON
Feed, no feed autodiscovery beyond pasting a feed URL, no social/API sources,
no scrape fallback for sites without feeds), no stats, no webhooks or
automation surface, and no public sharing. The super-app themes at the top
assume those foundations land first: the briefing desk needs clustering and
digests; the workbench needs provenance.

## K. The briefing desk (mornings like the president)

One screen, three depths, zero decisions before coffee. The editions
pipeline and the Brief view are the seed; this theme grows them into the
reason to open the app every day.

### K1. Three-tier briefing

- **Why.** Some mornings allow sixty seconds, some allow thirty minutes.
  A briefing with one depth fits neither.
- **What.** Every briefing renders as three tiers: the minute (five Jev-
  selected key excerpts, five links), the five minutes (sections with Jev-
  scored why-it-matters excerpts), and the deep read (full sections with
  member rows). All tier text is assembled from cited corpus excerpts; tier
  switching never loses your place and each tier links the same sources.
- **Half.** `both` (tiering server-side in the editions pipeline, render
  client-side).
- **Effort.** `M`.
- **First test.** Tier-rendering goldens; link-parity test across tiers.

### K2. Overnight deltas

- **Why.** "What changed while I slept" is the highest-value question in
  news and the hardest to answer by scrolling.
- **What.** A "since your last visit" delta computed from read state and
  fetch times: new clusters and moved stories; the retracted-claims
  category arrives with L5 and the closed-questions category arrives with
  M2, both hidden until then. Consumes B7 cluster identity and K1's
  briefing shape; the briefing opens on the delta, not the firehose.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Delta goldens with frozen clocks; empty-delta copy tests.

### K3. Briefing desk with live drill-down

- **Why.** A briefing that cannot be interrogated is a lecture. Presidents
  ask follow-ups.
- **What.** Every briefing section expands into its member rows, every row
  opens the panel, and a scoped "why does this matter to me" view returns
  Jev-ranked, cited excerpts from the same corpus. Reuses the N3 retrieval
  and evidence-selection engine; the desk remembers which sections you
  expanded and weights them tomorrow. No answer without linked source rows.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Expansion-state persistence smoke; citation-integrity
  tests for scoped answers.

### K4. Scheduled briefings that arrive

- **Why.** A briefing you must open is a briefing you skip on busy days.
- **What.** Opt-in morning and evening briefings delivered as notifications
  and an offline-readable card from the editions pipeline; quiet hours
  respected (the shared preference owned by F3); one tap opens the
  underlying rows. The weekend slot is owned by K5, not here.
- **Half.** `both` (briefing assembly server-side from Jev-selected
  excerpts; delivery through push with per-user opt-in).
- **Effort.** `L`.
- **First test.** Scheduling and opt-in tests; redaction tests for payloads.

### K5. Weekend review edition

- **Why.** The week deserves a closing ceremony: what mattered, what you
  missed, what is worth an hour on Sunday.
- **What.** A longer auto-built weekend edition with the week's biggest
  clusters (consuming B7 cluster identity), your starred gems, unfinished
  longform, and three suggested deep reads; shareable as a card, private
  by default. Owns the weekend slot; K4 delivers it.
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Aggregation smoke with crafted histories.

## L. Investigation workbench (thousands of articles, one desk)

This is the Google News full-coverage page rebuilt as a power tool: not a
page you visit, a desk where cases get built. It assumes retrieval (theme
A), topic clustering (B7), and row-level provenance (N6) exist.

### L1. Storylines across time

- **Why.** Big stories unfold over weeks across hundreds of rows. A flat
  list cannot show an arc.
- **What.** Storylines: a developing story rendered as a timeline of key
  updates with cluster membership over time, new-angles markers, and a
  "where this stands now" block assembled from Jev-selected, cited recent
  rows that refresh as the cluster grows.
- **Half.** `both` (cluster identity server-side; timeline render client).
- **Effort.** `XL`.
- **First test.** Storyline goldens with synthetic cluster histories.

### L2. The evidence tray

- **Why.** Investigating means collecting: rows, quotes, numbers, links.
  Today collecting means open tabs and memory.
- **What.** A persistent tray where you pin articles, quotes, and figures
  from any view; the tray becomes a case file with ordering, notes, and
  one-tap export to portable markdown; cases save, rename, and reopen.
- **Half.** `both` (cases sync per user with migrations).
- **Effort.** `L`.
- **First test.** Migration plus endpoint tests; tray-ordering smoke.

### L3. Faceted exploration at corpus scale

- **Why.** "Show me everything my feeds said about batteries in March,
  longest first, excluding press releases" is a pro query that needs a pro
  surface.
- **What.** A faceted explorer over the whole corpus: topic, feed, folder,
  author, date, length, media, and signal facets with counts, combinable
  with search operators and savable as smart folders reusing A3's saved-view
  model.
- **Half.** `both`.
- **Effort.** `XL`.
- **First test.** Facet-count tests; savable-view round-trip tests.

### L4. Saved research sessions

- **Why.** Investigations span days. Rebuilding context each visit kills
  momentum.
- **What.** Named sessions capturing open case, filters, scroll positions,
  and tray contents; consumes L2's case-file and tray model; resume
  exactly; sessions list with last-touched stamps and gentle staleness
  notes ("12 new rows since Tuesday").
- **Half.** `app` first, `api` assist for cross-device later.
- **Effort.** `M`.
- **First test.** Session capture and resume smoke.

### L5. Contradiction and correction radar

- **Why.** Feeds get things wrong and update quietly. A pro reader wants
  the correction surfaced, not buried.
- **What.** Detection of corrections, retractions, and direct
  contradictions inside clusters, surfaced as badges on affected rows and
  a corrections section in briefings (consuming K1's briefing shape);
  corrected rows link the update.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Correction-pattern goldens; badge smoke.

## M. Context engine (Google News full coverage, but better and yours)

Google News shows every angle but knows nothing about you and explains
nothing about itself. Our coverage view is personal, sourced, and
answerable.

### M1. Perspective spectrum per cluster

- **Why.** One outlet is one angle; five outlets unlabeled is noise.
- **What.** Each cluster shows a perspective spectrum: reporting spread
  across outlets with primary sources pinned first, opinion labeled as
  opinion, and wire copies folded; the spectrum never labels people, only
  pieces.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Spectrum goldens; opinion-label tests.

### M2. Entity dossiers from your feeds

- **Why.** People, companies, and places recur for months before you learn
  their backstory. Dossiers compile it from what you already read.
- **What.** Auto-built dossier pages per recurring entity: first-seen,
  key stories, timeline of mentions, related entities, and open questions;
  consumes the N6 provenance layer for entity links; dossiers derive from
  your corpus only, with per-entity mute and forget.
- **Half.** `both`.
- **Effort.** `XL`.
- **First test.** Dossier goldens; forget-path tests.

### M3. Backgrounders on demand

- **Why.** Walking into week three of a story needs a primer, not an
  archive dive.
- **What.** One-tap "catch me up" on any cluster or entity: a short
  primer assembled from Jev-selected, cited excerpts with the five essential
  rows linked; primers cache and refresh as clusters grow. No invented
  background text.
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Primer goldens; cache-invalidation tests.

### M4. Jargon and context explainer

- **Why.** Specialist beats assume vocabulary the reader never agreed to.
- **What.** Inline explanations for terms, acronyms, and references drawn
  from your own corpus first ("as used in your feeds") as Jev-selected,
  cited excerpts and definitions, with a glossary that grows per folder. No
  uncited generated definitions.
- **Half.** `app` first, `api` assist later.
- **Effort.** `M`.
- **First test.** Glossary smoke; explainer fallback tests.

### M5. Numbers with receipts

- **Why.** Figures travel without sources. A pro desk pins every number to
  its row.
- **What.** Builds on the N6 provenance layer: figure extraction with
  per-number provenance links, unit normalization, and disagreement flags
  when feeds cite different values for the same fact; reuses N6's
  provenance ids so the panel and the numbers view cannot disagree.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Extraction goldens; disagreement-flag tests.

## N. Ambient Jev assistance (everywhere, receipts always)

Not a chatbot tab and not generative prose. Jev is the sole AI: assistance
lives where the reading already happens (rows, panel, briefings, clusters)
as typed judgments, scores, labels, and assemblies of cited excerpts from
the user's corpus. Every surfaced answer links source rows or it does not
ship; keys stay server-side, payloads never reach logs, and quotas guard the
server.

### N1. Row-level highlights and why-this-row

- **Why.** Triage is ninety percent of reading. Two key lines plus a reason
  beats any badge alone.
- **What.** Expandable Jev-selected key excerpts (extractive highlights) in
  list rows for long pieces plus a why-this-row line naming the Jev signals
  and scores that ranked it; a global off switch; cached per article. No
  generated abstracts. Shipped: the excerpts, why signals, cache, and global
  off switch render in the article panel. Still wanted: the list-row
  expansion hook.
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Cache and quota tests; row-expansion smoke.

### N2. In-panel reading companion

- **Why.** Questions strike mid-article, and leaving the article kills them.
- **What.** A companion inside the article panel built on Jev judgments:
  surface key excerpts, find related rows in your corpus ("what did my
  other feeds say"), and highlight counter-arguments or corrections already
  present in cited rows. Reuses the N3 retrieval and evidence-selection
  engine so there is one cited pipeline and one quota pool; every surfaced
  item cites source rows, never the open web alone. No free-form chat or
  generated rewrites.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Citation and selection tests; quota and redaction tests.

### N3. Ask-your-feeds Q&A

- **Why.** "What did my feeds say about grid storage this week?" is the
  question no reader UI answers today.
- **What.** Scoped "ask your feeds" over your own corpus: Jev-scored
  retrieval and evidence selection return cited excerpts that open the exact
  rows; scope picker (everything, folder, feed, board, date range; the case
  scope lands with L2). No answer without linked source rows and no
  free-form synthesis.
- **Half.** `both` (retrieval plus Jev-scored selection server-side;
  citations render client-side).
- **Effort.** `XL`.
- **First test.** Citation-integrity tests; quota and redaction tests.

### N4. Coverage-balance meter

- **Why.** A diet of three outlets feels complete while starving you.
- **What.** A private meter showing outlet and perspective breadth per
  topic with gentle "you have not heard the other side" nudges and
  one-tap broadening suggestions; computed locally, never uploaded.
- **Half.** `app`.
- **Effort.** `M`.
- **First test.** Breadth-scoring smoke; nudge-suppression tests.

### N5. Reading-level and time adaptation

- **Why.** The same story serves a skim, a study session, and a tired
  evening differently.
- **What.** Per-session reading modes: Jev-selected excerpt depth (skim key
  lines, standard highlights, or deep set) assembled from the article and
  cited corpus context; your default depth per folder remembered; originals
  always one tap away and credited. No generated rewrites.
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Adaptation goldens; original-link presence tests.

### N6. Row-level provenance layer

- **Why.** N1 explains why a row ranked; the workbench needs the other
  direction: which sources, quotes, and figures a row actually rests on.
  Without a provenance layer, storylines and dossiers have nothing to link.
- **What.** A per-row provenance record: extracted quotes, cited figures,
  linked entities, and source rows, with stable ids the workbench themes
  consume; provenance renders in the panel and exports with case files.
- **Half.** `both` (extraction server-side; render and export client-side).
- **Effort.** `L`.
- **First test.** Extraction goldens; provenance-link integrity tests.

## O. Pro treatment (workspaces, command, mastery)

Treat the heaviest user like a professional, not a metric: beats, cases,
command, and stats that respect attention.

### O1. Beat workspaces

- **Why.** One sidebar cannot serve a hardware analyst, a new parent, and
  a Sunday browser in the same person.
- **What.** Named workspaces (beats) bundling folders, boards, mutes,
  briefings, and alerts per role; fast switching with full keyboard
  support; each beat has its own Today and Interesting tuning.
- **Half.** `both` (definitions sync).
- **Effort.** `L`.
- **First test.** Workspace-switch smoke; per-beat tuning tests.

### O2. Command palette for everything

- **Why.** Every action and destination in seven keystrokes.
- **What.** A palette for go, filter, act, and ask: jump to any view,
  run any shortcut, trigger briefs, file rows to boards, with fuzzy
  matching and recent commands. Month one ships the go, filter, and act
  verbs; the ask verb lands with N3 and the brief triggers with K1/K4.
- **Half.** `app`.
- **Effort.** `M`.
- **First test.** Palette action registry tests; fuzzy-match goldens.

### O3. Focus sessions with a bottom

- **Why.** Fifteen focused minutes beat an hour of grazing; queues need
  bottoms.
- **What.** Scheduled sessions that queue a ranked set with a timer,
  progress, and a done screen that marks the rest read only on approval;
  streaks track kept sessions, never guilt.
- **Half.** `app`.
- **Effort.** `S`.
- **First test.** Session flow smoke.

### O4. Mastery stats, privately

- **Why.** Progress motivates when it stays yours.
- **What.** Minutes read, finish rate, topic mix, and streaks on one
  private screen; the breadth meter lives in N4, not here; session streaks
  reuse O3's counter; monthly recap cards; everything computed locally
  first; export your own data anytime.
- **Half.** `app` first.
- **Effort.** `M`.
- **First test.** Aggregation smoke; empty-state copy tests.

### O5. Case files that leave the app

- **Why.** Investigations end in memos, posts, and decisions elsewhere.
- **What.** Builds on L2's case-file model: one export path that renders
  citations intact to portable markdown and a formatted document, plus
  publish to the personal reading page (G2) on approval. Reuses L2's
  export rather than adding a second one; the publish path needs an api
  follow-up when G2 lands.
- **Half.** `app` first, `api` follow-up with G2.
- **Effort.** `S`.
- **First test.** Export goldens with citation checks; publish-approval
  flow smoke.

## A. Find anything (search and retrieval)

Search shipped local-first: a client index over cached pages, a server `q=`
endpoint with ranking, operators, and saved searches as sidebar rows.
Feedly's power search is a paid moat; ours is local-first and free.
Everything in the workbench themes depends on retrieval landing first.

### A4. Stories like this one

- **Why.** Discovery inside your own archive: one great piece should surface
  its siblings.
- **What.** A per-article "more like this" action combining word overlap,
  shared feeds, and syndication clusters, served as a transient view.
- **Half.** `app` first (local scoring), `api` later for depth.
- **Effort.** `M`.
- **First test.** Smoke for the similarity ranking with crafted titles.

### A5. Search inside one article and jump-to-article

- **Why.** Longform needs find-in-page that understands the reader shell,
  and deep links worth sending.
- **What.** In-article find with match counts and keyboard stepping; every
  article gets a stable link that opens scrolled to the right row.
- **Half.** `app`.
- **Effort.** `S`.
- **First test.** Browser smoke for the find flow; unit tests for link
  building.

## B. Kill the noise (filtering and triage)

Interesting ranks; this theme deletes. Feedly sells mute filters and Leo
triage as premium features. Ours are core.

### B1. Mute rules with a test drive

- **Why.** Some topics, authors, and domains are never worth your minutes.
  A mute that is scary to create never gets created.
- **What.** Global and per-folder mute rules over keywords, phrases,
  authors, and domains, with plain and pattern matching. A rule can target
  title, article body, or either, and accept multiple words/terms (any
  match mutes). Shipped: rules, matching, the editor, list/search
  application, a test-drive preview that shows what a draft rule would
  hide in the latest batch before it goes live, and one-tap undo from the
  empty state. Still wanted: server-side rule sync and richer matching
  (authors/domains/patterns).
- **Half.** `both` (sync still wanted; evaluation client-side for lists).
- **Effort.** `L`.
- **First test.** Smoke for matching and the test-drive counts; API tests
  for rule storage.

### B2. Duplicate and cross-post clustering

- **Why.** Big stories arrive five times from five feeds. Reading all five
  is the tax Feedly never removes.
- **What.** Group near-identical stories into one row ("covered by 3
  feeds") with a merged view, canonical pick, and per-member open; the
  cluster survives marking one member read.
- **Half.** `both` (syndication signals exist on the server; clustering
  rules and the merged row are client work first).
- **Effort.** `XL`.
- **First test.** Golden clustering cases in smoke; server tests for the
  syndication inputs.

### B3. Paywall, soft-404, and junk detection

- **Why.** A row that cannot be read is worse than no row: it spends hope.
- **What.** Label rows the reader cannot finish (paywall markers, truncated
  bodies, error fetches) with a badge and a filter; feed health feeds the
  labels (see the health dashboard further down).
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Parser heuristics in smoke; fetcher classification in API
  tests.

### B4. Priority inbox per folder

- **Why.** Not every unread is equal. A must-read split beats an endless
  river.
- **What.** A per-folder priority lane combining the Interesting score,
  front-page worthiness, and recency; one toggle flips between everything
  and must-read; the lane remembers its toggle per folder.
- **Half.** `app`.
- **Effort.** `M`.
- **First test.** Smoke for lane membership and toggle persistence.

### B5. Snooze and resurface

- **Why.** "Not now" is not "never". Without snooze, timing kills good
  stories.
- **What.** Snooze an article to tonight, tomorrow, or the weekend; a
  resurface row collects what comes due; snoozed rows vanish without
  counting as read.
- **Half.** `both` (timestamps sync; the row is a client view).
- **Effort.** `M`.
- **First test.** Time-travel smoke for due and overdue states; migration
  plus endpoint tests.

### B6. Catch-me-up caps

- **Why.** Coming back to 400 unread should offer a five-minute path, not
  guilt.
- **What.** Per-folder "catch me up in N minutes" using read-time estimates
  and ranking to fill the budget; one button marks the overflow read with
  an explicit, undoable confirmation.
- **Half.** `app`.
- **Effort.** `S`.
- **First test.** Smoke for budget filling and the undo path.

### B7. Topic clustering

- **Why.** Near-duplicate clustering (B2) folds copies of one story; it
  does not group different stories about the same developing topic. The
  briefing desk, storylines, and the perspective spectrum all need topic
  cluster identity, and nothing else in this file builds it.
- **What.** Topic clusters over the corpus: group rows by shared phrases
  (reusing the app's learned word-map signals), syndication neighborhoods,
  and shared links into developing stories with a stable cluster id,
  growth rate, and member set; clusters persist across refreshes and merge
  when two clusters converge. Entity linking arrives with N6; B7 ships
  phrase and link clustering first and folds entity links in when N6 lands.
  Exposes the cluster id the workbench themes consume.
- **Half.** `both` (cluster identity and growth server-side; merge rules
  and the cluster row client-side first).
- **Effort.** `XL`.
- **First test.** Cluster goldens with synthetic corpora; merge and
  split tests; growth-rate tests.

### B8. Ignore folder from metadata

- **Why.** Some folders come from imported or provider metadata (OPML groups, feed categories) that should stay out of the daily reading flow without deleting the underlying feeds.
- **What.** Let a folder be ignored based on its metadata/source so it can be excluded from sidebar emphasis, unread counts, and default views while remaining manageable in Organize; the ignore state is explicit, reversible, and visible.
- **Half.** `both` (metadata sync/derivation as needed; view/count filtering client-side first).
- **Effort.** `M`.
- **First test.** Smoke for ignore toggles, count/view exclusion, and restore; migration or storage tests if the flag syncs.

## C. Read better (the reading experience)

The reader shell is already strong (shortcuts, bulk select, read-time
estimates, video handling). This theme makes reading itself delightful.

### C1. Speed-read mode

- **Why.** Skimming a long piece at fixed pace beats scrolling past it.
- **What.** A flash mode with words-per-minute control, chunking, pause on
  punctuation, progress, and a plain list fallback; honors reduced-motion
  settings by refusing to flash.
- **Half.** `app`.
- **Effort.** `M`.
- **First test.** Unit tests for chunking and pacing; audit for the mode.

### C2. Audio briefs and listen queue

- **Why.** Commutes, dishes, and walks are reading time without a screen.
  No audio story exists today.
- **What.** A listen queue that plays Jev-selected briefing excerpts and
  article highlights using platform/device text-to-speech (no AI synthesis
  model) with a sleep timer, speed control, and offline-cached audio where
  supported; play from the row, the panel, or the Today view.
- **Half.** `app` (player, queue, and cache; optional `api` assist only for
  packaging excerpts, not for model synthesis).
- **Effort.** `L`.
- **First test.** Player and queue smoke; offline-cache accounting tests.

### C3. Real reader modes

- **Why.** Typography is a feature for tired eyes.
- **What.** Serif, sans, and dyslexia-friendly faces; line width and
  spacing controls; focus mode that spotlights the current paragraph;
  per-feed defaults remembered quietly.
- **Half.** `app`.
- **Effort.** `M`.
- **First test.** Persistence smoke; audit for the mode controls.

### C4. Resume where you left off

- **Why.** Longform gets interrupted. Remembering scroll position per
  article is a small kindness with outsized love.
- **What.** Per-article progress persisted locally with a "resume" affordance
  and the existing progress bar extended to restore position.
- **Half.** `app`.
- **Effort.** `S`.
- **First test.** Smoke for save, restore, and completion clearing.

### C5. Highlights and margin notes

- **Why.** Readers think in the margins. Feedly's notes are a premium
  hook; ours sync and export.
- **What.** Select-to-highlight with per-color meaning, margin notes per
  article, a notes view per folder, and one-tap export to portable
  markdown; quotes render as shareable cards.
- **Half.** `both` (notes sync per user with migrations).
- **Effort.** `L`.
- **First test.** Smoke for ranges and export; migration plus endpoint
  tests.

### C6. Worth-your-minutes badge

- **Why.** "Four minutes" is not an answer without "worth it".
- **What.** A badge combining read time, Interesting score, and front-page
  worthiness into a plain verdict with a why-popover; the popover names
  the signals, never the model internals.
- **Half.** `app`.
- **Effort.** `S`.
- **First test.** Smoke for badge tiers and the popover copy.

### C7. Original-language reading aids

- **Why.** Great feeds are not all in your language, but readers still need
  a safe way in.
- **What.** For original-language articles, show the source text with clear
  language labeling plus Jev-selected key excerpts, entities, and numbers
  linked to cited corpus context (reusing M4, M5, and N6 where available).
  No machine translation and no generated paraphrase; originals remain
  primary.
- **Half.** `app` first, `api` assist later for corpus linking.
- **Effort.** `M`.
- **First test.** Labeling and excerpt-selection smoke; provenance-link
  tests where corpus context is shown.

### C8. Slideshow view

- **Why.** Some reading sessions work better as a paced, one-article-at-a-time flow than as a scrolling list.
- **What.** A slideshow view mode for articles, in the spirit of Clipstack and lemmy-scroll: step or swipe through items with focused reading, clear progress, and quick actions (star, save, mark read, open original) without losing place.
- **Half.** `app`.
- **Effort.** `M`.
- **First test.** View-mode smoke for navigation, progress, and actions; accessibility audit for the new mode.

## D. Organize and own your data

Stars are a single bucket. Feedly's boards are beloved because thinking
needs piles. Ours add portability: everything exports, everything migrates.

### D1. Boards beyond stars

- **Why.** "Read later", "citations", "gift ideas", and "team ammo" are
  different piles with different lives.
- **What.** Named boards with ordering, notes per entry, per-board sharing
  by link, per-board OPML export, and board-scoped search; stars stay as
  the zero-friction default.
- **Half.** `both` (boards sync with migrations).
- **Effort.** `L`.
- **First test.** Migration plus endpoint tests; drag-order smoke.

### D2. Read-later queue with plane mode

- **Why.** Offline planes, subways, and cabins are where queues earn love.
- **What.** A dedicated queue plus one-tap offline pack (articles, images,
  and audio segments) with a storage meter and eviction rules; the pack
  completes in the background with progress. Shipped: the saved-for-later
  queue. Still wanted: the offline pack, storage meter, eviction, and
  background progress.
- **Half.** `app`.
- **Effort.** `L`.
- **First test.** Cache accounting smoke; quota-of-storage edge tests.

### D3. Full portable export

- **Why.** Your library is yours. Leaving must be trivial for staying to
  feel safe.
- **What.** One archive with feeds, folders, stars, boards, notes, rules,
  and settings; one import that rebuilds it; a documented format so other
  tools can read it.
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Round-trip fixtures; version-tolerance tests.

### D4. Feed health dashboard

- **Why.** Dead, moved, and flaky feeds rot silently and poison counts.
- **What.** Per-feed health (error history, cadence, dupe rate), fix
  suggestions including moved-URL replacement, bulk retire of the long-dead
  feeds only after explicit confirmation with an undo window, and
  pre-subscribe quality preview. No silent or automatic feed removal.
- **Half.** `both` (fetch history exists server-side; the dashboard is new).
- **Effort.** `L`.
- **First test.** Health-derivation tests; dashboard audit.

### D5. Curated bundles and starter packs

- **Why.** A new reader faces a blank page. Bundles make day one great.
- **What.** Topic starter packs and community bundles as importable OPML
  with previews and per-bundle update notes. No tracking, no ratings.
- **Half.** `both` (bundle hosting plus client preview).
- **Effort.** `M`.
- **First test.** Bundle validation tests; preview smoke.

### D6. Dedupe my subscriptions

- **Why.** The same feed subscribed twice doubles noise and splits state.
- **What.** Detection of duplicate URLs and near-duplicate feeds with a
  guided merge that preserves folders, stars, and rules.
- **Half.** `both`.
- **Effort.** `S`.
- **First test.** Merge-preservation tests.

## E. Discovery (find new feeds)

Today the only door is pasting a feed URL. Feedly's discovery keeps people
paying; ours respects the no-tracking rule while doing it better. Detecting
feeds from a site (E1) and ingesting sources beyond traditional feeds
(formats, social APIs, and scrape fallbacks) are tackled in P. Sources and
ingestion.

### E1. Site-to-feed finder

- **Why.** People find sites, not feed URLs.
- **What.** Paste any site address: detect candidate feeds, preview recent
  items and cadence, subscribe to the right one in one tap.
- **Half.** `both` (detection assist server-side).
- **Effort.** `M`.
- **First test.** Detection goldens; preview smoke.

### E2. More like this feed

- **Why.** One beloved feed implies a neighborhood.
- **What.** Per-feed recommendations from co-reading graphs and topic
  overlap, with reasons ("readers of X also follow Y for hardware"), all
  computed without cross-user tracking.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Recommendation goldens with synthetic graphs.

### E3. Anonymous trend signals

- **Why.** "What are readers like me finding?" without surveillance.
- **What.** Opt-in, aggregated, delay-fuzzed popularity signals that power
  a trends row and never resolve to a person; off by default with a plain
  explanation.
- **Half.** `both`.
- **Effort.** `XL`.
- **First test.** Aggregation privacy tests; trends smoke.

### E4. Import from everywhere

- **Why.** Switching costs keep people in worse readers.
- **What.** Guided import from the common export formats plus starred and
  saved migration, with a before-and-after report.
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Format fixtures; report smoke.

## F. Alerts, routines, and stats

### F1. Keyword and cluster alerts

- **Why.** Some stories cannot wait for the next scroll.
- **What.** Keyword alerts with per-alert channels and quiet hours
  (respecting the shared preference owned by F3), plus cluster-break alerts
  for big multi-feed stories; every alert deep-links the rows.
- **Half.** `both` (matching server-side; delivery via push and in-app).
- **Effort.** `L`.
- **First test.** Matching tests; quiet-hours time travel.

### F2. Email digest option

- **Why.** Not everyone lives in the reader. An opt-in digest meets them
  where they are.
- **What.** Server-rendered daily or weekly digest email with top picks and
  links back to rows; one-click unsubscribe; no tracking pixels, ever. The
  unsubscribe link is a signed, single-use token route; implementing it
  requires an explicit `apps/rss/api/AGENTS.md` contract update to add that
  specific route to the unauthenticated, unversioned exemption list (like a
  probe), and the token must be single-use and subscription-scoped. Every
  other route stays authenticated and versioned.
- **Half.** `api` plus templates.
- **Effort.** `M`.
- **First test.** Rendering goldens; unsubscribe tests.

### F3. Breaking clusters via push

- **Why.** The poller sees news first; the reader should hear it first.
- **What.** Opt-in push for large fast-growing clusters with collapse and
  quiet hours; owns the shared quiet-hours preference consumed by K4 and F1;
  VAPID keys per deployment, never shared.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Cluster-threshold tests; subscription lifecycle tests.

### F4. Sessions wired into alerts and queues

- **Why.** Sessions earn their keep when they respond to the day, not only
  when planned. Alerts should be able to open a session, and a session should
  know what the queue already holds.
- **What.** Cluster and keyword alerts open a ready session seeded with the
  alert rows; sessions read the read-later queue first when one exists; the
  done screen offers the next session as a single tap.
- **Half.** `app`.
- **Effort.** `M`.
- **First test.** Alert-to-session seeding smoke; queue-first ordering tests.

## G. Share and integrate (the reader as a citizen)

Sharing exists (multi-network targets, quote flow). This theme turns the
reader into infrastructure.

### G1. Copy as markdown and quote cards

- **Why.** The fastest share is paste-ready text, not a screenshot ritual.
- **What.** One action copies a clean markdown citation; another renders a
  beautiful quote card image locally for social posting.
- **Half.** `app`.
- **Effort.** `S`.
- **First test.** Citation-format goldens; card-render smoke.

### G2. Personal reading page

- **Why.** "What I read this week" is a lovely public artifact.
- **What.** An opt-in auto-built public page (weekly picks with notes,
  assembled from cited rows) rendered statically, with custom slug and
  instant revoke. The published
  page is a signed-slug public route; implementing it requires an explicit
  `apps/rss/api/AGENTS.md` contract update to add that specific route to the
  unauthenticated, unversioned exemption list (or it must be rendered as a
  static asset outside the API). Revocation stays authenticated and
  versioned.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** Rendering tests; revoke tests.

### G3. Webhooks for boards and alerts

- **Why.** Automation people live in webhooks. Glue without the middleman
  subscription.
- **What.** Per-board and per-alert webhook endpoints with signed payloads,
  retry with backoff, delivery log, and per-hook disable.
- **Half.** `api`.
- **Effort.** `L`.
- **First test.** Signature and retry tests; delivery-log tests.

### G4. Notes-app exports

- **Why.** Highlights die in silos. Markdown-first tools deserve first-class
  export.
- **What.** One-tap export paths for the common markdown notebooks plus a
  documented file layout; scheduled export to a chosen destination later.
- **Half.** `app` first.
- **Effort.** `S`.
- **First test.** Layout goldens.

### G5. OS share-target receiving

- **Why.** Sharing into the reader should be as easy as sharing out of it.
- **What.** PWA share-target support so links from any app land as
  subscribe-or-save flows.
- **Half.** `app` plus manifest work.
- **Effort.** `M`.
- **First test.** Manifest assertions; receive-flow smoke.

## H. Speed, offline, and trust (the platform bets)

### H1. Full offline reader

- **Why.** Tunnels, planes, and dead zones should not end reading.
- **What.** Background sync of unread plus images, offline search over the
  cached corpus, queued actions (star, read, note) that reconcile on
  reconnect with visible conflict rules.
- **Half.** `app` with sync-protocol support on `api`.
- **Effort.** `XL`.
- **First test.** Reconcile tests; offline smoke with a killed network.

### H2. Performance budgets in CI

- **Why.** Virtualized lists stay fast only if something measures them.
- **What.** List-window frame budgets, long-task guards on ingest, and a
  sustained-scroll check in the browser suite that fails on regression.
- **Half.** `app` plus CI wiring.
- **Effort.** `M`.
- **First test.** The budget test itself plus a known-slow fixture.

### H3. Privacy dashboard

- **Why.** A reader that learns must prove what it learned, locally.
- **What.** One screen showing every learned signal (word weights, totals,
  deranks, decay), per-signal toggles, export of the learned profile, and
  one-tap forget with confirmation.
- **Half.** `app`.
- **Effort.** `M`.
- **First test.** Inspector smoke against a rigged profile; forget tests.

### H4. Cross-device settings sync

- **Why.** Two devices should feel like one reader.
- **What.** Sync of settings, boards, rules, and notes per user with
  last-write-wins plus visible conflict notes; stars already sync and lead
  the pattern.
- **Half.** `both` with migrations.
- **Effort.** `L`.
- **First test.** Migration tests; conflict-note smoke.

## P. Sources and ingestion (beyond Atom/RSS feeds)

The reader should be able to follow anything worth reading, not just whatever
already publishes a clean feed. This theme expands the front door: richer feed
formats and autodiscovery, push where the web supports it, standards-based
page and social sources, and careful scrape fallbacks for sites that offer no
feed at all. Every connector normalizes into the same article/feed model so
ranking, search, mute rules, clustering, and reading all work unchanged.

Ingestion conventions (apply to every item here): sources are explicit and
user-added, never auto-subscribed; fetches respect robots.txt, site terms,
and rate limits; polling is bounded and backoff-aware; credentials for
private or API-keyed sources stay server-side and never appear in logs or
client bundles; fetched content is untrusted (sanitized before render,
URLs validated, no script execution); connector failures surface in feed
health (D4) with actionable errors; and every new source type records
provenance (source kind, canonical URL, fetch method, timestamps) so users
can tell where an item came from.

### P1. JSON Feed 1.1 and feed-format parity

- **Why.** Many modern sites publish JSON Feed instead of, or in addition to,
  RSS/Atom. Treating it as a second-class citizen turns "subscribe" into a
  guessing game.
- **What.** First-class parsing and subscription for JSON Feed 1.1 (including
  `items`, `content_html`/`content_text`, attachments, authors, tags, and
  extensions we choose to ignore safely), with parity handling for RSS 0.9x/
  1.0/2.0 and Atom (enclosures, media namespaces, content encodings, dates,
  GUID/id stability). Normalize titles, links, authors, published/updated
  times, summaries, full content, and media into the existing article fields.
- **Half.** `both` (parser/fetcher in `api`, subscription UX/validation in
  `app`).
- **Effort.** `M`.
- **First test.** Parser goldens for JSON Feed, RSS variants, Atom, and
  malformed/edge cases; API slice tests for subscribe/refresh; smoke for
  adding a JSON Feed URL.

### P2. Rich feed autodiscovery from any page

- **Why.** People paste homepages, article URLs, and profile pages, not feed
  URLs. Discovery should find every usable followable source a page advertises.
- **What.** When subscribing to a URL, fetch and inspect `<link rel="alternate">`
  (RSS, Atom, JSON Feed MIME types), common feed paths, and visible feed links;
  detect Microformats2 `h-feed`/`h-entry` on the page as a standards-based
  fallback source; present candidates with type, title, item count/cadence
  preview, and confidence before subscribing. One page may yield multiple
  candidates (site feed, comments feed, section feeds, h-feed); the user picks.
  Reuse/extend E1 site-to-feed finder UI and heuristics.
- **Half.** `both` (discovery endpoint in `api`, candidate picker/preview in
  `app`).
- **Effort.** `M`.
- **First test.** Discovery goldens over fixture HTML (multiple alternates,
  JSON Feed, h-feed, no feed); preview smoke; seeded audit for the picker.

### P3. WebSub push subscriptions

- **Why.** Polling wastes requests and delays updates. Hubs can tell us when
  content changes, which is faster and kinder to publishers.
- **What.** Discover `hub`/`self` links for Atom/RSS feeds that advertise
  WebSub; subscribe and verify callbacks, renew leases before expiry, handle
  unsubscription, and fall back to polling when no hub exists or verification
  fails. Ingest pushed content through the same normalization/dedupe pipeline.
  WebSub callbacks are a specific unauthenticated, signed/verified route;
  implementing them requires an explicit `apps/rss/api/AGENTS.md` contract
  update and strict verification (hub challenge, signature/HMAC where
  provided, replay/expiry handling). All other data routes remain
  authenticated and versioned.
- **Half.** `api` (hub client, callback endpoint, lease management) plus
  minimal `app` status/health surfacing.
- **Effort.** `L`.
- **First test.** Hub handshake and callback verification tests, renewal and
  fallback tests, malformed-payload rejection tests.

### P4. Conditional fetch and polite polling

- **Why.** Good citizenship and good performance are the same work: do not
  re-download unchanged feeds, and do not hammer sources that are slow or
  broken.
- **What.** Send `If-None-Match`/`If-Modified-Since` when available, honor
  `304 Not Modified`, cache validators per feed, and respect `Retry-After` and
  reasonable backoff on errors/429s. Adaptive poll intervals based on observed
  update cadence and feed health, with per-source floors/ceilings and manual
  refresh always available. Expose fetch status (last success, next attempt,
  backoff reason) to D4.
- **Half.** `api`.
- **Effort.** `M`.
- **First test.** HTTP fixture tests for 304/ETag/Last-Modified/Retry-After;
  backoff and cadence tests.

### P5. Follow any page (scrape fallback when no feed exists)

- **Why.** Many valuable sites publish updates with no RSS/Atom/JSON Feed or
  h-feed at all. A reader that requires a feed cannot follow them.
- **What.** A "watch this page" source type: periodically fetch a page and
  extract a list of items (links/titles/dates/snippets) using layered
  strategies — structured data (JSON-LD/ItemList/Article), semantic/list
  heuristics, readability-style content extraction, and optional user-defined
  CSS selectors/XPath-like hints for stubborn pages. Detect changes/new items
  by stable keys (URL, content hash), produce normalized articles with clear
  "scraped from page" provenance, and let users preview extracted items before
  saving. Mark as best-effort: layout changes can break extraction, and errors
  must be visible and recoverable.
- **Half.** `both` (fetch/extract pipeline in `api`, preview/configure UI in
  `app`).
- **Effort.** `XL`.
- **First test.** Extraction goldens over fixture pages (blog index, news
  listing, product/changelog pages, JS-light pages), change-detection tests,
  and a preview/config smoke.

### P6. Browser-assisted extraction for JS-heavy and protected pages

- **Why.** Some sites render content only after client-side JavaScript or hide
  it behind interactions that plain HTTP fetch cannot reach. Without an
  optional browser path, those sources are unfollowable.
- **What.** An opt-in, bounded browser-render fetch path (headless browser
  worker) for sources that require it: render, wait for configured selectors/
  network-idle with strict timeouts, capture the resulting DOM/text, then run
  the same extraction/normalization pipeline as P5. Strong limits: per-source
  opt-in, resource/timeout caps, no stored cookies/credentials by default,
  isolated execution, and clear labeling that this mode is heavier and more
  fragile. Never bypass paywalls, logins, CAPTCHAs, or access controls.
- **Half.** `api` (render worker/service) plus `app` opt-in controls and
  warnings.
- **Effort.** `XL`.
- **First test.** Worker timeout/resource-cap tests, fixture-page render
  extraction tests, and opt-in/labeling smoke. (Requires a browser runtime in
  the deploy environment.)

### P7. ActivityPub and Mastodon sources

- **Why.** A large part of the open social web publishes via ActivityPub.
  Following public accounts, tags, or instances as first-class sources brings
  that conversation into the reader without building a social network.
- **What.** Subscribe to public ActivityPub actors (Mastodon accounts) and,
  where feasible, public hashtag/instance timelines: resolve actors via
  WebFinger/ActivityPub, fetch outboxes/collections over HTTP with proper
  content negotiation, and normalize posts/boosts/replies/attachments into
  article-like rows (with post kind, author/handle/instance, visibility,
  media, CW/summary, and canonical URL). Read-only and public-only by default;
  authenticated/home-timeline access is a separate, explicit follow-up that
  would store tokens server-side per the security rules. Deduplicate boosts
  and cross-posts where possible.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** ActivityPub JSON-LD fixture parsing tests, actor resolution
  tests, normalization/dedupe tests, and a subscribe-to-account smoke.

### P8. Bluesky and AT Protocol sources

- **Why.** Bluesky/ATProto hosts high-signal public feeds and authors that
  readers want alongside traditional publications.
- **What.** Subscribe to public Bluesky actors, feeds, and lists via the AT
  Protocol/Bluesky APIs: resolve handles/DIDs, fetch posts with pagination,
  normalize text, links, quotes, reposts, embeds/media, and canonical URLs
  into rows with clear provenance. Read-only public access first; any
  authenticated or app-password flow is a separate opt-in item with
  server-side credential storage and revocation.
- **Half.** `both`.
- **Effort.** `L`.
- **First test.** API fixture/contract tests for resolution and post
  normalization, pagination tests, and a subscribe smoke.

### P9. YouTube, video, and audio channels

- **Why.** Creators publish primarily on video/audio platforms. Treating
  channels and playlists as readable/watchable sources keeps the reader
  current without a separate app.
- **What.** Subscribe to YouTube channels and playlists (via channel/playlist
  feeds where available, or platform APIs where necessary and permitted),
  normalize videos/livestreams/premieres with title, description, duration,
  thumbnails, publish time, and canonical/watch/embed URLs. Similar connectors
  for podcast feeds and other media channels where a standard feed exists
  (building on P1). Integrate with existing video handling and the listen
  queue where media type fits.
- **Half.** `both` (connectors in `api`, rich media rows/player affordances
  in `app`).
- **Effort.** `M`.
- **First test.** Feed/API fixture normalization tests, channel/playlist URL
  resolution tests, and a media-row smoke.

### P10. Reddit, forums, and community sources

- **Why.** Subreddits, forum threads, and community boards are primary sources
  for many beats, but their native feeds vary in quality and completeness.
- **What.** First-class subscription for subreddits and users via available
  feeds/APIs, normalized into rows with flair, score/comment signals (where
  permitted), and canonical links; optional thread-expansion view that fetches
  top-level context on demand. A generic forum/community connector pattern for
  platforms that expose RSS/Atom/JSON feeds or stable JSON endpoints, with
  per-source mapping rules. Respect platform rate limits and terms.
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Mapping/normalization tests over fixtures, rate-limit/backoff
  tests, and a subreddit/community subscribe smoke.

### P11. Newsletters and email-to-reader ingestion

- **Why.** A growing share of writing ships as email newsletters, not feeds.
  Without an inbox bridge, the reader misses whole authors.
- **What.** Per-user inbound addresses or forwarding rules that accept
  newsletter emails and convert them into articles: parse MIME/HTML/text,
  extract the canonical web view when present, preserve images/links safely,
  attribute to a synthetic "newsletter" source per sender/publication, and
  dedupe against the same content if it also arrives via feed/scrape.
  Double-opt-in/confirmation for new senders, easy unsubscribe/block, and
  strict size/sanitization limits. Any public receive endpoint must be treated
  as an explicit, hardened surface (authz tokenized address, abuse/rate
  limits, spam filtering) and documented in `apps/rss/api/AGENTS.md`.
- **Half.** `both` (`api` receive/parse pipeline, `app` address management and
  sender controls).
- **Effort.** `L`.
- **First test.** MIME parsing and sanitization goldens, dedupe tests,
  sender-confirmation tests, and abuse-limit tests.

### P12. Connector framework, provenance, and source safety

- **Why.** Every new source type is another way to fail, leak, or confuse.
  A shared framework keeps connectors consistent, observable, and safe to add.
- **What.** A common connector contract (discover, validate, fetch, normalize,
  schedule, health) with capability flags (supports push, supports auth,
  supports incremental, best-effort), unified provenance stored per article
  (source type, connector id/version, canonical and source URLs, fetch mode),
  per-connector rate limits/timeouts/retries, and sandboxed parsing of
  untrusted inputs. A "source info" view shows users exactly what a connector
  does, when it last ran, and what it can access. Adding a connector means
  implementing the contract plus fixtures, not ad-hoc code paths.
- **Half.** `both` (contract/runtime in `api`, provenance and source-info UI
  in `app`).
- **Effort.** `L`.
- **First test.** Contract conformance tests with a fake connector, provenance
  persistence tests, timeout/rate-limit enforcement tests, and a source-info
  smoke.

### P13. Source permissions, privacy, and robots compliance

- **Why.** Ingestion touches the open web, third-party APIs, and sometimes
  user credentials. Trust requires clear boundaries and enforceable rules.
- **What.** A permissions model per source: what network hosts it contacts,
  whether it uses credentials/API keys, whether it runs browser rendering,
  and what data it stores; explicit consent for elevated modes (browser
  rendering, authenticated APIs, email ingestion). Enforce robots.txt/`noai`-
  style directives where applicable, configurable per-source user-agent,
  domain allow/deny controls, and a central audit log (local, user-visible)
  of connector actions without payload-bearing logs. One place to pause or
  revoke any source or connector class.
- **Half.** `both`.
- **Effort.** `M`.
- **First test.** Robots/permission enforcement tests, consent-gating smoke,
  and audit-log integrity tests.

## I. Sequencing (six months to daylight)

Foundations first, because the desk depends on them. The months below name
the work orders that land in each; anything not named is unscheduled on
purpose and waits for a month to claim it. Month one is
retrieval and control: instant search with operators (shipped), mute rules
with test drive, boards with export, the read-later queue with plane mode,
the command palette, and copy-as-markdown. Each ships behind its own flag where
risky, each with its named tests, and the month ends with the accessibility
audits green on every new screen.

Month two is briefing and ears: topic clustering (B7) and the row-level
provenance layer (N6) first, because the deltas, cluster alerts, and
storylines below consume them, then three-tier briefing with overnight
deltas, scheduled briefings that arrive, audio briefs with offline cache,
ask-your-feeds scoped Q&A, keyword and cluster alerts with quiet hours,
push plumbing (F3) so the alert and briefing deliveries have a channel,
feed health dashboard, site-to-feed finder, feed-format parity and
autodiscovery with polite polling foundations (P1, P2, P4), and stats. The
push and email surfaces stay opt-in from day one with revoke paths tested.

Month three is understanding: duplicate clustering (B2) with the
perspective spectrum (M1) as coverage compare, row-level why-this-row (N1)
on top of the provenance layer (N6), highlights with margin notes, webhooks,
personal reading page, full portable export, and the connector framework,
provenance, and source safety baseline (P12). The quarter closes by deleting
shipped lines from this file and writing the next quarter from what readers
actually used, informed by the private stats screen (O4) and any opt-in
aggregate signals (E3), not by opinion.

Months four through six are the super app proper: storylines across time,
the evidence tray with saved research sessions, entity dossiers with
backgrounders on demand, the in-panel reading companion, the coverage-
balance meter (N4) as the second half of the perspective-spectrum pair
with M1, the contradiction radar, numbers with receipts, beat workspaces,
the weekend review edition, the full offline reader, and the broader source
expansion (P3, P5–P11, P13) as the connector foundation proves out. These
range from `M` to `XL`; sequence them by which unlocked the most delight in
months one through three, and cut any two without grief if the foundations
need the time instead.

## J. Non-goals (what we will not copy)

- Advertising, tracking pixels, affiliate injection, or engagement farming.
  The product is the reader, not the reader's attention. Depth here means
  mastery with done screens and queues that end, never streaks-as-guilt or
  infinite scroll.
- Team workspaces, shared analytics, or anything that moves product data
  into the identity service or merges databases across services.
- A social network inside the reader: no follows, likes, or comments
  hosting. Public pages are static artifacts, not profiles.
- Any AI other than Jev, browser-called model keys, logged prompts,
  open-ended chat, or payload-bearing logs. Jev is the sole AI; keys stay
  server-side and payloads stay out of logs.
- New Node data access for server data, hand-rolled SQL mappers, or
  unversioned data routes. The API contract section in the API notes
  stays the law.
- Bypassing paywalls, logins, CAPTCHAs, or access controls; ignoring
  robots.txt, platform terms, or rate limits; or scraping in ways that hide
  source identity or abuse publishers. Connectors are explicit, polite, and
  user-controlled.
- A mobile native app before the PWA earns it: share-target receiving,
  offline packs, and push come first, and only then is native discussed.
- Registries, extra manifests, or orchestration beyond what the repo
  already runs. Build from the tree on the engine that runs it.
