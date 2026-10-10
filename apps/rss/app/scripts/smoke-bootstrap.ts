// Bootstrap smoke: the client reads the JVM shell's #rss-bootstrap blob and
// resolves an absolute API origin from it, with relative fallback intact.
import { parseBootstrapJson, readBootstrap } from '../src/services/bootstrap';
import { apiUrl } from '../src/services/api';
import { assert } from './smoke-assert';

// ---- parseBootstrapJson: pure parser ----
assert(
    parseBootstrapJson(null).apiBase === '' && parseBootstrapJson(undefined).assetsBase === '',
    'parseBootstrapJson returns empty defaults for missing text',
);
assert(parseBootstrapJson('not json').apiBase === '', 'parseBootstrapJson returns empty defaults for invalid JSON');
assert(
    parseBootstrapJson('{"apiBase":"https://api.example.com","assetsBase":"https://cdn.example.com"}').apiBase ===
        'https://api.example.com',
    'parseBootstrapJson reads apiBase',
);
assert(
    parseBootstrapJson('{"apiBase":"https://api.example.com"}').assetsBase === '',
    'parseBootstrapJson defaults a missing field to empty',
);
assert(
    parseBootstrapJson('{"apiBase":42,"assetsBase":null}').apiBase === '',
    'parseBootstrapJson ignores non-string fields',
);

// ---- readBootstrap: reads the shell element from a shimmed document ----
{
    const shims = globalThis as Record<string, unknown>;
    const realDocument = shims['document'];
    shims['document'] = {
        getElementById: (id: string) =>
            id === 'rss-bootstrap' ? { textContent: '{"apiBase":"https://shell.example.com","assetsBase":""}' } : null,
    };
    try {
        const state = readBootstrap();
        assert(state.apiBase === 'https://shell.example.com', 'readBootstrap hydrates from the shell element');
    } finally {
        shims['document'] = realDocument;
    }
}

// ---- apiBase: prefers the shell blob over the relative fallback ----
{
    const shims = globalThis as Record<string, unknown>;
    const realDocument = shims['document'];
    shims['document'] = {
        getElementById: (id: string) =>
            id === 'rss-bootstrap' ? { textContent: '{"apiBase":"https://abs.example.com","assetsBase":""}' } : null,
    };
    try {
        assert(apiUrl('/library') === 'https://abs.example.com/library', 'apiUrl uses the shell apiBase when present');
    } finally {
        shims['document'] = realDocument;
    }
}
