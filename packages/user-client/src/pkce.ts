import {sha256Bytes} from './sha256.ts';

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function randomVerifier(length = 64): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let out = '';
    for (const b of bytes) out += UNRESERVED[b % UNRESERVED.length];
    return out;
}

export async function challengeS256(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    // Plain-HTTP origins (LAN hosts) have no WebCrypto; same S256 either way.
    const subtle = globalThis.crypto?.subtle;
    const hash = subtle ? new Uint8Array(await subtle.digest('SHA-256', data)) : sha256Bytes(data);
    return bytesToB64url(hash);
}

export function authorizeUrl(params: {
    authorizeEndpoint: string;
    clientId: string;
    redirectUri: string;
    challenge: string;
    state: string;
}): string {
    const q = new URLSearchParams({
        response_type: 'code',
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        code_challenge: params.challenge,
        code_challenge_method: 'S256',
        state: params.state,
    });
    const sep = params.authorizeEndpoint.includes('?') ? '&' : '?';
    return `${params.authorizeEndpoint}${sep}${q.toString()}`;
}

function bytesToB64url(bytes: Uint8Array): string {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
