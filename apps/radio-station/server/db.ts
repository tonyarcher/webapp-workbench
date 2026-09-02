import pg from 'pg';
import {DATABASE_URL} from './env.js';
import {SCHEMA} from './schema.js';
import {seedCatalog} from './seed.js';

const DB_NAME_RE = /^[a-z][a-z0-9_]*$/;

let pool: pg.Pool | null = null;
let migrated = false;

export function getPool(): pg.Pool {
    if (!pool) pool = new pg.Pool({connectionString: DATABASE_URL, max: 10});
    return pool;
}

function adminUrl(databaseUrl: string): {admin: string; dbName: string} {
    const url = new URL(databaseUrl);
    const dbName = url.pathname.replace(/^\//, '');
    if (!DB_NAME_RE.test(dbName)) throw new Error(`refusing database name "${dbName}"`);
    url.pathname = '/postgres';
    return {admin: url.toString(), dbName};
}

/** Create the app database if the volume predates this service. */
export async function ensureDatabase(): Promise<void> {
    const {admin, dbName} = adminUrl(DATABASE_URL);
    const client = new pg.Client({connectionString: admin});
    await client.connect();
    try {
        const {rows} = await client.query<{exists: number}>('SELECT 1 AS exists FROM pg_database WHERE datname = $1', [dbName]);
        if (rows.length) return;
        await client.query(`CREATE DATABASE ${dbName}`);
    } finally {
        await client.end();
    }
}

export async function migrate(): Promise<void> {
    if (migrated) return;
    const p = getPool();
    await p.query(SCHEMA);
    await seedCatalog(p);
    migrated = true;
}

export async function closePool(): Promise<void> {
    if (!pool) return;
    const p = pool;
    await p.end();
    pool = null;
    migrated = false;
}

export async function bootDb(): Promise<void> {
    await ensureDatabase();
    await migrate();
}
