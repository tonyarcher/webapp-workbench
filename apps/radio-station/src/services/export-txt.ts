import type {PlaylistEntry, Weights} from '../types';

export interface TxtInput {
    stationName: string;
    seed: string;
    weights: Weights;
    entries: PlaylistEntry[];
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

function weekEndDate(entries: PlaylistEntry[], timeZone: string): string {
    const first = entries[0];
    if (!first) return '';
    return ymd(first.startsAt + 7 * 24 * 60 * 60 * 1_000, timeZone);
}

function header(input: TxtInput): string {
    const first = input.entries[0];
    const start = first ? ymd(first.startsAt, input.timeZone) : '';
    const end = weekEndDate(input.entries, input.timeZone);
    const w = input.weights;
    return [
        `${input.stationName} — ${start} to ${end}`,
        `seed: ${input.seed}`,
        `hitGravity=${w.hitGravity} goldLeak=${w.goldLeak} temperature=${w.temperature} separation=${w.separation} powerOrbitMin=${w.powerOrbitMin}`,
        '',
    ].join('\n');
}

function line(entry: PlaylistEntry, timeZone: string): string {
    return `${ymd(entry.startsAt, timeZone)} ${hm(entry.startsAt, timeZone)}  ${entry.artist} — ${entry.title}`;
}

export function formatPlaylistTxt(input: TxtInput): string {
    const rows = input.entries.map((entry) => line(entry, input.timeZone));
    return `${header(input)}${rows.join('\n')}\n`;
}
