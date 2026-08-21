import {getPool} from '../db.js';
import type {FeedRow} from '../types.js';
import {MAX_ARTICLES_PER_FEED, MAX_CONTENT_BYTES} from '../env.js';
import {parseFeedXml} from './feed-parser.js';
import {sanitizeHtml} from './sanitize.js';
import {normalizeLink, contentEngagement} from './ranking.js';
import {domainOf} from '../util.js';
import {createHash} from 'node:crypto';

// ---- article ID ----

export function makeArticleId(feedId: string, guid: string): string {
    return createHash('sha256').update(feedId + '\n' + guid).digest('hex');
}

// ---- ingest one feed's XML ----

export async function ingestFeed(
    feedRow: FeedRow,
    xml: string,
    userId: string,
): Promise<{ inserted: number }> {
    const pool = getPool();
    const now = new Date();

    let parsed;
    try {
        parsed = parseFeedXml(xml, Date.now());
    } catch (err) {
        await pool.query(
            `INSERT INTO feed_sync (feed_id, last_error)
             VALUES ($1, $2)
             ON CONFLICT (feed_id) DO UPDATE SET last_error = EXCLUDED.last_error, last_fetched_at = NULL`,
            [feedRow.id, err instanceof Error ? err.message : String(err)],
        );
        throw err;
    }

    // Update feed title if it was default and parsed differs
    if ((feedRow.title === 'Untitled feed' || feedRow.title === '') && parsed.title && parsed.title !== 'Untitled feed') {
        await pool.query('UPDATE feeds SET title = $1 WHERE id = $2', [parsed.title, feedRow.id]);
    }

    const client = await pool.connect();
    let inserted = 0;
    try {
        await client.query('BEGIN');

        const insertedIds = new Set<string>();
        for (const item of parsed.items) {
            const articleId = makeArticleId(feedRow.id, item.guid);
            const contentHtml = sanitizeHtml(item.content ?? item.summary);
            const truncatedContent = contentHtml.length > MAX_CONTENT_BYTES
                ? contentHtml.slice(0, MAX_CONTENT_BYTES)
                : contentHtml;
            const summary = item.summary ?? '';
            const image = item.media ?? null;
            const link = item.link ?? null;
            const normLink = link ? normalizeLink(link) : null;
            const domain = link ? domainOf(link) : null;
            const publishedAt = new Date(item.published);

            // xmax=0 in RETURNING distinguishes insert from conflict-update.
            const {rows} = await client.query<{ was_inserted: boolean }>(
                `INSERT INTO articles (id, feed_id, guid, title, link, norm_link, domain, author, summary, content_html, image, comments, published_at, fetched_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content_html = EXCLUDED.content_html,
                    summary = EXCLUDED.summary,
                    image = EXCLUDED.image,
                    comments = EXCLUDED.comments,
                    fetched_at = now()
                 RETURNING (xmax = 0) AS was_inserted`,
                [
                    articleId,
                    feedRow.id,
                    item.guid,
                    item.title || '(untitled)',
                    link,
                    normLink,
                    domain,
                    item.author ?? null,
                    summary,
                    truncatedContent || null,
                    image,
                    item.comments ?? null,
                    publishedAt,
                    now,
                ],
            );
            if (rows[0]?.was_inserted) insertedIds.add(articleId);
        }
        inserted = insertedIds.size;

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    // ---- compute engagement scores ----
    const {rows: articles} = await pool.query<{ id: string; title: string; content_html: string | null; summary: string | null; author: string | null; image: string | null }>(
        'SELECT id, title, content_html, summary, author, image FROM articles WHERE feed_id = $1',
        [feedRow.id],
    );

    for (const a of articles) {
        const engagement = contentEngagement({
            title: a.title,
            content: a.content_html ?? undefined,
            summary: a.summary ?? undefined,
            author: a.author ?? undefined,
            media: a.image ?? undefined,
        });
        await pool.query(
            'UPDATE articles SET engagement = $1 WHERE id = $2',
            [engagement, a.id],
        );
    }

    // ---- compute popularity + hot (mirrors ranking.ts formulas exactly) ----
    // popularityScore = 1 + 3*(syndication-1) + min(comments, 50)
    // hotScore = log10(max(popularity + max(engagement,0), 1))
    //            + (epochSec - anchor)/90000
    await pool.query(
        `UPDATE articles a
         SET popularity = 1 + 3 * GREATEST(sub.cnt - 1, 0)
                          + LEAST(GREATEST(COALESCE(a.comments, 0), 0), 50),
              hot = log(GREATEST(
                        1 + 3 * GREATEST(sub.cnt - 1, 0)
                        + LEAST(GREATEST(COALESCE(a.comments, 0), 0), 50)
                        + GREATEST(a.engagement, 0), 1)::numeric)
                   + (EXTRACT(EPOCH FROM a.published_at) - 1134028003) / 90000
         FROM (
            SELECT norm_link, COUNT(DISTINCT feed_id) AS cnt
            FROM articles
            WHERE norm_link IS NOT NULL AND feed_id IN (
                SELECT id FROM feeds WHERE user_id = $1
            )
            GROUP BY norm_link
         ) sub
         WHERE a.norm_link = sub.norm_link AND a.feed_id IN (
            SELECT id FROM feeds WHERE user_id = $1
         )`,
        [userId],
    );

    // ---- prune per feed ----
    await pool.query(
        `DELETE FROM articles
         WHERE feed_id = $1
           AND id NOT IN (
             SELECT id FROM articles
             WHERE feed_id = $1
               AND NOT EXISTS (SELECT 1 FROM article_state s WHERE s.article_id = articles.id AND s.starred)
             ORDER BY published_at DESC
             LIMIT $2
           )`,
        [feedRow.id, MAX_ARTICLES_PER_FEED],
    );

    // ---- apply pending state ----
    const {rows: pending} = await pool.query<{
        id: number;
        feed_id: string;
        guid: string | null;
        norm_link: string | null;
        link: string | null;
        user_id: string;
        read: boolean;
        read_at: Date | null;
        starred: boolean;
    }>(
        'SELECT * FROM pending_article_state WHERE feed_id = $1',
        [feedRow.id],
    );

    for (const p of pending) {
        const {rows: matched} = await pool.query<{ id: string }>(
            `SELECT id FROM articles
             WHERE feed_id = $1 AND (
               ($2::text IS NOT NULL AND guid = $2)
               OR ($3::text IS NOT NULL AND norm_link = $3)
             )
             LIMIT 1`,
            [p.feed_id, p.guid, p.norm_link],
        );
        if (matched[0]) {
            await pool.query(
                `INSERT INTO article_state (user_id, article_id, read, read_at, starred)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id, article_id) DO UPDATE SET
                    read = GREATEST(article_state.read, EXCLUDED.read),
                    starred = GREATEST(article_state.starred, EXCLUDED.starred),
                    read_at = COALESCE(EXCLUDED.read_at, article_state.read_at)`,
                [p.user_id, matched[0].id, p.read, p.read_at, p.starred],
            );
        }
        await pool.query('DELETE FROM pending_article_state WHERE id = $1', [p.id]);
    }

    // Delete old unmatched pending rows (>48h)
    await pool.query(
        `DELETE FROM pending_article_state
         WHERE feed_id = $1 AND created_at < now() - interval '48 hours'`,
        [feedRow.id],
    );

    // ---- update feed_sync ----
    await pool.query(
        `INSERT INTO feed_sync (feed_id, last_fetched_at, last_error)
         VALUES ($1, now(), NULL)
         ON CONFLICT (feed_id) DO UPDATE SET
            last_fetched_at = now(),
            last_error = NULL`,
        [feedRow.id],
    );

    return {inserted};
}
