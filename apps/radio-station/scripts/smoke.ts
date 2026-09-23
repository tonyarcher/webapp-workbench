import { formatPlaylistTxt } from '../src/services/export-txt';
import { findNowPlaying } from '../src/services/now-playing';
import { filterEntries, toListItems, weekDays } from '../src/services/list-items';
import type { PlaylistEntry, Weights } from '../src/types';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

const START = Date.UTC(2026, 8, 1, 0, 0, 0);

const DEFAULT_WEIGHTS: Weights = {
    hitGravity: 70,
    goldLeak: 15,
    temperature: 40,
    separation: 60,
    powerOrbitMin: 90,
};

function entry(partial: Partial<PlaylistEntry> & Pick<PlaylistEntry, 'idx' | 'startsAt'>): PlaylistEntry {
    return {
        trackId: 't',
        artist: 'Artist',
        title: 'Title',
        durationMs: 180_000,
        rotation: 'power',
        era: 'current',
        ...partial,
    };
}

const txt = formatPlaylistTxt({
    stationName: 'Pulse 101',
    seed: 'autumn-oak',
    weights: DEFAULT_WEIGHTS,
    timeZone: 'UTC',
    entries: [
        entry({ idx: 0, startsAt: START, artist: 'The Chartliners', title: 'Neon Boulevard' }),
        entry({ idx: 1, startsAt: START + 180_000, artist: 'Luna Vox', title: 'Midnight Static' }),
    ],
});
assert(txt.startsWith('Pulse 101 — 2026-09-01 to 2026-09-08\n'), 'txt header station + week');
assert(txt.includes('seed: autumn-oak'), 'txt includes seed');
assert(txt.includes('2026-09-01 00:00  The Chartliners — Neon Boulevard'), 'txt first row');

const npEntries = [
    entry({ idx: 0, startsAt: START, durationMs: 180_000, trackId: 'a' }),
    entry({ idx: 1, startsAt: START + 180_000, durationMs: 180_000, trackId: 'b' }),
];
assert(findNowPlaying(npEntries, START - 1).kind === 'outside', 'now-playing before week');
const mid = findNowPlaying(npEntries, START + 60_000);
assert(mid.kind === 'track' && mid.entry.trackId === 'a', 'now-playing during first');
assert(findNowPlaying(npEntries, START + 180_000).kind === 'track', 'now-playing at boundary is next');

const listEntries = [
    entry({ idx: 0, startsAt: START, artist: 'A', title: 'One' }),
    entry({ idx: 1, startsAt: START + 3_600_000, artist: 'B', title: 'Two' }),
    entry({ idx: 2, startsAt: START + 24 * 3_600_000, artist: 'C', title: 'Three' }),
];
const items = toListItems(listEntries, 'all');
assert(items.filter((i) => i.kind === 'day').length === 2, 'list inserts day headers');
assert(weekDays(listEntries).length === 2, 'weekDays unique local days');
const firstDay = weekDays(listEntries)[0];
assert(!!firstDay, 'weekDays has first day');
assert(filterEntries(listEntries, firstDay.key).length >= 1, 'day filter matches weekDays key');

console.log('\nAll smoke tests passed.');
