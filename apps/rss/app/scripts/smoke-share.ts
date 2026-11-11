// Share smoke: share-intent URLs, Mastodon host normalization and persistence.
// Instagram has no web share endpoint, so the contract is undefined (copy).
import { facebookShareUrl, mastodonShareUrl, normalizeMastodonHost, shareUrl, xShareUrl } from '../src/services/share';
import { DEFAULT_MASTODON_HOST, loadMastodonHost, saveMastodonHost } from '../src/services/share-settings';
import { assert } from './smoke-assert';

const url = 'https://example.com/articles/hello-world';
const title = 'Hello, World & Friends';

// ---- facebook shares the bare URL ----
assert(
    facebookShareUrl(url) === `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    'facebook share carries the article url',
);

// ---- x carries title and URL ----
const x = xShareUrl(url, title);
assert(x.startsWith('https://twitter.com/intent/tweet?'), 'x share hits the intent endpoint');
assert(x.includes(`url=${encodeURIComponent(url)}`), 'x share carries the article url');
assert(x.includes(`text=${encodeURIComponent(title)}`), 'x share carries the title');

// ---- mastodon needs an instance ----
assert(mastodonShareUrl(undefined, url, title) === undefined, 'mastodon share without a host is undefined');
assert(
    mastodonShareUrl('mastodon.social', url, title) ===
        `https://mastodon.social/share?text=${encodeURIComponent(`${title} ${url}`)}`,
    'mastodon share posts title and url to the instance',
);

// ---- instagram has no endpoint, so the UI copies instead ----
assert(shareUrl('instagram', url, title) === undefined, 'instagram share is undefined (copy the link)');
assert(shareUrl('facebook', url, title) === facebookShareUrl(url), 'shareUrl routes facebook');
assert(
    shareUrl('mastodon', url, title, 'mastodon.social') === mastodonShareUrl('mastodon.social', url, title),
    'shareUrl routes mastodon with the host',
);

// ---- host normalization accepts pasted URLs and handles, rejects garbage ----
assert(normalizeMastodonHost('mastodon.social') === 'mastodon.social', 'bare domain passes through');
assert(normalizeMastodonHost('https://mastodon.social/@user') === 'mastodon.social', 'share url trims to the host');
assert(normalizeMastodonHost('@user@mastodon.social') === 'mastodon.social', 'handle trims to the host');
assert(normalizeMastodonHost('  MAStoDon.Social  ') === 'mastodon.social', 'host is trimmed and lowercased');
assert(normalizeMastodonHost('') === undefined, 'empty host is undefined');
assert(normalizeMastodonHost('not a host') === undefined, 'host with spaces is undefined');
assert(normalizeMastodonHost('localhost') === undefined, 'dotless host is undefined');

// ---- persistence falls back to the default instance ----
const mem = new Map<string, string>();
const gStorage = globalThis as Record<string, unknown>;
const realStorage = gStorage['localStorage'];
gStorage['localStorage'] = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
};
try {
    assert(loadMastodonHost() === DEFAULT_MASTODON_HOST, 'mastodon host defaults when unset');
    saveMastodonHost('https://other.example/@me');
    assert(loadMastodonHost() === 'other.example', 'mastodon host round-trips through normalization');
    saveMastodonHost('garbage host !!');
    assert(loadMastodonHost() === DEFAULT_MASTODON_HOST, 'mastodon host falls back on garbage');
} finally {
    gStorage['localStorage'] = realStorage;
}
