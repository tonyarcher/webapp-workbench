import type pg from 'pg';
import {PLACEHOLDER_TRACKS, STATION_FORMAT, STATION_ID, STATION_NAME} from './seed-data.js';

async function insertTracks(client: pg.PoolClient): Promise<void> {
    for (const track of PLACEHOLDER_TRACKS) {
        await client.query(
            `INSERT INTO tracks
             (id, mbid, artist, title, duration_ms, year, genre, era, rotation, rank, explicit, radio_edit)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                track.id,
                track.mbid ?? null,
                track.artist,
                track.title,
                track.durationMs,
                track.year,
                track.genre,
                track.era,
                track.rotation,
                track.rank,
                track.explicit,
                track.radioEdit,
            ],
        );
    }
}

export async function seedCatalog(pool: pg.Pool): Promise<void> {
    await pool.query(
        `INSERT INTO stations (id, name, format) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, format = EXCLUDED.format`,
        [STATION_ID, STATION_NAME, STATION_FORMAT],
    );
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const {rows} = await client.query<{count: string}>('SELECT COUNT(*)::text AS count FROM tracks');
        if (Number(rows[0]?.count ?? 0) === 0) await insertTracks(client);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
