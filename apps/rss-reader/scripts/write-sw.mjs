// Post-build step: generates dist/sw.js from scripts/sw.template.js, embedding
// the hashed bundle filenames (so a fresh install works fully offline) and a
// content-derived cache name (so updates never serve stale bundles and no one
// has to bump a cache constant by hand).
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

const template = await readFile(path.join(root, 'scripts', 'sw.template.js'), 'utf8');

const assets = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/favicon.svg',
    '/icon-192.png',
    '/icon-512.png',
];
try {
    const files = (await readdir(path.join(dist, 'assets'))).sort();
    for (const file of files) assets.push(`/assets/${file}`);
} catch {
    // no assets directory yet — the build script always runs after vite build,
    // so this only happens when dist is missing entirely
}

// Hash the actual bytes of every precached file (not just the URL list) so a
// same-name content change — an edited icon, a touched manifest — rotates the
// cache name too.
const hashInput = Buffer.concat(
    await Promise.all(
        assets
            .filter((url) => url !== '/')
            .map(async (url) => {
                const rel = url.replace(/^\//, '');
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
