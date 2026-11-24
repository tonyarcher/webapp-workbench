# Vanilla DOM Conversion Plan — times-up

## Status

~25 of ~45 components converted to vanilla (no Lit). Remaining (complex):

| Component                      | Lines | Complexity                                           | Pass |
| ------------------------------ | ----- | ---------------------------------------------------- | ---- |
| article-list                   | 569   | high (virtualization, drag, bulk select, slideshow)  | 1    |
| article-view                   | 503   | high (sanitization, progress, highlights, key lines) | 1    |
| source-list                    | 400+  | high (drag, folders, feeds, counts, interesting)     | 1    |
| settings-dialog                | 381   | high (theme, sharing, feeds, migration, reading)     | 2    |
| command-palette                | 158   | medium (fuzzy, keyboard nav, groups)                 | 2    |
| board-view                     | 255   | medium (drag reorder, search, notes, export)         | 2    |
| article-view-body              | 96    | low (render helper)                                  | 3    |
| article-view-helpers           | 120   | low (icon/keyword helpers)                           | 3    |
| article-view-overlays          | 40    | low (board picker, speed-read)                       | 3    |
| article-list-render            | 350   | medium (row templates)                               | 3    |
| article-list-render-highlights | ~80   | low                                                  | 3    |
| article-list-slideshow-render  | ~120  | medium                                               | 3    |
| speed-read-view-render         | 60    | low                                                  | 3    |
| feed-menu                      | 100   | medium (folder checkboxes)                           | 4    |
| folder-menu                    | 100   | medium (toggles)                                     | 4    |
| saved-search-menu              | 40    | low                                                  | 4    |
| today-menu                     | 40    | low                                                  | 4    |
| advanced-menu                  | 40    | low                                                  | 4    |
| video-header                   | 80    | medium (video embed)                                 | 4    |

## Approach per component

1. Read the full Lit component + its tests.
2. Identify reactive state and lifecycle.
3. Rewrite as vanilla custom element with:
    - `connectedCallback` sets up shadow DOM + style + initial paint.
    - `attributeChangedCallback` / property setters trigger `paint()`.
    - `disconnectedCallback` cleans up timers/listeners.
    - `paint()` rebuilds DOM via createElement/textContent/addEventListener.
4. Add setters for properties passed from parent (`.foo=${...}`).
5. Run `npx tsc --noEmit` and `npm run build` and `npm test`.
6. Commit and push.

## Pass 1: Core reading (article-list, article-view, source-list)

- Highest user impact. Largest components.
- Need to preserve virtualization, drag, bulk select, slideshow, keyboard shortcuts, reading progress, highlights.
- Estimated: 3-4 sessions.

## Pass 2: Dialogs and menus (settings-dialog, command-palette, board-view)

- Medium complexity. Preserve all settings, sharing, migration, fuzzy search.
- Estimated: 2-3 sessions.

## Pass 3: Render helpers

- Extract inline templates from helper files into vanilla render functions.
- Estimated: 1-2 sessions.

## Pass 4: Leaf components

- Simple menu/dialog components.
- Estimated: 1 session.

## Other apps

- baseball (19 files), stock-game (13), lemmy (11), vertical-scroll (5), fitness (7), radio (6), basketball (5), coldwater (5), football (4), clipstack (4), calendar-sync (4), user (3).
- Each app needs its own pass, following the same pattern.
- Estimated: 10+ sessions.

## Total

~20 sessions for times-up + ~10 for other apps = ~30 sessions.
EOF
