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

        // The settings panels are tabs of one page now. The old top-level paths
        // stay parseable so a bookmark or an installed PWA still lands right.
        const privacy = { kind: 'settings', section: 'privacy' } as const;
        assert(viewToPath(privacy) === '/settings/privacy', 'a settings tab serializes to /settings/<tab>');
        assert(
            JSON.stringify(parsePath('/settings/privacy')) === JSON.stringify(privacy),
            'a settings tab round-trips',
        );
        assert(
            JSON.stringify(parsePath(viewToPath({ kind: 'settings', section: 'general' }))) ===
                JSON.stringify({ kind: 'settings', section: 'general' }),
            'the default settings tab round-trips',
        );
        assert(JSON.stringify(parsePath('/privacy')) === JSON.stringify(privacy), 'the old privacy URL opens Privacy');
        assert(
            JSON.stringify(parsePath('/organize')) === JSON.stringify({ kind: 'settings', section: 'organize' }),
            'the old organize URL opens the Organize tab',
        );
        assert(
            JSON.stringify(parsePath('/settings/nope')) === JSON.stringify({ kind: 'settings', section: 'general' }),
            'an unknown settings tab falls back to General',
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
