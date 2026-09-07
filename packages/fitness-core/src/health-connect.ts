import type {MetricId, ParseResult, ParseSkip, Sample} from './types';
import {asNumber, asString, isRecord, toSi} from './units';

interface Extractor {
    metric: MetricId;
    unit: string;
    pick: (rec: Record<string, unknown>) => number | null;
}

function nestedNumber(rec: Record<string, unknown>, keys: string[], inner: string[]): number | null {
    for (const key of keys) {
        const node = rec[key];
        const direct = asNumber(node);
        if (direct != null) return direct;
        if (isRecord(node)) {
            for (const innerKey of inner) {
                const n = asNumber(node[innerKey]);
                if (n != null) return n;
            }
        }
    }
    return null;
}

const EXTRACTORS: Array<{match: RegExp; ext: Extractor}> = [
    {
        match: /weight/i,
        ext: {
            metric: 'body_mass',
            unit: 'kg',
            pick: (rec) => nestedNumber(rec, ['weight', 'mass', 'value'], ['inKilograms', 'inKg', 'kg', 'value']),
        },
    },
    {
        match: /height/i,
        ext: {
            metric: 'height',
            unit: 'm',
            pick: (rec) => nestedNumber(rec, ['height', 'value'], ['inMeters', 'inM', 'meters', 'm', 'value']),
        },
    },
    {
        match: /hrv|rmssd/i,
        ext: {
            metric: 'hrv_rmssd',
            unit: 'ms',
            pick: (rec) => nestedNumber(rec, ['heartRateVariabilityMillis', 'rmssd', 'value'], ['value']),
        },
    },
    {
        match: /resting.*heart|heartrate.*rest/i,
        ext: {
            metric: 'resting_heart_rate',
            unit: 'bpm',
            pick: (rec) => nestedNumber(rec, ['beatsPerMinute', 'bpm', 'value'], ['value', 'bpm']),
        },
    },
    {
        match: /heart.?rate|heartrate/i,
        ext: {
            metric: 'heart_rate',
            unit: 'bpm',
            pick: (rec) => nestedNumber(rec, ['beatsPerMinute', 'bpm', 'samples', 'value'], ['value', 'bpm', 'beatsPerMinute']),
        },
    },
    {
        match: /step/i,
        ext: {
            metric: 'steps',
            unit: 'count',
            pick: (rec) => nestedNumber(rec, ['count', 'steps', 'value'], ['value', 'count']),
        },
    },
    {
        match: /sleep/i,
        ext: {
            metric: 'sleep',
            unit: 's',
            pick: (rec) => {
                const direct = nestedNumber(rec, ['duration', 'durationSeconds'], ['inSeconds', 'seconds', 'value']);
                if (direct != null) return direct;
                const start = parseTime(rec);
                const end = parseEnd(rec);
                if (start != null && end != null && end > start) return (end - start) / 1000;
                return null;
            },
        },
    },
    {
        match: /vo2/i,
        ext: {
            metric: 'vo2max',
            unit: 'ml/kg/min',
            pick: (rec) => nestedNumber(rec, ['vo2MillilitersPerMinuteKilogram', 'vo2Max', 'value'], ['value']),
        },
    },
    {
        match: /body.?fat/i,
        ext: {
            metric: 'body_fat',
            unit: 'fraction',
            pick: (rec) => {
                const pct = nestedNumber(rec, ['percentage', 'bodyFat'], ['value']);
                if (pct == null) return null;
                return pct > 1 ? pct / 100 : pct;
            },
        },
    },
    {
        match: /lean/i,
        ext: {
            metric: 'lean_mass',
            unit: 'kg',
            pick: (rec) => nestedNumber(rec, ['mass', 'leanBodyMass', 'value'], ['inKilograms', 'kg', 'value']),
        },
    },
    {
        match: /calor/i,
        ext: {
            metric: 'energy_total',
            unit: 'kcal',
            pick: (rec) => nestedNumber(rec, ['energy', 'calories', 'value'], ['inKilocalories', 'kcal', 'value']),
        },
    },
];

function recordType(rec: Record<string, unknown>): string {
    return asString(rec.recordType) ?? asString(rec.type) ?? asString(rec.dataType) ?? asString(rec.name) ?? '';
}

function firstString(rec: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
        const s = asString(rec[key]);
        if (s) return s;
    }
    return undefined;
}

function firstNumber(rec: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
        const n = asNumber(rec[key]);
        if (n != null) return n;
    }
    return undefined;
}

function parseTime(rec: Record<string, unknown>): number | null {
    const raw = firstString(rec, ['startTime', 'time', 'start', 'timestamp', 'instant', 'date']);
    if (raw) {
        const ms = Date.parse(raw);
        return Number.isFinite(ms) ? ms : null;
    }
    const n = firstNumber(rec, ['startTime', 'time', 'timestamp']);
    if (n == null) return null;
    return n < 1e12 ? n * 1000 : n;
}

function parseEnd(rec: Record<string, unknown>): number | null {
    const raw = asString(rec.endTime) ?? asString(rec.end);
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
}

function originId(rec: Record<string, unknown>, metric: MetricId, t: number, valueSi: number): string {
    const meta = isRecord(rec.metadata) ? asString(rec.metadata.id) : undefined;
    return asString(rec.id) ?? asString(rec.uid) ?? meta ?? `${metric}:${t}:${valueSi}`;
}

function collectKeyedRecords(payload: Record<string, unknown>): unknown[] {
    const out: unknown[] = [];
    for (const [key, value] of Object.entries(payload)) {
        if (!Array.isArray(value)) continue;
        for (const item of value) {
            if (isRecord(item) && !item.recordType && !item.type) out.push({...item, recordType: key});
            else out.push(item);
        }
    }
    return out;
}

function isSingleRecord(payload: Record<string, unknown>): boolean {
    return !!(payload.recordType || payload.type || payload.startTime || payload.weight);
}

function recordsFrom(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    if (!isRecord(payload)) return [];
    if (Array.isArray(payload.records)) return payload.records;
    if (Array.isArray(payload.data)) return payload.data;
    const keyed = collectKeyedRecords(payload);
    if (keyed.length) return keyed;
    return isSingleRecord(payload) ? [payload] : [];
}

function extractorFor(typeName: string): Extractor | null {
    for (const row of EXTRACTORS) {
        if (row.match.test(typeName)) return row.ext;
    }
    return null;
}

function recordToSample(item: unknown): Sample | ParseSkip {
    if (!isRecord(item)) return {line: String(item), reason: 'not an object'};
    const typeName = recordType(item);
    const ext = extractorFor(typeName);
    if (!ext) return {line: typeName || JSON.stringify(item).slice(0, 80), reason: 'unknown record type'};
    const t = parseTime(item);
    if (t == null) return {line: typeName, reason: 'missing time'};
    const raw = ext.pick(item);
    if (raw == null) return {line: typeName, reason: 'missing value'};
    const valueSi = ext.metric === 'body_fat' ? raw : toSi(ext.metric, raw, ext.unit);
    if (valueSi == null) return {line: typeName, reason: 'unit conversion failed'};
    return {metric: ext.metric, t, valueSi, source: 'health-connect', originId: originId(item, ext.metric, t, valueSi)};
}

export function parseHealthConnectJson(payload: unknown): ParseResult {
    const skipped: ParseSkip[] = [];
    const samples: Sample[] = [];
    const records = recordsFrom(payload);
    if (!records.length) return {samples, skipped: [{line: '', reason: 'no records'}], format: 'health-connect'};
    for (const item of records) {
        const parsed = recordToSample(item);
        if ('reason' in parsed) skipped.push(parsed);
        else samples.push(parsed);
    }
    return {samples, skipped, format: 'health-connect'};
}

export function looksLikeHealthConnect(text: string): boolean {
    const head = text.trimStart().slice(0, 400);
    if (head.startsWith('{') || head.startsWith('[')) {
        return /recordType|WeightRecord|HeartRate|startTime|inKilograms/i.test(head) || head.startsWith('[') || head.startsWith('{');
    }
    return false;
}
