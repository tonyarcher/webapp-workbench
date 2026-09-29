import {
    csrfUrl,
    healthzUrl,
    isHealthOk,
    loginTotpUrl,
    loginUrl,
    meUrl,
    passkeyLoginBeginUrl,
    passkeyRegisterBeginUrl,
    readBackupCodes,
    readCsrf,
    readErr,
    readMe,
    readPasskeyBegin,
    readTotpBegin,
    totpBeginUrl,
    totpRequired,
    USER_API_PREFIX,
} from '../src/services/api.ts';
import { returnPathFromSearch, safeReturnPath } from '../src/services/return-path.ts';
import { b64urlRoundTrip } from '../src/services/webauthn.ts';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

assert(USER_API_PREFIX === '/user-api', 'api prefix is origin-absolute');
assert(healthzUrl() === '/user-api/healthz', 'healthz url');
assert(csrfUrl() === '/user-api/csrf', 'csrf url');
assert(loginUrl() === '/user-api/login', 'login url');
assert(meUrl() === '/user-api/me', 'me url');
assert(isHealthOk({ ok: true }), 'health body ok');
assert(!isHealthOk({ ok: false }), 'health body not ok');
assert(readCsrf({ csrf: 'tok' }) === 'tok', 'csrf token');
assert(readCsrf({ csrf: '' }) === null, 'empty csrf');
assert(readMe({ id: '1', username: 'alice' })?.username === 'alice', 'me body');
assert(readMe({ id: '1', username: 'alice', totpEnabled: true })?.totpEnabled === true, 'me totp');
assert(readMe({ ok: true }) === null, 'me rejects health');
assert(totpRequired({ totpRequired: true }), 'totp required flag');
assert(loginTotpUrl() === '/user-api/login/totp', 'login totp url');
assert(totpBeginUrl() === '/user-api/totp/begin', 'totp begin url');
assert(readTotpBegin({ secret: 'ABC', otpauth: 'otpauth://x' })?.secret === 'ABC', 'totp begin');
assert(readBackupCodes({ backupCodes: ['AAAA'] })?.[0] === 'AAAA', 'backup codes');
assert(passkeyRegisterBeginUrl() === '/user-api/passkey/register/begin', 'passkey register begin');
assert(passkeyLoginBeginUrl() === '/user-api/passkey/login/begin', 'passkey login begin');
assert(readPasskeyBegin({ requestId: 'r', options: { publicKey: {} } })?.requestId === 'r', 'passkey begin');
assert(b64urlRoundTrip('YQ') === 'YQ', 'b64url roundtrip');
assert(
    readErr({ err: { type: 'unauthorized', message: 'invalid credentials' } }) === 'invalid credentials',
    'err message',
);
assert(safeReturnPath('/fitness/') === '/fitness/', 'return path ok');
assert(safeReturnPath('//evil.example') === null, 'return path protocol-relative');
assert(safeReturnPath('https://evil.example/') === null, 'return path absolute');
assert(returnPathFromSearch('?return=/rss-reader/') === '/rss-reader/', 'search return');
assert(returnPathFromSearch('?return=https://evil.example') === null, 'search rejects host');

// A real OAuth authorize return path, captured from the log viewer's sign-in.
// It measured 287 characters, over the old 256 cap, so it was rejected and the
// browser was left signed in with nowhere to go back to. The existing cases
// above are all short, which is why that went unnoticed. Length is the axis
// that regressed, so it is the axis pinned here.
const AUTHORIZE_RETURN =
    '/user-api/oauth/authorize?client_id=grafana&code_challenge=oJLiYoZVdPOE5_M60eZaVHeXv1AT4AK5aFicqmNSlfA' +
    '&code_challenge_method=S256&redirect_uri=http%3A%2F%2F10.0.0.63%2Flogs%2Flogin%2Fgeneric_oauth' +
    '&response_type=code&scope=user%3Aemail&state=gmV20Y_-aAJwC69j8fpOy1xCKggjG6UcTBZ5_2blzXY%3D';
assert(AUTHORIZE_RETURN.length === 287, 'the pinned authorize path is the measured length');
assert(safeReturnPath(AUTHORIZE_RETURN) === AUTHORIZE_RETURN, 'a full oauth authorize return path survives');
assert(
    returnPathFromSearch(`?return=${encodeURIComponent(AUTHORIZE_RETURN)}`) === AUTHORIZE_RETURN,
    'oauth authorize return path survives the search round trip',
);
// The bound is still real, and a hostile path that is merely long is still refused.
assert(safeReturnPath(`/${'a'.repeat(2000)}`) === null, 'over-long return path still rejected');
// Raising the cap must not have weakened the open-redirect defence. Dot segments
// and an embedded '//' are accepted by the shape checks, because a '/'-prefixed
// value is a PATH against the current origin rather than a protocol-relative
// URL, so the thing worth asserting is where the browser actually lands.
const traversal = safeReturnPath(`/${'a'.repeat(500)}/../..//evil.example`);
assert(traversal !== null, 'long path with dot segments is accepted');
assert(
    new URL(traversal as string, 'http://localhost/auth/').origin === 'http://localhost',
    'a long path cannot smuggle an off-site target',
);
// The shapes that really are off-site stay rejected at any length.
assert(safeReturnPath(`/${'a'.repeat(400)}//evil.example`)?.startsWith('//') === false, 'no protocol-relative');
assert(safeReturnPath(`/${'a'.repeat(400)}/https://evil.example`) === null, 'no embedded absolute url');
// A real backslash, so the test exercises the check rather than a template
// literal swallowing it: `\e` is just `e` in TypeScript.
assert(safeReturnPath(`/${'a'.repeat(400)}/\\evil.example`) === null, 'no backslash escape');
assert(safeReturnPath('/\\evil.example') === null, 'no leading backslash escape');

console.log('user-web smoke ok');
