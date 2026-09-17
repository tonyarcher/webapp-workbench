import {
    csrfUrl, healthzUrl, isHealthOk, loginTotpUrl, loginUrl, meUrl, passkeyLoginBeginUrl, passkeyRegisterBeginUrl,
    readBackupCodes, readCsrf, readErr, readMe, readPasskeyBegin, readTotpBegin, totpBeginUrl, totpRequired,
    USER_API_PREFIX,
} from '../src/services/api.ts';
import {returnPathFromSearch, safeReturnPath} from '../src/services/return-path.ts';
import {b64urlRoundTrip} from '../src/services/webauthn.ts';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

assert(USER_API_PREFIX === '/user-api', 'api prefix is origin-absolute');
assert(healthzUrl() === '/user-api/healthz', 'healthz url');
assert(csrfUrl() === '/user-api/csrf', 'csrf url');
assert(loginUrl() === '/user-api/login', 'login url');
assert(meUrl() === '/user-api/me', 'me url');
assert(isHealthOk({ok: true}), 'health body ok');
assert(!isHealthOk({ok: false}), 'health body not ok');
assert(readCsrf({csrf: 'tok'}) === 'tok', 'csrf token');
assert(readCsrf({csrf: ''}) === null, 'empty csrf');
assert(readMe({id: '1', username: 'alice'})?.username === 'alice', 'me body');
assert(readMe({id: '1', username: 'alice', totpEnabled: true})?.totpEnabled === true, 'me totp');
assert(readMe({ok: true}) === null, 'me rejects health');
assert(totpRequired({totpRequired: true}), 'totp required flag');
assert(loginTotpUrl() === '/user-api/login/totp', 'login totp url');
assert(totpBeginUrl() === '/user-api/totp/begin', 'totp begin url');
assert(readTotpBegin({secret: 'ABC', otpauth: 'otpauth://x'})?.secret === 'ABC', 'totp begin');
assert(readBackupCodes({backupCodes: ['AAAA']})?.[0] === 'AAAA', 'backup codes');
assert(passkeyRegisterBeginUrl() === '/user-api/passkey/register/begin', 'passkey register begin');
assert(passkeyLoginBeginUrl() === '/user-api/passkey/login/begin', 'passkey login begin');
assert(readPasskeyBegin({requestId: 'r', options: {publicKey: {}}})?.requestId === 'r', 'passkey begin');
assert(b64urlRoundTrip('YQ') === 'YQ', 'b64url roundtrip');
assert(readErr({err: {type: 'unauthorized', message: 'invalid credentials'}}) === 'invalid credentials', 'err message');
assert(safeReturnPath('/fitness/') === '/fitness/', 'return path ok');
assert(safeReturnPath('//evil.example') === null, 'return path protocol-relative');
assert(safeReturnPath('https://evil.example/') === null, 'return path absolute');
assert(returnPathFromSearch('?return=/rss-reader/') === '/rss-reader/', 'search return');
assert(returnPathFromSearch('?return=https://evil.example') === null, 'search rejects host');
console.log('user-web smoke ok');
