import type {Track, Weights} from '../types.js';
import {pickUniform, pickWeighted, type Rng} from './rng.js';
import {bucketMix, dueScore, type SeparationWindows} from './clock.js';
import type {BucketName, TrackBuckets} from './buckets.js';

const GOLD_2000S_SHARE = 0.6;
const RELAX_STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1];

export function chooseBucket(rng: Rng, weights: Weights): BucketName {
    if (rng() < weights.goldLeak / 100) {
        return rng() < GOLD_2000S_SHARE ? 'gold2000s' : 'gold1990s';
    }
    const mix = bucketMix(weights.hitGravity);
    return pickWeighted(rng, ['power', 'current', 'recurrent'], [mix.power, mix.current, mix.recurrent]);
}

export function passesSeparation(
    track: Track,
    now: number,
    lastByTrack: Map<string, number>,
    lastByArtist: Map<string, number>,
    windows: SeparationWindows,
    relax: number,
    orbitMinMs = 0,
    numberOneId?: string,
): boolean {
    const scale = 1 - relax;
    const artistLast = lastByArtist.get(track.artist);
    if (artistLast != null && now - artistLast < windows.artistMs * scale) return false;
    const titleLast = lastByTrack.get(track.id);
    if (titleLast != null && now - titleLast < windows.titleMs[track.rotation] * scale) return false;
    if (numberOneId && track.id === numberOneId && titleLast != null && now - titleLast < orbitMinMs) return false;
    return true;
}

function candidatesAtRelax(
    pool: Track[],
    now: number,
    lastByTrack: Map<string, number>,
    lastByArtist: Map<string, number>,
    windows: SeparationWindows,
    relax: number,
    orbitMinMs: number,
    numberOneId: string | undefined,
): Track[] {
    return pool.filter((track) =>
        passesSeparation(track, now, lastByTrack, lastByArtist, windows, relax, orbitMinMs, numberOneId),
    );
}

function withoutLastArtist(pool: Track[], lastByArtist: Map<string, number>): Track[] {
    let lastArtist: string | undefined;
    let lastAt = -1;
    for (const [artist, at] of lastByArtist) {
        if (at > lastAt) {
            lastAt = at;
            lastArtist = artist;
        }
    }
    if (!lastArtist || lastAt < 0) return pool;
    const skipped = pool.filter((track) => track.artist !== lastArtist);
    return skipped.length ? skipped : pool;
}

function eligible(
    pool: Track[],
    now: number,
    lastByTrack: Map<string, number>,
    lastByArtist: Map<string, number>,
    windows: SeparationWindows,
    orbitMinMs: number,
    numberOneId: string | undefined,
): Track[] {
    const preferred = withoutLastArtist(pool, lastByArtist);
    for (const relax of RELAX_STEPS) {
        const found = candidatesAtRelax(preferred, now, lastByTrack, lastByArtist, windows, relax, orbitMinMs, numberOneId);
        if (found.length) return found;
    }
    const safe = preferred.filter((track) =>
        passesSeparation(track, now, lastByTrack, lastByArtist, windows, 1, orbitMinMs, numberOneId),
    );
    if (safe.length) return safe;
    const others = pool.filter((track) => track.id !== numberOneId);
    return others.length ? others : pool;
}

function pickByTemperature(rng: Rng, pool: Track[], now: number, lastByTrack: Map<string, number>, temperature: number): Track {
    if (temperature <= 0) {
        let best = pool[0] as Track;
        let bestScore = dueScore(best, now, lastByTrack.get(best.id));
        for (let i = 1; i < pool.length; i++) {
            const track = pool[i] as Track;
            const score = dueScore(track, now, lastByTrack.get(track.id));
            if (score > bestScore) {
                best = track;
                bestScore = score;
            }
        }
        return best;
    }
    const exp = 1 - 0.99 * (temperature / 100);
    const weights = pool.map((track) => Math.pow(Math.max(dueScore(track, now, lastByTrack.get(track.id)), 1), exp));
    return pickWeighted(rng, pool, weights);
}

export function pickFromBucket(
    rng: Rng,
    buckets: TrackBuckets,
    name: BucketName,
    now: number,
    lastByTrack: Map<string, number>,
    lastByArtist: Map<string, number>,
    windows: SeparationWindows,
    temperature: number,
    orbitMinMs = 0,
    numberOneId?: string,
): Track {
    const pool = buckets[name].length ? buckets[name] : fallbackPool(buckets);
    const fit = eligible(pool, now, lastByTrack, lastByArtist, windows, orbitMinMs, numberOneId);
    if (fit.length === 1) return fit[0] as Track;
    if (temperature >= 100) return pickUniform(rng, fit);
    return pickByTemperature(rng, fit, now, lastByTrack, temperature);
}

function fallbackPool(buckets: TrackBuckets): Track[] {
    return [
        ...buckets.power,
        ...buckets.current,
        ...buckets.recurrent,
        ...buckets.gold2000s,
        ...buckets.gold1990s,
    ];
}
