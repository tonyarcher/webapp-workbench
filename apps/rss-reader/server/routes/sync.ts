import {getPool} from '../db.js';
import {readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {queueFeeds} from '../services/poller.js';

// ---- POST /sync ----

export const syncHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as {
        scope?: 'all' | { feedIds?: string[] };
    } | null;

    const pool = getPool();
    let feedIds: string[] = [];

    if (body?.scope === 'all' || !body?.scope) {
        const {rows} = await pool.query<{ id: string }>(
            'SELECT id FROM feeds WHERE user_id = $1',
            [user.id],
        );
        feedIds = rows.map((r) => r.id);
    } else if (typeof body.scope === 'object' && Array.isArray(body.scope.feedIds)) {
        feedIds = body.scope.feedIds;
    }

    if (feedIds.length > 0) {
        await pool.query(
            `UPDATE feed_sync SET last_fetched_at = NULL
             WHERE feed_id = ANY($1::uuid[])`,
            [feedIds],
        );
    }

    // Kick the poller
    queueFeeds(feedIds);

    return {queued: feedIds.length};
};
