export type Sex = 'male' | 'female';

export type DisplayUnit = 'kg' | 'lb';

export type LiftId = 'squat' | 'bench' | 'deadlift' | 'press';

export type WeekKind = '5s' | '3s' | '531' | 'deload';

export type SetSlot = 'warmup' | 'main' | 'joker' | 'fsl' | 'ssl' | 'bbb' | 'widowmaker' | 'assistance';

export type TemplateId =
    | 'bbb'
    | 'fsl'
    | 'ssl'
    | '5s-pro'
    | 'widowmaker'
    | 'triumvirate'
    | 'bbb-beefcake'
    | 'bbs'
    | 'bodyweight';

export type PhaseKind = 'training' | 'nutrition' | 'diet' | 'custom';

export type ThresholdBand = 'target' | 'warn' | 'alert';

export type ThresholdComparator = 'lt' | 'lte' | 'gt' | 'gte';

export type SampleSource = 'health-connect' | 'csv' | 'manual' | 'five31';

/** Canonical sample metrics. Values are SI except heart_rate (bpm) and vo2max (mL/kg/min). */
export type MetricId =
    | 'body_mass'
    | 'height'
    | 'neck'
    | 'waist'
    | 'hip'
    | 'chest'
    | 'upper_arm'
    | 'thigh'
    | 'calf'
    | 'heart_rate'
    | 'resting_heart_rate'
    | 'hrv_rmssd'
    | 'steps'
    | 'distance'
    | 'sleep'
    | 'energy'
    | 'body_fat'
    | 'lean_mass'
    | 'vo2max'
    | 'sit_and_reach'
    | 'knee_to_wall'
    | 'active_knee_extension'
    | 'shoulder_flexion'
    | 'shoulder_er'
    | 'hip_ir'
    | 'hip_er'
    | 'wrist_extension';

export interface Sample {
    metric: MetricId;
    t: number;
    valueSi: number;
    source: SampleSource;
    originId: string;
}

export interface ParseSkip {
    line: string;
    reason: string;
}

export interface ParseResult {
    samples: Sample[];
    skipped: ParseSkip[];
    format: 'health-connect' | 'health-connect-db' | 'csv' | 'unknown';
}

export interface MainSetSpec {
    pct: number;
    reps: number;
    amrap: boolean;
}

export interface PlannedSet {
    lift: LiftId;
    slot: SetSlot;
    setIndex: number;
    pct: number;
    reps: number;
    amrap: boolean;
    weightKg: number;
}

export interface FormulaDef {
    id: string;
    label: string;
    region: string;
    cadenceDays: number;
    inputs: MetricId[];
    /** Extra profile fields required (not samples). */
    profile: Array<'sex' | 'height'>;
}

export interface Point {
    t: number;
    v: number;
}
