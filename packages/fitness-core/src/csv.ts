import type {ParseResult, ParseSkip, Sample, SampleSource} from './types';
import {asNumber, parseMetricId, toSi} from './units';

function stepQuoted(text: string, i: number, cell: string): {cell: string; next: number; inQuotes: boolean} {
    const c = text[i];
    if (c === '"') {
        if (text[i + 1] === '"') return {cell: cell + '"', next: i + 2, inQuotes: true};
        return {cell, next: i + 1, inQuotes: false};
    }
    return {cell: cell + (c ?? ''), next: i + 1, inQuotes: true};
}

function stepUnquoted(
    text: string,
    i: number,
    cell: string,
    row: string[],
    rows: string[][],
): {cell: string; row: string[]; next: number; inQuotes: boolean} | null {
    const c = text[i];
    if (c === '"') return {cell, row, next: i + 1, inQuotes: true};
    if (c === ',') {
        row.push(cell);
        return {cell: '', row, next: i + 1, inQuotes: false};
    }
    if (c === '\n' || c === '\r') {
        const skip = c === '\r' && text[i + 1] === '\n' ? 1 : 0;
        row.push(cell);
        if (row.some((value) => value.length > 0)) rows.push(row);
        return {cell: '', row: [], next: i + 1 + skip, inQuotes: false};
    }
    return null;
}

export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        if (inQuotes) {
            const stepped = stepQuoted(text, i, cell);
            cell = stepped.cell;
            i = stepped.next - 1;
            inQuotes = stepped.inQuotes;
            continue;
        }
        const stepped = stepUnquoted(text, i, cell, row, rows);
        if (stepped) {
            cell = stepped.cell;
            row = stepped.row;
            i = stepped.next - 1;
            inQuotes = stepped.inQuotes;
            continue;
        }
        cell += text[i] ?? '';
    }
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
    return rows;
}

function headerIndex(header: string[], ...names: string[]): number {
    const wanted = new Set(names.map((n) => n.toLowerCase()));
    return header.findIndex((h) => wanted.has(h.trim().toLowerCase()));
}

function parseTimestamp(raw: string): number | null {
    const s = raw.trim();
    if (!s) return null;
    const ms = Date.parse(s);
    if (Number.isFinite(ms)) return ms;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!iso) return null;
    return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
}

function originId(metric: string, t: number, valueSi: number, given?: string): string {
    if (given && given.trim()) return given.trim();
    return `${metric}:${t}:${valueSi}`;
}

interface CsvCols {
    metric: number;
    time: number;
    value: number;
    unit: number;
    source: number;
    origin: number;
}

function csvCols(header: string[]): CsvCols | null {
    const metric = headerIndex(header, 'metric', 'type', 'name');
    const time = headerIndex(header, 'timestamp', 'time', 'date', 't');
    const value = headerIndex(header, 'value', 'amount');
    if (metric < 0 || time < 0 || value < 0) return null;
    return {
        metric,
        time,
        value,
        unit: headerIndex(header, 'unit', 'units'),
        source: headerIndex(header, 'source'),
        origin: headerIndex(header, 'origin_id', 'originid', 'id'),
    };
}

function sourceFromCell(raw: string, fallback: SampleSource): SampleSource {
    const s = raw.trim().toLowerCase();
    if (s === 'health-connect' || s === 'manual' || s === 'five31' || s === 'csv') return s;
    return fallback;
}

function cell(row: string[], idx: number): string {
    return idx >= 0 ? (row[idx] ?? '') : '';
}

function skip(line: string, reason: string): ParseSkip {
    return {line, reason};
}

function rowToSample(row: string[], cols: CsvCols, fallback: SampleSource): Sample | ParseSkip {
    const line = row.join(',');
    const metric = parseMetricId(cell(row, cols.metric));
    const t = parseTimestamp(cell(row, cols.time));
    const value = asNumber(cell(row, cols.value));
    if (!metric) return skip(line, 'unknown metric');
    if (t == null) return skip(line, 'bad timestamp');
    if (value == null) return skip(line, 'bad value');
    const valueSi = toSi(metric, value, cell(row, cols.unit));
    if (valueSi == null) return skip(line, 'unknown unit');
    return {
        metric,
        t,
        valueSi,
        source: sourceFromCell(cell(row, cols.source), fallback),
        originId: originId(metric, t, valueSi, cell(row, cols.origin)),
    };
}

/**
 * Canonical sample CSV:
 *   metric,timestamp,value,unit[,source][,origin_id]
 */
export function parseSampleCsv(text: string, defaultSource: SampleSource = 'csv'): ParseResult {
    const rows = parseCsv(text);
    const skipped: ParseSkip[] = [];
    const samples: Sample[] = [];
    if (!rows.length) return {samples, skipped, format: 'csv'};
    const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
    const cols = csvCols(header);
    if (!cols) {
        return {samples, skipped: [{line: header.join(','), reason: 'missing metric,timestamp,value header'}], format: 'csv'};
    }
    for (let r = 1; r < rows.length; r++) {
        const parsed = rowToSample(rows[r] ?? [], cols, defaultSource);
        if ('reason' in parsed) skipped.push(parsed);
        else samples.push(parsed);
    }
    return {samples, skipped, format: 'csv'};
}

export function looksLikeCsv(text: string): boolean {
    const first = text.trimStart().slice(0, 200).split(/\r?\n/, 1)[0] ?? '';
    const lower = first.toLowerCase();
    return lower.includes('metric') && lower.includes(',') && (lower.includes('timestamp') || lower.includes('time') || lower.includes('date'));
}
