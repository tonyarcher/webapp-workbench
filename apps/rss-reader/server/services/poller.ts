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

async function runTick(): Promise<void> {
    // Drain feeds queued while a pass was in flight instead of waiting
    // for the next interval. `stopped` aborts the loop on shutdown.
    do {
        if (stopped) return;
        const pool = getPool();

        const dueIds: string[] = [...new Set(forceQueue)];
        forceQueue = [];

        if (dueIds.length < POLL_BATCH) {
            const {rows} = await pool.query<{ id: string }>(
                `SELECT f.id
                 FROM feeds f
                 LEFT JOIN feed_sync fs ON fs.feed_id = f.id
                 WHERE fs.last_fetched_at IS NULL
                    OR fs.last_fetched_at < now() - ($1 || ' milliseconds')::interval
                 ORDER BY fs.last_fetched_at ASC NULLS FIRST
                 LIMIT $2`,
                [String(POLL_MAX_AGE_MS), String(POLL_BATCH - dueIds.length)],
            );
            for (const r of rows) {
                if (!dueIds.includes(r.id)) dueIds.push(r.id);
            }
        }

        for (const feedId of dueIds.slice(0, POLL_BATCH)) {
            if (stopped) return;
            try {
                await pollFeed(feedId);
            } catch (err) {
                console.error('poller: feed ' + feedId + ' failed:', err);
            }
        }
    } while (!stopped && forceQueue.length > 0);
}

async function pollFeed(feedId: string): Promise<void> {
    const pool = getPool();

    await pool.query(
        `INSERT INTO feed_sync (feed_id) VALUES ($1) ON CONFLICT (feed_id) DO NOTHING`,
        [feedId],
    );

    const {rows: syncRows} = await pool.query<{
        etag: string | null;
        last_modified: string | null;
    }>('SELECT etag, last_modified FROM feed_sync WHERE feed_id = $1', [feedId]);

    const sync = syncRows[0];
    if (!sync) return;

    const {rows: feedRows} = await pool.query<FeedRow & { user_id: string }>(
        'SELECT * FROM feeds WHERE id = $1',
        [feedId],
    );
    const feed = feedRows[0];
    if (!feed) return;

    let result;
    try {
        result = await fetchFeedText(feed.xml_url, {
            etag: sync.etag ?? undefined,
            lastModified: sync.last_modified ?? undefined,
        });
    } catch (err) {
        // Fetch-phase failure: back off for a full poll interval instead of
        // leaving last_fetched_at NULL (which would retry every tick and
        // starve the rest of the queue).
        await pool.query(
            `INSERT INTO feed_sync (feed_id, last_fetched_at, last_error)
             VALUES ($1, now(), $2)
             ON CONFLICT (feed_id) DO UPDATE SET last_fetched_at = now(), last_error = EXCLUDED.last_error`,
            [feedId, err instanceof Error ? err.message : String(err)],
        );
        throw err;
    }

    if (result.status === 304) {
        await pool.query(
            `INSERT INTO feed_sync (feed_id, last_fetched_at, etag, last_modified)
             VALUES ($1, now(), $2, $3)
             ON CONFLICT (feed_id) DO UPDATE SET
                last_fetched_at = now(),
                etag = COALESCE(EXCLUDED.etag, feed_sync.etag),
                last_modified = COALESCE(EXCLUDED.last_modified, feed_sync.last_modified)`,
            [feedId, result.etag ?? sync.etag, result.lastModified ?? sync.last_modified],
        );
        return;
    }

    if (result.text) {
        await ingestFeed(feed, result.text, feed.user_id);
        await pool.query(
            `UPDATE feed_sync SET etag = $1, last_modified = $2 WHERE feed_id = $3`,
            [result.etag ?? null, result.lastModified ?? null, feedId],
        );
    }
}
