import pg from 'pg';
import {getPool} from '../db.js';
import {HttpError, readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {normalizeLink} from '../services/ranking.js';

// ---- POST /migrate/library ----

type MigrateBody = {
    folders?: Array<{ title: string; sortOrder?: number }>;
    feeds?: Array<{ url: string; title?: string; siteUrl?: string; folderTitles?: string[] }>;
    states?: Array<{ feedUrl: string; guid?: string; link?: string; read: boolean; readAt?: number; starred: boolean }>;
    affinity?: Array<{ key: string; value: number }>;
};

function hostTitleFor(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

async function insertMigrateFolders(client: pg.PoolClient, userId: string, folders: MigrateBody['folders'], map: Map<string, string>, counters: { foldersAdded: { value: number } }) {
    if (!folders) return;
    for (const f of folders) {
        const {rows} = await client.query(
            `INSERT INTO folders (user_id, title, sort_order) VALUES ($1, $2, $3) ON CONFLICT (user_id, title) DO UPDATE SET sort_order = EXCLUDED.sort_order RETURNING id`,
            [userId, f.title, f.sortOrder ?? 0],
        );
        map.set(f.title, rows[0].id);
        counters.foldersAdded.value++;
    }
}

async function linkFolderFeeds(client: pg.PoolClient, titles: string[], folderMap: Map<string, string>, feedId: string) {
    for (const title of titles) {
        const folderId = folderMap.get(title);
        if (!folderId) continue;
        await client.query(`INSERT INTO folder_feeds (folder_id, feed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [folderId, feedId]);
    }
}

async function insertMigrateFeeds(client: pg.PoolClient, userId: string, feeds: MigrateBody['feeds'], folderMap: Map<string, string>, feedMap: Map<string, string>, counters: { feedsAdded: { value: number } }) {
    if (!feeds) return;
    for (const f of feeds) {
        const hostTitle = hostTitleFor(f.url);
        const {rows} = await client.query(
            `INSERT INTO feeds (user_id, xml_url, title, site_url) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, xml_url) DO UPDATE SET title = EXCLUDED.title RETURNING id`,
            [userId, f.url, f.title ?? hostTitle, f.siteUrl ?? null],
        );
        const feedId = rows[0].id;
        feedMap.set(f.url, feedId);
        counters.feedsAdded.value++;
        if (f.folderTitles) await linkFolderFeeds(client, f.folderTitles, folderMap, feedId);
    }
}

async function insertMigrateStates(client: pg.PoolClient, userId: string, states: MigrateBody['states'], feedMap: Map<string, string>, counters: { statesQueued: { value: number } }) {
    if (!states) return;
    for (const s of states) {
        const feedId = feedMap.get(s.feedUrl);
        if (!feedId) continue;
        const normLink = s.link ? normalizeLink(s.link) : null;
        await client.query(
            `INSERT INTO pending_article_state (user_id, feed_id, guid, norm_link, link, read, read_at, starred) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, feedId, s.guid ?? null, normLink, s.link ?? null, s.read, s.readAt ? new Date(s.readAt) : null, s.starred],
        );
        counters.statesQueued.value++;
    }
}

async function insertMigrateAffinity(client: pg.PoolClient, userId: string, affinity: MigrateBody['affinity']) {
    if (!affinity) return;
    const now = new Date();
    for (const a of affinity) {
        await client.query(`INSERT INTO user_affinity (user_id, key, value, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = $4`, [userId, a.key, a.value, now]);
    }
}

async function runMigrateTx(body: MigrateBody, userId: string, counters: { feedsAdded: { value: number }; foldersAdded: { value: number }; statesQueued: { value: number } }) {
    const pool = getPool();
    const client = await pool.connect();
    const folderMap = new Map<string, string>();
    const feedMap = new Map<string, string>();
    try {
        await client.query('BEGIN');
        await insertMigrateFolders(client, userId, body.folders, folderMap, counters);
        await insertMigrateFeeds(client, userId, body.feeds, folderMap, feedMap, counters);
        await insertMigrateStates(client, userId, body.states, feedMap, counters);
        await insertMigrateAffinity(client, userId, body.affinity);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export const migrateLibraryHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as MigrateBody | null;
    if (!body) throw new HttpError(400, 'Request body is required');
    const counters = {feedsAdded: {value: 0}, foldersAdded: {value: 0}, statesQueued: {value: 0}};
    await runMigrateTx(body, user.id, counters);
    await getPool().query(`INSERT INTO feed_sync (feed_id) SELECT f.id FROM feeds f WHERE f.user_id = $1 ON CONFLICT (feed_id) DO NOTHING`, [user.id]);
    return {feedsAdded: counters.feedsAdded.value, foldersAdded: counters.foldersAdded.value, statesQueued: counters.statesQueued.value};
};
