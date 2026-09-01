import {getPool} from '../db.js';
import {HttpError, isUuid, readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {mapFeed} from '../db.js';
import {safeHttpUrl} from '../services/feed-parser.js';
import {ingestFeed} from '../services/ingest.js';
import {fetchFeedText} from '../services/fetcher.js';

// ---- POST /feeds ----

async function validateFolderOwnership(pool: ReturnType<typeof getPool>, userId: string, folderIds: string[]) {
    if (!folderIds.length) return;
    if (folderIds.some((id) => !isUuid(id))) throw new HttpError(400, 'Unknown folder in folderIds');
    const {rows: owned} = await pool.query<{ id: string }>('SELECT id FROM folders WHERE user_id = $1 AND id = ANY($2::uuid[])', [userId, folderIds]);
    if (owned.length !== folderIds.length) throw new HttpError(400, 'Unknown folder in folderIds');
}

async function upsertFeed(pool: ReturnType<typeof getPool>, userId: string, validatedUrl: string) {
    const {rows: feedRows} = await pool.query(
        `INSERT INTO feeds (user_id, xml_url, title) VALUES ($1, $2, $3) ON CONFLICT (user_id, xml_url) DO NOTHING RETURNING *`,
        [userId, validatedUrl, new URL(validatedUrl).hostname],
    );
    if (feedRows[0]) return feedRows[0];
    const {rows} = await pool.query('SELECT * FROM feeds WHERE user_id = $1 AND xml_url = $2', [userId, validatedUrl]);
    return rows[0];
}

async function insertMemberships(pool: ReturnType<typeof getPool>, feedId: string, folderIds: string[]) {
    if (!folderIds.length) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const folderId of folderIds) await client.query(`INSERT INTO folder_feeds (folder_id, feed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [folderId, feedId]);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function fetchAndIngest(pool: ReturnType<typeof getPool>, feedRow: { id: string; [k: string]: unknown }, validatedUrl: string, userId: string) {
    try {
        const result = await fetchFeedText(validatedUrl);
        if (result.status !== 200 || !result.text) return;
        await ingestFeed(feedRow as never, result.text, userId);
        await pool.query(`UPDATE feed_sync SET etag = $1, last_modified = $2 WHERE feed_id = $3`, [result.etag ?? null, result.lastModified ?? null, feedRow.id]);
    } catch (err) {
        await pool.query(
            `INSERT INTO feed_sync (feed_id, last_fetched_at, last_error) VALUES ($1, now(), $2) ON CONFLICT (feed_id) DO UPDATE SET last_error = EXCLUDED.last_error, last_fetched_at = now()`,
            [feedRow.id, err instanceof Error ? err.message : String(err)],
        );
    }
}

async function loadFullFeed(pool: ReturnType<typeof getPool>, userId: string, feedId: string) {
    const {rows} = await pool.query(
        `SELECT f.*, COALESCE(fc.folder_ids, '[]') AS folder_ids,
                (SELECT COUNT(*) FROM articles a LEFT JOIN article_state s ON s.article_id = a.id AND s.user_id = $1 WHERE a.feed_id = f.id AND COALESCE(s.read, false) = false) AS unread,
                fs.last_fetched_at, fs.last_error
         FROM feeds f LEFT JOIN (SELECT feed_id, json_agg(folder_id) AS folder_ids FROM folder_feeds GROUP BY feed_id) fc ON fc.feed_id = f.id
         LEFT JOIN feed_sync fs ON fs.feed_id = f.id WHERE f.id = $2`,
        [userId, feedId],
    );
    return mapFeed(rows[0]);
}

export const createFeedHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as { url?: string; folderIds?: string[] } | null;
    if (!body?.url || typeof body.url !== 'string') throw new HttpError(400, 'url is required');
    const validatedUrl = safeHttpUrl(body.url);
    if (!validatedUrl) throw new HttpError(400, 'Invalid feed URL (must be http/https)');
    const pool = getPool();
    const folderIds = body.folderIds ?? [];
    await validateFolderOwnership(pool, user.id, folderIds);
    const feedRow = await upsertFeed(pool, user.id, validatedUrl);
    await insertMemberships(pool, feedRow.id, folderIds);
    await pool.query('INSERT INTO feed_sync (feed_id) VALUES ($1) ON CONFLICT (feed_id) DO NOTHING', [feedRow.id]);
    await fetchAndIngest(pool, feedRow, validatedUrl, user.id);
    return loadFullFeed(pool, user.id, feedRow.id);
};

// ---- DELETE /feeds/:id ----

export const deleteFeedHandler: RouteHandler = async ({params, user}) => {
    if (!isUuid(params.id)) throw new HttpError(400, 'invalid feed id');
    const pool = getPool();
    const result = await pool.query(
        'DELETE FROM feeds WHERE id = $1 AND user_id = $2',
        [params.id, user.id],
    );
    if (result.rowCount === 0) throw new HttpError(404, 'Feed not found');
    return {ok: true};
};

// ---- PUT /feeds/:id/folders ----

async function verifyFeedOwnership(pool: ReturnType<typeof getPool>, feedId: string, userId: string) {
    const {rows} = await pool.query('SELECT id FROM feeds WHERE id = $1 AND user_id = $2', [feedId, userId]);
    if (!rows[0]) throw new HttpError(404, 'Feed not found');
}

async function verifyFolderIds(pool: ReturnType<typeof getPool>, userId: string, folderIds: string[]) {
    if (folderIds.some((id) => !isUuid(id))) throw new HttpError(400, 'Unknown folder in folderIds');
    const {rows: owned} = await pool.query<{ id: string }>('SELECT id FROM folders WHERE user_id = $1 AND id = ANY($2::uuid[])', [userId, folderIds]);
    if (owned.length !== folderIds.length) throw new HttpError(400, 'Unknown folder in folderIds');
}

async function replaceFolderMemberships(pool: ReturnType<typeof getPool>, feedId: string, folderIds: string[]) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM folder_feeds WHERE feed_id = $1', [feedId]);
        for (const folderId of folderIds) await client.query(`INSERT INTO folder_feeds (folder_id, feed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [folderId, feedId]);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export const updateFeedFoldersHandler: RouteHandler = async ({req, params, user}) => {
    if (!isUuid(params.id)) throw new HttpError(400, 'invalid feed id');
    const body = await readJsonBody(req) as { folderIds?: string[] } | null;
    if (!Array.isArray(body?.folderIds)) throw new HttpError(400, 'folderIds array is required');
    const pool = getPool();
    await verifyFeedOwnership(pool, params.id, user.id);
    await verifyFolderIds(pool, user.id, body.folderIds);
    await replaceFolderMemberships(pool, params.id, body.folderIds);
    return {ok: true};
};
