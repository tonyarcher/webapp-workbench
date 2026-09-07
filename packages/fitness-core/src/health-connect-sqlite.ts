import type {MetricId, ParseResult, ParseSkip, Sample} from './types';
import {KCAL_TO_J, asNumber} from './units';

const SQLITE_MAGIC = 'SQLite format 3';
const HR_BUCKET_MS = 60_000;

export function looksLikeSqlite(bytes: Uint8Array): boolean {
    if (bytes.length < SQLITE_MAGIC.length) return false;
    for (let i = 0; i < SQLITE_MAGIC.length; i++) {
        if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
    }
    return true;
}

export function blobToHex(value: unknown): string {
    if (value instanceof Uint8Array) {
        let out = '';
        for (const b of value) out += b.toString(16).padStart(2, '0');
        return out;
    }
    return typeof value === 'string' ? value : '';
}

function originFor(row: Record<string, unknown>, table: string, t: number): string {
    const uuid = blobToHex(row.uuid);
    if (uuid) return uuid;
    const client = typeof row.client_record_id === 'string' ? row.client_record_id.trim() : '';
    if (client) return `client:${client}`;
    return `${table}:${t}`;
}

interface ColSpec {
    table: string;
    metric: MetricId;
    valueCol: string;
    timeCol: string;
    toSi: (raw: number) => number;
}

/** Health Connect Room stores mass in grams and Energy in small calories. */
const INSTANT: ColSpec[] = [
    {table: 'weight_record_table', metric: 'body_mass', valueCol: 'weight', timeCol: 'time', toSi: (g) => g / 1_000},
    {table: 'height_record_table', metric: 'height', valueCol: 'height', timeCol: 'time', toSi: (m) => m},
    {table: 'resting_heart_rate_record_table', metric: 'resting_heart_rate', valueCol: 'beats_per_minute', timeCol: 'time', toSi: (v) => v},
    {table: 'lean_body_mass_record_table', metric: 'lean_mass', valueCol: 'mass', timeCol: 'time', toSi: (g) => g / 1_000},
    {table: 'body_fat_record_table', metric: 'body_fat', valueCol: 'percentage', timeCol: 'time', toSi: (p) => (p > 1 ? p / 100 : p)},
    {table: 'vo2_max_record_table', metric: 'vo2max', valueCol: 'vo2_milliliters_per_minute_kilogram', timeCol: 'time', toSi: (v) => v},
    {table: 'heart_rate_variability_rmssd_record_table', metric: 'hrv_rmssd', valueCol: 'heart_rate_variability_millis', timeCol: 'time', toSi: (ms) => ms / 1_000},
    {table: 'oxygen_saturation_record_table', metric: 'oxygen_sat', valueCol: 'percentage', timeCol: 'time', toSi: (p) => (p > 1 ? p / 100 : p)},
    {table: 'basal_metabolic_rate_record_table', metric: 'bmr', valueCol: 'basal_metabolic_rate', timeCol: 'time', toSi: (v) => v},
];

const INTERVAL: ColSpec[] = [
    {table: 'steps_record_table', metric: 'steps', valueCol: 'count', timeCol: 'start_time', toSi: (v) => v},
    {table: 'distance_record_table', metric: 'distance', valueCol: 'distance', timeCol: 'start_time', toSi: (m) => m},
    {table: 'total_calories_burned_record_table', metric: 'energy_total', valueCol: 'energy', timeCol: 'start_time', toSi: (cal) => (cal / 1_000) * KCAL_TO_J},
    {table: 'active_calories_burned_record_table', metric: 'energy_active', valueCol: 'energy', timeCol: 'start_time', toSi: (cal) => (cal / 1_000) * KCAL_TO_J},
    {table: 'floors_climbed_record_table', metric: 'floors', valueCol: 'floors', timeCol: 'start_time', toSi: (v) => v},
];

export const HEALTH_CONNECT_SQLITE_TABLES = [
    ...INSTANT.map((s) => s.table),
    ...INTERVAL.map((s) => s.table),
    'sleep_session_record_table',
    'heart_rate_record_series_table',
    'speed_record_table',
    'exercise_session_record_table',
];

function mapSpecRows(rows: Record<string, unknown>[], spec: ColSpec): {samples: Sample[]; skipped: ParseSkip[]} {
    const samples: Sample[] = [];
    const skipped: ParseSkip[] = [];
    for (const row of rows) {
        const t = asNumber(row[spec.timeCol]);
        const raw = asNumber(row[spec.valueCol]);
        if (t == null || raw == null) {
            skipped.push({line: spec.table, reason: 'missing time or value'});
            continue;
        }
        samples.push({
            metric: spec.metric,
            t,
            valueSi: spec.toSi(raw),
            source: 'health-connect',
            originId: originFor(row, spec.table, t),
        });
    }
    return {samples, skipped};
}

function mapSleep(rows: Record<string, unknown>[]): {samples: Sample[]; skipped: ParseSkip[]} {
    const samples: Sample[] = [];
    const skipped: ParseSkip[] = [];
    for (const row of rows) {
        const start = asNumber(row.start_time);
        const end = asNumber(row.end_time);
        if (start == null || end == null || end <= start) {
            skipped.push({line: 'sleep_session_record_table', reason: 'bad sleep interval'});
            continue;
        }
        samples.push({
            metric: 'sleep',
            t: start,
            valueSi: (end - start) / 1_000,
            source: 'health-connect',
            originId: originFor(row, 'sleep_session_record_table', start),
        });
    }
    return {samples, skipped};
}

function mapMinuteSeries(
    rows: Record<string, unknown>[],
    valueCol: string,
    metric: MetricId,
    originPrefix: string,
): Sample[] {
    const buckets = new Map<number, {sum: number; n: number}>();
    for (const row of rows) {
        const t = asNumber(row.epoch_millis);
        const raw = asNumber(row[valueCol]);
        if (t == null || raw == null) continue;
        const key = Math.floor(t / HR_BUCKET_MS) * HR_BUCKET_MS;
        const bucket = buckets.get(key) ?? {sum: 0, n: 0};
        bucket.sum += raw;
        bucket.n += 1;
        buckets.set(key, bucket);
    }
    const samples: Sample[] = [];
    for (const [t, bucket] of buckets) {
        samples.push({
            metric,
            t,
            valueSi: bucket.sum / bucket.n,
            source: 'health-connect',
            originId: `${originPrefix}:${t}`,
        });
    }
    return samples;
}

function mapExercise(rows: Record<string, unknown>[]): {samples: Sample[]; skipped: ParseSkip[]} {
    const samples: Sample[] = [];
    const skipped: ParseSkip[] = [];
    for (const row of rows) {
        const start = asNumber(row.start_time);
        const end = asNumber(row.end_time);
        if (start == null || end == null || end <= start) {
            skipped.push({line: 'exercise_session_record_table', reason: 'bad exercise interval'});
            continue;
        }
        samples.push({
            metric: 'exercise',
            t: start,
            valueSi: (end - start) / 1_000,
            source: 'health-connect',
            originId: originFor(row, 'exercise_session_record_table', start),
        });
    }
    return {samples, skipped};
}

function merge(into: ParseResult, part: {samples: Sample[]; skipped: ParseSkip[]}): void {
    into.samples.push(...part.samples);
    into.skipped.push(...part.skipped);
}

/**
 * Map Health Connect Room tables (from a `.db` export) to samples.
 * Re-imports upsert: origin_id is the record UUID, or a stable minute key for HR.
 */
function appendMinutes(result: ParseResult, tables: Record<string, Record<string, unknown>[]>): void {
    result.samples.push(...mapMinuteSeries(tables.heart_rate_record_series_table ?? [], 'beats_per_minute', 'heart_rate', 'hr-minute'));
    result.samples.push(...mapMinuteSeries(tables.speed_record_table ?? [], 'speed', 'speed', 'speed-minute'));
}

export function parseHealthConnectSqliteTables(tables: Record<string, Record<string, unknown>[]>): ParseResult {
    const result: ParseResult = {samples: [], skipped: [], format: 'health-connect-db'};
    for (const spec of INSTANT) merge(result, mapSpecRows(tables[spec.table] ?? [], spec));
    for (const spec of INTERVAL) merge(result, mapSpecRows(tables[spec.table] ?? [], spec));
    merge(result, mapSleep(tables.sleep_session_record_table ?? []));
    merge(result, mapExercise(tables.exercise_session_record_table ?? []));
    appendMinutes(result, tables);
    if (!result.samples.length && !result.skipped.length) {
        result.skipped.push({line: '', reason: 'no mapped records'});
    }
    return result;
}
