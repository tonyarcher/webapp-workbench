import { safeUrl } from 'vertical-scroll-component';

export interface OEmbedInfo {
    author?: string;
    authorName?: string;
    title?: string;
    pageUrl?: string;
    thumbnailUrl?: string;
}

/**
 * TikTok's oEmbed endpoint accepts a dummy `/@x/video/{id}` cite and now
 * returns only the iframe html: `author_unique_id`, `author_name`, `title`,
 * and `thumbnail_url` are gone, so a null result is the common case. The
 * player's own items API still carries them, but it sends no CORS header, so
 * the gateway proxies it under the app's base path (`meta/<id>`).
 */
const OEMBED_TIMEOUT_MS = 8_000;

function combinedSignal(signal: AbortSignal | undefined): AbortSignal {
    const timeout = AbortSignal.timeout(OEMBED_TIMEOUT_MS);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function extractString(data: Record<string, unknown>, key: string): string | undefined {
    const v = data[key];
    return typeof v === 'string' && v ? v : undefined;
}

function safeString(raw: unknown): string | undefined {
    return typeof raw === 'string' ? (safeUrl(raw) ?? undefined) : undefined;
}

function firstUrl(cover: Record<string, unknown> | null): string | undefined {
    const list = cover?.['url_list'];
    if (!Array.isArray(list)) return undefined;
    for (const entry of list) {
        const url = safeString(entry);
        if (url) return url;
    }
    return undefined;
}

/** Drops empty fields so a payload with nothing usable becomes null. */
function collectInfo(fields: ReadonlyArray<readonly [keyof OEmbedInfo, string | undefined]>): OEmbedInfo | null {
    const info: OEmbedInfo = {};
    for (const [key, value] of fields) {
        if (value) info[key] = value;
    }
    return Object.keys(info).length > 0 ? info : null;
}

function pageUrlFor(id: string, author: string | undefined): string | undefined {
    return author ? `https://www.tiktok.com/@${author}/video/${id}` : undefined;
}

function buildInfo(id: string, data: Record<string, unknown>): OEmbedInfo | null {
    const author = extractString(data, 'author_unique_id');
    return collectInfo([
        ['author', author],
        ['authorName', extractString(data, 'author_name')],
        ['title', extractString(data, 'title')],
        ['pageUrl', pageUrlFor(id, author)],
        ['thumbnailUrl', safeString(data['thumbnail_url'])],
    ]);
}

/** The player items payload (`author_info`, `desc`, `video_info.cover`). */
export function playerInfoFromPayload(id: string, payload: unknown): OEmbedInfo | null {
    const record = asRecord(payload);
    const items = record?.['items'];
    const item = Array.isArray(items) ? asRecord(items[0]) : null;
    if (!item) return null;
    const authorInfo = asRecord(item['author_info']);
    const video = asRecord(item['video_info']);
    const cover = asRecord(video?.['origin_cover']) ?? asRecord(video?.['cover']);
    const author = authorInfo ? extractString(authorInfo, 'unique_id') : undefined;
    return collectInfo([
        ['author', author],
        ['authorName', authorInfo ? extractString(authorInfo, 'nickname') : undefined],
        ['title', extractString(item, 'desc')],
        ['pageUrl', pageUrlFor(id, author)],
        ['thumbnailUrl', firstUrl(cover)],
    ]);
}

/**
 * Only the clip being watched may be probed. A lookahead window used to
 * prefetch neighbors and hammered TikTok when the rail jumped or paged.
 */
export function watchedOEmbedIndex(activeIndex: number, length: number): number | null {
    if (activeIndex < 0 || activeIndex >= length) return null;
    return activeIndex;
}

async function fetchJson(url: string, signal: AbortSignal | undefined): Promise<Record<string, unknown> | null> {
    const response = await fetch(url, { signal: combinedSignal(signal), headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return asRecord(await response.json());
}

export async function resolveTiktokMeta(id: string, signal?: AbortSignal): Promise<OEmbedInfo | null> {
    return playerInfoFromPayload(id, await fetchJson(`meta/${id}`, signal));
}

async function oembedInfo(id: string, signal: AbortSignal | undefined): Promise<OEmbedInfo | null> {
    try {
        const data = await fetchJson(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@x/video/${id}`)}`,
            signal,
        );
        return data ? buildInfo(id, data) : null;
    } catch (err) {
        if (signal?.aborted) throw err;
        return null;
    }
}

export async function resolveTiktokOEmbed(id: string, signal?: AbortSignal): Promise<OEmbedInfo | null> {
    const info = await oembedInfo(id, signal);
    return info ?? resolveTiktokMeta(id, signal);
}
