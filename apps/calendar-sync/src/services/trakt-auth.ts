import {
    deviceCodePath,
    deviceTokenPath,
    joinUrl,
    parseDeviceCodeResponse,
    parseDevicePollResponse,
    parseTokenResponse,
    refreshTokenPath,
    traktHeaders,
} from 'calendar-core';
import type {TraktDeviceCode, TraktToken} from 'calendar-core';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            },
            {once: true},
        );
    });
}

async function postJson(
    fetchImpl: typeof fetch,
    url: string,
    headers: Record<string, string>,
    body: Record<string, string>,
): Promise<{status: number; json: unknown}> {
    const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    let json: unknown;
    try {
        json = await res.json();
    } catch {
        json = undefined;
    }
    return {status: res.status, json};
}

export async function requestDeviceCode(
    fetchImpl: typeof fetch,
    baseUrl: string,
    clientId: string,
): Promise<TraktDeviceCode> {
    const {json} = await postJson(
        fetchImpl,
        joinUrl(baseUrl, deviceCodePath()),
        traktHeaders(clientId),
        {client_id: clientId},
    );
    const parsed = parseDeviceCodeResponse(json);
    if (!parsed) throw new Error('Trakt did not return a device code');
    return parsed;
}

async function pollOnce(
    fetchImpl: typeof fetch,
    url: string,
    headers: Record<string, string>,
    deviceCode: string,
    clientId: string,
    clientSecret: string,
): Promise<ReturnType<typeof parseDevicePollResponse>> {
    const {status, json} = await postJson(fetchImpl, url, headers, {
        code: deviceCode,
        client_id: clientId,
        client_secret: clientSecret,
    });
    return parseDevicePollResponse(status, json);
}

function handlePollStatus(
    result: ReturnType<typeof parseDevicePollResponse>,
    wait: number,
): {nextWait: number; token?: TraktToken} {
    if (result.status === 'token') return {nextWait: wait, token: result.token};
    if (result.status === 'slow_down') return {nextWait: wait + 1_000};
    if (result.status === 'denied') throw new Error('Trakt access denied');
    if (result.status === 'expired') throw new Error('Trakt device code expired');
    return {nextWait: wait};
}

type PollOpts = {
    fetch: typeof fetch;
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    deviceCode: string;
    intervalMs: number;
    expiresAt: number;
    signal?: AbortSignal;
};

export async function pollDeviceToken(opts: PollOpts): Promise<TraktToken> {
    const {fetch: fetchImpl, baseUrl, clientId, clientSecret, deviceCode, intervalMs, expiresAt, signal} = opts;
    let wait = Math.max(intervalMs, 1_000);
    const url = joinUrl(baseUrl, deviceTokenPath());
    const headers = traktHeaders(clientId);
    while (Date.now() < expiresAt) {
        await sleep(wait, signal);
        const result = await pollOnce(fetchImpl, url, headers, deviceCode, clientId, clientSecret);
        const handled = handlePollStatus(result, wait);
        if (handled.token) return handled.token;
        wait = handled.nextWait;
    }
    throw new Error('Trakt device code expired');
}

export async function refreshAccessToken(
    fetchImpl: typeof fetch,
    baseUrl: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string,
): Promise<TraktToken> {
    const {status, json} = await postJson(
        fetchImpl,
        joinUrl(baseUrl, refreshTokenPath()),
        traktHeaders(clientId),
        {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        },
    );
    const token = parseTokenResponse(json);
    if (!token) throw new Error(`Trakt refresh failed (${status})`);
    return token;
}

export function tokenExpiry(token: TraktToken, now = Date.now()): number {
    return now + token.expiresIn * 1_000;
}
