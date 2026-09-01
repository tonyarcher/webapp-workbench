import type {CalEvent} from './types';
import {asArray, fnv1a64, isRecord} from './util';

export const DEFAULT_NETFLIX_MINUTES = 60;
const DAY_MS = 86_400_000;

export interface NetflixSkipped {
    line: string;
    reason: 'no-date' | 'no-title' | 'garbage';
}

export interface NetflixParseResult {
    events: CalEvent[];
    skipped: NetflixSkipped[];
}

const TITLE_KEYS = ['title', 'name', 'video title', 'show title'];
const DATE_KEYS = ['date', 'playback date', 'start time', 'watchdate', 'vieweddate', 'utc'];

/** Parse ISO, YYYY-MM-DD, or M/D/YYYY as UTC so tests are timezone-stable. */
export function parseFlexibleDate(raw: string): {ms: number; hasTime: boolean} | null {
    const s = raw.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/.exec(s);
    if (iso) {
        const year = Number(iso[1]);
        const month = Number(iso[2]) - 1;
        const day = Number(iso[3]);
        const hasTime = iso[4] !== undefined;
        const hour = iso[4] ? Number(iso[4]) : 0;
        const minute = iso[5] ? Number(iso[5]) : 0;
        const second = iso[6] ? Number(iso[6]) : 0;
        return {ms: Date.UTC(year, month, day, hour, minute, second), hasTime};
    }
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
    if (us) {
        let year = Number(us[3]);
        if (year < 100) year += 2000;
        return {ms: Date.UTC(year, Number(us[1]) - 1, Number(us[2])), hasTime: false};
    }
    return null;
}

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

function finalizeCsv(rows: string[][], row: string[], cell: string): string[][] {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
    return rows;
}

export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let i = 0;
    let inQuotes = false;
    while (i < text.length) {
        if (inQuotes) {
            const res = stepQuoted(text, i, cell);
            cell = res.cell;
            i = res.next;
            inQuotes = res.inQuotes;
            continue;
        }
        const res = stepUnquoted(text, i, cell, row, rows);
        if (res) {
            cell = res.cell;
            row = res.row;
            i = res.next;
            inQuotes = res.inQuotes;
            continue;
        }
        cell += text[i] ?? '';
        i++;
    }
    return finalizeCsv(rows, row, cell);
}

function pickField(record: Record<string, unknown>, names: string[]): string | undefined {
    const lower = new Map(Object.keys(record).map((key) => [key.toLowerCase(), key]));
    for (const name of names) {
        const key = lower.get(name);
        if (key === undefined) continue;
        const value = record[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return undefined;
}

function toEvent(title: string, dateRaw: string): CalEvent | null {
    const parsed = parseFlexibleDate(dateRaw);
    if (!parsed) return null;
    const uid = `cal-sync:netflix:${fnv1a64(`${title}|${dateRaw}`)}`;
    if (parsed.hasTime) {
        return {
            uid,
            source: 'netflix',
            title,
            start: parsed.ms,
            end: parsed.ms + DEFAULT_NETFLIX_MINUTES * 60_000,
            allDay: false,
        };
    }
    return {
        uid,
        source: 'netflix',
        title,
        start: parsed.ms,
        end: parsed.ms + DAY_MS,
        allDay: true,
    };
}

function fromRecord(record: Record<string, unknown>): {event: CalEvent} | {skipped: NetflixSkipped} {
    const title = pickField(record, TITLE_KEYS);
    const dateRaw = pickField(record, DATE_KEYS);
    if (!title) return {skipped: {line: JSON.stringify(record), reason: 'no-title'}};
    if (!dateRaw) return {skipped: {line: title, reason: 'no-date'}};
    const event = toEvent(title, dateRaw);
    if (!event) return {skipped: {line: `${title},${dateRaw}`, reason: 'no-date'}};
    return {event};
}

function fromRecords(records: unknown[]): NetflixParseResult {
    const events: CalEvent[] = [];
    const skipped: NetflixSkipped[] = [];
    for (const item of records) {
        if (!isRecord(item)) {
            skipped.push({line: String(item), reason: 'garbage'});
            continue;
        }
        const result = fromRecord(item);
        if ('event' in result) events.push(result.event);
        else skipped.push(result.skipped);
    }
    return {events, skipped};
}

function recordsFromJson(data: unknown): unknown[] | null {
    const direct = asArray(data);
    if (direct) return direct;
    if (!isRecord(data)) return null;
    for (const value of Object.values(data)) {
        const arr = asArray(value);
        if (arr && arr.some(isRecord)) return arr;
    }
    return null;
}

function resolveCsvColumns(rows: string[][]): {titleCol: number; dateCol: number; startRow: number} {
    const header = rows[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
    const titleIdx = header.findIndex((cell) => TITLE_KEYS.includes(cell));
    const dateIdx = header.findIndex((cell) => DATE_KEYS.includes(cell) || cell.includes('date'));
    if (titleIdx >= 0) return {titleCol: titleIdx, dateCol: dateIdx >= 0 ? dateIdx : 1, startRow: 1};
    const first = rows[0];
    if (first) {
        const dateInFirst = first.findIndex((cell) => parseFlexibleDate(cell) !== null);
        if (dateInFirst >= 0) return {titleCol: dateInFirst === 0 ? 1 : 0, dateCol: dateInFirst, startRow: 0};
    }
    return {titleCol: 0, dateCol: 1, startRow: 0};
}

function rowToResult(row: string[], titleCol: number, dateCol: number): {event: CalEvent} | {skipped: NetflixSkipped} {
    const title = (row[titleCol] ?? '').trim();
    const dateRaw = (row[dateCol] ?? '').trim();
    const line = row.join(',');
    if (!title) return {skipped: {line, reason: 'no-title'}};
    if (!dateRaw) return {skipped: {line: title, reason: 'no-date'}};
    const event = toEvent(title, dateRaw);
    if (!event) return {skipped: {line, reason: 'no-date'}};
    return {event};
}

function collectCsvEvents(rows: string[][], titleCol: number, dateCol: number, startRow: number): NetflixParseResult {
    const events: CalEvent[] = [];
    const skipped: NetflixSkipped[] = [];
    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const res = rowToResult(row, titleCol, dateCol);
        if ('event' in res) events.push(res.event);
        else skipped.push(res.skipped);
    }
    return {events, skipped};
}

function parseCsvExport(text: string): NetflixParseResult {
    const rows = parseCsv(text);
    if (rows.length === 0) return {events: [], skipped: []};
    const cols = resolveCsvColumns(rows);
    return collectCsvEvents(rows, cols.titleCol, cols.dateCol, cols.startRow);
}

export function parseNetflixExport(text: string): NetflixParseResult {
    const trimmed = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const sliced = trimmed.trim();
    if (!sliced) return {events: [], skipped: []};
    if (sliced.startsWith('{') || sliced.startsWith('[')) {
        try {
            const data: unknown = JSON.parse(sliced);
            const records = recordsFromJson(data);
            if (records) return fromRecords(records);
        } catch {
            return {events: [], skipped: [{line: sliced.slice(0, 80), reason: 'garbage'}]};
        }
        return {events: [], skipped: [{line: sliced.slice(0, 80), reason: 'garbage'}]};
    }
    return parseCsvExport(sliced);
}
