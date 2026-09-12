import {authorizeUrl, challengeS256, parseJwtPayload, randomVerifier} from '../src/index.ts';
import {sha256Bytes} from '../src/sha256.ts';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

const verifier = randomVerifier();
assert(verifier.length === 64, 'verifier length');
const challenge = await challengeS256(verifier);
assert(challenge.length > 20, 's256 challenge');
assert(challenge !== (await challengeS256(verifier + 'x')), 'challenge changes');
const url = authorizeUrl({
    authorizeEndpoint: '/user-api/oauth/authorize',
    clientId: 'fitness',
    redirectUri: 'http://localhost/fitness/',
    challenge,
    state: 'abc',
});
assert(url.includes('code_challenge_method=S256'), 'authorize S256');
assert(url.includes('client_id=fitness'), 'authorize client');
assert(parseJwtPayload('not-a-jwt') === null, 'reject junk jwt');
const payload = btoa(JSON.stringify({sub: '1'})).replace(/=+$/g, '');
assert(parseJwtPayload(`aaa.${payload}.bbb`)?.sub === '1', 'parse jwt payload');

function hex(bytes: Uint8Array): string {
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const enc = new TextEncoder();
assert(
    hex(sha256Bytes(enc.encode(''))) ===
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'sha256 empty vector',
);
assert(
    hex(sha256Bytes(enc.encode('abc'))) ===
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'sha256 abc vector',
);
for (const input of ['abcdbcdecdefdefgefghfghighijhijk', 'x'.repeat(200)]) {
    const data = enc.encode(input);
    const ref = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    assert(hex(sha256Bytes(data)) === hex(ref), `sha256 matches WebCrypto for ${data.length} bytes`);
}
assert(
    (await challengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')) ===
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    'challenge matches RFC 7636 vector',
);
{
    // Plain-HTTP origins have no WebCrypto: pin the fallback to WebCrypto output.
    const expected = await challengeS256(verifier);
    Object.defineProperty(globalThis.crypto, 'subtle', {value: undefined, configurable: true});
    try {
        assert((await challengeS256(verifier)) === expected, 'fallback challenge matches WebCrypto');
    } finally {
        delete (globalThis.crypto as unknown as Record<string, unknown>)['subtle'];
    }
}
console.log('user-client smoke ok');
