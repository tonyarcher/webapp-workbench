// Smoke suite for the reader app: `tsx scripts/smoke.ts` (part of `npm test`).
// Each phase lives in a sibling ./smoke-*.ts module and runs in the order below;
// every assertion prints `ok: ...` and a failure throws.
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { API_VERSION, API_VERSION_HEADER } from '../src/services/api';
import { assert } from './smoke-assert';

(globalThis as Record<string, unknown>).DOMParser = DOMParser;
(globalThis as Record<string, unknown>).XMLSerializer = XMLSerializer;

assert(API_VERSION_HEADER === 'X-Api-Version' && API_VERSION === '1', 'api version header');

await import('./smoke-feed.js');
await import('./smoke-ai.js');
await import('./smoke-proxy.js');
await import('./smoke-pagination.js');
await import('./smoke-coalesce.js');
await import('./smoke-settings.js');
await import('./smoke-api.js');
await import('./smoke-server-ai.js');
await import('./smoke-query.js');
await import('./smoke-fetch-races.js');
await import('./smoke-mutations.js');
await import('./smoke-auth.js');
await import('./smoke-router.js');
await import('./smoke-summary.js');
await import('./smoke-interesting.js');
await import('./smoke-edition.js');
await import('./smoke-router-guard.js');

console.log('\nAll parser smoke tests passed.');
