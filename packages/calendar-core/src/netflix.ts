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

export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let i = 0;
    let inQuotes = false;
    while (i < text.length) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i++;
                continue;
            }
            cell += c;
            i++;
            continue;
        }
        if (c === '"') {
            inQuotes = true;
            i++;
            continue;
        }
        if (c === ',') {
            row.push(cell);
            cell = '';
            i++;
            continue;
        }
        if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cell);
            cell = '';
            if (row.some((value) => value.length > 0)) rows.push(row);
            row = [];
            i++;
            continue;
        }
        cell += c;
        i++;
    }
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
    return rows;
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

function parseCsvExport(text: string): NetflixParseResult {
    const rows = parseCsv(text);
    if (rows.length === 0) return {events: [], skipped: []};
    const header = rows[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
    const titleIdx = header.findIndex((cell) => TITLE_KEYS.includes(cell));
    const dateIdx = header.findIndex((cell) => DATE_KEYS.includes(cell) || cell.includes('date'));
    const hasHeader = titleIdx >= 0;
    let titleCol = 0;
    let dateCol = 1;
    let startRow = 0;
    if (hasHeader) {
        titleCol = titleIdx;
        dateCol = dateIdx >= 0 ? dateIdx : 1;
        startRow = 1;
    } else if (rows[0]) {
        const dateInFirst = rows[0].findIndex((cell) => parseFlexibleDate(cell) !== null);
        if (dateInFirst >= 0) {
            dateCol = dateInFirst;
            titleCol = dateInFirst === 0 ? 1 : 0;
        }
    }
    const events: CalEvent[] = [];
    const skipped: NetflixSkipped[] = [];
    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const title = (row[titleCol] ?? '').trim();
        const dateRaw = (row[dateCol] ?? '').trim();
        const line = row.join(',');
        if (!title) {
            skipped.push({line, reason: 'no-title'});
            continue;
        }
        if (!dateRaw) {
            skipped.push({line: title, reason: 'no-date'});
            continue;
        }
        const event = toEvent(title, dateRaw);
        if (!event) skipped.push({line, reason: 'no-date'});
        else events.push(event);
    }
    return {events, skipped};
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
