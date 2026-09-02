import type {PlaylistEntry} from '../types';

export type NowPlaying =
    | {kind: 'track'; entry: PlaylistEntry; elapsedMs: number; progress: number}
    | {kind: 'outside'};

function weekBounds(entries: PlaylistEntry[]): {start: number; end: number} | null {
    const first = entries[0];
    const last = entries[entries.length - 1];
    if (!first || !last) return null;
    return {start: first.startsAt, end: last.startsAt + last.durationMs};
}

function contains(entry: PlaylistEntry, now: number): boolean {
    return now >= entry.startsAt && now < entry.startsAt + entry.durationMs;
}

function binaryFind(entries: PlaylistEntry[], now: number): PlaylistEntry | null {
    let lo = 0;
    let hi = entries.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const entry = entries[mid];
        if (!entry) return null;
        if (contains(entry, now)) return entry;
        if (now < entry.startsAt) hi = mid - 1;
        else lo = mid + 1;
    }
    return null;
}

export function findNowPlaying(entries: PlaylistEntry[], now: number): NowPlaying {
    const bounds = weekBounds(entries);
    if (!bounds || now < bounds.start || now >= bounds.end) return {kind: 'outside'};
    const entry = binaryFind(entries, now);
    if (!entry) return {kind: 'outside'};
    const elapsedMs = now - entry.startsAt;
    return {
        kind: 'track',
        entry,
        elapsedMs,
        progress: entry.durationMs <= 0 ? 0 : Math.min(1, elapsedMs / entry.durationMs),
    };
}
