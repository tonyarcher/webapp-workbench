// Post-build step: generates dist/sw.js from scripts/sw.template.js, embedding
// the hashed bundle filenames (so a fresh install works fully offline) and a
// content-derived cache name (so updates never serve stale bundles and no one
// has to bump a cache constant by hand).
//
// The document (index.html and the app root) is deliberately NOT precached:
// it carries the runtime config block (the API origin) that the publish step
// renders per environment, so a precached copy could serve a stale origin.
// Navigations are network-first and the document is cached on each successful
// navigation only as the offline fallback.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const BASE = process.env.APP_BASE_PATH ?? '/';
// Normalize to a leading-slash, trailing-slash form ("/rss-reader/" or "/") so
// path joins never produce "//" or "/rss-readerassets/…" concatenations.
const normalizedBase = BASE.startsWith('/') ? BASE : `/${BASE}`;
const base = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;

const template = await readFile(path.join(root, 'scripts', 'sw.template.js'), 'utf8');

const baseOf = (p) => `${base.replace(/\/$/, '')}${p}`;
const assets = [
    baseOf('/manifest.webmanifest'),
    baseOf('/favicon.svg'),
    baseOf('/icon-192.png'),
    baseOf('/icon-512.png'),
];
try {
    const files = (await readdir(path.join(dist, 'assets'))).sort();
    for (const file of files) assets.push(`${base}assets/${file}`);
} catch {
    // no assets directory yet — the build script always runs after vite build,
    // so this only happens when dist is missing entirely
}

// Hash the actual bytes of every precached file (not just the URL list) so a
// same-name content change — an edited icon, a touched manifest — rotates the
// cache name too.
const hashInput = Buffer.concat(
    await Promise.all(
        assets.map(async (url) => {
            const rel = url.startsWith(base) ? url.slice(base.length).replace(/^\//, '') : url.replace(/^\//, '');
            try {
                return await readFile(path.join(dist, rel));
            } catch {
                return Buffer.from(rel);
            }
        }),
    ),
);

let hash = 5381;
for (let i = 0; i < hashInput.length; i++) {
    hash = ((hash << 5) + hash + hashInput[i]) >>> 0;
}

const output = template
    .replaceAll('__ASSETS__', JSON.stringify(assets))
    .replaceAll('__CACHE_HASH__', `'${hash.toString(36)}'`);
await writeFile(path.join(dist, 'sw.js'), output, 'utf8');
console.log(`wrote dist/sw.js (${assets.length} precache entries)`);
