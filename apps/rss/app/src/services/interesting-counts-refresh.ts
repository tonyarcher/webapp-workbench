import { libraryKey, queryClient, type LibraryData } from '../query';
import { fetchArticlesPage } from './api';
import { isInterestingHideRead, saveInterestingCount, loadInterestingCount } from './interesting-counts';
import {
    loadInterestingOrder,
    loadInterestingShadow,
    loadInterestingStrictness,
    orderedInterestingFolderIds,
} from './interesting-settings';
import { interestingWordMapOf } from '../web-components/article-list/article-list-interesting';
import { selectInteresting } from './interesting-words';
import { filterMutedArticles, loadMuteRules, type FeedFolderLookup } from './mute-rules';
import type { Article, Feed } from '../types';

const VIEW_SETTINGS_KEY = 'rss-reader:view-settings';
/** Mirrors the Interesting view's page-size options; the badge shows the capped list. */
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZES: readonly number[] = [20, 50, 100, 500];

interface InterestingViewSettings {
    unreadOnly: boolean;
    pageSize: number;
}

interface BatchEntry {
    at: number;
    articles: Article[];
    unreadOnly: boolean;
}

const BATCH_TTL_MS = 45_000;
const DEBOUNCE_MS = 1_500;
const CONCURRENCY = 2;

const batchCache = new Map<string, BatchEntry>();
let timer: number | null = null;
let running = false;
let queued = false;
let forceRefetch = false;
let started = false;
let refreshGen = 0;
let unsubscribeCache: (() => void) | null = null;

function feedLookup(): FeedFolderLookup {
    const lib = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    const feeds = lib?.feeds ?? [];
    const out: Record<string, readonly string[]> = {};
    for (const feed of feeds as Feed[]) out[feed.id] = feed.folderIds;
    return out;
}

function enabledFolderIds(): string[] {
    const shadow = loadInterestingShadow();
    const order = loadInterestingOrder();
    const lib = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    const folders = (lib?.folders ?? []).map((f) => ({ id: (f as { id: string }).id }));
    if (folders.length) return orderedInterestingFolderIds(shadow, folders, order);
    // Library not loaded yet: best effort over enabled shadow keys in stored order.
    const enabled = new Set(Object.keys(shadow).filter((id) => shadow[id] === true));
    const out: string[] = [];
    const seen = new Set<string>();
    for (const id of order) {
        if (!enabled.has(id) || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    for (const id of enabled) {
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

function interestingViewSettings(folderId: string): InterestingViewSettings {
    try {
        const raw = localStorage.getItem(VIEW_SETTINGS_KEY);
        if (!raw) return { unreadOnly: false, pageSize: DEFAULT_PAGE_SIZE };
        const parsed = JSON.parse(raw) as Record<string, { unreadOnly?: boolean; pageSize?: number } | undefined>;
        const entry = parsed[`interesting:${folderId}`];
        const pageSize =
            typeof entry?.pageSize === 'number' && PAGE_SIZES.includes(entry.pageSize)
                ? entry.pageSize
                : DEFAULT_PAGE_SIZE;
        return { unreadOnly: entry?.unreadOnly === true, pageSize };
    } catch {
        return { unreadOnly: false, pageSize: DEFAULT_PAGE_SIZE };
    }
}

async function fetchBatch(folderId: string, unreadOnly: boolean): Promise<Article[]> {
    const res = await fetchArticlesPage({
        scope: `folder:${folderId}`,
        sort: 'newest',
        limit: 200,
        unreadOnly,
    });
    return res.items;
}

async function getBatch(folderId: string, refetch: boolean): Promise<Article[]> {
    const unreadOnly = interestingViewSettings(folderId).unreadOnly;
    // Read-sensitive lenses cannot trust a cached batch: its read flags may
    // predate the write that just changed them.
    const mustRefetch = refetch || unreadOnly || isInterestingHideRead(folderId);
    const now = Date.now();
    const cached = batchCache.get(folderId);
    if (!mustRefetch && cached && cached.unreadOnly === unreadOnly && now - cached.at < BATCH_TTL_MS)
        return cached.articles;
    const articles = await fetchBatch(folderId, unreadOnly);
    batchCache.set(folderId, { at: Date.now(), articles, unreadOnly });
    return articles;
}

/** Drop a folder's batch so the next recompute sees fresh read flags. */
export function invalidateInterestingBatch(folderId: string): void {
    batchCache.delete(folderId);
}

function computeCount(folderId: string, articles: Article[], lookup: FeedFolderLookup, pageSize: number): number {
    // Mirror the view's transient "hide read" filter after Mark shown as read.
    const visible = isInterestingHideRead(folderId) ? articles.filter((a) => a.read === 0) : articles;
    const filtered = filterMutedArticles(visible, loadMuteRules(), lookup);
    const wordMap = interestingWordMapOf(filtered);
    const strictness = loadInterestingStrictness(folderId);
    // The view slices its ranked batch to the page size, so the badge must
    // count the visible window rather than the whole matching set.
    return Math.min(selectInteresting(filtered, wordMap, strictness).length, pageSize);
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) {
            const idx = i++;
            const item = items[idx];
            if (item !== undefined) await fn(item);
        }
    });
    await Promise.all(workers);
}

async function refreshNow(refetch: boolean): Promise<void> {
    if (running) {
        queued = true;
        forceRefetch = forceRefetch || refetch;
        return;
    }
    const gen = refreshGen;
    running = true;
    try {
        do {
            queued = false;
            const doRefetch = forceRefetch || refetch;
            forceRefetch = false;
            if (gen !== refreshGen) break;
            const ids = enabledFolderIds();
            if (!ids.length) break;
            const lookup = feedLookup();
            await runPool(ids, CONCURRENCY, async (folderId) => {
                try {
                    if (gen !== refreshGen) return;
                    const batch = await getBatch(folderId, doRefetch);
                    if (gen !== refreshGen) return;
                    const settings = interestingViewSettings(folderId);
                    const count = computeCount(folderId, batch, lookup, settings.pageSize);
                    if (gen !== refreshGen) return;
                    if (loadInterestingCount(folderId) !== count) saveInterestingCount(folderId, count);
                } catch {
                    // best effort: keep stale count
                }
            });
        } while (queued && gen === refreshGen);
    } finally {
        if (gen === refreshGen) running = false;
    }
}

function schedule(refetch: boolean, delay = DEBOUNCE_MS): void {
    if (refetch) forceRefetch = true;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
        timer = null;
        void refreshNow(forceRefetch);
    }, delay);
}

export function scheduleInterestingCountsRefresh(opts?: { refetch?: boolean; immediate?: boolean }): void {
    if (typeof window === 'undefined') return;
    const refetch = opts?.refetch === true;
    if (opts?.immediate) {
        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }
        void refreshNow(refetch);
        return;
    }
    schedule(refetch);
}

function onLightModelChange() {
    // Word map/strictness/mute/shadow changed: recompute from cached batches.
    schedule(false, 800);
}

function onDataChange() {
    // Feeds/articles/library likely changed: allow refetch (TTL still applies).
    schedule(true, 1200);
}

function onVisibility() {
    if (document.visibilityState === 'visible') schedule(false, 300);
}

export function startInterestingCountsRefresh(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    window.addEventListener('article-starred', onLightModelChange);
    window.addEventListener('article-read', onLightModelChange);
    window.addEventListener('interesting-model-changed', onLightModelChange);
    window.addEventListener('interesting-settings-changed', onLightModelChange);
    window.addEventListener('mute-rules-changed', onLightModelChange);
    window.addEventListener('feeds-refreshed', onDataChange);
    window.addEventListener('share-settings-changed', onLightModelChange as EventListener);
    document.addEventListener('visibilitychange', onVisibility);
    unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
        if (event?.query?.queryKey?.[0] === libraryKey[0]) {
            // Library feeds/folders/counts changed; recompute (batches may still be fresh).
            schedule(false, 800);
        }
    });
    // Initial refresh soon after startup/library paint.
    schedule(false, 600);
}

export function stopInterestingCountsRefresh(): void {
    if (!started || typeof window === 'undefined') return;
    started = false;
    refreshGen++;
    if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
    }
    unsubscribeCache?.();
    unsubscribeCache = null;
    batchCache.clear();
    running = false;
    queued = false;
    forceRefetch = false;
    window.removeEventListener('article-starred', onLightModelChange);
    window.removeEventListener('article-read', onLightModelChange);
    window.removeEventListener('interesting-model-changed', onLightModelChange);
    window.removeEventListener('interesting-settings-changed', onLightModelChange);
    window.removeEventListener('mute-rules-changed', onLightModelChange);
    window.removeEventListener('feeds-refreshed', onDataChange);
    window.removeEventListener('share-settings-changed', onLightModelChange as EventListener);
    document.removeEventListener('visibilitychange', onVisibility);
}
