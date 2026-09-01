import {getPool} from '../db.js';
import {readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {queueFeeds} from '../services/poller.js';

// ---- POST /sync ----

async function resolveSyncIds(scope: unknown, userId: string): Promise<string[]> {
    const pool = getPool();
    if (scope === 'all' || !scope) {
        const {rows} = await pool.query<{ id: string }>('SELECT id FROM feeds WHERE user_id = $1', [userId]);
        return rows.map((r) => r.id);
    }
    if (typeof scope === 'object' && scope !== null && Array.isArray((scope as { feedIds?: unknown }).feedIds)) {
        const requested = (scope as { feedIds: unknown[] }).feedIds.filter((id) => typeof id === 'string') as string[];
        if (!requested.length) return [];
        const {rows} = await pool.query<{ id: string }>('SELECT id FROM feeds WHERE user_id = $1 AND id = ANY($2::uuid[])', [userId, requested]);
        return rows.map((r) => r.id);
    }
    return [];
}

async function resetSync(feedIds: string[]): Promise<void> {
    if (!feedIds.length) return;
    await getPool().query(`UPDATE feed_sync SET last_fetched_at = NULL WHERE feed_id = ANY($1::uuid[])`, [feedIds]);
}

export const syncHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as { scope?: 'all' | { feedIds?: string[] } } | null;
    const feedIds = await resolveSyncIds(body?.scope, user.id);
    await resetSync(feedIds);
    queueFeeds(feedIds);
    return {queued: feedIds.length};
};
