import type {CalEvent} from './types';
import {pad2, utf8ByteLength} from './util';

const CRLF = '\r\n';
const FOLD_LIMIT = 75;
const CONT_LIMIT = 74;

export function escapeText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');
}

/** Fold at 75 octets (74 on continuation lines) per RFC 5545 §3.1. */
export function foldLine(line: string): string {
    const parts: string[] = [];
    let current = '';
    let currentBytes = 0;
    let budget = FOLD_LIMIT;
    for (const ch of line) {
        const chBytes = utf8ByteLength(ch);
        if (currentBytes + chBytes > budget && current.length > 0) {
            parts.push(current);
            current = ch;
            currentBytes = chBytes;
            budget = CONT_LIMIT;
        } else {
            current += ch;
            currentBytes += chBytes;
        }
    }
    if (current.length > 0 || parts.length === 0) parts.push(current);
    return parts.map((part, i) => (i === 0 ? part : ` ${part}`)).join(CRLF);
}

export function formatUtcStamp(ms: number): string {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

export function formatUtcDate(ms: number): string {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function line(name: string, value: string): string {
    return foldLine(`${name}:${value}`);
}

function eventBlock(event: CalEvent, now: number): string {
    const rows = [
        'BEGIN:VEVENT',
        line('UID', event.uid),
        line('DTSTAMP', formatUtcStamp(now)),
    ];
    if (event.allDay) {
        rows.push(line('DTSTART;VALUE=DATE', formatUtcDate(event.start)));
        rows.push(line('DTEND;VALUE=DATE', formatUtcDate(event.end)));
    } else {
        rows.push(line('DTSTART', formatUtcStamp(event.start)));
        rows.push(line('DTEND', formatUtcStamp(event.end)));
    }
    rows.push(line('SUMMARY', escapeText(event.title)));
    if (event.description) rows.push(line('DESCRIPTION', escapeText(event.description)));
    if (event.location) rows.push(line('LOCATION', escapeText(event.location)));
    if (event.url) rows.push(line('URL', event.url));
    rows.push(line('CATEGORIES', event.source));
    rows.push('END:VEVENT');
    return rows.join(CRLF);
}

export function eventsToIcs(
    events: readonly CalEvent[],
    calendarName = 'Calendar Sync',
    now = Date.now(),
): string {
    const blocks = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//webapp-workbench//calendar-core//EN',
        'CALSCALE:GREGORIAN',
        line('X-WR-CALNAME', escapeText(calendarName)),
        ...events.map((event) => eventBlock(event, now)),
        'END:VCALENDAR',
        '',
    ];
    return blocks.join(CRLF);
}
