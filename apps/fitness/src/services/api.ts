import type {LatestSample, MetricStat, Profile, RollupRow, SeriesResult} from '../types';
import type {Sample} from 'fitness-core';

function apiUrl(path: string): string {
    const base = import.meta.env.BASE_URL;
    const root = base.endsWith('/') ? base : `${base}/`;
    return `${root}api${path}`;
}

async function readError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as {error?: string};
        return body.error ?? res.statusText;
    } catch {
        return res.statusText;
    }
}

async function json<T>(res: Response): Promise<T> {
    if (!res.ok) throw new Error(await readError(res));
    return res.json() as Promise<T>;
}

export function fetchHealth(): Promise<{ok: boolean}> {
    return fetch(apiUrl('/healthz')).then((res) => json<{ok: boolean}>(res));
}

export function fetchStats(): Promise<{metrics: MetricStat[]}> {
    return fetch(apiUrl('/stats')).then((res) => json<{metrics: MetricStat[]}>(res));
}

export function fetchLatest(): Promise<{latest: LatestSample[]}> {
    return fetch(apiUrl('/samples/latest')).then((res) => json<{latest: LatestSample[]}>(res));
}

export function fetchProfile(): Promise<Profile> {
    return fetch(apiUrl('/profile')).then((res) => json<Profile>(res));
}

export function saveProfile(profile: Profile): Promise<Profile> {
    return fetch(apiUrl('/profile'), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(profile),
    }).then((res) => json<Profile>(res));
}

export function postImport(samples: Sample[], source: string): Promise<{stored: number; skipped: number; errors: string[]}> {
    return fetch(apiUrl('/imports'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({samples, source}),
    }).then((res) => json<{stored: number; skipped: number; errors: string[]}>(res));
}

export function fetchRollups(): Promise<{rollups: RollupRow[]}> {
    return fetch(apiUrl('/rollups')).then((res) => json<{rollups: RollupRow[]}>(res));
}

export function fetchSeries(metric: string): Promise<SeriesResult> {
    return fetch(apiUrl(`/series?metric=${encodeURIComponent(metric)}`)).then((res) => json<SeriesResult>(res));
}

export function patchSample(body: {metric: string; originId: string; hidden?: boolean; valueSi?: number; note?: string}): Promise<{ok: boolean}> {
    return fetch(apiUrl('/samples'), {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    }).then((res) => json<{ok: boolean}>(res));
}
