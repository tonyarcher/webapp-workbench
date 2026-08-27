import {joinUrl} from 'calendar-core';

export function traktProxyUrl(baseUrl: string): string {
    return joinUrl(baseUrl, 'api/trakt');
}
