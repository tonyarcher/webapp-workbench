import { safeHttpUrl } from './url';

export type VideoProvider = 'youtube' | 'vimeo' | 'direct';

export interface ArticleVideo {
    provider: VideoProvider;
    /** Canonical embed/player URL (iframe src for youtube/vimeo, file URL for direct). */
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
    ];
}

export function youtubeEmbedUrl(id: string): string {
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

export function vimeoEmbedUrl(id: string): string {
    return `https://player.vimeo.com/video/${id}?autoplay=1`;
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
            embedUrl: youtubeEmbedUrl(yt),
            posters: youtubeThumbs(yt),
            label: 'YouTube video',
        };
    }
    const vimeo = parseVimeoId(safe);
    if (vimeo) {
        return {
            provider: 'vimeo',
            embedUrl: vimeoEmbedUrl(vimeo),
            posters: [],
            label: 'Vimeo video',
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
