import type {IncomingMessage, ServerResponse} from 'node:http';
import {getPool} from './db.js';
import {parseCookies, setCookie, cookieOpts} from './http.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the anonymous user from the rss_uid cookie; creates the user +
 * cookie on first visit. Deliberately NOT cached across requests: two
 * browsers hitting the same process must never share a library.
 */
export async function ensureUser(req: IncomingMessage, res: ServerResponse): Promise<{ id: string; label: string }> {
    const cookies = parseCookies(req.headers.cookie);
    const uid = cookies['rss_uid'];
    const pool = getPool();

    if (uid && UUID_RE.test(uid)) {
        const {rows} = await pool.query<{ id: string; label: string }>(
            'SELECT id, label FROM users WHERE id = $1',
            [uid],
        );
        if (rows[0]) return rows[0];
    }

    const {rows} = await pool.query<{ id: string; label: string }>(
        'INSERT INTO users (label) VALUES ($1) RETURNING id, label',
        ['local'],
    );
    setCookie(res, 'rss_uid', rows[0].id, cookieOpts(req));
    return rows[0];
}
