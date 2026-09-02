import type {Track} from '../types.js';

export interface TrackBuckets {
    power: Track[];
    current: Track[];
    recurrent: Track[];
    gold2000s: Track[];
    gold1990s: Track[];
}

export type BucketName = keyof TrackBuckets;

export function groupTracks(tracks: Track[]): TrackBuckets {
    const buckets: TrackBuckets = {
        power: [],
        current: [],
        recurrent: [],
        gold2000s: [],
        gold1990s: [],
    };
    for (const track of tracks) {
        if (track.rotation === 'power') buckets.power.push(track);
        else if (track.rotation === 'current') buckets.current.push(track);
        else if (track.rotation === 'recurrent') buckets.recurrent.push(track);
        else if (track.era === 'gold-2000s') buckets.gold2000s.push(track);
        else buckets.gold1990s.push(track);
    }
    return buckets;
}

export function numberOne(buckets: TrackBuckets): Track | undefined {
    return buckets.power.find((t) => t.rank === 1) ?? buckets.power[0];
}
