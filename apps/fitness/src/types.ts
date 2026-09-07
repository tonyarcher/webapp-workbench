export type View = 'dashboard' | 'import' | 'lifts' | 'measure';

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
