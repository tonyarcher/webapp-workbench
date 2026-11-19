/**
 * Explicit likes as the seed for the Interesting model.
 *
 * The persisted word map learns from star toggles, but the ranking path can
 * also read the reader's likes from the server. That matters for folders whose
 * liked articles are older than the recent batch: a batch-only model only saw
 * likes that happened to fall inside it, so those folders looked cold forever
 * even with a full liked history.
 *
 * One cached search request (`is:starred`) covers every folder. A failed fetch
 * keeps the previous list, so ranking still runs offline and on a cold start.
 */
import { fetchArticlesPage } from './api';

export interface StarredSeed {
    title: string;
}

/** The server windows search at 400 rows; 200 likes is already plenty of signal. */
const STARRED_LIMIT = 200;
const STARRED_TTL_MS = 5 * 60_000;

export interface StarredLoader {
    /** Cached likes; `force` refetches. Never rejects: a failure returns the last list. */
    load(opts?: { force?: boolean }): Promise<StarredSeed[]>;
    /**
     * Drop the cached list and its TTL. Used on a star change and on sign-out:
     * a failed refetch must not serve another account's likes or a stale star.
     */
    invalidate(): void;
}

/**
 * Cache and de-duplicate a likes fetch. `now` is injectable so the TTL is
 * testable without a timer; concurrent callers share one in-flight request.
 */
export function createStarredLoader(
    fetchAll: () => Promise<StarredSeed[]>,
    ttlMs: number = STARRED_TTL_MS,
    now: () => number = Date.now,
): StarredLoader {
    let cached: StarredSeed[] = [];
    let cachedAt = 0;
    let generation = 0;
    let inflight: Promise<StarredSeed[]> | null = null;
    function load(opts?: { force?: boolean }): Promise<StarredSeed[]> {
        if (!opts?.force && cachedAt > 0 && now() - cachedAt < ttlMs) return Promise.resolve(cached);
        if (inflight) return inflight;
        const startedAt = generation;
        // A request that outlives an `invalidate` (sign-out, unstar) must not
        // repopulate the cache, and must not clear a newer request's slot.
        const request = fetchAll()
            .then((seeds) => {
                if (startedAt !== generation) return cached;
                cached = seeds;
                cachedAt = now();
                return seeds;
            })
            .catch(() => cached)
            .finally(() => {
                if (inflight === request) inflight = null;
            });
        inflight = request;
        return request;
    }
    return {
        load,
        invalidate(): void {
            // Drop the content too: a forced refresh that fails must not fall
            // back to another account's likes after a sign-out, or to a star
            // the reader just removed.
            generation += 1;
            cached = [];
            cachedAt = 0;
            inflight = null;
        },
    };
}

async function fetchStarredSeeds(): Promise<StarredSeed[]> {
    const page = await fetchArticlesPage({ q: 'is:starred', limit: STARRED_LIMIT });
    return page.items.map((article) => ({ title: article.title }));
}

const starredLoader = createStarredLoader(fetchStarredSeeds);

export const loadStarredTitles = starredLoader.load;
export const invalidateStarredTitles = starredLoader.invalidate;
