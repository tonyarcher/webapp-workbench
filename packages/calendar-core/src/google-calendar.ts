import type {CalEvent, FetchLike, WriteResult} from './types';
import {asArray, asString, isRecord, joinUrl, utcYmd} from './util';

export const GOOGLE_CALENDAR_NAME = 'Calendar Sync';
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const DAY_MS = 86_400_000;

export interface GoogleDateTime {
    dateTime: string;
}

export interface GoogleDate {
    date: string;
}

export interface GoogleCalendarEvent {
    iCalUID: string;
    summary: string;
    description?: string;
    location?: string;
    source?: {url: string; title: string};
    start: GoogleDateTime | GoogleDate;
    end: GoogleDateTime | GoogleDate;
}

function googleHeaders(accessToken: string): Record<string, string> {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}

export function eventToGoogleBody(event: CalEvent): GoogleCalendarEvent {
    const body: GoogleCalendarEvent = {
        iCalUID: event.uid,
        summary: event.title,
        start: event.allDay
            ? {date: utcYmd(event.start)}
            : {dateTime: new Date(event.start).toISOString()},
        end: event.allDay
            ? {date: utcYmd(event.end > event.start ? event.end : event.start + DAY_MS)}
            : {dateTime: new Date(event.end).toISOString()},
    };
    if (event.description) body.description = event.description;
    if (event.location) body.location = event.location;
    if (event.url) body.source = {url: event.url, title: event.title};
    return body;
}

export function eventsInsertPath(calendarId: string): string {
    return `/calendars/${encodeURIComponent(calendarId)}/events`;
}

export function calendarListPath(): string {
    return '/users/me/calendarList';
}

export function calendarsInsertPath(): string {
    return '/calendars';
}

export async function googleInsertEvent(
    fetchImpl: FetchLike,
    accessToken: string,
    calendarId: string,
    body: GoogleCalendarEvent,
    apiBase = GOOGLE_CALENDAR_API,
): Promise<WriteResult> {
    const res = await fetchImpl(joinUrl(apiBase, eventsInsertPath(calendarId)), {
        method: 'POST',
        headers: googleHeaders(accessToken),
        body: JSON.stringify(body),
    });
    if (res.status === 409) return 'exists';
    if (res.ok) return 'ok';
    return 'fail';
}

export async function findOrCreateCalendar(
    fetchImpl: FetchLike,
    accessToken: string,
    summary = GOOGLE_CALENDAR_NAME,
    apiBase = GOOGLE_CALENDAR_API,
): Promise<string> {
    const list = await fetchImpl(joinUrl(apiBase, calendarListPath()), {
        method: 'GET',
        headers: googleHeaders(accessToken),
    });
    if (list.ok) {
        let json: unknown;
        try {
            json = await list.json();
        } catch {
            json = undefined;
        }
        const items = isRecord(json) ? asArray(json.items) ?? [] : [];
        for (const item of items) {
            if (!isRecord(item)) continue;
            if (asString(item.summary) === summary) {
                const id = asString(item.id);
                if (id) return id;
            }
        }
    }
    const created = await fetchImpl(joinUrl(apiBase, calendarsInsertPath()), {
        method: 'POST',
        headers: googleHeaders(accessToken),
        body: JSON.stringify({summary}),
    });
    let createdJson: unknown;
    try {
        createdJson = await created.json();
    } catch {
        createdJson = undefined;
    }
    const id = isRecord(createdJson) ? asString(createdJson.id) : undefined;
    if (!created.ok || !id) {
        throw new Error(`Google calendar create failed (${created.status})`);
    }
    return id;
}
