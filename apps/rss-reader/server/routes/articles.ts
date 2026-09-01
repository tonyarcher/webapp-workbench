import {getPool} from '../db.js';
import {HttpError, isUuid, readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {mapArticle} from '../db.js';
import {decodeCursor, encodeCursor} from '../cursor.js';
import {PAGE_LIMIT_DEFAULT} from '../env.js';

type Sort = 'newest' | 'oldest' | 'hot';

interface ArticlesParams {
    scope: string;
    unreadOnly: boolean;
    sort: Sort;
    cursor: string | null;
    limit: number;
    since: string | null;
}

function parseArticlesParams(query: URLSearchParams): ArticlesParams {
    const sort = (query.get('sort') ?? 'newest') as Sort;
    const rawLimit = Number(query.get('limit') || PAGE_LIMIT_DEFAULT);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 10_000) : PAGE_LIMIT_DEFAULT;
    return {
        scope: query.get('scope') ?? 'all',
        unreadOnly: query.get('unreadOnly') === '1',
        sort,
        cursor: query.get('cursor'),
        limit,
        since: query.get('since'),
    };
}

function toValidCursor(cursor: string | null) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    if (decoded && typeof decoded.k === 'number' && typeof decoded.id === 'string') return decoded;
    if (decoded && typeof decoded.k === 'string' && typeof decoded.id === 'string') return decoded;
    return null;
}

function addFeedScope(scope: string, conditions: string[], params: unknown[], idx: { value: number }) {
    const feedId = scope.slice(5);
    if (!isUuid(feedId)) throw new HttpError(400, 'invalid feed id');
    conditions.push(`a.feed_id = $${idx.value} AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)`);
    params.push(feedId);
    idx.value++;
}

function addFolderScope(scope: string, conditions: string[], params: unknown[], idx: { value: number }) {
    const folderId = scope.slice(7);
    if (!isUuid(folderId)) throw new HttpError(400, 'invalid folder id');
    conditions.push(`a.feed_id IN (SELECT ff.feed_id FROM folder_feeds ff JOIN folders fo ON fo.id = ff.folder_id WHERE ff.folder_id = $${idx.value} AND fo.user_id = $1)`);
    params.push(folderId);
    idx.value++;
}

function addScopeCondition(scope: string, conditions: string[], params: unknown[], idx: { value: number }) {
    if (scope === 'all') {
        conditions.push('a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)');
        return;
    }
    if (scope.startsWith('feed:')) { addFeedScope(scope, conditions, params, idx); return; }
    if (scope.startsWith('folder:')) { addFolderScope(scope, conditions, params, idx); return; }
    throw new HttpError(400, 'invalid scope');
}

function addSinceCondition(since: string | null, conditions: string[], params: unknown[], idx: { value: number }) {
    if (!since) return;
    const sinceMs = Number(since);
    if (!Number.isFinite(sinceMs)) throw new HttpError(400, 'invalid since');
    conditions.push('a.published_at >= $' + idx.value);
    params.push(new Date(sinceMs));
    idx.value++;
}

function addCursorCondition(
    validCursor: ReturnType<typeof toValidCursor>,
    sort: Sort,
    conditions: string[],
    params: unknown[],
    idx: { value: number },
) {
    if (!validCursor) return;
    if (sort === 'newest') {
        conditions.push('(a.published_at, a.id) < ($' + idx.value + ', $' + (idx.value + 1) + ')');
        params.push(new Date(validCursor.k as number), validCursor.id);
        idx.value += 2;
        return;
    }
    if (sort === 'oldest') {
        conditions.push('(a.published_at, a.id) > ($' + idx.value + ', $' + (idx.value + 1) + ')');
        params.push(new Date(validCursor.k as number), validCursor.id);
        idx.value += 2;
        return;
    }
    conditions.push('(a.hot, a.id) < ($' + idx.value + ', $' + (idx.value + 1) + ')');
    params.push(validCursor.k, validCursor.id);
    idx.value += 2;
}

function buildWhereClause(conditions: string[]): string {
    return conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
}

function buildOrderClause(sort: Sort): string {
    if (sort === 'oldest') return 'ORDER BY a.published_at ASC, a.id ASC';
    if (sort === 'hot') return 'ORDER BY a.hot DESC, a.id DESC';
    return 'ORDER BY a.published_at DESC, a.id DESC';
}

function buildNextCursor(items: Array<{ published: number; hot: number; id: string }>, hasMore: boolean, sort: Sort): string | undefined {
    if (!hasMore || !items.length) return undefined;
    const last = items[items.length - 1];
    if (sort === 'newest' || sort === 'oldest') return encodeCursor({k: last.published, id: last.id});
    return encodeCursor({k: last.hot, id: last.id});
}

// ---- GET /articles ----

export const getArticlesHandler: RouteHandler = async ({user, query}) => {
    const pool = getPool();
    const parsed = parseArticlesParams(query);
    const validCursor = toValidCursor(parsed.cursor);
    const conditions: string[] = [];
    const params: unknown[] = [user.id];
    const idx = {value: 2};
    addScopeCondition(parsed.scope, conditions, params, idx);
    if (parsed.unreadOnly) conditions.push('COALESCE(s.read, false) = false');
    addSinceCondition(parsed.since, conditions, params, idx);
    addCursorCondition(validCursor, parsed.sort, conditions, params, idx);
    const whereClause = buildWhereClause(conditions);
    const orderClause = buildOrderClause(parsed.sort);
    params.push(parsed.limit + 1);
    const {rows} = await pool.query(
        `SELECT a.*,
                COALESCE(s.read, false) AS read,
                COALESCE(s.starred, false) AS starred,
                s.read_at
         FROM articles a
         LEFT JOIN article_state s ON s.article_id = a.id AND s.user_id = $1
         ${whereClause}
         ${orderClause}
         LIMIT $${idx.value}`,
        params,
    );
    const hasMore = rows.length > parsed.limit;
    const items = rows.slice(0, parsed.limit).map(mapArticle);
    return {items, nextCursor: buildNextCursor(items, hasMore, parsed.sort)};
};

// ---- POST /articles/state ----

function parseUpdateBody(body: unknown): Array<{ id: string; read?: boolean; starred?: boolean }> {
    const updates = (body as { updates?: unknown } | null)?.updates;
    if (!Array.isArray(updates)) throw new HttpError(400, 'updates array is required');
    return updates as Array<{ id: string; read?: boolean; starred?: boolean }>;
}

function collectRequestedIds(updates: Array<{ id: string }>): string[] {
    return updates.map((u) => u.id).filter((id): id is string => typeof id === 'string' && id.length > 0);
}

async function fetchOwnedIds(requestedIds: string[], userId: string): Promise<Set<string>> {
    if (!requestedIds.length) return new Set();
    const pool = getPool();
    const {rows: owned} = await pool.query<{ id: string }>(
        `SELECT a.id FROM articles a
         WHERE a.id = ANY($1::text[])
           AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $2)`,
        [requestedIds, userId],
    );
    return new Set(owned.map((r) => r.id));
}

function buildReadAt(read: boolean | undefined): Date | null | undefined {
    if (read === true) return new Date();
    if (read === false) return null;
    return undefined;
}

async function upsertOneState(u: { id: string; read?: boolean; starred?: boolean }, userId: string): Promise<number> {
    const readAt = buildReadAt(u.read);
    try {
        const pool = getPool();
        const result = await pool.query(
            `INSERT INTO article_state (user_id, article_id, read, read_at, starred)
             VALUES ($1, $2, COALESCE($3, false), $4, COALESCE($5, false))
             ON CONFLICT (user_id, article_id) DO UPDATE SET
                read = COALESCE($3, article_state.read),
                read_at = CASE WHEN $3 IS NOT NULL THEN $4 ELSE article_state.read_at END,
                starred = COALESCE($5, article_state.starred)`,
            [userId, u.id, u.read ?? null, readAt ?? null, u.starred ?? null],
        );
        return result.rowCount ?? 0;
    } catch (err) {
        if ((err as { code?: string }).code !== '23503') throw err;
        return 0;
    }
}

async function applyStateUpdates(
    updates: Array<{ id: string; read?: boolean; starred?: boolean }>,
    ownedIds: Set<string>,
    userId: string,
): Promise<number> {
    let updated = 0;
    for (const u of updates) {
        if (!u.id || !ownedIds.has(u.id)) continue;
        if (u.read === undefined && u.starred === undefined) continue;
        updated += await upsertOneState(u, userId);
    }
    return updated;
}

export const updateArticleStateHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as unknown;
    const updates = parseUpdateBody(body);
    const requestedIds = collectRequestedIds(updates);
    const ownedIds = await fetchOwnedIds(requestedIds, user.id);
    const updated = await applyStateUpdates(updates, ownedIds, user.id);
    return {ok: true, updated};
};

// ---- POST /articles/read-before ----

function parseReadBeforeBody(body: unknown) {
    const b = body as { feedIds?: unknown; cutoff?: unknown } | null;
    if (!b?.cutoff || typeof b.cutoff !== 'number') throw new HttpError(400, 'cutoff (epoch ms) is required');
    if (Array.isArray(b.feedIds) && b.feedIds.some((id) => !isUuid(id as string))) throw new HttpError(400, 'invalid feed id');
    return {feedIds: b.feedIds as string[] | undefined, cutoff: b.cutoff as number};
}

async function markReadBeforeForFeeds(userId: string, feedIds: string[], cutoff: Date) {
    const pool = getPool();
    for (const feedId of feedIds) {
        await pool.query(
            `INSERT INTO article_state (user_id, article_id, read, read_at)
             SELECT $1, a.id, true, now()
             FROM articles a
             WHERE a.feed_id = $2 AND a.published_at < $3
               AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)
             ON CONFLICT (user_id, article_id) DO UPDATE SET
                read = true,
                read_at = COALESCE(article_state.read_at, now())`,
            [userId, feedId, cutoff],
        );
    }
}

async function markReadBeforeAll(userId: string, cutoff: Date) {
    const pool = getPool();
    await pool.query(
        `INSERT INTO article_state (user_id, article_id, read, read_at)
         SELECT $1, a.id, true, now()
         FROM articles a
         WHERE a.published_at < $2
           AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)
         ON CONFLICT (user_id, article_id) DO UPDATE SET
            read = true,
            read_at = COALESCE(article_state.read_at, now())`,
        [userId, cutoff],
    );
}

export const readBeforeHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as unknown;
    const {feedIds, cutoff} = parseReadBeforeBody(body);
    const cutoffDate = new Date(cutoff);
    if (feedIds && feedIds.length > 0) await markReadBeforeForFeeds(user.id, feedIds, cutoffDate);
    else await markReadBeforeAll(user.id, cutoffDate);
    return {ok: true};
};

// ---- POST /articles/read-all ----

function parseReadAllBody(body: unknown): string | undefined {
    const feedId = (body as { feedId?: unknown } | null)?.feedId as string | undefined;
    if (feedId && !isUuid(feedId)) throw new HttpError(400, 'invalid feed id');
    return feedId;
}

async function markAllForFeed(userId: string, feedId: string) {
    const pool = getPool();
    await pool.query(
        `INSERT INTO article_state (user_id, article_id, read, read_at)
         SELECT $1, a.id, true, now()
         FROM articles a
         WHERE a.feed_id = $2
           AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)
         ON CONFLICT (user_id, article_id) DO UPDATE SET
            read = true,
            read_at = COALESCE(article_state.read_at, now())`,
        [userId, feedId],
    );
}

async function markAllForUser(userId: string) {
    const pool = getPool();
    await pool.query(
        `INSERT INTO article_state (user_id, article_id, read, read_at)
         SELECT $1, a.id, true, now()
         FROM articles a
         WHERE a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)
         ON CONFLICT (user_id, article_id) DO UPDATE SET
            read = true,
            read_at = COALESCE(article_state.read_at, now())`,
        [userId],
    );
}

export const readAllHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as unknown;
    const feedId = parseReadAllBody(body);
    if (feedId) await markAllForFeed(user.id, feedId);
    else await markAllForUser(user.id);
    return {ok: true};
};

// ---- POST /affinity ----

function parseAffinityBody(body: unknown): { articleId: string; amount: number } {
    const b = body as { articleId?: unknown; amount?: unknown } | null;
    if (!b?.articleId || typeof b.amount !== 'number') throw new HttpError(400, 'articleId and amount are required');
    return {articleId: b.articleId as string, amount: b.amount};
}

async function upsertAffinity(userId: string, key: string, amount: number, now: Date) {
    const pool = getPool();
    await pool.query(
        `INSERT INTO user_affinity (user_id, key, value, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, key) DO UPDATE SET
            value = GREATEST(0, user_affinity.value * 0.9) + $3,
            updated_at = $4`,
        [userId, key, amount, now],
    );
}

export const affinityHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as unknown;
    const {articleId, amount} = parseAffinityBody(body);
    const pool = getPool();
    const {rows} = await pool.query<{ feed_id: string; domain: string | null; author: string | null }>(
        'SELECT feed_id, domain, author FROM articles WHERE id = $1',
        [articleId],
    );
    if (!rows[0]) throw new HttpError(404, 'Article not found');
    const article = rows[0];
    const now = new Date();
    await upsertAffinity(user.id, 'aff:feed:' + article.feed_id, amount, now);
    if (article.domain) await upsertAffinity(user.id, 'aff:domain:' + article.domain, amount, now);
    if (article.author) await upsertAffinity(user.id, 'aff:author:' + article.author.toLowerCase(), amount, now);
    return {ok: true};
};
