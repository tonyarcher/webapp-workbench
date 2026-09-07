import type {DisplayUnit, MetricId} from './types';

export const LB_TO_KG = 0.45359237;
export const IN_TO_M = 0.0254;
export const CM_TO_M = 0.01;
export const KCAL_TO_J = 4_184;
export const DAY_MS = 86_400_000;

export function kgToLb(kg: number): number {
    return kg / LB_TO_KG;
}

export function lbToKg(lb: number): number {
    return lb * LB_TO_KG;
}

export function mToIn(m: number): number {
    return m / IN_TO_M;
}

export function inToM(inches: number): number {
    return inches * IN_TO_M;
}

export function mToCm(m: number): number {
    return m / CM_TO_M;
}

export function cmToM(cm: number): number {
    return cm * CM_TO_M;
}

export function roundTo(value: number, increment: number): number {
    if (increment <= 0) return value;
    return Math.round(value / increment) * increment;
}

/** Wendler: nearest 5 lb. Metric: nearest 2.5 kg. */
export function roundLoadKg(kg: number, display: DisplayUnit): number {
    if (display === 'lb') return lbToKg(roundTo(kgToLb(kg), 5));
    return roundTo(kg, 2.5);
}

const LENGTH_METRICS = new Set<MetricId>([
    'height',
    'neck',
    'waist',
    'hip',
    'chest',
    'upper_arm',
    'thigh',
    'calf',
    'sit_and_reach',
    'knee_to_wall',
]);

const MASS_METRICS = new Set<MetricId>(['body_mass', 'lean_mass']);

export function metricKind(metric: MetricId): 'mass' | 'length' | 'other' {
    if (MASS_METRICS.has(metric)) return 'mass';
    if (LENGTH_METRICS.has(metric)) return 'length';
    return 'other';
}

function scale(value: number, unit: string, factors: Record<string, number>): number | null {
    const factor = factors[unit];
    return factor == null ? null : value * factor;
}

const MASS_UNITS: Record<string, number> = {
    kg: 1,
    lb: LB_TO_KG,
    lbs: LB_TO_KG,
    pound: LB_TO_KG,
    pounds: LB_TO_KG,
    g: 0.001,
    gram: 0.001,
    grams: 0.001,
};

const LENGTH_UNITS: Record<string, number> = {
    m: 1,
    meter: 1,
    meters: 1,
    cm: CM_TO_M,
    mm: 0.001,
    in: IN_TO_M,
    inch: IN_TO_M,
    inches: IN_TO_M,
    '"': IN_TO_M,
};

const OTHER_UNITS: Partial<Record<MetricId, Record<string, number>>> = {
    body_fat: {'%': 0.01, percent: 0.01, pct: 0.01, fraction: 1, ratio: 1, '': 1},
    energy: {j: 1, joule: 1, joules: 1, kj: 1_000, kcal: KCAL_TO_J, cal: KCAL_TO_J, calorie: KCAL_TO_J, calories: KCAL_TO_J},
    sleep: {s: 1, sec: 1, second: 1, seconds: 1, min: 60, minute: 60, minutes: 60, h: 3_600, hr: 3_600, hour: 3_600, hours: 3_600},
    heart_rate: {bpm: 1, beats: 1, '': 1},
    resting_heart_rate: {bpm: 1, beats: 1, '': 1},
    steps: {'': 1, count: 1, steps: 1, step: 1},
    hrv_rmssd: {ms: 0.001, '': 0.001},
    vo2max: {'': 1, 'ml/kg/min': 1},
    active_knee_extension: {deg: 1, degree: 1, degrees: 1, '°': 1, '': 1},
    shoulder_flexion: {deg: 1, degree: 1, degrees: 1, '°': 1, '': 1},
    shoulder_er: {deg: 1, degree: 1, degrees: 1, '°': 1, '': 1},
    hip_ir: {deg: 1, degree: 1, degrees: 1, '°': 1, '': 1},
    hip_er: {deg: 1, degree: 1, degrees: 1, '°': 1, '': 1},
    wrist_extension: {deg: 1, degree: 1, degrees: 1, '°': 1, '': 1},
};

/**
 * Convert a user-facing value into the metric's SI (or documented) unit.
 * Unknown units return null so importers can skip the row.
 */
export function toSi(metric: MetricId, value: number, unit: string): number | null {
    if (!Number.isFinite(value)) return null;
    const u = unit.trim().toLowerCase();
    const kind = metricKind(metric);
    if (kind === 'mass') return scale(value, u, MASS_UNITS);
    if (kind === 'length') return scale(value, u, LENGTH_UNITS);
    return scale(value, u, OTHER_UNITS[metric] ?? {});
}

const FORMAT_EXTRA: Partial<Record<MetricId, {scale: number; unit: string}>> = {
    body_fat: {scale: 100, unit: '%'},
    energy: {scale: 1 / KCAL_TO_J, unit: 'kcal'},
    sleep: {scale: 1 / 3_600, unit: 'h'},
    hrv_rmssd: {scale: 1_000, unit: 'ms'},
    heart_rate: {scale: 1, unit: 'bpm'},
    resting_heart_rate: {scale: 1, unit: 'bpm'},
    steps: {scale: 1, unit: 'steps'},
};

export function formatSi(metric: MetricId, valueSi: number, display: DisplayUnit): {value: number; unit: string} {
    const kind = metricKind(metric);
    if (kind === 'mass') return display === 'lb' ? {value: kgToLb(valueSi), unit: 'lb'} : {value: valueSi, unit: 'kg'};
    if (kind === 'length') return display === 'lb' ? {value: mToIn(valueSi), unit: 'in'} : {value: mToCm(valueSi), unit: 'cm'};
    const extra = FORMAT_EXTRA[metric];
    return extra ? {value: valueSi * extra.scale, unit: extra.unit} : {value: valueSi, unit: ''};
}

const METRIC_ALIASES: Record<string, MetricId> = {
    body_mass: 'body_mass',
    weight: 'body_mass',
    bodymass: 'body_mass',
    height: 'height',
    neck: 'neck',
    waist: 'waist',
    hip: 'hip',
    hips: 'hip',
    chest: 'chest',
    upper_arm: 'upper_arm',
    arm: 'upper_arm',
    bicep: 'upper_arm',
    thigh: 'thigh',
    calf: 'calf',
    heart_rate: 'heart_rate',
    heartrate: 'heart_rate',
    hr: 'heart_rate',
    resting_heart_rate: 'resting_heart_rate',
    rhr: 'resting_heart_rate',
    hrv_rmssd: 'hrv_rmssd',
    hrv: 'hrv_rmssd',
    steps: 'steps',
    sleep: 'sleep',
    energy: 'energy',
    calories: 'energy',
    kcal: 'energy',
    body_fat: 'body_fat',
    bodyfat: 'body_fat',
    bf: 'body_fat',
    lean_mass: 'lean_mass',
    vo2max: 'vo2max',
    sit_and_reach: 'sit_and_reach',
    knee_to_wall: 'knee_to_wall',
    active_knee_extension: 'active_knee_extension',
    shoulder_flexion: 'shoulder_flexion',
    shoulder_er: 'shoulder_er',
    hip_ir: 'hip_ir',
    hip_er: 'hip_er',
    wrist_extension: 'wrist_extension',
};

export function parseMetricId(raw: string): MetricId | null {
    const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
    return METRIC_ALIASES[key] ?? null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

export function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}
