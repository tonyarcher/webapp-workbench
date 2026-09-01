import {getPool} from '../db.js';
import {POLL_TICK_MS, POLL_MAX_AGE_MS, POLL_BATCH} from '../env.js';
import {fetchFeedText} from './fetcher.js';
import {ingestFeed} from './ingest.js';
import type {FeedRow} from '../types.js';

// ---- poller singleton ----

let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
let forceQueue: string[] = [];
let stopped = false;
let tickPromise: Promise<void> | null = null;

export function startPoller(): void {
    stopped = false;
    if (timer) return;
    timer = setInterval(() => {
        void tick().catch((err) => {
            console.error('poller tick error:', err);
        });
    }, POLL_TICK_MS);
}

export function stopPoller(): void {
    stopped = true;
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

/** Stop the interval and wait for any in-flight tick to finish. */
export async function drainPoller(): Promise<void> {
    stopPoller();
    if (tickPromise) {
        try {
            await tickPromise;
        } catch {
            // already logged inside tick
        }
    }
}

/** Kick the poller to process due feeds immediately. */
export function tickNow(): void {
    if (stopped) return;
    void tick().catch((err) => {
        console.error('poller tickNow error:', err);
    });
}

export function queueFeeds(ids: string[]): void {
    forceQueue.push(...ids);
    tickNow();
}

// ---- tick ----

async function tick(): Promise<void> {
    if (inFlight || stopped) return;
    inFlight = true;
    const running = runTick();
    tickPromise = running;
    try {
        await running;
    } finally {
        inFlight = false;
        if (tickPromise === running) tickPromise = null;
    }
}

async function fetchDueFromDb(pool: ReturnType<typeof getPool>, need: number): Promise<string[]> {
    if (need <= 0) return [];
    const {rows} = await pool.query<{ id: string }>(
        `SELECT f.id FROM feeds f LEFT JOIN feed_sync fs ON fs.feed_id = f.id
         WHERE fs.last_fetched_at IS NULL OR fs.last_fetched_at < now() - ($1 || ' milliseconds')::interval
         ORDER BY fs.last_fetched_at ASC NULLS FIRST LIMIT $2`,
        [String(POLL_MAX_AGE_MS), String(need)],
    );
    return rows.map((r) => r.id);
}

async function collectDueIds(): Promise<string[]> {
    const pool = getPool();
    const dueIds: string[] = [...new Set(forceQueue)];
    forceQueue = [];
    const need = POLL_BATCH - dueIds.length;
    if (need > 0) {
        const extra = await fetchDueFromDb(pool, need);
        for (const id of extra) if (!dueIds.includes(id)) dueIds.push(id);
    }
    return dueIds;
}

async function pollBatch(ids: string[]): Promise<void> {
    for (const feedId of ids.slice(0, POLL_BATCH)) {
        if (stopped) return;
        try {
            await pollFeed(feedId);
        } catch (err) {
            console.error('poller: feed ' + feedId + ' failed:', err);
        }
    }
}

async function runTick(): Promise<void> {
    do {
        if (stopped) return;
        const dueIds = await collectDueIds();
        await pollBatch(dueIds);
    } while (!stopped && forceQueue.length > 0);
}

async function ensureSyncRow(pool: ReturnType<typeof getPool>, feedId: string): Promise<void> {
    await pool.query(`INSERT INTO feed_sync (feed_id) VALUES ($1) ON CONFLICT (feed_id) DO NOTHING`, [feedId]);
}

async function loadPollContext(pool: ReturnType<typeof getPool>, feedId: string): Promise<{ sync: { etag: string | null; last_modified: string | null }; feed: FeedRow & { user_id: string } } | null> {
    const {rows: syncRows} = await pool.query<{ etag: string | null; last_modified: string | null }>('SELECT etag, last_modified FROM feed_sync WHERE feed_id = $1', [feedId]);
    const sync = syncRows[0];
    if (!sync) return null;
    const {rows: feedRows} = await pool.query<FeedRow & { user_id: string }>('SELECT * FROM feeds WHERE id = $1', [feedId]);
    const feed = feedRows[0];
    if (!feed) return null;
    return {sync, feed};
}

async function fetchWithBackoff(pool: ReturnType<typeof getPool>, feedId: string, feed: FeedRow & { user_id: string }, sync: { etag: string | null; last_modified: string | null }) {
    try {
        return await fetchFeedText(feed.xml_url, {etag: sync.etag ?? undefined, lastModified: sync.last_modified ?? undefined});
    } catch (err) {
        await pool.query(`INSERT INTO feed_sync (feed_id, last_fetched_at, last_error) VALUES ($1, now(), $2) ON CONFLICT (feed_id) DO UPDATE SET last_fetched_at = now(), last_error = EXCLUDED.last_error`, [feedId, err instanceof Error ? err.message : String(err)]);
        throw err;
    }
}

async function handleNotModified(pool: ReturnType<typeof getPool>, feedId: string, sync: { etag: string | null; last_modified: string | null }, result: { etag?: string | null; lastModified?: string | null }): Promise<void> {
    await pool.query(
        `INSERT INTO feed_sync (feed_id, last_fetched_at, etag, last_modified) VALUES ($1, now(), $2, $3) ON CONFLICT (feed_id) DO UPDATE SET last_fetched_at = now(), etag = COALESCE(EXCLUDED.etag, feed_sync.etag), last_modified = COALESCE(EXCLUDED.last_modified, feed_sync.last_modified)`,
        [feedId, result.etag ?? sync.etag, result.lastModified ?? sync.last_modified],
    );
}

async function handleFeedIngest(pool: ReturnType<typeof getPool>, feed: FeedRow & { user_id: string }, result: { text?: string | null; etag?: string | null; lastModified?: string | null }, feedId: string): Promise<void> {
    if (!result.text) return;
    await ingestFeed(feed, result.text, feed.user_id);
    await pool.query(`UPDATE feed_sync SET etag = $1, last_modified = $2 WHERE feed_id = $3`, [result.etag ?? null, result.lastModified ?? null, feedId]);
}

async function pollFeed(feedId: string): Promise<void> {
    const pool = getPool();
    await ensureSyncRow(pool, feedId);
    const ctx = await loadPollContext(pool, feedId);
    if (!ctx) return;
    const result = await fetchWithBackoff(pool, feedId, ctx.feed, ctx.sync);
    if (result.status === 304) {
        await handleNotModified(pool, feedId, ctx.sync, result);
        return;
    }
    await handleFeedIngest(pool, ctx.feed, result, feedId);
}
