import { joinUrl } from '../core/index.js';

export function traktProxyUrl(baseUrl: string): string {
    return joinUrl(baseUrl, 'api/trakt');
}
