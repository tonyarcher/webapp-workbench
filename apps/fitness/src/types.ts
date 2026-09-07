export type View = 'dashboard' | 'import' | 'lifts' | 'measure' | 'chart';

export interface MetricStat {
    metric: string;
    n: number;
    firstT: number;
    lastT: number;
}

export interface LatestSample {
    metric: string;
    t: number;
    valueSi: number;
}

export interface Profile {
    sex: 'male' | 'female' | null;
    birthYear: number | null;
    heightM: number | null;
    displayUnit: 'kg' | 'lb';
    tm: {
        squat: number | null;
        bench: number | null;
        deadlift: number | null;
        press: number | null;
    };
}

export interface RollupRow {
    metric: string;
    day: string;
    minSi: number;
    maxSi: number;
    avgSi: number;
    sumSi: number;
    n: number;
}

export interface SeriesPoint {
    t: number;
    v: number;
}

export interface SeriesOrigin {
    t: number;
    valueSi: number;
    originId: string;
    source: string;
}

export interface SeriesResult {
    metric: string;
    points: SeriesPoint[];
    n: number;
    origins: SeriesOrigin[];
}
