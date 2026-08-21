import {getPool} from '../db.js';
import {HttpError, readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {normalizeLink} from '../services/ranking.js';

// ---- POST /migrate/library ----

export const migrateLibraryHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as {
        folders?: Array<{ title: string; sortOrder?: number }>;
        feeds?: Array<{ url: string; title?: string; siteUrl?: string; folderTitles?: string[] }>;
        states?: Array<{ feedUrl: string; guid?: string; link?: string; read: boolean; readAt?: number; starred: boolean }>;
        affinity?: Array<{ key: string; value: number }>;
    } | null;

    if (!body) throw new HttpError(400, 'Request body is required');

    const pool = getPool();
    let feedsAdded = 0;
    let foldersAdded = 0;
    let statesQueued = 0;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create folders
        const folderMap = new Map<string, string>();
        if (body.folders) {
            for (const f of body.folders) {
                const {rows} = await client.query(
                    `INSERT INTO folders (user_id, title, sort_order)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (user_id, title) DO UPDATE SET sort_order = EXCLUDED.sort_order
                     RETURNING id`,
                    [user.id, f.title, f.sortOrder ?? 0],
                );
                folderMap.set(f.title, rows[0].id);
                foldersAdded++;
            }
        }

        // Create feeds
        const feedMap = new Map<string, string>();
        if (body.feeds) {
            for (const f of body.feeds) {
                let hostTitle = f.url;
                try {
                    hostTitle = new URL(f.url).hostname;
                } catch {
                    // keep raw url as title for malformed entries
                }
                const {rows} = await client.query(
                    `INSERT INTO feeds (user_id, xml_url, title, site_url)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (user_id, xml_url) DO UPDATE SET title = EXCLUDED.title
                     RETURNING id`,
                    [user.id, f.url, f.title ?? hostTitle, f.siteUrl ?? null],
                );
                const feedId = rows[0].id;
                feedMap.set(f.url, feedId);
                feedsAdded++;

                if (f.folderTitles) {
                    for (const title of f.folderTitles) {
                        const folderId = folderMap.get(title);
                        if (folderId) {
                            await client.query(
                                `INSERT INTO folder_feeds (folder_id, feed_id)
                                 VALUES ($1, $2)
                                 ON CONFLICT DO NOTHING`,
                                [folderId, feedId],
                            );
                        }
                    }
                }
            }
        }

        // Queue pending states
        if (body.states) {
            for (const s of body.states) {
                const feedId = feedMap.get(s.feedUrl);
                if (!feedId) continue;
                const normLink = s.link ? normalizeLink(s.link) : null;
                await client.query(
                    `INSERT INTO pending_article_state (user_id, feed_id, guid, norm_link, link, read, read_at, starred)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        user.id,
                        feedId,
                        s.guid ?? null,
                        normLink,
                        s.link ?? null,
                        s.read,
                        s.readAt ? new Date(s.readAt) : null,
                        s.starred,
                    ],
                );
                statesQueued++;
            }
        }

        // Upsert affinity
        if (body.affinity) {
            const now = new Date();
            for (const a of body.affinity) {
                await client.query(
                    `INSERT INTO user_affinity (user_id, key, value, updated_at)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = $4`,
                    [user.id, a.key, a.value, now],
                );
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    // Every feed must carry poll state — a missing feed_sync row reads as
    // "never polled" in the due queue, and a migrated library without these
    // rows produced the hundreds-deep haystack that starved healthy feeds.
    await getPool().query(
        `INSERT INTO feed_sync (feed_id)
         SELECT f.id FROM feeds f WHERE f.user_id = $1
         ON CONFLICT (feed_id) DO NOTHING`,
        [user.id],
    );

    return {feedsAdded, foldersAdded, statesQueued};
};
