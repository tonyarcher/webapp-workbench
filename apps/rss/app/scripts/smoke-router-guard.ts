// Router regression guard: the frontpage view stays stable.
import { assert } from './smoke-assert';

// ---- router frontpage unchanged ----
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
        assert(viewToPath({ kind: 'frontpage' }) === '/frontpage', 'frontpage still serializes to #/frontpage');
        assert(parsePath('/frontpage').kind === 'frontpage', 'frontpage still parses back to a View');
    } finally {
        shims['window'] = realWindow;
        shims['document'] = realDocument;
    }
}
