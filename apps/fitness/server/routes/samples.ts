import {downsampleLttb} from 'fitness-core';
import {getPool} from '../db.js';
import {LOCAL_USER_ID} from '../env.js';
import {HttpError, readJsonBody, type RouteHandler} from '../http.js';
import {rebuildRollups} from '../rollups.js';

const VISIBLE = 'hidden = false';

export const statsHandler: RouteHandler = async (_ctx) => {
    const {rows} = await getPool().query<{metric: string; n: string; first_t: Date; last_t: Date}>(
        `SELECT metric, COUNT(*)::text AS n, MIN(t) AS first_t, MAX(t) AS last_t
         FROM samples WHERE user_id = $1 AND ${VISIBLE}
         GROUP BY metric
         ORDER BY metric`,
        [LOCAL_USER_ID],
    );
    return {
        metrics: rows.map((row) => ({
            metric: row.metric,
            n: Number(row.n),
            firstT: row.first_t.getTime(),
            lastT: row.last_t.getTime(),
        })),
    };
};

export const latestHandler: RouteHandler = async (_ctx) => {
    const {rows} = await getPool().query<{metric: string; t: Date; value_si: number}>(
        `SELECT DISTINCT ON (metric) metric, t, value_si
         FROM samples
         WHERE user_id = $1 AND ${VISIBLE}
         ORDER BY metric, t DESC, (source = 'override') DESC, value_si DESC`,
        [LOCAL_USER_ID],
    );
    return {
        latest: rows.map((row) => ({
            metric: row.metric,
            t: row.t.getTime(),
            valueSi: row.value_si,
        })),
    };
};

function samplesQuery(metric: string | null, from: number, to: number, limit: number): {sql: string; params: unknown[]} {
    const params: unknown[] = [LOCAL_USER_ID, new Date(from), new Date(to)];
    let sql = `SELECT metric, t, value_si, source, origin_id, hidden, note
               FROM samples
               WHERE user_id = $1 AND t >= $2 AND t <= $3 AND ${VISIBLE}`;
    if (metric) {
        params.push(metric);
        sql += ` AND metric = $4`;
    }
    sql += ` ORDER BY t ASC LIMIT ${limit}`;
    return {sql, params};
}

export const samplesHandler: RouteHandler = async ({query}) => {
    const from = Number(query.get('from') ?? '0');
    const to = Number(query.get('to') ?? String(Date.now()));
    const rawLimit = Number(query.get('limit') ?? '2000');
    const limit = Number.isFinite(rawLimit) ? Math.min(5_000, Math.max(1, rawLimit)) : 2_000;
    const {sql, params} = samplesQuery(
        query.get('metric'),
        Number.isFinite(from) ? from : 0,
        Number.isFinite(to) ? to : Date.now(),
        limit,
    );
    const {rows} = await getPool().query<{
        metric: string;
        t: Date;
        value_si: number;
        source: string;
        origin_id: string;
        hidden: boolean;
        note: string | null;
    }>(sql, params);
    return {samples: rows.map(mapSampleRow)};
};

function mapSampleRow(row: {
    metric: string;
    t: Date;
    value_si: number;
    source: string;
    origin_id: string;
    hidden: boolean;
    note: string | null;
}) {
    return {
        metric: row.metric,
        t: row.t.getTime(),
        valueSi: row.value_si,
        source: row.source,
        originId: row.origin_id,
        hidden: row.hidden,
        note: row.note,
    };
}

export const rollupsHandler: RouteHandler = async (_ctx) => {
    const {rows} = await getPool().query<{
        metric: string;
        day: Date;
        min_si: number;
        max_si: number;
        avg_si: number;
        sum_si: number;
        n: number;
    }>(
        `SELECT metric, day, min_si, max_si, avg_si, sum_si, n
         FROM daily_rollups WHERE user_id = $1
         ORDER BY metric, day`,
        [LOCAL_USER_ID],
    );
    return {
        rollups: rows.map((row) => ({
            metric: row.metric,
            day: row.day.toISOString().slice(0, 10),
            minSi: row.min_si,
            maxSi: row.max_si,
            avgSi: row.avg_si,
            sumSi: row.sum_si,
            n: row.n,
        })),
    };
};

export const seriesHandler: RouteHandler = async ({query}) => {
    const metric = query.get('metric');
    if (!metric) throw new HttpError(400, 'metric required');
    const from = Number(query.get('from') ?? '0');
    const to = Number(query.get('to') ?? String(Date.now()));
    const {rows} = await getPool().query<{t: Date; value_si: number; origin_id: string; source: string}>(
        `SELECT t, value_si, origin_id, source FROM samples
         WHERE user_id = $1 AND metric = $2 AND t >= $3 AND t <= $4 AND ${VISIBLE}
         ORDER BY t ASC`,
        [LOCAL_USER_ID, metric, new Date(Number.isFinite(from) ? from : 0), new Date(Number.isFinite(to) ? to : Date.now())],
    );
    const points = rows.map((row) => ({t: row.t.getTime(), v: row.value_si}));
    const down = downsampleLttb(points, 1_500);
    return {
        metric,
        points: down,
        n: points.length,
        origins: rows.slice(-80).map((row) => ({
            t: row.t.getTime(),
            valueSi: row.value_si,
            originId: row.origin_id,
            source: row.source,
        })),
    };
};

interface SampleRow {
    metric: string;
    t: Date;
    value_si: number;
    origin_id: string;
    source: string;
}

async function withTx(work: (client: import('pg').PoolClient) => Promise<void>): Promise<void> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        await work(client);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function applyOverride(row: SampleRow, valueSi: number, note: string | null): Promise<void> {
    await withTx(async (client) => {
        if (row.source === 'override') {
            await client.query(
                `UPDATE samples SET value_si = $4, note = $5, hidden = false
                 WHERE user_id = $1 AND metric = $2 AND origin_id = $3`,
                [LOCAL_USER_ID, row.metric, row.origin_id, valueSi, note],
            );
        } else {
            await client.query(
                `UPDATE samples SET hidden = true WHERE user_id = $1 AND metric = $2 AND origin_id = $3`,
                [LOCAL_USER_ID, row.metric, row.origin_id],
            );
            await client.query(
                `INSERT INTO samples (user_id, metric, t, value_si, source, origin_id, hidden, note)
                 VALUES ($1, $2, $3, $4, 'override', $5, false, $6)
                 ON CONFLICT (user_id, metric, t, source, origin_id) DO UPDATE SET value_si = EXCLUDED.value_si, note = EXCLUDED.note, hidden = false`,
                [LOCAL_USER_ID, row.metric, row.t, valueSi, `override:${row.origin_id}`, note],
            );
        }
        await rebuildRollups(client, LOCAL_USER_ID, [row.metric]);
    });
}

async function hideSample(row: SampleRow, note: string | null): Promise<void> {
    await withTx(async (client) => {
        await client.query(
            `UPDATE samples SET hidden = true, note = COALESCE($4, note)
             WHERE user_id = $1 AND metric = $2 AND origin_id = $3`,
            [LOCAL_USER_ID, row.metric, row.origin_id, note],
        );
        await rebuildRollups(client, LOCAL_USER_ID, [row.metric]);
    });
}

export const patchSampleHandler: RouteHandler = async ({req}) => {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body || typeof body.metric !== 'string' || typeof body.originId !== 'string') {
        throw new HttpError(400, 'metric and originId required');
    }
    const {rows} = await getPool().query<SampleRow>(
        `SELECT metric, t, value_si, origin_id, source FROM samples
         WHERE user_id = $1 AND metric = $2 AND origin_id = $3 LIMIT 1`,
        [LOCAL_USER_ID, body.metric, body.originId],
    );
    const row = rows[0];
    if (!row) throw new HttpError(404, 'sample not found');
    const note = typeof body.note === 'string' ? body.note : null;
    if (typeof body.valueSi === 'number') {
        if (!Number.isFinite(body.valueSi)) throw new HttpError(400, 'valueSi must be finite');
        await applyOverride(row, body.valueSi, note);
        return {ok: true, overridden: true};
    }
    if (body.hidden === true) {
        await hideSample(row, note);
        return {ok: true, hidden: true};
    }
    throw new HttpError(400, 'valueSi or hidden required');
};
