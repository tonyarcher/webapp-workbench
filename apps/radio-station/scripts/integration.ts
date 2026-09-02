import {createServer} from 'node:http';
import {rm, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PLACEHOLDER_TRACKS} from '../server/seed-data.ts';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            const port = typeof addr === 'object' && addr ? addr.port : 0;
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms);
        p.then(
            (v) => {
                clearTimeout(t);
                resolve(v);
            },
            (e) => {
                clearTimeout(t);
                reject(e);
            },
        );
    });
}

let EmbeddedPostgresCtor: typeof import('embedded-postgres').default;
try {
    const mod = await import('embedded-postgres');
    EmbeddedPostgresCtor = mod.default;
} catch (err) {
    console.error('FATAL: embedded-postgres import failed. Install with: npm install');
    console.error(err);
    process.exit(1);
}

const PG_PORT = await freePort();
const DATA_DIR = fileURLToPath(new URL('../.tmp/integration-pg', import.meta.url));

try {
    await rm(DATA_DIR, {recursive: true, force: true});
} catch (err) {
    throw new Error(`Could not remove leftover ${DATA_DIR}. ${err}`);
}
await mkdir(DATA_DIR, {recursive: true});

const pg = new EmbeddedPostgresCtor({
    databaseDir: DATA_DIR,
    user: 'rss',
    password: 'rss',
    port: PG_PORT,
    persistent: false,
});

let pgStarted = false;
let closeSrv: (() => Promise<void>) | undefined;

try {
    await withTimeout(pg.initialise(), 60_000, 'embedded-postgres initialise');
    await withTimeout(pg.start(), 60_000, 'embedded-postgres start');
    pgStarted = true;

    process.env.DATABASE_URL = `postgres://rss:rss@127.0.0.1:${PG_PORT}/radio`;
    process.env.PORT = '0';
    process.env.LISTEN_HOST = '127.0.0.1';

    const {startServer} = await import('../server/app.ts');
    const started = await withTimeout(startServer(0, '127.0.0.1'), 30_000, 'startServer');
    closeSrv = () => started.close();
    const base = `http://127.0.0.1:${started.port}`;

    const health = await fetch(`${base}/healthz`);
    assert(health.status === 200, 'healthz 200');
    assert((await health.json() as {ok: boolean}).ok === true, 'healthz ok');

    const stations = await fetch(`${base}/stations`).then((r) => r.json()) as {id: string}[];
    assert(stations.some((s) => s.id === 'top40'), 'stations include top40');

    const {getPool} = await import('../server/db.ts');
    const {rows} = await getPool().query<{count: string}>('SELECT COUNT(*)::text AS count FROM tracks');
    assert(Number(rows[0]?.count) === PLACEHOLDER_TRACKS.length, 'catalog seeded');

    const body = {
        stationId: 'top40',
        seed: 'autumn-oak',
        startsAt: Date.UTC(2026, 8, 1),
        weights: {hitGravity: 70, goldLeak: 15, temperature: 40, separation: 60, powerOrbitMin: 90},
    };
    const first = await fetch(`${base}/playlists`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    });
    assert(first.status === 200, 'POST playlists 200');
    const created = await first.json() as {playlist: {id: string; stationName: string; seed: string}; entries: unknown[]};
    assert(created.playlist.seed === 'autumn-oak', 'playlist seed echoed');
    assert(created.entries.length > 1000, 'entries cover a week');

    const second = await fetch(`${base}/playlists`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    });
    const replay = await second.json() as {playlist: {id: string}};
    assert(replay.playlist.id === created.playlist.id, 'same body returns same playlist id');

    const txtRes = await fetch(`${base}/playlists/${created.playlist.id}.txt`);
    assert(txtRes.status === 200, 'GET playlist txt 200');
    const txt = await txtRes.text();
    assert(txt.startsWith('Pulse 101 — '), 'txt starts with station line');
    assert(txt.includes('seed: autumn-oak'), 'txt includes seed');

    console.log('\nAll integration tests passed.');
} finally {
    if (closeSrv) {
        try {
            await closeSrv();
        } catch {
            // ignore cleanup errors
        }
    }
    if (pgStarted) {
        try {
            await pg.stop();
        } catch {
            // ignore cleanup errors
        }
    }
    try {
        await rm(DATA_DIR, {recursive: true, force: true});
    } catch {
        // ignore cleanup errors
    }
}
