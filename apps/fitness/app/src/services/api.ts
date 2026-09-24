import type { LatestSample, MetricStat, Profile, RollupRow, SeriesResult } from '../types';
import type { Sample } from 'fitness-core';

function apiUrl(path: string): string {
    const base = import.meta.env.BASE_URL;
    const root = base.endsWith('/') ? base : `${base}/`;
    return `${root}api${path}`;
}

export const API_VERSION_HEADER: string = 'X-Api-Version';
export const API_VERSION: string = '1';

const API_VERSION_HEADERS: Record<string, string> = { [API_VERSION_HEADER]: API_VERSION };

const FETCH_TIMEOUT_MS = 15_000;
const IMPORT_TIMEOUT_MS = 120_000;

export interface FetchOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number = FETCH_TIMEOUT_MS): AbortSignal {
    const timeout = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function readError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as { error?: string };
        return body.error ?? res.statusText;
    } catch {
        return res.statusText;
    }
}

async function json<T>(res: Response): Promise<T> {
    if (!res.ok) throw new Error(await readError(res));
    return res.json() as Promise<T>;
}

export function fetchHealth(opts?: FetchOptions): Promise<{ ok: boolean }> {
    return fetch(apiUrl('/healthz'), { headers: API_VERSION_HEADERS, signal: withTimeout(opts?.signal) }).then((res) =>
        json<{ ok: boolean }>(res),
    );
}

export function fetchStats(opts?: FetchOptions): Promise<{ metrics: MetricStat[] }> {
    return fetch(apiUrl('/stats'), { headers: API_VERSION_HEADERS, signal: withTimeout(opts?.signal) }).then((res) =>
        json<{ metrics: MetricStat[] }>(res),
    );
}

export function fetchLatest(opts?: FetchOptions): Promise<{ latest: LatestSample[] }> {
    return fetch(apiUrl('/samples/latest'), {
        headers: API_VERSION_HEADERS,
        signal: withTimeout(opts?.signal),
    }).then((res) => json<{ latest: LatestSample[] }>(res));
}

export function fetchProfile(opts?: FetchOptions): Promise<Profile> {
    return fetch(apiUrl('/profile'), { headers: API_VERSION_HEADERS, signal: withTimeout(opts?.signal) }).then((res) =>
        json<Profile>(res),
    );
}

export function saveProfile(profile: Profile, opts?: FetchOptions): Promise<Profile> {
    return fetch(apiUrl('/profile'), {
        method: 'PUT',
        headers: { ...API_VERSION_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
        signal: withTimeout(opts?.signal),
    }).then((res) => json<Profile>(res));
}

export function postImport(
    samples: Sample[],
    source: string,
    opts?: FetchOptions,
): Promise<{ stored: number; skipped: number; errors: string[] }> {
    // Bulk Health Connect imports can be large on slow links; use a longer
    // timeout than interactive reads so the client does not reject while
    // the server is still processing the write.
    return fetch(apiUrl('/imports'), {
        method: 'POST',
        headers: { ...API_VERSION_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples, source }),
        signal: withTimeout(opts?.signal, opts?.timeoutMs ?? IMPORT_TIMEOUT_MS),
    }).then((res) => json<{ stored: number; skipped: number; errors: string[] }>(res));
}

export function fetchRollups(opts?: FetchOptions): Promise<{ rollups: RollupRow[] }> {
    return fetch(apiUrl('/rollups'), { headers: API_VERSION_HEADERS, signal: withTimeout(opts?.signal) }).then((res) =>
        json<{ rollups: RollupRow[] }>(res),
    );
}

export function fetchSeries(metric: string, opts?: FetchOptions): Promise<SeriesResult> {
    return fetch(apiUrl(`/series?metric=${encodeURIComponent(metric)}`), {
        headers: API_VERSION_HEADERS,
        signal: withTimeout(opts?.signal),
    }).then((res) => json<SeriesResult>(res));
}

export function patchSample(
    body: {
        metric: string;
        originId: string;
        hidden?: boolean;
        valueSi?: number;
        note?: string;
    },
    opts?: FetchOptions,
): Promise<{ ok: boolean }> {
    return fetch(apiUrl('/samples'), {
        method: 'PATCH',
        headers: { ...API_VERSION_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: withTimeout(opts?.signal),
    }).then((res) => json<{ ok: boolean }>(res));
}
