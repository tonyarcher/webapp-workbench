import {getPool} from '../db.js';
import {HttpError, isUuid, readJsonBody} from '../http.js';
import type {RouteHandler} from '../http.js';
import {mapArticle} from '../db.js';
import {encodeCursor, decodeCursor} from '../cursor.js';
import {PAGE_LIMIT_DEFAULT} from '../env.js';

// ---- GET /articles ----

export const getArticlesHandler: RouteHandler = async ({user, query}) => {
    const pool = getPool();
    const scope = query.get('scope') ?? 'all';
    const unreadOnly = query.get('unreadOnly') === '1';
    const sort = (query.get('sort') ?? 'newest') as 'newest' | 'oldest' | 'hot';
    const cursor = query.get('cursor');
    // Today view legitimately pulls a day's worth in one page; list views
    // stay at the default. Clamp instead of trusting client input.
    const rawLimit = Number(query.get('limit') || PAGE_LIMIT_DEFAULT);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 10_000) : PAGE_LIMIT_DEFAULT;
    const since = query.get('since');

    const decoded = cursor ? decodeCursor(cursor) : null;
    // A tampered cursor (non-numeric k) is ignored rather than 500'd.
    const validCursor = decoded && typeof decoded.k === 'number' && typeof decoded.id === 'string' ? decoded : null;

    const conditions: string[] = [];
    const params: unknown[] = [user.id];
    let paramIdx = 2;

    // Scope filtering — every scope also constrains to the caller's own
    // feeds so foreign UUIDs enumerate nothing (they 404-equivalent to empty).
    if (scope === 'all') {
        // no extra condition
    } else if (scope.startsWith('feed:')) {
        const feedId = scope.slice(5);
        if (!isUuid(feedId)) throw new HttpError(400, 'invalid feed id');
        conditions.push(`a.feed_id = $${paramIdx} AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)`);
        params.push(feedId);
        paramIdx++;
    } else if (scope.startsWith('folder:')) {
        const folderId = scope.slice(7);
        if (!isUuid(folderId)) throw new HttpError(400, 'invalid folder id');
        conditions.push(`a.feed_id IN (
            SELECT ff.feed_id FROM folder_feeds ff
            JOIN folders fo ON fo.id = ff.folder_id
            WHERE ff.folder_id = $${paramIdx} AND fo.user_id = $1
        )`);
        params.push(folderId);
        paramIdx++;
    } else {
        throw new HttpError(400, 'invalid scope');
    }

    // Unread filter
    if (unreadOnly) {
        conditions.push('COALESCE(s.read, false) = false');
    }

    // Since filter
    if (since) {
        const sinceMs = Number(since);
        if (!Number.isFinite(sinceMs)) throw new HttpError(400, 'invalid since');
        conditions.push('a.published_at >= $' + paramIdx);
        params.push(new Date(sinceMs));
        paramIdx++;
    }

    // Cursor filter
    if (validCursor) {
        if (sort === 'newest') {
            conditions.push('(a.published_at, a.id) < ($' + paramIdx + ', $' + (paramIdx + 1) + ')');
            params.push(new Date(validCursor.k as number), validCursor.id);
            paramIdx += 2;
        } else if (sort === 'oldest') {
            conditions.push('(a.published_at, a.id) > ($' + paramIdx + ', $' + (paramIdx + 1) + ')');
            params.push(new Date(validCursor.k as number), validCursor.id);
            paramIdx += 2;
        } else {
            conditions.push('(a.hot, a.id) < ($' + paramIdx + ', $' + (paramIdx + 1) + ')');
            params.push(validCursor.k, validCursor.id);
            paramIdx += 2;
        }
    }

    const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

    const orderClause = sort === 'oldest'
        ? 'ORDER BY a.published_at ASC, a.id ASC'
        : sort === 'hot'
            ? 'ORDER BY a.hot DESC, a.id DESC'
            : 'ORDER BY a.published_at DESC, a.id DESC';

    // Fetch limit+1 to detect if there are more results
    params.push(limit + 1);

    const {rows} = await pool.query(
        `SELECT a.*,
                COALESCE(s.read, false) AS read,
                COALESCE(s.starred, false) AS starred,
                s.read_at
         FROM articles a
         LEFT JOIN article_state s ON s.article_id = a.id AND s.user_id = $1
         ${whereClause}
         ${orderClause}
         LIMIT $${paramIdx}`,
        params,
    );

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(mapArticle);

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
        const last = items[items.length - 1];
        if (sort === 'newest' || sort === 'oldest') {
            nextCursor = encodeCursor({k: last.published, id: last.id});
        } else {
            nextCursor = encodeCursor({k: last.hot, id: last.id});
        }
    }

    return {items, nextCursor};
};

// ---- POST /articles/state ----

export const updateArticleStateHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as {
        updates?: Array<{ id: string; read?: boolean; starred?: boolean }>;
    } | null;

    if (!Array.isArray(body?.updates)) {
        throw new HttpError(400, 'updates array is required');
    }

    const pool = getPool();
    let updated = 0;

    // Ownership pre-filter: only articles living in the caller's own feeds
    // are writable, so foreign ids become no-ops instead of state rows.
    // Article ids are sha256 hex hashes, NOT uuids — never gate them
    // through isUuid here.
    const requestedIds = body.updates
        .map((u) => u.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const ownedIds = new Set<string>();
    if (requestedIds.length > 0) {
        const {rows: owned} = await pool.query<{ id: string }>(
            `SELECT a.id FROM articles a
             WHERE a.id = ANY($1::text[])
               AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $2)`,
            [requestedIds, user.id],
        );
        for (const row of owned) ownedIds.add(row.id);
    }

    for (const u of body.updates) {
        if (!u.id || !ownedIds.has(u.id)) continue;
        if (u.read === undefined && u.starred === undefined) continue;

        const readAt = u.read === true ? new Date() : u.read === false ? null : undefined;

        try {
            const result = await pool.query(
                // VALUES must never see NULL for the NOT NULL booleans —
                // Postgres applies column DEFAULTs only when the column is
                // omitted, not when an explicit null arrives. Partial
                // updates still merge field-by-field in the conflict clause.
                `INSERT INTO article_state (user_id, article_id, read, read_at, starred)
                 VALUES ($1, $2, COALESCE($3, false), $4, COALESCE($5, false))
                 ON CONFLICT (user_id, article_id) DO UPDATE SET
                    read = COALESCE($3, article_state.read),
                    read_at = CASE WHEN $3 IS NOT NULL THEN $4 ELSE article_state.read_at END,
                    starred = COALESCE($5, article_state.starred)`,
                [
                    user.id,
                    u.id,
                    u.read ?? null,
                    readAt ?? null,
                    u.starred ?? null,
                ],
            );
            if (result.rowCount) updated += result.rowCount;
        } catch (err) {
            // 23503: article pruned between page render and this write — skip.
            if ((err as {code?: string}).code !== '23503') throw err;
        }
    }

    return {ok: true, updated};
};

// ---- POST /articles/read-before ----

export const readBeforeHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as {
        feedIds?: string[];
        cutoff?: number;
    } | null;

    if (!body?.cutoff || typeof body.cutoff !== 'number') {
        throw new HttpError(400, 'cutoff (epoch ms) is required');
    }
    if (body.feedIds?.some((id) => !isUuid(id))) {
        throw new HttpError(400, 'invalid feed id');
    }

    const pool = getPool();
    const cutoffDate = new Date(body.cutoff);

    if (body.feedIds && body.feedIds.length > 0) {
        for (const feedId of body.feedIds) {
            await pool.query(
                `INSERT INTO article_state (user_id, article_id, read, read_at)
                 SELECT $1, a.id, true, now()
                 FROM articles a
                 WHERE a.feed_id = $2 AND a.published_at < $3
                   AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)
                 ON CONFLICT (user_id, article_id) DO UPDATE SET
                    read = true,
                    read_at = COALESCE(article_state.read_at, now())`,
                [user.id, feedId, cutoffDate],
            );
        }
    } else {
        await pool.query(
            `INSERT INTO article_state (user_id, article_id, read, read_at)
             SELECT $1, a.id, true, now()
             FROM articles a
             WHERE a.published_at < $2
               AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)
             ON CONFLICT (user_id, article_id) DO UPDATE SET
                read = true,
                read_at = COALESCE(article_state.read_at, now())`,
            [user.id, cutoffDate],
        );
    }

    return {ok: true};
};

// ---- POST /articles/read-all ----

export const readAllHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as {
        feedId?: string;
    } | null;
    if (body?.feedId && !isUuid(body.feedId)) {
        throw new HttpError(400, 'invalid feed id');
    }

    const pool = getPool();

    if (body?.feedId) {
        await pool.query(
            `INSERT INTO article_state (user_id, article_id, read, read_at)
             SELECT $1, a.id, true, now()
             FROM articles a
             WHERE a.feed_id = $2
               AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)
             ON CONFLICT (user_id, article_id) DO UPDATE SET
                read = true,
                read_at = COALESCE(article_state.read_at, now())`,
            [user.id, body.feedId],
        );
    } else {
        await pool.query(
            `INSERT INTO article_state (user_id, article_id, read, read_at)
             SELECT $1, a.id, true, now()
             FROM articles a
             WHERE a.feed_id IN (SELECT id FROM feeds WHERE user_id = $1)
             ON CONFLICT (user_id, article_id) DO UPDATE SET
                read = true,
                read_at = COALESCE(article_state.read_at, now())`,
            [user.id],
        );
    }

    return {ok: true};
};

// ---- POST /affinity ----

export const affinityHandler: RouteHandler = async ({req, user}) => {
    const body = await readJsonBody(req) as {
        articleId?: string;
        amount?: number;
    } | null;

    if (!body?.articleId || typeof body.amount !== 'number') {
        throw new HttpError(400, 'articleId and amount are required');
    }

    const pool = getPool();

    const {rows} = await pool.query<{ feed_id: string; domain: string | null; author: string | null }>(
        'SELECT feed_id, domain, author FROM articles WHERE id = $1',
        [body.articleId],
    );
    if (!rows[0]) throw new HttpError(404, 'Article not found');

    const article = rows[0];
    const amount = body.amount;
    const now = new Date();

    // Upsert affinity for feed
    await pool.query(
        `INSERT INTO user_affinity (user_id, key, value, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, key) DO UPDATE SET
            value = GREATEST(0, user_affinity.value * 0.9) + $3,
            updated_at = $4`,
        [user.id, 'aff:feed:' + article.feed_id, amount, now],
    );

    // Upsert affinity for domain (skip if missing)
    if (article.domain) {
        await pool.query(
            `INSERT INTO user_affinity (user_id, key, value, updated_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, key) DO UPDATE SET
                value = GREATEST(0, user_affinity.value * 0.9) + $3,
                updated_at = $4`,
            [user.id, 'aff:domain:' + article.domain, amount, now],
        );
    }

    // Upsert affinity for author (skip if missing)
    if (article.author) {
        await pool.query(
            `INSERT INTO user_affinity (user_id, key, value, updated_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, key) DO UPDATE SET
                value = GREATEST(0, user_affinity.value * 0.9) + $3,
                updated_at = $4`,
            [user.id, 'aff:author:' + article.author.toLowerCase(), amount, now],
        );
    }

    return {ok: true};
};
