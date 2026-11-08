import { safeHttpUrl } from './url';

export function firstImageUrl(html: string | undefined, base?: string): string | undefined {
    if (!html) return undefined;
    const patterns: RegExp[] = [
        /<img[^>]+(?:data-srcset|data-original-src|data-lazy-src|data-original|data-src|data-url|data-image|data-thumb)=["']([^"']+)["']/i,
        /<img[^>]+src=["']([^"']+)["']/i,
        /<img[^>]+srcset=["']([^"']+)["']/i,
        /<source[^>]+srcset=["']([^"']+)["']/i,
        /<video[^>]+poster=["']([^"']+)["']/i,
    ];
    for (const re of patterns) {
        const m = re.exec(html);
        if (!m) continue;
        const raw = m[1]?.trim();
        if (!raw) continue;
        const isSrcset = re.source.includes('srcset');
        let candidate: string | undefined;
        if (isSrcset) {
            let best = 0;
            let bestUrl: string | undefined;
            for (const part of raw.split(',')) {
                const tokens = part.trim().split(/\s+/);
                const url = tokens[0];
                if (!url) continue;
                const desc = tokens[1] ?? '';
                const w = /^(\d+)w$/i.exec(desc)?.[1];
                const x = /^(\d+(?:\.\d+)?)x$/i.exec(desc)?.[1];
                const score = w ? Number(w) : x ? Math.round(Number(x) * 1000) : 0;
                if (score >= best) {
                    best = score;
                    bestUrl = url;
                }
            }
            candidate = bestUrl ?? raw.split(',')[0]?.trim().split(/\s+/)[0];
        } else {
            candidate = raw;
        }
        if (!candidate) continue;
        const resolved = resolveUrl(candidate, base);
        const safe = safeHttpUrl(resolved);
        if (safe) return safe;
    }
    return undefined;
}

function resolveUrl(url: string, base?: string): string | undefined {
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (!base) return undefined;
    try {
        return new URL(trimmed, base).href;
    } catch {
        return undefined;
    }
}

export function faviconUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
        return `${u.origin}/favicon.ico`;
    } catch {
        return undefined;
    }
}

export function cardPlaceholderStyle(article: { id: string; title: string }): string {
    let h = 0;
    const seed = article.id || article.title;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const hue2 = (hue + 42) % 360;
    return `background: linear-gradient(135deg, hsl(${hue}, 32%, 86%), hsl(${hue2}, 38%, 74%));`;
}

export function articleImage(
    article: { content?: string | undefined; link?: string | undefined } & { image?: string | undefined },
    feedIcon?: string,
): string | undefined {
    const fromContent = firstImageUrl(article.content, article.link);
    if (fromContent) return fromContent;
    const fromImage = safeHttpUrl((article as { image?: string }).image);
    if (fromImage) return fromImage;
    if (feedIcon) {
        const safe = safeHttpUrl(feedIcon);
        if (safe) return safe;
    }
    return faviconUrl(article.link);
}
