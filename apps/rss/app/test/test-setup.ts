// Browser globals the test environment is missing.
//
// @tanstack/query-core's garbage-collection timer reads process.env, and
// query.ts builds its QueryClient as a module-level singleton, so that read
// happens while source-list.ts is being imported. Vite supplies this in a dev
// build; a test runner has no such step. It lives in its own module imported
// first, because ESM evaluates imports in order and a statement in the test
// file would run after the component it is meant to prepare.
(globalThis as unknown as { process?: unknown }).process ??= { env: { NODE_ENV: 'production' } };

export {};
