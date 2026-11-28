import { libraryKey, queryClient } from '../query';

export const APP_BADGE_CAP = 99;

export function totalUnreadFromLibrary(data: { feeds?: Array<{ unread?: number }> } | null | undefined): number {
    if (!data?.feeds) return 0;
    let total = 0;
    for (const feed of data.feeds) total += feed.unread ?? 0;
    return total;
}

export function badgeValue(total: number): number {
    if (total <= 0) return 0;
    return total > APP_BADGE_CAP ? APP_BADGE_CAP : total;
}

export function badgeLabel(total: number): string {
    if (total <= 0) return '';
    return total > APP_BADGE_CAP ? `${APP_BADGE_CAP}+` : String(total);
}

type NavigatorWithBadge = Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
};

function nav(): NavigatorWithBadge | null {
    if (typeof navigator === 'undefined') return null;
    return navigator as NavigatorWithBadge;
}

function supportsBadgeApi(): boolean {
    const n = nav();
    return n !== null && typeof n.setAppBadge === 'function';
}

/**
 * The favicon the page shipped with. Every draw starts from this, never from
 * the previous result, so badges cannot stack and clearing restores the icon.
 */
let pristineFavicon: string | null = null;
/** Image loads finish out of order; only the newest call may touch the link. */
let faviconDraw = 0;

function faviconLink(): HTMLLinkElement | null {
    if (typeof document === 'undefined') return null;
    return document.querySelector<HTMLLinkElement>("link[rel~='icon']");
}

function pristineFaviconHref(link: HTMLLinkElement): string {
    if (pristineFavicon === null) pristineFavicon = link.href;
    return pristineFavicon;
}

function drawFaviconBadge(total: number): void {
    const link = faviconLink();
    if (!link?.href) return;
    const draw = ++faviconDraw;
    if (total <= 0) {
        link.href = pristineFaviconHref(link);
        return;
    }
    const source = pristineFaviconHref(link);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        if (draw !== faviconDraw) return;
        try {
            const size = 64;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, size, size);
            const r = 16;
            const cx = size - r - 2;
            const cy = r + 2;
            ctx.fillStyle = '#d33';
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeLabel(total), cx, cy);
            link.href = canvas.toDataURL('image/png');
        } catch {
            // CORS or canvas taint: leave the favicon alone.
        }
    };
    img.src = source;
}

export async function applyAppBadge(total: number): Promise<void> {
    const n = nav();
    if (!n) return;
    try {
        if (total <= 0) {
            if (n.clearAppBadge) await n.clearAppBadge();
            else if (n.setAppBadge) await n.setAppBadge(0);
        } else if (n.setAppBadge) {
            await n.setAppBadge(badgeValue(total));
        }
    } catch {
        // Some browsers reject when the page is not installed; ignore.
    }
    if (!supportsBadgeApi()) drawFaviconBadge(total);
}

let started = false;
let unsubscribe: (() => void) | null = null;

export function startAppBadge(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        const ev = event as { query?: { queryKey?: readonly unknown[] } } | undefined;
        if (ev?.query?.queryKey?.[0] !== libraryKey[0]) return;
        const data = queryClient.getQueryData(libraryKey) as { feeds?: Array<{ unread?: number }> } | undefined;
        void applyAppBadge(totalUnreadFromLibrary(data));
    });
    const data = queryClient.getQueryData(libraryKey) as { feeds?: Array<{ unread?: number }> } | undefined;
    void applyAppBadge(totalUnreadFromLibrary(data));
}

export function stopAppBadge(): void {
    if (!started) return;
    started = false;
    unsubscribe?.();
    unsubscribe = null;
}

/** Force a recompute from the current library cache (e.g. after all-read). */
export function refreshAppBadge(): void {
    const data = queryClient.getQueryData(libraryKey) as { feeds?: Array<{ unread?: number }> } | undefined;
    void applyAppBadge(totalUnreadFromLibrary(data));
}

export async function clearAppBadge(): Promise<void> {
    await applyAppBadge(0);
}
