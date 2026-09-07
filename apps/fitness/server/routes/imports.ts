import type {PoolClient} from 'pg';
import {parseMetricId} from 'fitness-core';
import {getPool} from '../db.js';
import {LOCAL_USER_ID} from '../env.js';
import {HttpError, readJsonBody, type RouteHandler} from '../http.js';

interface IncomingSample {
    metric: string;
    t: number;
    valueSi: number;
    source: string;
    originId: string;
}

const MAX_ROWS = 2_000;

function sampleSource(raw: unknown): string {
    if (raw === 'health-connect' || raw === 'health-connect-db' || raw === 'manual' || raw === 'five31' || raw === 'csv') return raw;
    return 'csv';
}

function asSample(value: unknown): IncomingSample | null {
    if (typeof value !== 'object' || value === null) return null;
    const rec = value as Record<string, unknown>;
    const metric = typeof rec.metric === 'string' ? parseMetricId(rec.metric) : null;
    const t = Number(rec.t);
    const valueSi = Number(rec.valueSi);
    const originId = typeof rec.originId === 'string' ? rec.originId : '';
    if (!metric || !Number.isFinite(t) || !Number.isFinite(valueSi) || !originId) return null;
    return {metric, t, valueSi, source: sampleSource(rec.source), originId};
}

function sampleKey(sample: IncomingSample): string {
    return `${sample.metric}|${sample.t}|${sample.source}|${sample.originId}`;
}

function collectSamples(raw: unknown[]): {samples: IncomingSample[]; errorCount: number; errors: string[]} {
    const byKey = new Map<string, IncomingSample>();
    const errors: string[] = [];
    let errorCount = 0;
    for (const item of raw) {
        const sample = asSample(item);
        if (sample) {
            byKey.set(sampleKey(sample), sample);
            continue;
        }
        errorCount += 1;
        if (errors.length < 20) errors.push('invalid sample');
    }
    return {samples: [...byKey.values()], errorCount, errors};
}

async function rebuildRollups(client: PoolClient, metrics: string[]): Promise<void> {
    if (!metrics.length) return;
    await client.query(
        `INSERT INTO daily_rollups (user_id, metric, day, min_si, max_si, avg_si, sum_si, n)
         SELECT user_id, metric, (t AT TIME ZONE 'UTC')::date AS day,
                MIN(value_si), MAX(value_si), AVG(value_si), SUM(value_si), COUNT(*)::int
         FROM samples
         WHERE user_id = $1 AND metric = ANY($2::text[])
         GROUP BY user_id, metric, (t AT TIME ZONE 'UTC')::date
         ON CONFLICT (user_id, metric, day) DO UPDATE SET
            min_si = EXCLUDED.min_si,
            max_si = EXCLUDED.max_si,
            avg_si = EXCLUDED.avg_si,
            sum_si = EXCLUDED.sum_si,
            n = EXCLUDED.n`,
        [LOCAL_USER_ID, metrics],
    );
}

async function insertSamples(client: PoolClient, samples: IncomingSample[]): Promise<void> {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let i = 1;
    for (const sample of samples) {
        placeholders.push(`($${i++}, $${i++}, to_timestamp($${i++} / 1000.0), $${i++}, $${i++}, $${i++})`);
        values.push(LOCAL_USER_ID, sample.metric, sample.t, sample.valueSi, sample.source, sample.originId);
    }
    await client.query(
        `INSERT INTO samples (user_id, metric, t, value_si, source, origin_id)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (user_id, metric, t, source, origin_id) DO UPDATE SET value_si = EXCLUDED.value_si`,
        values,
    );
    await rebuildRollups(client, [...new Set(samples.map((s) => s.metric))]);
}

async function commitImport(
    samples: IncomingSample[],
    source: string,
    errorCount: number,
    errors: string[],
): Promise<{importId: string | undefined; stored: number; skipped: number; errors: string[]}> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const inserted = await client.query<{id: string}>(
            `INSERT INTO imports (user_id, source, row_count, error_count, errors)
             VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
            [LOCAL_USER_ID, source, samples.length, errorCount, JSON.stringify(errors)],
        );
        if (samples.length) await insertSamples(client, samples);
        const importId = inserted.rows[0]?.id;
        await client.query('UPDATE imports SET finished_at = now() WHERE id = $1', [importId]);
        await client.query('COMMIT');
        return {importId, stored: samples.length, skipped: errorCount, errors};
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export const importHandler: RouteHandler = async ({req}) => {
    const body = (await readJsonBody(req)) as {samples?: unknown; source?: unknown} | null;
    const raw = Array.isArray(body?.samples) ? body.samples : [];
    if (raw.length > MAX_ROWS) throw new HttpError(400, `at most ${MAX_ROWS} samples per request`);
    const {samples, errorCount, errors} = collectSamples(raw);
    return commitImport(samples, sampleSource(body?.source), errorCount, errors);
};
