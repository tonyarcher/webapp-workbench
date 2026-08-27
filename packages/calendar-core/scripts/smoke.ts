import type {CalEvent, FetchLike, WriteResult} from '../src/types';
import {escapeText, eventsToIcs, foldLine, formatUtcDate, formatUtcStamp} from '../src/ics';
import {dedupEvents} from '../src/dedup';
import {collectEvents, writeEvents} from '../src/sync';
import {fnv1a, joinUrl, utf8ByteLength} from '../src/util';
import {
    calendarShowsPath,
    calendarWindows,
    mapCalendarMovie,
    mapCalendarShow,
    mapHistoryItem,
    parseDeviceCodeResponse,
    parseDevicePollResponse,
    parseTokenResponse,
    traktHeaders,
} from '../src/trakt';
import {parseCsv, parseFlexibleDate, parseNetflixExport} from '../src/netflix';
import {eventToGoogleBody, googleInsertEvent} from '../src/google-calendar';

function assert(cond: unknown, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`);
}

const sample: CalEvent = {
    uid: 'cal-sync:trakt:air:show:1:s1e1',
    source: 'trakt',
    title: 'Show S01E01: Hello, world',
    start: Date.UTC(2026, 0, 15, 2, 0, 0),
    end: Date.UTC(2026, 0, 15, 3, 0, 0),
    allDay: false,
    description: 'Line 1\nLine 2',
    url: 'https://trakt.tv/shows/show',
};

// ICS escape
assert(escapeText('Hello, world; yes\\no') === 'Hello\\, world\\; yes\\\\no', 'escape comma semi backslash');
assert(escapeText('a\nb') === 'a\\nb', 'escape newline');

// ICS timestamps
assert(formatUtcStamp(Date.UTC(2026, 0, 15, 2, 3, 4)) === '20260115T020304Z', 'utc stamp');
assert(formatUtcDate(Date.UTC(2026, 0, 15)) === '20260115', 'utc date');

// Fold at 75 octets; continuation starts with space
{
    const long = 'SUMMARY:' + 'a'.repeat(80);
    const folded = foldLine(long);
    assert(folded.includes('\r\n '), 'fold uses CRLF space');
    const first = folded.split('\r\n')[0] ?? '';
    assert(utf8ByteLength(first) <= 75, 'first fold line <= 75 octets');
}

// Unicode fold does not split a code point
{
    const line = 'SUMMARY:' + 'é'.repeat(40);
    const folded = foldLine(line);
    assert(!folded.includes('�'), 'no replacement char');
    assert(folded.includes('é'), 'keeps accented char');
}

// ICS document
{
    const ics = eventsToIcs([sample], 'Calendar Sync', Date.UTC(2026, 5, 1, 12, 0, 0));
    assert(ics.startsWith('BEGIN:VCALENDAR'), 'begins vcalendar');
    assert(ics.includes('UID:cal-sync:trakt:air:show:1:s1e1'), 'uid');
    assert(ics.includes('DTSTART:20260115T020000Z'), 'dtstart utc');
    assert(ics.includes('DTEND:20260115T030000Z'), 'dtend utc');
    assert(ics.includes('SUMMARY:Show S01E01: Hello\\, world'), 'summary escaped');
    assert(ics.includes('DESCRIPTION:Line 1\\nLine 2'), 'description escaped');
    assert(ics.includes('CATEGORIES:trakt'), 'category');
    assert(ics.includes('DTSTAMP:20260601T120000Z'), 'dtstamp from now arg');
    assert(ics.includes('\r\n'), 'CRLF line endings');
}

{
    const allDay: CalEvent = {
        uid: 'cal-sync:netflix:abc',
        source: 'netflix',
        title: 'Film',
        start: Date.UTC(2026, 0, 15),
        end: Date.UTC(2026, 0, 16),
        allDay: true,
    };
    const ics = eventsToIcs([allDay], 'X', 0);
    assert(ics.includes('DTSTART;VALUE=DATE:20260115'), 'all-day start');
    assert(ics.includes('DTEND;VALUE=DATE:20260116'), 'all-day exclusive end');
}

// joinUrl
assert(joinUrl('./', 'api/trakt') === './api/trakt', 'join ./');
assert(joinUrl('/calendar-sync/', 'api/trakt') === '/calendar-sync/api/trakt', 'join subpath');
assert(joinUrl('https://api.trakt.tv', '/calendars/my/shows') === 'https://api.trakt.tv/calendars/my/shows', 'join host');
assert(fnv1a('a') !== fnv1a('b'), 'fnv distinct');

// Trakt mappers
{
    const show = mapCalendarShow({
        first_aired: '2026-01-15T02:00:00.000Z',
        episode: {season: 1, number: 2, title: 'Pilot', runtime: 45, ids: {trakt: 99}},
        show: {title: 'Severance', ids: {trakt: 7, slug: 'severance'}, runtime: 50},
    });
    assert(show !== null, 'map show');
    assert(show?.uid === 'cal-sync:trakt:air:show:7:s1e2', 'show uid');
    assert(show?.title === 'Severance S01E02: Pilot', 'show title');
    assert(show?.end === Date.UTC(2026, 0, 15, 2, 45, 0), 'show runtime 45m');
    assert(show?.url === 'https://trakt.tv/shows/severance/seasons/1/episodes/2', 'show url');
    assert(mapCalendarShow({}) === null, 'empty show skipped');
    assert(mapCalendarShow({first_aired: 'nope', episode: {}, show: {}}) === null, 'bad air skipped');
}

{
    const movie = mapCalendarMovie({
        released: '2026-02-01',
        movie: {title: 'Dune', year: 2026, ids: {trakt: 5, slug: 'dune-2026'}, runtime: 180},
    });
    assert(movie !== null, 'map movie');
    assert(movie?.allDay === true, 'movie all-day');
    assert(movie?.uid === 'cal-sync:trakt:air:movie:5:2026-02-01', 'movie uid');
    assert(movie?.title === 'Dune (2026)', 'movie title year');
}

{
    const watched = mapHistoryItem({
        watched_at: '2026-01-15T02:00:00.000Z',
        type: 'episode',
        episode: {season: 2, number: 3, title: 'Hi', runtime: 30, ids: {trakt: 1}},
        show: {title: 'Show', ids: {trakt: 8, slug: 'show'}},
    });
    assert(watched?.uid === `cal-sync:trakt:watch:show:8:s2e3:${Date.UTC(2026, 0, 15, 2, 0, 0)}`, 'watch uid includes time');
    assert(watched?.description === 'Watched', 'watch description');
}

{
    const headers = traktHeaders('cid', 'tok');
    assert(headers['trakt-api-key'] === 'cid', 'trakt key header');
    assert(headers.Authorization === 'Bearer tok', 'trakt bearer');
    assert(calendarShowsPath('2026-01-01', 7) === '/calendars/my/shows/2026-01-01/7', 'shows path');
}

{
    const windows = calendarWindows(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 40), 33);
    assert(windows.length === 2, 'two calendar windows');
    assert(windows[0]?.days === 33, 'first window 33 days');
    assert(windows[0]?.start === '2026-01-01', 'first window start');
}

{
    const code = parseDeviceCodeResponse({
        device_code: 'dev',
        user_code: 'ABCD',
        verification_url: 'https://trakt.tv/activate',
        expires_in: 600,
        interval: 5,
    });
    assert(code?.userCode === 'ABCD', 'device user code');
    const token = parseTokenResponse({
        access_token: 'a',
        refresh_token: 'r',
        expires_in: 86_400,
        created_at: 1,
    });
    assert(token?.accessToken === 'a' && token.refreshToken === 'r', 'token parse');
    assert(parseDevicePollResponse(400, {error: 'pending'}).status === 'pending', 'poll pending');
    assert(parseDevicePollResponse(400, {error: 'slow_down'}).status === 'slow_down', 'poll slow_down');
    assert(parseDevicePollResponse(200, {access_token: 'a', refresh_token: 'r', expires_in: 1}).status === 'token', 'poll token');
}

// Netflix CSV
{
    const csv = parseNetflixExport('Title,Date\n"The Crown: Season 1: Windsor","1/15/2024"\nNoDateRow,\n,1/1/2024');
    assert(csv.events.length === 1, 'csv one event');
    assert(csv.events[0]?.title === 'The Crown: Season 1: Windsor', 'csv title');
    assert(csv.events[0]?.allDay === true, 'csv all-day');
    assert(csv.events[0]?.start === Date.UTC(2024, 0, 15), 'csv date utc');
    assert(csv.skipped.some((s) => s.reason === 'no-date'), 'csv no-date skipped');
    assert(csv.skipped.some((s) => s.reason === 'no-title'), 'csv no-title skipped');
}

{
    const quoted = parseCsv('"Foo, Bar",1/15/2024');
    assert(quoted[0]?.[0] === 'Foo, Bar', 'quoted csv comma');
}

{
    const json = parseNetflixExport(
        JSON.stringify([{title: 'Stranger Things', date: '2024-06-07T01:25:56Z'}]),
    );
    assert(json.events.length === 1, 'json one event');
    assert(json.events[0]?.allDay === false, 'json timed');
    assert(json.events[0]?.title === 'Stranger Things', 'json title');
}

{
    const wrapped = parseNetflixExport(JSON.stringify({viewedItems: [{Title: 'Film', Date: '2024-01-02'}]}));
    assert(wrapped.events.length === 1, 'wrapped json array');
    assert(wrapped.events[0]?.title === 'Film', 'wrapped title');
}

{
    const garbage = parseNetflixExport('{not json');
    assert(garbage.events.length === 0, 'garbage json no events');
    assert(garbage.skipped[0]?.reason === 'garbage', 'garbage skipped');
}

{
    const parsed = parseFlexibleDate('2024-01-15');
    assert(parsed?.ms === Date.UTC(2024, 0, 15) && parsed.hasTime === false, 'ymd no time');
    assert(parseFlexibleDate('nope') === null, 'bad date');
}

// Dedup keeps first
{
    const a: CalEvent = {...sample, uid: 'x', title: 'first'};
    const b: CalEvent = {...sample, uid: 'x', title: 'second'};
    const c: CalEvent = {...sample, uid: 'y', title: 'other'};
    const out = dedupEvents([a, b, c]);
    assert(out.length === 2, 'dedup length');
    assert(out[0]?.title === 'first', 'dedup keeps first');
}

// Google body
{
    const body = eventToGoogleBody(sample);
    assert(body.iCalUID === sample.uid, 'google ical uid');
    assert(body.summary === sample.title, 'google summary');
    assert('dateTime' in body.start && body.start.dateTime === '2026-01-15T02:00:00.000Z', 'google start');
    const day = eventToGoogleBody({
        uid: 'd',
        source: 'netflix',
        title: 'D',
        start: Date.UTC(2026, 0, 15),
        end: Date.UTC(2026, 0, 16),
        allDay: true,
    });
    assert('date' in day.start && day.start.date === '2026-01-15', 'google all-day start');
    assert('date' in day.end && day.end.date === '2026-01-16', 'google all-day end');
}

// Google insert 409 → exists
{
    const calls: string[] = [];
    const fakeFetch: FetchLike = async (url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        return {
            ok: false,
            status: 409,
            headers: {get: () => null},
            json: async () => ({}),
            text: async () => '',
        };
    };
    const result = await googleInsertEvent(fakeFetch, 'tok', 'cal', eventToGoogleBody(sample), 'https://example.test');
    assert(result === 'exists', '409 is exists');
    assert(calls[0]?.startsWith('POST https://example.test/calendars/cal/events'), 'insert url');
}

{
    const fakeFetch: FetchLike = async () => ({
        ok: false,
        status: 500,
        headers: {get: () => null},
        json: async () => ({}),
        text: async () => '',
    });
    assert((await googleInsertEvent(fakeFetch, 't', 'c', eventToGoogleBody(sample))) === 'fail', '500 is fail');
}

// Sync progress
{
    const events: CalEvent[] = [
        {...sample, uid: '1', title: 'a'},
        {...sample, uid: '2', title: 'b'},
        {...sample, uid: '3', title: 'c'},
    ];
    const snapshots: Array<{done: number; failed?: number}> = [];
    const result = await writeEvents({
        events,
        writtenUids: new Set(['1']),
        writeOne: async (event): Promise<WriteResult> => (event.uid === '3' ? 'fail' : 'ok'),
        onProgress: (p) => snapshots.push({done: p.done, failed: p.failed}),
    });
    assert(result.done === 2, 'two succeeded (skip + ok)');
    assert(result.failed === 1, 'one failed');
    assert(result.newUids.join(',') === '2', 'only new uid');
    const last = snapshots[snapshots.length - 1];
    assert(last?.done === 3, 'progress done reaches total');
    assert(last?.failed === 1, 'progress failed count');
}

{
    const collected = await collectEvents([
        async () => [{...sample, uid: 'a'}],
        async () => [{...sample, uid: 'b'}],
    ]);
    assert(collected.length === 2, 'collect both loaders');
}

console.log('smoke.ts: all assertions passed');

export {};
