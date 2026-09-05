import {getPool} from '../db.js';
import type {FeedRow} from '../types.js';
import {MAX_ARTICLES_PER_FEED, MAX_CONTENT_BYTES} from '../env.js';
import {firstImageUrl, parseFeedXml} from './feed-parser.js';
import {sanitizeHtml} from './sanitize.js';
import {normalizeLink, contentEngagement} from './ranking.js';
import {domainOf} from '../util.js';
import {createHash} from 'node:crypto';

// ---- article ID ----

export function makeArticleId(feedId: string, guid: string): string {
    return createHash('sha256').update(feedId + '\n' + guid).digest('hex');
}

// ---- ingest one feed's XML ----

async function handleParseError(feedId: string, err: unknown): Promise<never> {
    await getPool().query(
        `INSERT INTO feed_sync (feed_id, last_fetched_at, last_error)
         VALUES ($1, now(), $2)
         ON CONFLICT (feed_id) DO UPDATE SET last_error = EXCLUDED.last_error, last_fetched_at = now()`,
        [feedId, err instanceof Error ? err.message : String(err)],
    );
    throw err;
}

async function maybeUpdateTitle(feedRow: FeedRow, title: string): Promise<void> {
    if ((feedRow.title === 'Untitled feed' || feedRow.title === '') && title && title !== 'Untitled feed') {
        await getPool().query('UPDATE feeds SET title = $1 WHERE id = $2', [title, feedRow.id]);
    }
}

async function insertItems(feedRow: FeedRow, items: ReturnType<typeof parseFeedXml>['items']): Promise<{inserted: number; affected: Set<string>}> {
    const pool = getPool();
    const client = await pool.connect();
    let inserted = 0;
    const affected = new Set<string>();
    const now = new Date();
    try {
        await client.query('BEGIN');
        for (const item of items) await insertOne(client, feedRow, item, now, affected).then((v) => { if (v) inserted++; });
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return {inserted, affected};
}

function truncatedFor(item: ReturnType<typeof parseFeedXml>['items'][number]): string {
    const raw = item.content ?? item.summary ?? '';
    const html = sanitizeHtml(raw);
    const truncated = html.length > MAX_CONTENT_BYTES ? html.slice(0, MAX_CONTENT_BYTES) : html;
    // Preserve the enclosure/media thumbnail without a dedicated image column:
    // keep the previous `media wins` priority (image = media ?? firstImageUrl)
    // by ensuring the media image is the first <img> when present.
    if (item.media && firstImageUrl(truncated) !== item.media) {
        const safe = sanitizeHtml(`<img src="${item.media}" alt="">`);
        // sanitizeHtml will keep the img; prepend it outside the truncated
        // slice so the thumbnail is never clipped by the byte cap.
        return safe + truncated;
    }
    return truncated;
}

function linkInfoFor(link: string | null): {norm: string | null; domain: string | null} {
    if (!link) return {norm: null, domain: null};
    return {norm: normalizeLink(link), domain: domainOf(link)};
}

function engagementForItem(item: ReturnType<typeof parseFeedXml>['items'][number], truncated: string): number {
    return contentEngagement({title: item.title || '(untitled)', content: truncated || undefined, summary: item.summary || undefined, author: item.author, media: item.media ?? undefined});
}

async function insertOne(client: import('pg').PoolClient, feedRow: FeedRow, item: ReturnType<typeof parseFeedXml>['items'][number], now: Date, affected: Set<string>): Promise<boolean> {
    const truncated = truncatedFor(item);
    const link = item.link ?? null;
    const {norm, domain} = linkInfoFor(link);
    if (norm) affected.add(norm);
    const engagement = engagementForItem(item, truncated);
    const articleId = makeArticleId(feedRow.id, item.guid);
    const {rows} = await client.query<{was_inserted: boolean}>(
        `INSERT INTO articles (id, feed_id, guid, title, link, norm_link, domain, author, summary, content_html, comments, engagement, published_at, fetched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, content_html=EXCLUDED.content_html, summary=EXCLUDED.summary, comments=EXCLUDED.comments, engagement=EXCLUDED.engagement, fetched_at=now()
         RETURNING (xmax=0) AS was_inserted`,
        [articleId, feedRow.id, item.guid, item.title || '(untitled)', link, norm, domain, item.author ?? null, item.summary ?? '', truncated || null, item.comments ?? null, engagement, new Date(item.published), now],
    );
    return Boolean(rows[0]?.was_inserted);
}

async function updatePopularity(affected: Set<string>, userId: string, feedId: string): Promise<void> {
    const pool = getPool();
    if (affected.size > 0) await pool.query(
        `UPDATE articles a SET popularity=1+3*GREATEST(sub.cnt-1,0)+LEAST(GREATEST(COALESCE(a.comments,0),0),50),
         hot=log(GREATEST(1+3*GREATEST(sub.cnt-1,0)+LEAST(GREATEST(COALESCE(a.comments,0),0),50)+GREATEST(a.engagement,0),1)::numeric)+(EXTRACT(EPOCH FROM a.published_at)-1134028003)/90000
         FROM (SELECT norm_link, COUNT(DISTINCT feed_id) AS cnt FROM articles WHERE norm_link=ANY($2::text[]) AND feed_id IN (SELECT id FROM feeds WHERE user_id=$1) GROUP BY norm_link) sub
         WHERE a.norm_link=sub.norm_link AND a.feed_id IN (SELECT id FROM feeds WHERE user_id=$1)`,
        [userId, [...affected]],
    );
    await pool.query(
        `UPDATE articles SET popularity=1+LEAST(GREATEST(COALESCE(comments,0),0),50),
         hot=log(GREATEST(1+LEAST(GREATEST(COALESCE(comments,0),0),50)+GREATEST(engagement,0),1)::numeric)+(EXTRACT(EPOCH FROM published_at)-1134028003)/90000
         WHERE feed_id=$1 AND norm_link IS NULL`,
        [feedId],
    );
}

async function pruneFeed(feedId: string): Promise<void> {
    await getPool().query(
        `DELETE FROM articles a WHERE a.feed_id=$1 AND NOT EXISTS (SELECT 1 FROM article_state s WHERE s.article_id=a.id AND s.starred) AND a.id NOT IN (SELECT id FROM articles WHERE feed_id=$1 ORDER BY published_at DESC LIMIT $2)`,
        [feedId, MAX_ARTICLES_PER_FEED],
    );
}

async function applyPending(feedId: string): Promise<void> {
    const pool = getPool();
    const {rows: pending} = await pool.query<{id:number; feed_id:string; guid:string|null; norm_link:string|null; user_id:string; read:boolean; read_at:Date|null; starred:boolean}>('SELECT * FROM pending_article_state WHERE feed_id=$1', [feedId]);
    for (const p of pending) await applyOnePending(p);
    await pool.query(`DELETE FROM pending_article_state WHERE feed_id=$1 AND created_at < now() - interval '48 hours'`, [feedId]);
}

async function applyOnePending(p: {id:number; feed_id:string; guid:string|null; norm_link:string|null; user_id:string; read:boolean; read_at:Date|null; starred:boolean}): Promise<void> {
    const pool = getPool();
    const {rows: matched} = await pool.query<{id:string}>(`SELECT id FROM articles WHERE feed_id=$1 AND (($2::text IS NOT NULL AND guid=$2) OR ($3::text IS NOT NULL AND norm_link=$3)) LIMIT 1`, [p.feed_id, p.guid, p.norm_link]);
    if (!matched[0]) return;
    await pool.query(`INSERT INTO article_state (user_id, article_id, read, read_at, starred) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, article_id) DO UPDATE SET read=GREATEST(article_state.read, EXCLUDED.read), starred=GREATEST(article_state.starred, EXCLUDED.starred), read_at=COALESCE(EXCLUDED.read_at, article_state.read_at)`, [p.user_id, matched[0].id, p.read, p.read_at, p.starred]);
    await pool.query('DELETE FROM pending_article_state WHERE id=$1', [p.id]);
}

export async function ingestFeed(feedRow: FeedRow, xml: string, userId: string): Promise<{inserted: number}> {
    let parsed: ReturnType<typeof parseFeedXml>;
    try { parsed = parseFeedXml(xml, Date.now()); } catch (err) { await handleParseError(feedRow.id, err); throw err; }
    await maybeUpdateTitle(feedRow, parsed.title);
    const {inserted, affected} = await insertItems(feedRow, parsed.items);
    await updatePopularity(affected, userId, feedRow.id);
    await pruneFeed(feedRow.id);
    await applyPending(feedRow.id);
    await getPool().query(`INSERT INTO feed_sync (feed_id, last_fetched_at, last_error) VALUES ($1, now(), NULL) ON CONFLICT (feed_id) DO UPDATE SET last_fetched_at=now(), last_error=NULL`, [feedRow.id]);
    return {inserted};
}
