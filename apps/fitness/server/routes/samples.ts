import {getPool} from '../db.js';
import {LOCAL_USER_ID} from '../env.js';
import type {RouteHandler} from '../http.js';

export const statsHandler: RouteHandler = async (_ctx) => {
    const {rows} = await getPool().query<{metric: string; n: string; first_t: Date; last_t: Date}>(
        `SELECT metric, COUNT(*)::text AS n, MIN(t) AS first_t, MAX(t) AS last_t
         FROM samples WHERE user_id = $1
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
         WHERE user_id = $1
         ORDER BY metric, t DESC, value_si DESC`,
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
    let sql = `SELECT metric, t, value_si, source, origin_id
               FROM samples
               WHERE user_id = $1 AND t >= $2 AND t <= $3`;
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
    const {rows} = await getPool().query<{metric: string; t: Date; value_si: number; source: string; origin_id: string}>(sql, params);
    return {
        samples: rows.map((row) => ({
            metric: row.metric,
            t: row.t.getTime(),
            valueSi: row.value_si,
            source: row.source,
            originId: row.origin_id,
        })),
    };
};
