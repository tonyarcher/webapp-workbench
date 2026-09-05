import pg from 'pg';
import {DATABASE_URL} from './env.js';
import {SCHEMA} from './schema.js';
import {firstImageUrl} from './services/feed-parser.js';
import type {
    FeedRow,
    FolderRow,
    ApiFeed,
    ApiArticle,
    ApiFolder,
} from './types.js';

// ---- pool singleton ----

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
    if (!pool) {
        pool = new pg.Pool({connectionString: DATABASE_URL, max: 10});
    }
    return pool;
}

// ---- migration (runs DDL once, lazy) ----

let migrated = false;

export async function migrate(): Promise<void> {
    if (migrated) return;
    const p = getPool();
    await p.query(SCHEMA);
    // Backfill content_html with the legacy image where it is the only
    // thumbnail source, then drop the column so new installs never create it.
    // Gate on column existence so fresh installs (no image column) don't
    // swallow unrelated errors via a blanket try/catch.
    try {
        const {rows: col} = await p.query(
            `SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'image'`,
        );
        if (col.length > 0) {
            const {rows} = await p.query<{ id: string; image: string; content_html: string | null }>(
                `SELECT id, image, content_html FROM articles WHERE image IS NOT NULL`,
            );
            for (const r of rows) {
                if (!firstImageUrl(r.content_html ?? undefined)) {
                    await p.query(`UPDATE articles SET content_html = $1 WHERE id = $2`, [
                        `<img src="${r.image}" alt="">` + (r.content_html ?? ''),
                        r.id,
                    ]);
                }
            }
        }
        await p.query('ALTER TABLE articles DROP COLUMN IF EXISTS image');
    } catch {
        // best-effort legacy migration; drop is idempotent
        try {
            await p.query('ALTER TABLE articles DROP COLUMN IF EXISTS image');
        } catch {
            // ignore
        }
    }
    migrated = true;
}

/** End the singleton pool so a later getPool() opens a fresh one. */
export async function closePool(): Promise<void> {
    if (!pool) return;
    const p = pool;
    await p.end();
    pool = null;
    migrated = false;
}

// ---- row mappers ----

export function mapFeed(row: FeedRow & { unread?: string | number; folder_ids?: string[]; last_fetched_at?: Date | null; last_error?: string | null }): ApiFeed {
    const feed: ApiFeed = {
        id: row.id,
        title: row.title,
        url: row.xml_url,
        folderIds: Array.isArray(row.folder_ids) ? (row.folder_ids as string[]) : [],
        unread: Number(row.unread ?? 0),
        addedAt: row.added_at.getTime(),
    };
    if (row.site_url) feed.siteUrl = row.site_url;
    if (row.last_fetched_at) feed.lastFetchedAt = row.last_fetched_at.getTime();
    if (row.last_error) feed.lastError = row.last_error;
    return feed;
}

function imageForRow(row: { content_html: string | null; image?: string | null }): string | undefined {
    const derived = firstImageUrl(row.content_html ?? undefined);
    if (derived) return derived;
    // Legacy fallback: old rows still carry image until migrate() backfills
    // and drops the column; keep it behind a derived-image check so new
    // data never depends on the column.
    if (row.image) return row.image;
    return undefined;
}

function applyArticleOptionals(
    article: ApiArticle,
    row: { link: string | null; author: string | null; summary: string | null; content_html: string | null; norm_link: string | null; comments: number | null; engagement: number } & { image?: string | null },
) {
    if (row.link) article.link = row.link;
    if (row.author) article.author = row.author;
    if (row.summary) article.summary = row.summary;
    if (row.content_html) article.content = row.content_html;
    const img = imageForRow(row);
    if (img) article.image = img;
    if (row.norm_link) article.normLink = row.norm_link;
    if (row.comments != null) article.comments = row.comments;
    if (row.engagement) article.engagement = row.engagement;
}

export function mapArticle(
    row: { id: string; feed_id: string; guid: string; title: string; link: string | null; norm_link: string | null; domain: string | null; author: string | null; summary: string | null; content_html: string | null; comments: number | null; published_at: Date; fetched_at: Date; popularity: number; engagement: number; hot: number; read?: boolean; starred?: boolean } & { image?: string | null },
): ApiArticle {
    const article: ApiArticle = {
        id: row.id,
        feedId: row.feed_id,
        guid: row.guid,
        title: row.title,
        published: row.published_at.getTime(),
        fetchedAt: row.fetched_at.getTime(),
        read: row.read ? 1 : 0,
        starred: row.starred ?? false,
        popularity: row.popularity,
        hot: row.hot,
    };
    applyArticleOptionals(article, row);
    return article;
}

export function mapFolder(row: FolderRow): ApiFolder {
    return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at.getTime(),
        sortOrder: row.sort_order,
    };
}
