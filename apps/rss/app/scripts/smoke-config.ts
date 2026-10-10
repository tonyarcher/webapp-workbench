// Runtime config smoke: parseAppConfig, resolveApiBase, and the #app-config
// read chain through apiUrl.
import { parseAppConfig, resolveApiBase, resolveIdentityBase, setAppConfig } from '../src/services/config';
import { apiUrl } from '../src/services/api';
import { assert } from './smoke-assert';

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

// ---- identityBase ----
assert(
    parseAppConfig('{"identityBase":"https://gw.example/user-api"}').identityBase === 'https://gw.example/user-api',
    'parseAppConfig reads the identityBase string',
);
assert(parseAppConfig('{}').identityBase === '', 'parseAppConfig({}) -> empty identityBase');
assert(parseAppConfig('not json').identityBase === '', 'parseAppConfig rejects malformed json for identityBase');
assert(
    resolveIdentityBase('https://gw.example/user-api', 'https://assets.example') === 'https://gw.example/user-api',
    'config identityBase wins over the same-origin default',
);
assert(
    resolveIdentityBase('', 'https://assets.example') === 'https://assets.example/user-api',
    'the identity default is <origin>/user-api',
);

// ---- resolveApiBase chain ----
assert(
    resolveApiBase('https://cfg.example', 'https://vite.example', '/rss-reader/') === 'https://cfg.example',
    'config block wins over VITE_API_BASE',
);
assert(
    resolveApiBase('', 'https://vite.example', '/rss-reader/') === 'https://vite.example',
    'VITE_API_BASE wins over BASE_URL',
);
assert(resolveApiBase('', undefined, '/rss-reader/') === '/rss-reader/api', 'BASE_URL yields the relative api base');
assert(resolveApiBase('', undefined, '/') === '/api', 'root BASE_URL yields /api');
assert(resolveApiBase('', undefined, 'rss-reader') === 'rss-reader/api', 'trailing slash is normalized');

// ---- the config set at boot drives apiUrl ----
setAppConfig(parseAppConfig('{"apiBase":"https://cfg.example"}'));
assert(apiUrl('/library') === 'https://cfg.example/library', 'apiUrl uses the config set at boot');
setAppConfig(parseAppConfig(''));
assert(apiUrl('/library') === '/api/library', 'apiUrl falls back to the relative base with no config');
