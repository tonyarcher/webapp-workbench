import {createServer} from 'node:http';
import {rm, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

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

    process.env.DATABASE_URL = `postgres://rss:rss@127.0.0.1:${PG_PORT}/fitness`;
    process.env.PORT = '0';
    process.env.LISTEN_HOST = '127.0.0.1';

    const {startServer} = await import('../server/app.ts');
    const started = await withTimeout(startServer(0, '127.0.0.1'), 30_000, 'startServer');
    closeSrv = () => started.close();
    const base = `http://127.0.0.1:${started.port}`;

    const health = await fetch(`${base}/healthz`);
    assert(health.status === 200, 'healthz 200');
    assert((await health.json() as {ok: boolean}).ok === true, 'healthz ok');

    const sample = {
        metric: 'body_mass',
        t: Date.parse('2026-01-05T08:00:00Z'),
        valueSi: 82,
        source: 'csv',
        originId: 'csv:body_mass:1',
    };
    const first = await fetch(`${base}/imports`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({samples: [sample], source: 'csv'}),
    });
    assert(first.status === 200, 'POST imports 200');
    const stored = await first.json() as {stored: number};
    assert(stored.stored === 1, 'stored 1');

    const dup = await fetch(`${base}/imports`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({samples: [sample, sample], source: 'csv'}),
    });
    assert(dup.status === 200, 'duplicate identity in one request 200');
    const dupBody = await dup.json() as {stored: number};
    assert(dupBody.stored === 1, 'duplicate identity collapsed to one row');

    const replay = await fetch(`${base}/imports`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({samples: [{...sample, valueSi: 83}], source: 'csv'}),
    });
    const replayed = await replay.json() as {stored: number};
    assert(replayed.stored === 1, 'reimport upserts');

    const stats = await fetch(`${base}/stats`).then((r) => r.json()) as {metrics: {metric: string; n: number}[]};
    assert(stats.metrics.length === 1 && stats.metrics[0]?.n === 1, 'one body_mass row after upsert');

    const latest = await fetch(`${base}/samples/latest`).then((r) => r.json()) as {latest: {valueSi: number}[]};
    assert(latest.latest[0]?.valueSi === 83, 'upsert replaced value');

    const profile = await fetch(`${base}/profile`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            sex: 'male',
            birthYear: 1988,
            heightM: 1.8,
            displayUnit: 'lb',
            tm: {squat: 160, bench: 100, deadlift: 180, press: 70},
        }),
    });
    assert(profile.status === 200, 'PUT profile 200');
    const got = await fetch(`${base}/profile`).then((r) => r.json()) as {sex: string; displayUnit: string; tm: {squat: number}};
    assert(got.sex === 'male' && got.displayUnit === 'lb' && got.tm.squat === 160, 'profile round-trip');

    const badLimit = await fetch(`${base}/samples?limit=abc`);
    assert(badLimit.status === 200, 'GET samples invalid limit 200');

    const {getPool} = await import('../server/db.ts');
    const {rows} = await getPool().query<{n: string}>('SELECT COUNT(*)::text AS n FROM daily_rollups');
    assert(Number(rows[0]?.n) === 1, 'rollup row written');
    const unfinished = await getPool().query<{n: string}>('SELECT COUNT(*) FILTER (WHERE finished_at IS NULL)::text AS n FROM imports');
    assert(Number(unfinished.rows[0]?.n) === 0, 'no unfinished import rows');

    const waist = {
        metric: 'waist',
        t: Date.parse('2026-02-01T08:00:00Z'),
        valueSi: 0.9,
        source: 'manual',
        originId: 'manual:waist:1',
    };
    await fetch(`${base}/imports`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({samples: [waist, {...waist, t: Date.parse('2026-02-08T08:00:00Z'), originId: 'manual:waist:2', valueSi: 0.88}], source: 'manual'}),
    });
    const series = await fetch(`${base}/series?metric=waist`).then((r) => r.json()) as {points: {v: number}[]; n: number};
    assert(series.n === 2 && series.points.length === 2, 'series has waist points');
    const hide = await fetch(`${base}/samples`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({metric: 'waist', originId: 'manual:waist:2', hidden: true}),
    });
    assert(hide.status === 200, 'PATCH hide 200');
    const afterHide = await fetch(`${base}/series?metric=waist`).then((r) => r.json()) as {n: number};
    assert(afterHide.n === 1, 'hidden point excluded from series');
    const latestWaist = await fetch(`${base}/samples/latest`).then((r) => r.json()) as {latest: {metric: string; valueSi: number}[]};
    const waistLatest = latestWaist.latest.find((s) => s.metric === 'waist');
    assert(waistLatest?.valueSi === 0.9, 'latest waist is visible row');
    const rolls = await fetch(`${base}/rollups`).then((r) => r.json()) as {rollups: {metric: string; day: string}[]};
    const waistDays = rolls.rollups.filter((r) => r.metric === 'waist');
    assert(waistDays.length === 1, 'hidden day dropped from rollups');
    const over = await fetch(`${base}/samples`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({metric: 'waist', originId: 'manual:waist:1', valueSi: 0.85}),
    });
    assert(over.status === 200, 'PATCH override 200');
    const latestOver = await fetch(`${base}/samples/latest`).then((r) => r.json()) as {latest: {metric: string; valueSi: number}[]};
    assert(latestOver.latest.find((s) => s.metric === 'waist')?.valueSi === 0.85, 'override becomes latest');

    console.log('\nAll fitness integration tests passed.');
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
