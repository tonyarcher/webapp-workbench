# Reader view implementation plan — attention, scent, and the Feedly feel

A working list of view-level defects and the next slices. Rules from
`AGENTS.md` apply: no body reads at request time, learned metadata is the
asset, and every change gets a smoke or browser test.

## Bugs to fix (in priority order)

### 1. Today regressed into a front-page clone — `today-view/`

- **Symptom.** Today now looks like another front page: one flat newest list,
  no folder sections, no per-folder cap. It was right weeks ago, before the
  moonshot work. `ce1e9e94` converted the component to vanilla DOM and dropped
  the query-controller/library wiring; the old version grouped articles into
  per-folder sections with `buildTodaySections`, `today-settings` (excluded
  folders, per-folder count, unread-only), midnight rollover, and live
  refresh on feed/read/star events. The service (`services/today.ts`) and the
  settings module still exist and are correct; only the component regressed.
- **Fix.** Restore the old shape on the vanilla component: load library
  folders/feeds plus `since <start of today>`, call `buildTodaySections`,
  render one section per folder with its capped hottest rows, keep the
  unread-only/excluded-folder settings and the settings-changed listener, and
  keep midnight rollover with `isConnected` guards. Reuse the row renderer
  from article-list if possible; do not reintroduce Lit or pull in the front
  page's card grid.
- **Acceptance.** Browser test with two folders and a feed in each: sections
  follow sidebar order, excluded folders are absent, cap holds, and an empty
  day shows the empty copy. Refresh on `article-read` and `feeds-refreshed`.

### 2. Card cursor turns into a finger over dead space

- **Symptom.** The hand cursor appears over parts of the card that do nothing
  when clicked. `.grid-card` sets `cursor: default` but children override:
  `.title-open`, `.star`, `.derank`, `.meta` links, and `.grid-card-media`
  (`cursor: pointer`) all claim it. The media area has its own click handler
  in `article-list-render-rows.ts`; the rest of the card body is not a target.
- **Fix.** Make the cursor match the actual hit target: pointer only on the
  media, the title button, and real links/buttons; default everywhere else.
  Remove blanket `cursor: pointer` from `.grid-card-media` if the click
  handler is not on the whole media region, or add the handler so the cue is
  honest. Do not rely on `onClick` fallthrough.
- **Acceptance.** Browser test or manual check: hovering summary/excerpt/meta
  dead space shows the text cursor; hovering media and controls shows the
  hand.

### 3. Move card controls to a white hover overlay on the image

- **Symptom.** Star, derank, and open live in the title row, which crowds the
  headline. Feedly floats white icon buttons over the cover on hover; readers
  retain cards better with that shape.
- **Fix.** Add a `.grid-card-actions` layer inside `.grid-card-media`,
  absolutely positioned top-right, hidden until `:hover` / `:focus-within`.
  Use white circular buttons with a soft shadow and a dark icon, enough
  contrast on any cover; keep the existing `aria-label`, `aria-pressed`, and
  click handlers. Keyboard focus must reveal them. Keep the title as the
  primary open control in the body for keyboard and screen readers.
- **Acceptance.** axe audit clean; keyboard focus reveals the overlay; buttons
  work without the mouse; title row no longer duplicates star/derank.

### 4. Headline and excerpt readability — `article-list.css`

- **Status.** Headline 17px to 19px, card image 168px to 208px, card min
  height 420px to 470px, and the learned excerpt 12px muted/2 lines to 13px
  normal text/3 lines are already applied in the working tree. Keep them when
  the overlay work lands; re-check contrast and clamp in the 300px column.

### 5. Low-resolution card covers — `image.ts`, `lazy-img.ts`

- **Status.** `upgradeImageUrl` derives a crisp `-WIDTHxHEIGHT`-free sibling;
  `lazy-img` tries that first and falls back to the exact feed URL on error.
  The query string is untouched so signed CDN URLs survive. Smoke asserts
  the feed URL is kept as fallback. Already applied in the working tree.

## Chosen psychology slice: heads-up line + NEED sort

From the research in `MOONSHOT.md` ("Reading psychology: outside-in attention
design"): information scent, advance organizers, progressive disclosure,
F-pattern, inverted pyramid, time budget.

- **Heads-up line.** A one-line "why this matters" cue at the top-left of each
  card, before the headline, built only from learned metadata: frontpage
  `worthy`/`interest` scores, B7 cluster label and growth, affinity, and
  unread state. No body read. It is the advance organizer and the scent cue.
- **NEED sort.** Add `ArticleSort.NEED` that ranks by a documented blend of
  unread, affinity, cluster growth, `worthy`/`interest`, and recency decay.
  Keep NEWEST/OLDEST/HOT unchanged. Expose in the client sort control. The
  stored score must be deterministic and testable as pure logic.
- **Acceptance.** Pure scoring tests with crafted signals; list API test that
  NEED order differs from HOT on a fixture; browser test that the heads-up
  line renders from metadata and never requests `/body`; accessibility check
  for the new line.

## Deferred (tracked in MOONSHOT.md, not this plan)

- K1–K5 briefing desk tiers and overnight deltas.
- N4 coverage-balance meter and N5 time-adaptation modes.
- Full provenance export with linked entities and case files.

## Order of work

1. Ship the already-verified working tree (B7 + N6 metadata extractors,
   full-text-after-extract fix, card readability, image fallback) — reviews
   are APPROVE; commit, push, deploy.
2. Fix bugs 1–3 with tests; update this plan with status.
3. Build the heads-up + NEED sort slice.
4. Re-run a11y audits on Today and card view.
