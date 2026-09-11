import {authorizeUrl, challengeS256, parseJwtPayload, randomVerifier} from '../src/index.ts';

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
console.log('user-client smoke ok');
