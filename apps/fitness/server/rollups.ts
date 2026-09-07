import type {PoolClient} from 'pg';

export async function rebuildRollups(client: PoolClient, userId: string, metrics: string[]): Promise<void> {
    if (!metrics.length) return;
    await client.query(`DELETE FROM daily_rollups WHERE user_id = $1 AND metric = ANY($2::text[])`, [userId, metrics]);
    await client.query(
        `INSERT INTO daily_rollups (user_id, metric, day, min_si, max_si, avg_si, sum_si, n)
         SELECT user_id, metric, (t AT TIME ZONE 'UTC')::date AS day,
                MIN(value_si), MAX(value_si), AVG(value_si), SUM(value_si), COUNT(*)::int
         FROM samples
         WHERE user_id = $1 AND metric = ANY($2::text[]) AND hidden = false
         GROUP BY user_id, metric, (t AT TIME ZONE 'UTC')::date`,
        [userId, metrics],
    );
}
