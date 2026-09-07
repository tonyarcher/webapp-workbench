import type {Point, Sex} from './types';
import {bmi, navyBodyFat, waistToHeight, waistToHip} from './formulas';

function byDay(points: Point[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const p of points) {
        const day = new Date(p.t).toISOString().slice(0, 10);
        map.set(day, p.v);
    }
    return map;
}

function joinDays(maps: Map<string, number>[]): string[] {
    const counts = new Map<string, number>();
    for (const m of maps) {
        for (const day of m.keys()) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const need = maps.length;
    return [...counts.entries()].filter(([, n]) => n === need).map(([d]) => d).sort();
}

function dayMs(day: string): number {
    return Date.parse(`${day}T00:00:00Z`);
}

export function bmiSeries(mass: Point[], height: Point[]): Point[] {
    const m = byDay(mass);
    const h = byDay(height);
    return joinDays([m, h]).flatMap((day) => {
        const v = bmi(m.get(day) ?? 0, h.get(day) ?? 0);
        return v == null ? [] : [{t: dayMs(day), v}];
    });
}

export function whtrSeries(waist: Point[], height: Point[]): Point[] {
    const w = byDay(waist);
    const h = byDay(height);
    return joinDays([w, h]).flatMap((day) => {
        const v = waistToHeight(w.get(day) ?? 0, h.get(day) ?? 0);
        return v == null ? [] : [{t: dayMs(day), v}];
    });
}

export function whrSeries(waist: Point[], hip: Point[]): Point[] {
    const w = byDay(waist);
    const h = byDay(hip);
    return joinDays([w, h]).flatMap((day) => {
        const v = waistToHip(w.get(day) ?? 0, h.get(day) ?? 0);
        return v == null ? [] : [{t: dayMs(day), v}];
    });
}

export function navyBfSeries(
    sex: Sex,
    height: Point[],
    neck: Point[],
    waist: Point[],
    hip: Point[],
): Point[] {
    const h = byDay(height);
    const n = byDay(neck);
    const w = byDay(waist);
    const maps = sex === 'female' ? [h, n, w, byDay(hip)] : [h, n, w];
    const hipMap = byDay(hip);
    return joinDays(maps).flatMap((day) => {
        const v = navyBodyFat({
            sex,
            heightM: h.get(day) ?? 0,
            neckM: n.get(day) ?? 0,
            waistM: w.get(day) ?? 0,
            hipM: hipMap.get(day),
        });
        return v == null ? [] : [{t: dayMs(day), v}];
    });
}
