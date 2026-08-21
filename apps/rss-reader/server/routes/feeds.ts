import {getPool} from '../db.js';
import {HttpError, readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {mapFeed} from '../db.js';
import {safeHttpUrl} from '../services/feed-parser.js';
import {ingestFeed} from '../services/ingest.js';
import {fetchFeedText} from '../services/fetcher.js';

// ---- POST /feeds ----

export const createFeedHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as {
        url?: string;
        folderIds?: string[];
    } | null;

    if (!body?.url || typeof body.url !== 'string') {
        throw new HttpError(400, 'url is required');
    }

    const validatedUrl = safeHttpUrl(body.url);
    if (!validatedUrl) {
        throw new HttpError(400, 'Invalid feed URL (must be http/https)');
    }

    const pool = getPool();

    // Insert feed (dedupe by user + xml_url)
    const {rows: feedRows} = await pool.query(
        `INSERT INTO feeds (user_id, xml_url, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, xml_url) DO NOTHING
         RETURNING *`,
        [user.id, validatedUrl, new URL(validatedUrl).hostname],
    );

    let feedRow;
    if (feedRows[0]) {
        feedRow = feedRows[0];
    } else {
        const {rows} = await pool.query(
            'SELECT * FROM feeds WHERE user_id = $1 AND xml_url = $2',
            [user.id, validatedUrl],
        );
        feedRow = rows[0];
    }

    // Insert folder_feeds memberships
    if (body.folderIds && body.folderIds.length > 0) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const folderId of body.folderIds) {
                await client.query(
                    `INSERT INTO folder_feeds (folder_id, feed_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [folderId, feedRow.id],
                );
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // Ensure feed_sync row
    await pool.query(
        'INSERT INTO feed_sync (feed_id) VALUES ($1) ON CONFLICT (feed_id) DO NOTHING',
        [feedRow.id],
    );

    // Immediate fetch + ingest (best effort, don't fail request)
    try {
        const result = await fetchFeedText(validatedUrl);
        if (result.status === 200 && result.text) {
            await ingestFeed(feedRow, result.text, user.id);
            await pool.query(
                `UPDATE feed_sync SET etag = $1, last_modified = $2 WHERE feed_id = $3`,
                [result.etag ?? null, result.lastModified ?? null, feedRow.id],
            );
        }
    } catch (err) {
        await pool.query(
            `INSERT INTO feed_sync (feed_id, last_error)
             VALUES ($1, $2)
             ON CONFLICT (feed_id) DO UPDATE SET last_error = EXCLUDED.last_error`,
            [feedRow.id, err instanceof Error ? err.message : String(err)],
        );
    }

    // Build full feed response
    const {rows} = await pool.query(
        `SELECT f.*,
                COALESCE(fc.folder_ids, '[]') AS folder_ids,
                (SELECT COUNT(*) FROM articles a
                 LEFT JOIN article_state s ON s.article_id = a.id AND s.user_id = $1
                 WHERE a.feed_id = f.id AND COALESCE(s.read, false) = false) AS unread,
                fs.last_fetched_at,
                fs.last_error
         FROM feeds f
         LEFT JOIN (
            SELECT feed_id, json_agg(folder_id) AS folder_ids
            FROM folder_feeds
            GROUP BY feed_id
         ) fc ON fc.feed_id = f.id
         LEFT JOIN feed_sync fs ON fs.feed_id = f.id
         WHERE f.id = $2`,
        [user.id, feedRow.id],
    );

    return mapFeed(rows[0]);
};

// ---- DELETE /feeds/:id ----

export const deleteFeedHandler: RouteHandler = async ({params, user}) => {
    const pool = getPool();
    const result = await pool.query(
        'DELETE FROM feeds WHERE id = $1 AND user_id = $2',
        [params.id, user.id],
    );
    if (result.rowCount === 0) throw new HttpError(404, 'Feed not found');
    return {ok: true};
};

// ---- PUT /feeds/:id/folders ----

export const updateFeedFoldersHandler: RouteHandler = async ({req, params, user}) => {
    const body = await readJsonBody(req) as { folderIds?: string[] } | null;
    if (!Array.isArray(body?.folderIds)) {
        throw new HttpError(400, 'folderIds array is required');
    }

    const pool = getPool();

    // Verify feed exists and belongs to user
    const {rows} = await pool.query(
        'SELECT id FROM feeds WHERE id = $1 AND user_id = $2',
        [params.id, user.id],
    );
    if (!rows[0]) throw new HttpError(404, 'Feed not found');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            'DELETE FROM folder_feeds WHERE feed_id = $1',
            [params.id],
        );
        for (const folderId of body.folderIds) {
            await client.query(
                `INSERT INTO folder_feeds (folder_id, feed_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [folderId, params.id],
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return {ok: true};
};
