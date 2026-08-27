export type SourceId = 'trakt' | 'netflix';

export interface CalEvent {
    uid: string;
    source: SourceId;
    title: string;
    start: number;
    end: number;
    allDay: boolean;
    description?: string;
    location?: string;
    url?: string;
}

export type SyncPhase = 'fetch' | 'convert' | 'write';

export interface SyncProgress {
    phase: SyncPhase;
    done: number;
    total?: number;
    failed?: number;
    label?: string;
}

export type WriteResult = 'ok' | 'exists' | 'fail';

/** Minimal fetch so this package does not depend on DOM lib types. */
export type FetchLike = (
    input: string,
    init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    },
) => Promise<{
    ok: boolean;
    status: number;
    headers: {get(name: string): string | null};
    json: () => Promise<unknown>;
    text: () => Promise<string>;
}>;
