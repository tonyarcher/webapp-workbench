import { authorizeUrl, challengeS256, endSession, parseJwtPayload, randomVerifier } from 'user-client';
import { appConfig, resolveIdentityBase } from './config';

const CLIENT_ID = 'calendar-sync';
const TOKENS_KEY = 'calendar-sync.auth.tokens';
const VERIFIER_KEY = 'calendar-sync.auth.verifier';
const STATE_KEY = 'calendar-sync.auth.state';

export interface AuthTokens {
    access: string;
    refresh: string;
    exp: number;
}

function identityBase(): string {
    // The asset origin must name the identity service: it runs on the gateway,
    // so `location.origin` is only correct for the same-origin deploy. The
    // config is set at boot by the entry point, which owns the DOM read.
    return resolveIdentityBase(appConfig().identityBase, location.origin);
}

function tokenEndpoint(): string {
    return `${identityBase()}/oauth/token`;
}

/**
 * Redirect URI registered for this client in oauth_redirect_uris: the app root
 * as the browser sees it. Derived from `location.href`, not `BASE_URL`: this
 * app builds with a relative base (`./`), so resolving against the origin
 * would drop the gateway subpath and the IdP would reject the login with
 * `redirect_uri_mismatch`. The trailing slash is significant and must match
 * the registered row exactly.
 */
export function redirectUri(): string {
    return new URL('.', location.href).toString();
}

export function tokenExp(token: string): number | null {
    const exp = parseJwtPayload(token)?.['exp'];
    return typeof exp === 'number' ? exp : null;
}

export function isTokenFresh(exp: number, nowSec: number = Date.now() / 1000): boolean {
    return exp - nowSec > 60;
}

function loadTokens(): AuthTokens | null {
    try {
        const raw = localStorage.getItem(TOKENS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<AuthTokens>;
        if (typeof parsed.access !== 'string' || typeof parsed.refresh !== 'string') return null;
        if (typeof parsed.exp !== 'number') return null;
        return { access: parsed.access, refresh: parsed.refresh, exp: parsed.exp };
    } catch {
        return null;
    }
}

function storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

function clearTokens(): void {
    localStorage.removeItem(TOKENS_KEY);
}

function toTokens(body: unknown): AuthTokens | null {
    if (typeof body !== 'object' || body === null) return null;
    const { access_token: access, refresh_token: refresh, expires_in: expiresIn } = body as Record<string, unknown>;
    if (typeof access !== 'string' || typeof refresh !== 'string') return null;
    if (typeof expiresIn !== 'number') return null;
    return { access, refresh, exp: Math.floor(Date.now() / 1000) + expiresIn };
}

async function postToken(form: Record<string, string>): Promise<AuthTokens | null> {
    const res = await fetch(tokenEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form),
    });
    if (!res.ok) return null;
    return toTokens((await res.json()) as unknown);
}

export function hasSession(): boolean {
    return loadTokens() !== null;
}

export function currentUsername(): string | null {
    const tokens = loadTokens();
    if (!tokens) return null;
    const name = parseJwtPayload(tokens.access)?.['preferred_username'];
    return typeof name === 'string' ? name : null;
}

export async function startLogin(): Promise<void> {
    const verifier = randomVerifier();
    const state = randomVerifier(32);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);
    location.assign(
        authorizeUrl({
            authorizeEndpoint: `${identityBase()}/oauth/authorize`,
            clientId: CLIENT_ID,
            redirectUri: redirectUri(),
            challenge: await challengeS256(verifier),
            state,
        }),
    );
}

function takeCallbackParams(): { code: string; state: string } | null {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return null;
    history.replaceState(null, '', redirectUri());
    return { code, state };
}

/** Exchange an OAuth callback code for tokens. True when a session starts. */
export async function finishLoginFromCallback(): Promise<boolean> {
    const params = takeCallbackParams();
    if (!params) return false;
    const expected = sessionStorage.getItem(STATE_KEY);
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    if (!expected || expected !== params.state || !verifier) {
        throw new Error('Sign-in reply did not match this browser session. Try signing in again.');
    }
    const tokens = await postToken({
        grant_type: 'authorization_code',
        code: params.code,
        client_id: CLIENT_ID,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
    });
    if (!tokens) throw new Error('Sign-in was refused. Try signing in again.');
    storeTokens(tokens);
    return true;
}

export async function refreshTokens(): Promise<AuthTokens | null> {
    if (!inflightRefresh) {
        inflightRefresh = doRefresh().finally(() => {
            inflightRefresh = null;
        });
    }
    return inflightRefresh;
}

async function doRefresh(): Promise<AuthTokens | null> {
    const current = loadTokens();
    if (!current) return null;
    const next = await postToken({ grant_type: 'refresh_token', refresh_token: current.refresh });
    if (!next) {
        // Another in-flight refresh may have rotated already; only drop the
        // session when the stored token is still the one that failed.
        if (loadTokens()?.refresh === current.refresh) clearTokens();
        return null;
    }
    storeTokens(next);
    return next;
}

let inflightRefresh: Promise<AuthTokens | null> | null = null;

export async function getAccessToken(): Promise<string | null> {
    const current = loadTokens();
    if (!current) return null;
    if (isTokenFresh(current.exp)) return current.access;
    return (await refreshTokens())?.access ?? null;
}

/**
 * Drop local tokens and end the identity session. Resolves false when the
 * server call did not complete, so the caller can say the sign-out did not
 * take rather than claim it did.
 */
export async function logout(): Promise<boolean> {
    clearTokens();
    return endSession({ base: identityBase() });
}
