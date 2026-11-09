import { safeHttpUrl } from './url';

export type VideoProvider = 'youtube' | 'vimeo' | 'dailymotion' | 'tiktok' | 'twitch' | 'rumble' | 'direct';

export interface ArticleVideo {
    provider: VideoProvider;
    /** Player id or slug (video id, clip slug). Absent for direct files. */
    id?: string | undefined;
    /** True when a Twitch id is a clip slug rather than a video id. */
    clip?: boolean | undefined;
    /** Canonical embed/player URL (iframe src for embeds, file URL for direct). */
    embedUrl: string;
    /** Poster candidates, sharpest first. */
    posters: string[];
    /** Stable label for aria-labels. */
    label: string;
}

/** YouTube video id from watch, youtu.be, embed, shorts and live URLs. */
export function parseYouTubeId(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const m = /(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i.exec(url);
    return m?.[1];
}

/** Vimeo video id from vimeo.com and player.vimeo.com URLs. */
export function parseVimeoId(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const m = /(?:vimeo\.com\/(?:video\/)?)(\d{5,})/i.exec(url);
    return m?.[1];
}

function isDirectVideoUrl(url: string): boolean {
    try {
        const path = new URL(url).pathname.toLowerCase();
        return /\.(mp4|webm|ogv|m4v)(\?|#|$)/.test(path);
    } catch {
        return false;
    }
}

export function youtubeThumbs(id: string): string[] {
    return [
        `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    ];
}

export function youtubeEmbedUrl(id: string): string {
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

export function vimeoEmbedUrl(id: string): string {
    return `https://player.vimeo.com/video/${id}?autoplay=1`;
}

export function dailymotionEmbedUrl(id: string): string {
    return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
}

export function dailymotionThumb(id: string): string {
    return `https://www.dailymotion.com/thumbnail/video/${id}`;
}

export function tiktokEmbedUrl(id: string): string {
    return `https://www.tiktok.com/embed/v2/${id}`;
}

export function rumbleEmbedUrl(id: string): string {
    return `https://rumble.com/embed/${id}/`;
}

/**
 * Twitch embeds require the serving host as `parent`, so the URL is built at
 * play time rather than stored. Every other provider keeps its static URL.
 */
export function resolveEmbedUrl(video: ArticleVideo, parent: string): string {
    if (video.provider === 'twitch' && video.id) {
        const key = video.clip ? 'clip' : 'video';
        const value = video.clip ? video.id : `v${video.id}`;
        return `https://player.twitch.tv/?${key}=${value}&autoplay=true&parent=${parent}`;
    }
    return video.embedUrl;
}

/** Dailymotion video id from dailymotion.com and dai.ly URLs. */
export function parseDailymotionId(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const m = /(?:dailymotion\.com\/video\/|dai\.ly\/)([A-Za-z0-9]+)/i.exec(url);
    return m?.[1];
}

/** TikTok video id from watch URLs (short vm.tiktok.com links need a redirect). */
export function parseTikTokId(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const m = /tiktok\.com\/@[^/]+\/video\/(\d+)/i.exec(url);
    return m?.[1];
}

/** Twitch video id or clip slug. */
export function parseTwitch(url: string | undefined): { id: string; clip: boolean } | undefined {
    if (!url) return undefined;
    const video = /twitch\.tv\/videos\/(\d+)/i.exec(url);
    if (video?.[1]) return { id: video[1], clip: false };
    const clip = /(?:clips\.twitch\.tv\/|twitch\.tv\/\w+\/clip\/)([A-Za-z0-9_-]+)/i.exec(url);
    if (clip?.[1]) return { id: clip[1], clip: true };
    return undefined;
}

/** Rumble video id from watch URLs. */
export function parseRumbleId(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const m = /rumble\.com\/(v[a-z0-9]+)(?:-[^/?#]*)?(?:\.html)?/i.exec(url);
    return m?.[1];
}

/**
 * Video behind an article link, if any. Link-derived only: no ingest change,
 * so YouTube/Vimeo/direct-file links work on old and new rows alike. Feed
 * enclosure videos carried in content are out of scope until the API keeps a
 * video field beside media.
 */
export function parseVideo(link: string | undefined): ArticleVideo | undefined {
    if (!link) return undefined;
    const safe = safeHttpUrl(link);
    if (!safe) return undefined;
    const yt = parseYouTubeId(safe);
    if (yt) {
        return {
            provider: 'youtube',
            id: yt,
            embedUrl: youtubeEmbedUrl(yt),
            posters: youtubeThumbs(yt),
            label: 'YouTube video',
        };
    }
    const vimeo = parseVimeoId(safe);
    if (vimeo) {
        return {
            provider: 'vimeo',
            id: vimeo,
            embedUrl: vimeoEmbedUrl(vimeo),
            posters: [],
            label: 'Vimeo video',
        };
    }
    const dm = parseDailymotionId(safe);
    if (dm) {
        return {
            provider: 'dailymotion',
            id: dm,
            embedUrl: dailymotionEmbedUrl(dm),
            posters: [dailymotionThumb(dm)],
            label: 'Dailymotion video',
        };
    }
    const tiktok = parseTikTokId(safe);
    if (tiktok) {
        return {
            provider: 'tiktok',
            id: tiktok,
            embedUrl: tiktokEmbedUrl(tiktok),
            posters: [],
            label: 'TikTok video',
        };
    }
    const twitch = parseTwitch(safe);
    if (twitch) {
        return {
            provider: 'twitch',
            id: twitch.id,
            clip: twitch.clip,
            embedUrl: '',
            posters: [],
            label: 'Twitch video',
        };
    }
    const rumble = parseRumbleId(safe);
    if (rumble) {
        return {
            provider: 'rumble',
            id: rumble,
            embedUrl: rumbleEmbedUrl(rumble),
            posters: [],
            label: 'Rumble video',
        };
    }
    if (isDirectVideoUrl(safe)) {
        return { provider: 'direct', embedUrl: safe, posters: [], label: 'Video' };
    }
    return undefined;
}

/** Video for a card header, derived from the article link. */
export function articleVideo(article: { link?: string | undefined }): ArticleVideo | undefined {
    return parseVideo(article.link);
}
