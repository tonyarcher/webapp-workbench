/**
 * Ending an identity session.
 *
 * A client that only drops its own OAuth tokens has not signed the user out:
 * user-api keeps a `wb_session` cookie, `/oauth/authorize` honours it, and the
 * next sign-in is waved straight through. The server session has to be ended too.
 *
 * `POST /logout` sits behind the same CSRF filter as every other POST, so this
 * fetches the token pair first and echoes it in the header. The fetch and cookie
 * reader are injected: this package is headless and must not reach for a global.
 */

export const CSRF_COOKIE = 'wb_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';
export const API_VERSION_HEADER = 'X-Api-Version';
export const API_VERSION = '1';

export interface SessionClient {
    /** Absolute or root-relative base of user-api, e.g. `${location.origin}/user-api`. */
    base: string;
    /** Defaults to the global fetch. Injected so this stays testable without a DOM. */
    fetch?: typeof globalThis.fetch;
    /** Reads one cookie, or undefined. Defaults to document.cookie. */
    readCookie?: (name: string) => string | undefined;
}

/** The token echo pair, or null when the response did not carry one or the call failed. */
export async function fetchCsrfToken(client: SessionClient): Promise<string | null> {
    const doFetch = client.fetch ?? globalThis.fetch;
    try {
        // The version header is required: a missing or wrong value answers 404,
        // like an unknown route, so omitting it silently breaks every call here.
        const response = await doFetch(`${client.base}/csrf`, {
            credentials: 'include',
            headers: { [API_VERSION_HEADER]: API_VERSION },
        });
        if (!response.ok) return null;
        const body: unknown = await response.json();
        if (typeof body !== 'object' || body === null) return null;
        const token = (body as Record<string, unknown>)['csrf'];
        return typeof token === 'string' && token.length > 0 ? token : null;
    } catch {
        // Offline, DNS failure, or a proxy error page: no token, no throw.
        return null;
    }
}

/**
 * End the server session.
 *
 * Returns true when user-api confirmed. A false result means the call did not
 * complete -- offline, a non-JSON error page, or a rejected CSRF pair -- and the
 * caller should say so rather than report a sign-out that did not happen, because
 * the browser is still signed in until the cookie is cleared server-side.
 *
 * Never rejects. A caller clearing local state after awaiting this must not have
 * that cleanup skipped because the network was down, which is the case where the
 * local cleanup matters most.
 */
export async function endSession(client: SessionClient): Promise<boolean> {
    const doFetch = client.fetch ?? globalThis.fetch;
    const readCookie = client.readCookie ?? defaultCookieReader();
    try {
        // Prefer the cookie: it is the value the server compares against. The body
        // is the fallback for a first call where the cookie has not been set yet.
        const token = readCookie(CSRF_COOKIE) ?? (await fetchCsrfToken(client));
        if (!token) return false;
        const response = await doFetch(`${client.base}/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: { [API_VERSION_HEADER]: API_VERSION, [CSRF_HEADER]: token },
        });
        return response.ok;
    } catch {
        return false;
    }
}

function defaultCookieReader(): (name: string) => string | undefined {
    return (name) => {
        const jar = globalThis.document?.cookie;
        if (!jar) return undefined;
        for (const part of jar.split(';')) {
            const eq = part.indexOf('=');
            if (eq < 0) continue;
            if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
        }
        return undefined;
    };
}
