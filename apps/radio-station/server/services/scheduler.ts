import type {ScheduledEntry, Track, Weights} from '../types.js';
import {WEEK_MS} from '../env.js';
import {createRng, type Rng} from './rng.js';
import {orbitPolicy, separationWindows, type OrbitPolicy, type SeparationWindows} from './clock.js';
import {groupTracks, numberOne, type TrackBuckets} from './buckets.js';
import {chooseBucket, pickFromBucket} from './pick.js';
import {shouldForceNumberOne} from './orbit.js';

export interface GenerateWeekInput {
    tracks: Track[];
    seed: string;
    startsAtMs: number;
    weights: Weights;
}

interface ClockState {
    buckets: TrackBuckets;
    windows: SeparationWindows;
    orbit: OrbitPolicy;
    top: Track | undefined;
    weights: Weights;
    weekStart: number;
}

function toEntry(track: Track, startsAtMs: number): ScheduledEntry {
    return {
        trackId: track.id,
        artist: track.artist,
        title: track.title,
        startsAtMs,
        durationMs: track.durationMs,
        rotation: track.rotation,
        era: track.era,
        rank: track.rank,
    };
}

function nextTrack(
    rng: Rng,
    clock: ClockState,
    now: number,
    lastByTrack: Map<string, number>,
    lastByArtist: Map<string, number>,
): Track {
    const {buckets, windows, orbit, top, weights, weekStart} = clock;
    if (shouldForceNumberOne(top, now, weekStart, lastByTrack, lastByArtist, windows, orbit, weights.goldLeak) && top) {
        return top;
    }
    const bucket = chooseBucket(rng, weights);
    return pickFromBucket(
        rng,
        buckets,
        bucket,
        now,
        lastByTrack,
        lastByArtist,
        windows,
        weights.temperature,
        orbit.minMs,
        top?.id,
    );
}

function buildClock(input: GenerateWeekInput): ClockState {
    const buckets = groupTracks(input.tracks);
    return {
        buckets,
        windows: separationWindows(input.weights.separation),
        orbit: orbitPolicy(input.weights),
        top: numberOne(buckets),
        weights: input.weights,
        weekStart: input.startsAtMs,
    };
}

export function generateWeek(input: GenerateWeekInput): ScheduledEntry[] {
    if (!input.tracks.length) throw new Error('catalog is empty');
    if (input.tracks.some((track) => track.durationMs <= 0)) throw new Error('catalog has a zero-duration track');
    const rng = createRng(input.seed);
    const clock = buildClock(input);
    const lastByTrack = new Map<string, number>();
    const lastByArtist = new Map<string, number>();
    const entries: ScheduledEntry[] = [];
    let now = input.startsAtMs;
    const end = input.startsAtMs + WEEK_MS;
    while (now < end) {
        const track = nextTrack(rng, clock, now, lastByTrack, lastByArtist);
        entries.push(toEntry(track, now));
        lastByTrack.set(track.id, now);
        lastByArtist.set(track.artist, now);
        now += track.durationMs;
    }
    return entries;
}
