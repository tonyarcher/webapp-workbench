import type {MetricId, Point} from './types';

export function linearSlope(points: Point[]): number | null {
    if (points.length < 2) return null;
    let sumT = 0;
    let sumV = 0;
    for (const p of points) {
        sumT += p.t;
        sumV += p.v;
    }
    const n = points.length;
    const meanT = sumT / n;
    const meanV = sumV / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
        const dt = p.t - meanT;
        num += dt * (p.v - meanV);
        den += dt * dt;
    }
    if (den === 0) return null;
    return num / den;
}

export function pctChange(points: Point[]): number | null {
    if (points.length < 2) return null;
    const first = points[0]?.v;
    const last = points[points.length - 1]?.v;
    if (first == null || last == null || first === 0) return null;
    return (last - first) / first;
}

const DOWN_GOOD = new Set<MetricId>([
    'body_mass',
    'waist',
    'hip',
    'resting_heart_rate',
    'body_fat',
]);

const UP_GOOD = new Set<MetricId>([
    'lean_mass',
    'hrv_rmssd',
    'vo2max',
    'steps',
    'sleep',
    'distance',
]);

function goalHint(metric: MetricId, slope: number): string {
    if (DOWN_GOOD.has(metric)) return slope < 0 ? ' (down is typically the goal)' : ' (trending up)';
    if (UP_GOOD.has(metric)) return slope > 0 ? ' (up is typically the goal)' : ' (trending down)';
    return '';
}

export function trendAdvice(metric: MetricId, slope: number | null, pct: number | null, n: number): string | null {
    if (slope == null || pct == null || n < 4) return null;
    const pctLabel = `${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(1)}%`;
    return `${pctLabel} over this window${goalHint(metric, slope)}.`;
}
