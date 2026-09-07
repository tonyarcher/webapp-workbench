import type {Point} from './types';

function average(points: Point[]): Point {
    if (!points.length) return {t: 0, v: 0};
    let t = 0;
    let v = 0;
    for (const p of points) {
        t += p.t;
        v += p.v;
    }
    return {t: t / points.length, v: v / points.length};
}

function pickLargest(pointA: Point, range: Point[], avg: Point, rangeStart: number): number {
    let maxArea = -1;
    let nextA = rangeStart;
    for (let j = 0; j < range.length; j++) {
        const p = range[j];
        if (!p) continue;
        const area = Math.abs((pointA.t - avg.t) * (p.v - pointA.v) - (pointA.t - p.t) * (avg.v - pointA.v));
        if (area > maxArea) {
            maxArea = area;
            nextA = rangeStart + j;
        }
    }
    return nextA;
}

/**
 * Largest-Triangle-Three-Buckets. First and last points are kept.
 * If `limit` >= data length, returns a copy.
 */
export function downsampleLttb(points: Point[], limit: number): Point[] {
    if (limit < 3 || points.length <= limit) return points.slice();
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return [];
    const sampled: Point[] = [first];
    const bucketSize = (points.length - 2) / (limit - 2);
    let a = 0;
    for (let i = 0; i < limit - 2; i++) {
        const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
        const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, points.length);
        const avgStart = Math.floor((i + 2) * bucketSize) + 1;
        const avgEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, points.length);
        const pointA = points[a];
        if (!pointA) break;
        const avgPts = points.slice(avgStart, avgEnd);
        const nextA = pickLargest(pointA, points.slice(rangeStart, rangeEnd), average(avgPts.length ? avgPts : [last]), rangeStart);
        const chosen = points[nextA];
        if (chosen && chosen !== last) sampled.push(chosen);
        a = nextA;
    }
    sampled.push(last);
    return sampled;
}
