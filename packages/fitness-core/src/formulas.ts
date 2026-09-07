import type {FormulaDef, MetricId, Sample, Sex} from './types';
import {DAY_MS, mToIn} from './units';

/**
 * Hodgdon / Beckett Navy circumference method (1984). Inputs in metres;
 * the published coefficients use inches. Returns body-fat percent (e.g. 15.2).
 */
export function navyBodyFat(options: {
    sex: Sex;
    heightM: number;
    neckM: number;
    waistM: number;
    hipM?: number;
}): number | null {
    const height = mToIn(options.heightM);
    const neck = mToIn(options.neckM);
    const waist = mToIn(options.waistM);
    if (height <= 0 || neck <= 0 || waist <= 0) return null;
    if (options.sex === 'male') {
        const girth = waist - neck;
        if (girth <= 0) return null;
        const denom = 1.0324 - 0.19077 * Math.log10(girth) + 0.15456 * Math.log10(height);
        return 495 / denom - 450;
    }
    const hip = options.hipM == null ? 0 : mToIn(options.hipM);
    const girth = waist + hip - neck;
    if (girth <= 0 || hip <= 0) return null;
    const denom = 1.29579 - 0.35004 * Math.log10(girth) + 0.221 * Math.log10(height);
    return 495 / denom - 450;
}

export function navyBodyFatFraction(options: {
    sex: Sex;
    heightM: number;
    neckM: number;
    waistM: number;
    hipM?: number;
}): number | null {
    const pct = navyBodyFat(options);
    if (pct == null || !Number.isFinite(pct)) return null;
    return pct / 100;
}

export function bmi(massKg: number, heightM: number): number | null {
    if (massKg <= 0 || heightM <= 0) return null;
    return massKg / (heightM * heightM);
}

export function waistToHeight(waistM: number, heightM: number): number | null {
    if (waistM <= 0 || heightM <= 0) return null;
    return waistM / heightM;
}

export function waistToHip(waistM: number, hipM: number): number | null {
    if (waistM <= 0 || hipM <= 0) return null;
    return waistM / hipM;
}

export function ffmi(massKg: number, heightM: number, bodyFatFraction: number): number | null {
    if (massKg <= 0 || heightM <= 0) return null;
    if (bodyFatFraction < 0 || bodyFatFraction >= 1) return null;
    const lean = massKg * (1 - bodyFatFraction);
    return lean / (heightM * heightM);
}

/** DOTS (2019) coefficient for bodyweight in kg. */
export function dotsCoefficient(massKg: number, sex: Sex): number | null {
    if (massKg <= 0) return null;
    const bw = massKg;
    const bw2 = bw * bw;
    const bw3 = bw2 * bw;
    const bw4 = bw2 * bw2;
    const denom =
        sex === 'male'
            ? -0.000001093 * bw4 + 0.0007391293 * bw3 - 0.1918759221 * bw2 + 24.0900756 * bw - 307.75076
            : -0.0000010706 * bw4 + 0.0005158568 * bw3 - 0.1126655495 * bw2 + 13.6175032 * bw - 57.96288;
    if (denom === 0) return null;
    return 500 / denom;
}

export function dotsScore(totalKg: number, massKg: number, sex: Sex): number | null {
    const coeff = dotsCoefficient(massKg, sex);
    if (coeff == null) return null;
    return coeff * totalKg;
}

export const FORMULAS: FormulaDef[] = [
    {
        id: 'navy-bf',
        label: 'Navy body fat',
        region: 'composition',
        cadenceDays: 7,
        inputs: ['neck', 'waist', 'hip'],
        profile: ['sex', 'height'],
    },
    {
        id: 'bmi',
        label: 'BMI',
        region: 'composition',
        cadenceDays: 1,
        inputs: ['body_mass'],
        profile: ['height'],
    },
    {
        id: 'whtr',
        label: 'Waist-to-height',
        region: 'composition',
        cadenceDays: 7,
        inputs: ['waist'],
        profile: ['height'],
    },
    {
        id: 'whr',
        label: 'Waist-to-hip',
        region: 'composition',
        cadenceDays: 7,
        inputs: ['waist', 'hip'],
        profile: [],
    },
    {
        id: 'sit-and-reach',
        label: 'Sit-and-reach',
        region: 'hamstrings',
        cadenceDays: 28,
        inputs: ['sit_and_reach'],
        profile: [],
    },
    {
        id: 'ankle-df',
        label: 'Knee-to-wall dorsiflexion',
        region: 'ankles',
        cadenceDays: 28,
        inputs: ['knee_to_wall'],
        profile: [],
    },
    {
        id: 'shoulder-flexion',
        label: 'Shoulder flexion',
        region: 'shoulders',
        cadenceDays: 28,
        inputs: ['shoulder_flexion'],
        profile: [],
    },
];

export interface DueMeasurement {
    metric: MetricId;
    formulaIds: string[];
    lastT: number | null;
    stale: boolean;
}

function skipNavyHip(formulaId: string, metric: MetricId, sex: Sex | null): boolean {
    return formulaId === 'navy-bf' && metric === 'hip' && sex === 'male';
}

function addNeed(needed: Map<MetricId, Set<string>>, metric: MetricId, formulaId: string): void {
    const ids = needed.get(metric) ?? new Set<string>();
    ids.add(formulaId);
    needed.set(metric, ids);
}

export function dueMeasurements(
    latestByMetric: Partial<Record<MetricId, Pick<Sample, 't'>>>,
    nowMs: number,
    sex: Sex | null,
): DueMeasurement[] {
    const needed = new Map<MetricId, Set<string>>();
    for (const formula of FORMULAS) {
        for (const metric of formula.inputs) {
            if (!skipNavyHip(formula.id, metric, sex)) addNeed(needed, metric, formula.id);
        }
    }
    const out: DueMeasurement[] = [];
    for (const [metric, ids] of needed) {
        const last = latestByMetric[metric]?.t ?? null;
        const cadence = Math.min(...FORMULAS.filter((f) => ids.has(f.id)).map((f) => f.cadenceDays));
        out.push({metric, formulaIds: [...ids], lastT: last, stale: last == null || nowMs - last > cadence * DAY_MS});
    }
    return out.sort((a, b) => Number(b.stale) - Number(a.stale) || a.metric.localeCompare(b.metric));
}
