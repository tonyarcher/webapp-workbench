import {csrfUrl, healthzUrl, isHealthOk, loginUrl, meUrl, readCsrf, readErr, readMe, USER_API_PREFIX} from '../src/services/api.ts';
import {returnPathFromSearch, safeReturnPath} from '../src/services/return-path.ts';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

assert(USER_API_PREFIX === '/user-api', 'api prefix is origin-absolute');
assert(healthzUrl() === '/user-api/healthz', 'healthz url');
assert(csrfUrl() === '/user-api/v1/csrf', 'csrf url');
assert(loginUrl() === '/user-api/v1/login', 'login url');
assert(meUrl() === '/user-api/v1/me', 'me url');
assert(isHealthOk({ok: true}), 'health body ok');
assert(!isHealthOk({ok: false}), 'health body not ok');
assert(readCsrf({csrf: 'tok'}) === 'tok', 'csrf token');
assert(readCsrf({csrf: ''}) === null, 'empty csrf');
assert(readMe({id: '1', username: 'alice'})?.username === 'alice', 'me body');
assert(readMe({ok: true}) === null, 'me rejects health');
assert(readErr({err: {type: 'unauthorized', message: 'invalid credentials'}}) === 'invalid credentials', 'err message');
assert(safeReturnPath('/fitness/') === '/fitness/', 'return path ok');
assert(safeReturnPath('//evil.example') === null, 'return path protocol-relative');
assert(safeReturnPath('https://evil.example/') === null, 'return path absolute');
assert(returnPathFromSearch('?return=/rss-reader/') === '/rss-reader/', 'search return');
assert(returnPathFromSearch('?return=https://evil.example') === null, 'search rejects host');
console.log('user-web smoke ok');
