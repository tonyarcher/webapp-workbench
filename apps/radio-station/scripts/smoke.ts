import {formatPlaylistTxt} from '../src/services/export-txt';
import {findNowPlaying} from '../src/services/now-playing';
import {filterEntries, toListItems, weekDays} from '../src/services/list-items';
import {WEEK_MS} from '../server/env.ts';
import {canonicalizeWeights, DEFAULT_WEIGHTS} from '../server/services/weights.ts';
import {generateWeek} from '../server/services/scheduler.ts';
import {PLACEHOLDER_TRACKS} from '../server/seed-data.ts';
import type {PlaylistEntry, Weights} from '../src/types';
import type {ScheduledEntry} from '../server/types.ts';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

const START = Date.UTC(2026, 8, 1, 0, 0, 0);

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

function week(seed: string, weights: Partial<Weights> = {}): ScheduledEntry[] {
    return generateWeek({
        tracks: PLACEHOLDER_TRACKS,
        seed,
        startsAtMs: START,
        weights: canonicalizeWeights({...DEFAULT_WEIGHTS, ...weights}),
    });
}

function titles(rows: ScheduledEntry[]): string {
    return rows.map((row) => row.trackId).join(',');
}

// ---- canonicalize ----

const canon = canonicalizeWeights({hitGravity: 70.4, goldLeak: '15', extra: 1});
assert(canon.hitGravity === 70 && canon.goldLeak === 15, 'weights clamp/round to ints');
assert(canonicalizeWeights(null).powerOrbitMin === 90, 'weights fallback defaults');

// ---- export-txt ----

const txt = formatPlaylistTxt({
    stationName: 'Pulse 101',
    seed: 'autumn-oak',
    weights: DEFAULT_WEIGHTS,
    timeZone: 'UTC',
    entries: [
        entry({idx: 0, startsAt: START, artist: 'The Chartliners', title: 'Neon Boulevard'}),
        entry({idx: 1, startsAt: START + 180_000, artist: 'Luna Vox', title: 'Midnight Static'}),
    ],
});
assert(txt.startsWith('Pulse 101 — 2026-09-01 to 2026-09-08\n'), 'txt header station + week');
assert(txt.includes('seed: autumn-oak'), 'txt includes seed');
assert(txt.includes('hitGravity=70 goldLeak=15 temperature=40 separation=60 powerOrbitMin=90'), 'txt includes knobs');
assert(txt.includes('2026-09-01 00:00  The Chartliners — Neon Boulevard'), 'txt first row');
assert(txt.includes('2026-09-01 00:03  Luna Vox — Midnight Static'), 'txt second row');

// ---- now-playing ----

const npEntries = [
    entry({idx: 0, startsAt: START, durationMs: 180_000, trackId: 'a'}),
    entry({idx: 1, startsAt: START + 180_000, durationMs: 180_000, trackId: 'b'}),
];
assert(findNowPlaying(npEntries, START - 1).kind === 'outside', 'now-playing before week');
const mid = findNowPlaying(npEntries, START + 60_000);
assert(mid.kind === 'track' && mid.entry.trackId === 'a', 'now-playing during first');
assert(mid.kind === 'track' && mid.progress > 0.3 && mid.progress < 0.4, 'now-playing progress');
const second = findNowPlaying(npEntries, START + 180_000);
assert(second.kind === 'track' && second.entry.trackId === 'b', 'now-playing at boundary is next');
assert(findNowPlaying(npEntries, START + 360_000).kind === 'outside', 'now-playing after week');

// ---- list-items ----

const listEntries = [
    entry({idx: 0, startsAt: START, artist: 'A', title: 'One'}),
    entry({idx: 1, startsAt: START + 3_600_000, artist: 'B', title: 'Two'}),
    entry({idx: 2, startsAt: START + 24 * 3_600_000, artist: 'C', title: 'Three'}),
];
const items = toListItems(listEntries, 'all');
assert(items.filter((i) => i.kind === 'day').length === 2, 'list inserts day headers');
assert(items.filter((i) => i.kind === 'hour').length >= 2, 'list inserts hour headers');
assert(items.some((i) => i.kind === 'track' && i.entry.title === 'One'), 'list keeps tracks');
assert(weekDays(listEntries).length === 2, 'weekDays unique local days');
const firstDay = weekDays(listEntries)[0];
assert(!!firstDay, 'weekDays has first day');
assert(filterEntries(listEntries, firstDay.key).length >= 1, 'day filter matches weekDays key');

// ---- scheduler ----

const a = week('autumn-oak');
const b = week('autumn-oak');
let zeroThrew = false;
try {
    generateWeek({
        tracks: [{...PLACEHOLDER_TRACKS[0]!, durationMs: 0}],
        seed: 'zero',
        startsAtMs: START,
        weights: DEFAULT_WEIGHTS,
    });
} catch (err) {
    zeroThrew = err instanceof Error && err.message.includes('zero-duration');
}
assert(zeroThrew, 'zero-duration catalog throws');

assert(a.length > 1000, 'week has a full catalog of spins');
assert(titles(a) === titles(b), 'same seed+weights replay');

assert(a[0]?.startsAtMs === START, 'week starts at startsAt');
const last = a[a.length - 1];
assert(!!last, 'week has a last spin');
assert(last.startsAtMs + last.durationMs >= START + WEEK_MS, 'last spin covers week end');

for (let i = 1; i < a.length; i++) {
    const prev = a[i - 1];
    const cur = a[i];
    if (!prev || !cur) continue;
    if (cur.startsAtMs !== prev.startsAtMs + prev.durationMs) {
        throw new Error(`FAIL: gap/overlap at ${i}`);
    }
}
assert(true, 'no gaps or overlaps');

const hot = week('autumn-oak', {temperature: 0});
const wild = week('autumn-oak', {temperature: 100});
assert(titles(hot) !== titles(wild), 'temperature changes order');

const goldNone = week('jukebox-off', {goldLeak: 0});
assert(goldNone.every((row) => row.rotation !== 'gold'), 'goldLeak=0 has no gold');

const goldAll = week('jukebox-on', {goldLeak: 100});
assert(goldAll.every((row) => row.rotation === 'gold'), 'goldLeak=100 is all gold');

const hits = week('gravity-max', {hitGravity: 100, goldLeak: 0});
const hitShare = hits.filter((row) => row.rotation === 'power' || row.rotation === 'current').length / hits.length;
assert(hitShare > 0.7, `hitGravity=100 prefers power/current (${hitShare})`);

const sep = week('far-apart', {separation: 100, goldLeak: 0});
let adjacent = 0;
for (let i = 1; i < sep.length; i++) {
    const prev = sep[i - 1];
    const cur = sep[i];
    if (prev && cur && prev.artist === cur.artist) adjacent += 1;
}
assert(adjacent === 0, 'separation=100 never adjacent same artist');

const numberOneId = PLACEHOLDER_TRACKS.find((t) => t.rotation === 'power' && t.rank === 1)?.id;
assert(!!numberOneId, 'catalog has a #1');
const orbitMin = 90;
const plays = week('orbit-check', {powerOrbitMin: orbitMin, goldLeak: 0, hitGravity: 100})
    .filter((row) => row.trackId === numberOneId)
    .map((row) => row.startsAtMs);
assert(plays.length > 40, `#1 plays across the week (${plays.length})`);
const minGap = 0.7 * orbitMin * 60_000;
let tight = 0;
for (let i = 1; i < plays.length; i++) {
    const gap = (plays[i] ?? 0) - (plays[i - 1] ?? 0);
    if (gap + 1 < minGap) tight += 1;
}
assert(tight === 0, '#1 gaps respect 0.7x orbit');

console.log('\nAll smoke tests passed.');
