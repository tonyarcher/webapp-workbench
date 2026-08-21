import {getPool} from '../db.js';
import {readJsonBody, HttpError} from '../http.js';
import type {RouteHandler} from '../http.js';
import {isFolder} from '../services/opml-parse.js';
import type {OpmlNode} from '../types.js';

// ---- GET /opml ----

export const exportOpmlHandler: RouteHandler = async ({res, user}) => {
    const pool = getPool();

    const {rows: folders} = await pool.query(
        'SELECT * FROM folders WHERE user_id = $1 ORDER BY sort_order',
        [user.id],
    );

    const {rows: allFeeds} = await pool.query(
        `SELECT f.*, COALESCE(fc.folder_ids, '[]') AS folder_ids
         FROM feeds f
         LEFT JOIN (
            SELECT feed_id, json_agg(folder_id) AS folder_ids
            FROM folder_feeds
            GROUP BY feed_id
         ) fc ON fc.feed_id = f.id
         WHERE f.user_id = $1`,
        [user.id],
    );

    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<opml version="2.0">',
        '<head><title>RSS Reader Export</title></head>',
        '<body>',
    ];

    const folderFeedMap = new Map<string, typeof allFeeds>();
    for (const f of allFeeds) {
        const fids = (f.folder_ids ?? []) as string[];
        if (fids.length === 0) {
            const htmlUrl = f.site_url ?? '';
            lines.push(
                '  <outline type="rss" text="' + escXml(f.title) + '" title="' + escXml(f.title) + '" xmlUrl="' + escXml(f.xml_url) + '" htmlUrl="' + escXml(htmlUrl) + '"/>',
            );
        } else {
            for (const fid of fids) {
                if (!folderFeedMap.has(fid)) folderFeedMap.set(fid, []);
                folderFeedMap.get(fid)!.push(f);
            }
        }
    }

    for (const folder of folders) {
        const feeds = folderFeedMap.get(folder.id) ?? [];
        lines.push('  <outline text="' + escXml(folder.title) + '" title="' + escXml(folder.title) + '">');
        for (const f of feeds) {
            const htmlUrl = f.site_url ?? '';
            lines.push(
                '    <outline type="rss" text="' + escXml(f.title) + '" title="' + escXml(f.title) + '" xmlUrl="' + escXml(f.xml_url) + '" htmlUrl="' + escXml(htmlUrl) + '"/>',
            );
        }
        lines.push('  </outline>');
    }

    lines.push('</body>');
    lines.push('</opml>');

    const xml = lines.join('\n');
    res.writeHead(200, {'Content-Type': 'text/xml; charset=utf-8'});
    res.end(xml);
};

function escXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- POST /opml ----

export const importOpmlHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as { xml?: string } | null;
    if (!body?.xml || typeof body.xml !== 'string') {
                throw new HttpError(400, 'xml string is required');
    }

    const {parseOpml} = await import('../services/opml-parse.js');
    const nodes = parseOpml(body.xml);

    const pool = getPool();
    let addedFeeds = 0;
    let addedFolders = 0;

    const processNodes = async (items: OpmlNode[], parentId?: string) => {
        for (const node of items) {
            if (isFolder(node)) {
                const {rows} = await pool.query(
                    `INSERT INTO folders (user_id, title)
                     VALUES ($1, $2)
                     ON CONFLICT (user_id, title) DO UPDATE SET title = EXCLUDED.title
                     RETURNING id`,
                    [user.id, node.title],
                );
                const folderId = rows[0].id;
                addedFolders++;
                await processNodes(node.children, folderId);
            } else if (node.xmlUrl) {
                const {rows: feedRows} = await pool.query(
                    `INSERT INTO feeds (user_id, xml_url, title, site_url)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (user_id, xml_url) DO NOTHING
                     RETURNING id`,
                    [user.id, node.xmlUrl, node.title, node.htmlUrl ?? null],
                );
                if (feedRows[0]) {
                    addedFeeds++;
                    if (parentId) {
                        await pool.query(
                            `INSERT INTO folder_feeds (folder_id, feed_id)
                             VALUES ($1, $2)
                             ON CONFLICT DO NOTHING`,
                            [parentId, feedRows[0].id],
                        );
                    }
                }
            }
        }
    };

    await processNodes(nodes);

    return {addedFeeds, addedFolders};
};
