import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {WEEK_MS} from './env.js';
import {getPool} from './db.js';
import {HttpError} from './http.js';
import {generateWeek} from './services/scheduler.js';
import {canonicalizeWeights, weightsJson} from './services/weights.js';
import {normalizeSeed, randomSeed} from './services/seed-words.js';
import type {PlaylistEntryRow, PlaylistRow, Track, Weights} from './types.js';

interface TrackRow {
    id: string;
    artist: string;
    title: string;
    duration_ms: number;
    year: number | null;
    genre: string;
    era: string;
    rotation: string;
    rank: number;
    explicit: boolean;
    radio_edit: boolean;
    mbid: string | null;
}

function mapTrack(row: TrackRow): Track {
    const track: Track = {
        id: row.id,
        artist: row.artist,
        title: row.title,
        durationMs: row.duration_ms,
        year: row.year ?? 0,
        genre: row.genre,
        era: row.era as Track['era'],
        rotation: row.rotation as Track['rotation'],
        rank: row.rank,
        explicit: row.explicit,
        radioEdit: row.radio_edit,
    };
    if (row.mbid) track.mbid = row.mbid;
    return track;
}

function mapPlaylist(row: {
    id: string;
    station_id: string;
    station_name: string;
    seed: string;
    starts_at: Date;
    duration_ms: string | number;
    weights: Weights;
    created_at: Date;
}): PlaylistRow {
    return {
        id: row.id,
        stationId: row.station_id,
        stationName: row.station_name,
        seed: row.seed,
        startsAt: row.starts_at.getTime(),
        durationMs: Number(row.duration_ms),
        weights: canonicalizeWeights(row.weights),
        createdAt: row.created_at.getTime(),
    };
}

export async function listStations(): Promise<{id: string; name: string; format: string}[]> {
    const {rows} = await getPool().query<{id: string; name: string; format: string}>(
        'SELECT id, name, format FROM stations ORDER BY name',
    );
    return rows;
}

export async function loadTracks(): Promise<Track[]> {
    const {rows} = await getPool().query<TrackRow>('SELECT * FROM tracks ORDER BY rotation, rank');
    return rows.map(mapTrack);
}

async function findPlaylist(
    pool: pg.Pool,
    stationId: string,
    seed: string,
    startsAt: Date,
    weights: Weights,
): Promise<PlaylistRow | null> {
    const {rows} = await pool.query(
        `SELECT p.*, s.name AS station_name
         FROM playlists p
         JOIN stations s ON s.id = p.station_id
         WHERE p.station_id = $1 AND p.seed = $2 AND p.starts_at = $3 AND p.weights = $4::jsonb`,
        [stationId, seed, startsAt, weightsJson(weights)],
    );
    return rows[0] ? mapPlaylist(rows[0]) : null;
}

async function insertEntries(client: pg.PoolClient, playlistId: string, entries: PlaylistEntryRow[]): Promise<void> {
    const chunkSize = 200;
    for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const values: unknown[] = [];
        const placeholders = chunk.map((entry, offset) => {
            const base = offset * 5;
            values.push(playlistId, entry.idx, entry.trackId, new Date(entry.startsAt), entry.durationMs);
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        });
        await client.query(
            `INSERT INTO playlist_entries (playlist_id, idx, track_id, starts_at, duration_ms)
             VALUES ${placeholders.join(',')}`,
            values,
        );
    }
}

async function persistWeek(
    pool: pg.Pool,
    stationId: string,
    seed: string,
    startsAt: Date,
    weights: Weights,
    entries: PlaylistEntryRow[],
): Promise<PlaylistRow> {
    const id = randomUUID();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO playlists (id, station_id, seed, starts_at, duration_ms, weights)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [id, stationId, seed, startsAt, WEEK_MS, weightsJson(weights)],
        );
        await insertEntries(client, id, entries);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    const created = await getPlaylist(id);
    if (!created) throw new Error('playlist insert vanished');
    return created;
}

export async function getPlaylist(id: string): Promise<PlaylistRow | null> {
    const {rows} = await getPool().query(
        `SELECT p.*, s.name AS station_name
         FROM playlists p
         JOIN stations s ON s.id = p.station_id
         WHERE p.id = $1`,
        [id],
    );
    return rows[0] ? mapPlaylist(rows[0]) : null;
}

export async function getEntries(playlistId: string): Promise<PlaylistEntryRow[]> {
    const {rows} = await getPool().query<{
        idx: number;
        track_id: string;
        artist: string;
        title: string;
        starts_at: Date;
        duration_ms: number;
        rotation: string;
        era: string;
    }>(
        `SELECT e.idx, e.track_id, t.artist, t.title, e.starts_at, e.duration_ms, t.rotation, t.era
         FROM playlist_entries e
         JOIN tracks t ON t.id = e.track_id
         WHERE e.playlist_id = $1
         ORDER BY e.idx`,
        [playlistId],
    );
    return rows.map((row) => ({
        idx: row.idx,
        trackId: row.track_id,
        artist: row.artist,
        title: row.title,
        startsAt: row.starts_at.getTime(),
        durationMs: row.duration_ms,
        rotation: row.rotation as PlaylistEntryRow['rotation'],
        era: row.era as PlaylistEntryRow['era'],
    }));
}

function utcMidnightMs(now = Date.now()): number {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseStartsAt(value: unknown): number {
    if (value == null || value === '') return utcMidnightMs();
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new HttpError(400, 'startsAt must be epoch milliseconds');
    }
    return value;
}

function isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && (err as {code: string}).code === '23505';
}

function toEntryRows(scheduled: ReturnType<typeof generateWeek>): PlaylistEntryRow[] {
    return scheduled.map((entry, idx) => ({
        idx,
        trackId: entry.trackId,
        artist: entry.artist,
        title: entry.title,
        startsAt: entry.startsAtMs,
        durationMs: entry.durationMs,
        rotation: entry.rotation,
        era: entry.era,
    }));
}

async function persistGenerated(
    pool: ReturnType<typeof getPool>,
    stationId: string,
    seed: string,
    startsAt: Date,
    weights: Weights,
    entries: PlaylistEntryRow[],
): Promise<{playlist: PlaylistRow; entries: PlaylistEntryRow[]}> {
    try {
        const playlist = await persistWeek(pool, stationId, seed, startsAt, weights, entries);
        return {playlist, entries};
    } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        const raced = await findPlaylist(pool, stationId, seed, startsAt, weights);
        if (!raced) throw err;
        return {playlist: raced, entries: await getEntries(raced.id)};
    }
}

export async function generatePlaylist(body: {
    stationId?: string;
    seed?: string;
    startsAt?: number;
    weights?: unknown;
}): Promise<{playlist: PlaylistRow; entries: PlaylistEntryRow[]}> {
    const stationId = body.stationId ?? 'top40';
    const stations = await listStations();
    if (!stations.some((s) => s.id === stationId)) throw new HttpError(400, 'unknown station');
    const seed = body.seed ? normalizeSeed(body.seed) : randomSeed();
    const startsAtMs = parseStartsAt(body.startsAt);
    const weights = canonicalizeWeights(body.weights);
    const startsAt = new Date(startsAtMs);
    const pool = getPool();
    const existing = await findPlaylist(pool, stationId, seed, startsAt, weights);
    if (existing) return {playlist: existing, entries: await getEntries(existing.id)};
    const tracks = await loadTracks();
    const entries = toEntryRows(generateWeek({tracks, seed, startsAtMs, weights}));
    return persistGenerated(pool, stationId, seed, startsAt, weights, entries);
}
