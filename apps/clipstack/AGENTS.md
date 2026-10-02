# AGENTS.md

Clipstack. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Rules

- No TanStack, no IndexedDB, and no router. The list and scroll position persist
  in localStorage so a refresh resumes where the user left off. Do not add a
  router or a query cache to "fix" state: the localStorage session is the design.
- The `cs-*` elements in `src/web-components/` are local UI (import and watch
  shells). The shared piece is `vertical-scroll-component`, not these screens; other
  apps must not import them.
- New list clears the saved session. Resetting the list without clearing
  localStorage leaves a stale session pointing at a list that no longer exists.
- Every `href` and `src` derived from user input goes through `safeUrl()` from
  `vertical-scroll-component`. Never pass a raw user URL to an attribute.
- PWA paths in `public/` are base-relative, or the app breaks under a subpath.
- After editing `apps/vertical-scroll-component`, rebuild it before this app
  picks the change up.

## Verification

- `src/services/*` changes need assertions in `scripts/smoke.ts`.
