import type {RollupRow} from '../types';
import {formatSi, type DisplayUnit, type MetricId, type Point} from 'fitness-core';

export function rollupPoints(rows: RollupRow[], metric: string, kind: 'avg' | 'sum'): Point[] {
    const out: Point[] = [];
    for (const row of rows) {
        if (row.metric !== metric) continue;
        const t = Date.parse(`${row.day}T00:00:00Z`);
        if (!Number.isFinite(t)) continue;
        out.push({t, v: kind === 'sum' ? row.sumSi : row.avgSi});
    }
    return out;
}

export function displaySeries(
    metric: MetricId,
    points: Point[],
    display: DisplayUnit,
): {xs: number[]; ys: number[]; fmt: string} {
    const xs: number[] = [];
    const ys: number[] = [];
    let fmt = '';
    for (const p of points) {
        const shown = formatSi(metric, p.v, display);
        xs.push(p.t / 1_000);
        ys.push(shown.value);
        fmt = shown.unit;
    }
    return {xs, ys, fmt};
}
