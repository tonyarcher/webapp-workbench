export type {
    CalEvent,
    FetchLike,
    SourceId,
    SyncPhase,
    SyncProgress,
    WriteResult,
} from './types';

export {escapeText, eventsToIcs, foldLine, formatUtcDate, formatUtcStamp} from './ics';
export {dedupEvents} from './dedup';
export {collectEvents, writeEvents} from './sync';
export {joinUrl, fnv1a, fnv1a64, utcYmd} from './util';

export {
    DEFAULT_CALENDAR_FUTURE_DAYS,
    DEFAULT_CALENDAR_PAST_DAYS,
    DEFAULT_EPISODE_MINUTES,
    DEFAULT_MOVIE_MINUTES,
    TRAKT_API_VERSION,
    TRAKT_HISTORY_MAX_PAGES,
    TRAKT_HISTORY_PAGE_SIZE,
    TRAKT_MAX_CALENDAR_DAYS,
    TRAKT_VERIFICATION_URL,
    TraktHttpError,
    calendarMoviesPath,
    calendarShowsPath,
    calendarWindows,
    deviceCodePath,
    deviceTokenPath,
    fetchTraktEvents,
    historyPath,
    mapCalendarMovie,
    mapCalendarShow,
    mapHistoryItem,
    parseDeviceCodeResponse,
    parseDevicePollResponse,
    parseTokenResponse,
    refreshTokenPath,
    traktHeaders,
} from './trakt';
export type {DevicePollResult, TraktDeviceCode, TraktToken} from './trakt';

export {DEFAULT_NETFLIX_MINUTES, parseCsv, parseFlexibleDate, parseNetflixExport} from './netflix';
export type {NetflixParseResult, NetflixSkipped} from './netflix';

export {
    GOOGLE_CALENDAR_API,
    GOOGLE_CALENDAR_NAME,
    calendarListPath,
    calendarsInsertPath,
    eventToGoogleBody,
    eventsInsertPath,
    findOrCreateCalendar,
    googleInsertEvent,
} from './google-calendar';
export type {GoogleCalendarEvent, GoogleDate, GoogleDateTime} from './google-calendar';
