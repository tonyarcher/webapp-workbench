import { API_VERSION, API_VERSION_HEADER, AuthError, authedFetch, errorMessage } from './api-client';

export interface InterestJson {
    id: string;
    kind: string;
    label: string;
    key: string;
    weight: number;
    origin: string;
    enabled: boolean;
}

export interface ImportReport {
    count: number;
    unique: number;
    duplicates: number;
    quarantined: number;
    top: string[];
    quarantinedLabels: string[];
}

export interface ImportResult {
    fingerprint: string;
    topics: ImportReport;
    sources: ImportReport;
}

export interface CandidateFeed {
    label: string;
    host: string;
    url: string;
    title: string;
    type: string;
}

export interface CandidateResult {
    label: string;
    host: string | null;
    feeds: CandidateFeed[];
}

export interface LaneRow {
    articleId: string;
    title: string;
    score: number;
    reason: string;
}

export interface LaneResult {
    builtAt: number;
    rows: LaneRow[];
}

export async function fetchInterests(): Promise<InterestJson[]> {
    const res = await authedFetch('/interests');
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(await errorMessage(res));
    return (await res.json()) as InterestJson[];
}

export async function importInterests(topics: string, sources: string): Promise<ImportResult> {
    const res = await authedFetch('/interests/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [API_VERSION_HEADER]: API_VERSION },
        body: JSON.stringify({ topics, sources }),
    });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(await errorMessage(res));
    return (await res.json()) as ImportResult;
}

export async function fetchCandidates(labels: string[]): Promise<CandidateResult[]> {
    const res = await authedFetch('/interests/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [API_VERSION_HEADER]: API_VERSION },
        body: JSON.stringify({ labels }),
    });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(await errorMessage(res));
    const json = (await res.json()) as { candidates: CandidateResult[] };
    return json.candidates;
}

export async function fetchLane(): Promise<LaneResult> {
    const res = await authedFetch('/interests/lane');
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(await errorMessage(res));
    return (await res.json()) as LaneResult;
}

export async function postFeedback(interestKey: string, action: string): Promise<number> {
    const res = await authedFetch('/interests/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [API_VERSION_HEADER]: API_VERSION },
        body: JSON.stringify({ interestKey, action }),
    });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(await errorMessage(res));
    const json = (await res.json()) as { newWeight: number };
    return json.newWeight;
}
