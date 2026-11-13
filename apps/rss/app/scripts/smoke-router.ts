// Router smoke: frontpage View round-trip through the hash router.
import { assert } from './smoke-assert';

// ---- router frontpage round-trip ----
// router.ts builds a hash history at import, so it needs a browser-ish
// window/document present before the first import.
{
    const shims = globalThis as Record<string, unknown>;
    const realWindow = shims['window'];
    const realDocument = shims['document'];
    const fakeHistory = {
        state: undefined,
        pushState() {},
        replaceState() {},
        go() {},
        back() {},
        forward() {},
    };
    shims['window'] = {
        dispatchEvent: () => false,
        addEventListener: () => {},
        removeEventListener: () => {},
        history: fakeHistory,
        location: { pathname: '/', search: '', hash: '', href: 'http://localhost/' },
    };
    shims['document'] = {};
    try {
        const { parsePath, viewToPath } = await import('../src/router');
        assert(viewToPath({ kind: 'frontpage' }) === '/frontpage', 'frontpage serializes to #/frontpage');
        assert(parsePath('/frontpage').kind === 'frontpage', 'frontpage parses back to a View');
        assert(
            JSON.stringify(parsePath(viewToPath({ kind: 'frontpage' }))) === JSON.stringify({ kind: 'frontpage' }),
            'frontpage router round-trips',
        );

        assert(viewToPath({ kind: 'search' }) === '/search', 'search serializes to #/search');
        assert(
            viewToPath({ kind: 'search', scope: 'folder', id: 'f1', q: 'grid storage' }) ===
                '/search?scope=folder&id=f1&q=grid+storage',
            'search serializes with scope and query',
        );
        assert(
            JSON.stringify(parsePath('/search', '?scope=folder&id=f1&q=grid+storage')) ===
                JSON.stringify({ kind: 'search', scope: 'folder', id: 'f1', q: 'grid storage' }),
            'search parses query params from search string',
        );
        assert(
            JSON.stringify(parsePath('/search?scope=feed&id=f2&q=grid')) ===
                JSON.stringify({ kind: 'search', scope: 'feed', id: 'f2', q: 'grid' }),
            'search parses query params from pathname for compatibility',
        );
        assert(
            JSON.stringify(parsePath(viewToPath({ kind: 'search', scope: 'all', q: 'kube' }))) ===
                JSON.stringify({ kind: 'search', scope: 'all', q: 'kube' }),
            'search router round-trips',
        );
    } finally {
        shims['window'] = realWindow;
        shims['document'] = realDocument;
    }
}
