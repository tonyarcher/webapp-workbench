// Runtime config smoke: parseAppConfig, resolveApiBase, and the #app-config
// read chain through apiUrl.
import { apiUrl } from '../src/services/api';
import { parseAppConfig, resolveApiBase, setAppConfig } from '../src/services/config';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

// ---- parseAppConfig ----
assert(parseAppConfig(null).apiBase === '', 'parseAppConfig(null) -> empty apiBase');
assert(parseAppConfig(undefined).apiBase === '', 'parseAppConfig(undefined) -> empty apiBase');
assert(parseAppConfig('').apiBase === '', 'parseAppConfig("") -> empty apiBase');
assert(
    parseAppConfig('{"apiBase":"https://api.example.com"}').apiBase === 'https://api.example.com',
    'parseAppConfig reads the apiBase string',
);
assert(parseAppConfig('{}').apiBase === '', 'parseAppConfig({}) -> empty apiBase');
assert(parseAppConfig('{"apiBase":123}').apiBase === '', 'parseAppConfig rejects a non-string apiBase');
assert(parseAppConfig('{"apiBase":null}').apiBase === '', 'parseAppConfig rejects a null apiBase');
assert(parseAppConfig('not json').apiBase === '', 'parseAppConfig rejects malformed json');

// ---- resolveApiBase chain ----
assert(
    resolveApiBase('https://cfg.example', 'https://vite.example', '/fitness/') === 'https://cfg.example',
    'config block wins over VITE_API_BASE',
);
assert(
    resolveApiBase('', 'https://vite.example', '/fitness/') === 'https://vite.example',
    'VITE_API_BASE wins over BASE_URL',
);
assert(resolveApiBase('', undefined, '/fitness/') === '/fitness/api', 'BASE_URL yields the relative api base');
assert(resolveApiBase('', undefined, '/') === '/api', 'root BASE_URL yields /api');
assert(resolveApiBase('', undefined, 'fitness') === 'fitness/api', 'trailing slash is normalized');

// ---- the config set at boot drives apiUrl ----
setAppConfig(parseAppConfig('{"apiBase":"https://cfg.example"}'));
assert(apiUrl('/stats') === 'https://cfg.example/stats', 'apiUrl uses the config set at boot');
setAppConfig(parseAppConfig(''));
assert(apiUrl('/stats') === '/api/stats', 'apiUrl falls back to the relative base with no config');
