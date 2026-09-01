import {getPool} from '../db.js';
import {HttpError, isUuid, readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {mapFeed, mapFolder} from '../db.js';

// ---- GET /library ----

export const getLibraryHandler: RouteHandler = async ({user}) => {
    const pool = getPool();

    const {rows: folders} = await pool.query(
        'SELECT * FROM folders WHERE user_id = $1 ORDER BY sort_order, created_at',
        [user.id],
    );

    const {rows: feedRows} = await pool.query(
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
         WHERE f.user_id = $1
         ORDER BY f.added_at`,
        [user.id],
    );

    return {
        folders: folders.map(mapFolder),
        feeds: feedRows.map(mapFeed),
    };
};

// ---- POST /folders ----

export const createFolderHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as { title?: string } | null;
    if (!body?.title || typeof body.title !== 'string') {
        throw new HttpError(400, 'title is required');
    }
    const pool = getPool();
    const {rows} = await pool.query(
        `INSERT INTO folders (user_id, title)
         VALUES ($1, $2)
         ON CONFLICT (user_id, title) DO UPDATE SET title = EXCLUDED.title
         RETURNING *`,
        [user.id, body.title.trim()],
    );
    return mapFolder(rows[0]);
};

// ---- DELETE /folders/:id ----

export const deleteFolderHandler: RouteHandler = async ({params, user}) => {
    if (!isUuid(params.id)) throw new HttpError(400, 'invalid folder id');
    const pool = getPool();
    await pool.query(
        'DELETE FROM folders WHERE id = $1 AND user_id = $2',
        [params.id, user.id],
    );
    return {ok: true};
};

// ---- POST /folders/reorder ----

export const reorderFoldersHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as { ids?: string[] } | null;
    if (!Array.isArray(body?.ids)) {
        throw new HttpError(400, 'ids array is required');
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (let i = 0; i < body.ids.length; i++) {
            await client.query(
                'UPDATE folders SET sort_order = $1 WHERE id = $2 AND user_id = $3',
                [i, body.ids[i], user.id],
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
