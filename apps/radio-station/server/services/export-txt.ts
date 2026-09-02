import type {PlaylistEntryRow, Weights} from '../types.js';

export interface TxtInput {
    stationName: string;
    seed: string;
    weights: Weights;
    entries: PlaylistEntryRow[];
    timeZone: string;
}

function ymd(ms: number, timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(ms));
}

function hm(ms: number, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(new Date(ms));
}

function weekEndDate(entries: PlaylistEntryRow[], timeZone: string): string {
    const first = entries[0];
    if (!first) return '';
    return ymd(first.startsAt + 7 * 24 * 60 * 60 * 1_000, timeZone);
}

export function formatPlaylistTxt(input: TxtInput): string {
    const first = input.entries[0];
    const start = first ? ymd(first.startsAt, input.timeZone) : '';
    const end = weekEndDate(input.entries, input.timeZone);
    const w = input.weights;
    const header = [
        `${input.stationName} — ${start} to ${end}`,
        `seed: ${input.seed}`,
        `hitGravity=${w.hitGravity} goldLeak=${w.goldLeak} temperature=${w.temperature} separation=${w.separation} powerOrbitMin=${w.powerOrbitMin}`,
        '',
    ].join('\n');
    const rows = input.entries.map(
        (entry) => `${ymd(entry.startsAt, input.timeZone)} ${hm(entry.startsAt, input.timeZone)}  ${entry.artist} — ${entry.title}`,
    );
    return `${header}${rows.join('\n')}\n`;
}
