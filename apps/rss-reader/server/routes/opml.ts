import {getPool} from '../db.js';
import {readJsonBody, HttpError} from '../http.js';
import type {RouteHandler} from '../http.js';
import {isFolder} from '../services/opml-parse.js';
import type {OpmlNode} from '../types.js';

// ---- GET /opml ----

async function fetchExportData(userId: string) {
    const pool = getPool();
    const {rows: folders} = await pool.query('SELECT * FROM folders WHERE user_id = $1 ORDER BY sort_order', [userId]);
    const {rows: allFeeds} = await pool.query(
        `SELECT f.*, COALESCE(fc.folder_ids, '[]') AS folder_ids
         FROM feeds f
         LEFT JOIN (SELECT feed_id, json_agg(folder_id) AS folder_ids FROM folder_feeds GROUP BY feed_id) fc ON fc.feed_id = f.id
         WHERE f.user_id = $1`,
        [userId],
    );
    return {folders, allFeeds};
}

function feedOutline(f: { title: string; xml_url: string; site_url: string | null }, indent: string): string {
    const htmlUrl = f.site_url ?? '';
    return indent + '<outline type="rss" text="' + escXml(f.title) + '" title="' + escXml(f.title) + '" xmlUrl="' + escXml(f.xml_url) + '" htmlUrl="' + escXml(htmlUrl) + '"/>';
}

function buildFolderMap(allFeeds: Array<{ folder_ids: unknown } & Record<string, unknown>>): Map<string, typeof allFeeds> {
    const map = new Map<string, typeof allFeeds>();
    for (const f of allFeeds) {
        const fids = (f.folder_ids ?? []) as string[];
        if (fids.length === 0) continue;
        for (const fid of fids) {
            if (!map.has(fid)) map.set(fid, []);
            map.get(fid)!.push(f);
        }
    }
    return map;
}

function appendLooseFeeds(lines: string[], allFeeds: Array<{ folder_ids: unknown; title: string; xml_url: string; site_url: string | null }>, map: Map<string, unknown>) {
    for (const f of allFeeds) {
        const fids = (f.folder_ids ?? []) as string[];
        if (fids.length !== 0) continue;
        lines.push(feedOutline(f, '  '));
    }
    void map;
}

function appendFolderOutlines(lines: string[], folders: Array<{ id: string; title: string }>, map: Map<string, Array<{ title: string; xml_url: string; site_url: string | null }>>) {
    for (const folder of folders) {
        const feeds = map.get(folder.id) ?? [];
        lines.push('  <outline text="' + escXml(folder.title) + '" title="' + escXml(folder.title) + '">');
        for (const f of feeds) lines.push(feedOutline(f, '    '));
        lines.push('  </outline>');
    }
}

function buildOpmlLines(folders: Array<{ id: string; title: string }>, allFeeds: Array<{ title: string; xml_url: string; site_url: string | null; folder_ids: unknown }>): string[] {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<opml version="2.0">', '<head><title>RSS Reader Export</title></head>', '<body>'];
    const map = buildFolderMap(allFeeds as never);
    appendLooseFeeds(lines, allFeeds as never, map as never);
    appendFolderOutlines(lines, folders as never, map as never);
    lines.push('</body>', '</opml>');
    return lines;
}

export const exportOpmlHandler: RouteHandler = async ({res, user}) => {
    const {folders, allFeeds} = await fetchExportData(user.id);
    const lines = buildOpmlLines(folders as never, allFeeds as never);
    const xml = lines.join('\n');
    res.writeHead(200, {'Content-Type': 'text/xml; charset=utf-8'});
    res.end(xml);
};

function escXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- POST /opml ----

async function insertOpmlFolder(pool: ReturnType<typeof getPool>, userId: string, title: string): Promise<string> {
    const {rows} = await pool.query(
        `INSERT INTO folders (user_id, title) VALUES ($1, $2) ON CONFLICT (user_id, title) DO UPDATE SET title = EXCLUDED.title RETURNING id`,
        [userId, title],
    );
    return rows[0].id;
}

async function insertOpmlFeed(pool: ReturnType<typeof getPool>, userId: string, node: { xmlUrl: string; title: string; htmlUrl?: string }): Promise<string | null> {
    const {rows} = await pool.query(
        `INSERT INTO feeds (user_id, xml_url, title, site_url) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, xml_url) DO NOTHING RETURNING id`,
        [userId, node.xmlUrl, node.title, node.htmlUrl ?? null],
    );
    return rows[0]?.id ?? null;
}

async function linkFeedToFolder(pool: ReturnType<typeof getPool>, folderId: string, feedId: string): Promise<void> {
    await pool.query(`INSERT INTO folder_feeds (folder_id, feed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [folderId, feedId]);
}

async function handleOpmlFeed(node: { xmlUrl: string; title: string; htmlUrl?: string }, pool: ReturnType<typeof getPool>, userId: string, parentId: string | undefined, counters: { addedFeeds: { value: number } }) {
    const feedId = await insertOpmlFeed(pool, userId, node);
    if (!feedId) return;
    counters.addedFeeds.value++;
    if (parentId) await linkFeedToFolder(pool, parentId, feedId);
}

async function handleOpmlNode(node: OpmlNode, pool: ReturnType<typeof getPool>, userId: string, parentId: string | undefined, counters: { addedFeeds: { value: number }; addedFolders: { value: number } }, recurse: (items: OpmlNode[], parentId?: string) => Promise<void>) {
    if (isFolder(node)) {
        const folderId = await insertOpmlFolder(pool, userId, node.title);
        counters.addedFolders.value++;
        await recurse(node.children, folderId);
        return;
    }
    if (node.xmlUrl) await handleOpmlFeed(node, pool, userId, parentId, counters);
}

async function processOpmlNodes(items: OpmlNode[], pool: ReturnType<typeof getPool>, userId: string, parentId: string | undefined, counters: { addedFeeds: { value: number }; addedFolders: { value: number } }) {
    for (const node of items) await handleOpmlNode(node, pool, userId, parentId, counters, (next, pid) => processOpmlNodes(next, pool, userId, pid, counters));
}

async function ensureFeedSync(userId: string): Promise<void> {
    await getPool().query(`INSERT INTO feed_sync (feed_id) SELECT f.id FROM feeds f WHERE f.user_id = $1 ON CONFLICT (feed_id) DO NOTHING`, [userId]);
}

export const importOpmlHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as { xml?: string } | null;
    if (!body?.xml || typeof body.xml !== 'string') throw new HttpError(400, 'xml string is required');
    const {parseOpml} = await import('../services/opml-parse.js');
    const nodes = parseOpml(body.xml);
    const pool = getPool();
    const counters = {addedFeeds: {value: 0}, addedFolders: {value: 0}};
    await processOpmlNodes(nodes, pool, user.id, undefined, counters);
    await ensureFeedSync(user.id);
    return {addedFeeds: counters.addedFeeds.value, addedFolders: counters.addedFolders.value};
};
