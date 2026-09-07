import type {MetricId} from './types';

export type RollupKind = 'avg' | 'sum';

export interface ChartDef {
    id: string;
    label: string;
    metric: MetricId;
    group: string;
    rollup: RollupKind;
}

export const METRIC_LABELS: Record<string, string> = {
    body_mass: 'Weight',
    height: 'Height',
    neck: 'Neck',
    waist: 'Waist',
    hip: 'Hip',
    chest: 'Chest',
    upper_arm: 'Upper arm',
    thigh: 'Thigh',
    calf: 'Calf',
    heart_rate: 'Heart rate',
    resting_heart_rate: 'Resting HR',
    hrv_rmssd: 'HRV (RMSSD)',
    steps: 'Steps',
    distance: 'Distance',
    sleep: 'Sleep',
    energy_total: 'Total calories',
    energy_active: 'Active calories',
    oxygen_sat: 'SpO2',
    bmr: 'BMR',
    speed: 'Speed',
    floors: 'Floors',
    exercise: 'Exercise',
    body_fat: 'Body fat',
    lean_mass: 'Lean mass',
    vo2max: 'VO2 max',
    sit_and_reach: 'Sit-and-reach',
    knee_to_wall: 'Knee-to-wall',
    active_knee_extension: 'Active knee extension',
    shoulder_flexion: 'Shoulder flexion',
    shoulder_er: 'Shoulder ER',
    hip_ir: 'Hip IR',
    hip_er: 'Hip ER',
    wrist_extension: 'Wrist extension',
    bmi: 'BMI',
    navy_bf: 'Navy body fat',
    whtr: 'Waist-to-height',
    whr: 'Waist-to-hip',
};

export function metricLabel(id: string): string {
    return METRIC_LABELS[id] ?? id;
}

export const SUM_METRICS: MetricId[] = [
    'steps',
    'distance',
    'sleep',
    'energy_total',
    'energy_active',
    'floors',
    'exercise',
];

export function rollupKind(metric: string): RollupKind {
    return (SUM_METRICS as string[]).includes(metric) ? 'sum' : 'avg';
}

export const CHARTS: ChartDef[] = [
    {id: 'body_mass', label: 'Weight', metric: 'body_mass', group: 'body', rollup: 'avg'},
    {id: 'height', label: 'Height', metric: 'height', group: 'body', rollup: 'avg'},
    {id: 'neck', label: 'Neck', metric: 'neck', group: 'body', rollup: 'avg'},
    {id: 'waist', label: 'Waist', metric: 'waist', group: 'body', rollup: 'avg'},
    {id: 'hip', label: 'Hip', metric: 'hip', group: 'body', rollup: 'avg'},
    {id: 'chest', label: 'Chest', metric: 'chest', group: 'body', rollup: 'avg'},
    {id: 'upper_arm', label: 'Upper arm', metric: 'upper_arm', group: 'body', rollup: 'avg'},
    {id: 'thigh', label: 'Thigh', metric: 'thigh', group: 'body', rollup: 'avg'},
    {id: 'calf', label: 'Calf', metric: 'calf', group: 'body', rollup: 'avg'},
    {id: 'body_fat', label: 'Body fat', metric: 'body_fat', group: 'body', rollup: 'avg'},
    {id: 'lean_mass', label: 'Lean mass', metric: 'lean_mass', group: 'body', rollup: 'avg'},
    {id: 'heart_rate', label: 'Heart rate', metric: 'heart_rate', group: 'cardio', rollup: 'avg'},
    {id: 'resting_heart_rate', label: 'Resting HR', metric: 'resting_heart_rate', group: 'cardio', rollup: 'avg'},
    {id: 'hrv_rmssd', label: 'HRV', metric: 'hrv_rmssd', group: 'cardio', rollup: 'avg'},
    {id: 'oxygen_sat', label: 'SpO2', metric: 'oxygen_sat', group: 'cardio', rollup: 'avg'},
    {id: 'vo2max', label: 'VO2 max', metric: 'vo2max', group: 'cardio', rollup: 'avg'},
    {id: 'bmr', label: 'BMR', metric: 'bmr', group: 'cardio', rollup: 'avg'},
    {id: 'steps', label: 'Steps', metric: 'steps', group: 'activity', rollup: 'sum'},
    {id: 'distance', label: 'Distance', metric: 'distance', group: 'activity', rollup: 'sum'},
    {id: 'energy_total', label: 'Total calories', metric: 'energy_total', group: 'activity', rollup: 'sum'},
    {id: 'energy_active', label: 'Active calories', metric: 'energy_active', group: 'activity', rollup: 'sum'},
    {id: 'floors', label: 'Floors', metric: 'floors', group: 'activity', rollup: 'sum'},
    {id: 'speed', label: 'Speed', metric: 'speed', group: 'activity', rollup: 'avg'},
    {id: 'exercise', label: 'Exercise', metric: 'exercise', group: 'activity', rollup: 'sum'},
    {id: 'sleep', label: 'Sleep', metric: 'sleep', group: 'sleep', rollup: 'sum'},
    {id: 'sit_and_reach', label: 'Sit-and-reach', metric: 'sit_and_reach', group: 'mobility', rollup: 'avg'},
    {id: 'knee_to_wall', label: 'Knee-to-wall', metric: 'knee_to_wall', group: 'mobility', rollup: 'avg'},
    {id: 'shoulder_flexion', label: 'Shoulder flexion', metric: 'shoulder_flexion', group: 'mobility', rollup: 'avg'},
    {id: 'shoulder_er', label: 'Shoulder ER', metric: 'shoulder_er', group: 'mobility', rollup: 'avg'},
    {id: 'hip_ir', label: 'Hip IR', metric: 'hip_ir', group: 'mobility', rollup: 'avg'},
    {id: 'hip_er', label: 'Hip ER', metric: 'hip_er', group: 'mobility', rollup: 'avg'},
    {id: 'wrist_extension', label: 'Wrist extension', metric: 'wrist_extension', group: 'mobility', rollup: 'avg'},
    {id: 'active_knee_extension', label: 'AKE', metric: 'active_knee_extension', group: 'mobility', rollup: 'avg'},
];

export const MEASURE_METRICS: MetricId[] = [
    'height',
    'body_mass',
    'neck',
    'waist',
    'hip',
    'chest',
    'upper_arm',
    'thigh',
    'calf',
    'sit_and_reach',
    'knee_to_wall',
    'active_knee_extension',
    'shoulder_flexion',
    'shoulder_er',
    'hip_ir',
    'hip_er',
    'wrist_extension',
];
