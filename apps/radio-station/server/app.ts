import {createServer, type Server} from 'node:http';
import {PORT} from './env.js';
import {bootDb, closePool} from './db.js';
import {route, createDispatcher} from './http.js';
import {healthHandler} from './routes/health.js';
import {stationsHandler} from './routes/stations.js';
import {
    createPlaylistHandler,
    getEntriesHandler,
    getPlaylistHandler,
    getPlaylistTxtHandler,
} from './routes/playlists.js';

const routes = [
    route('GET', '/healthz', healthHandler),
    route('GET', '/stations', stationsHandler),
    route('POST', '/playlists', createPlaylistHandler),
    route('GET', '/playlists/:id', getPlaylistHandler),
    route('GET', '/playlists/:id/entries', getEntriesHandler),
    route('GET', '/playlists/:id/txt', getPlaylistTxtHandler),
];

export interface RunningServer {
    port: number;
    close(): Promise<void>;
}

function makeShutdown(srv: Server): () => Promise<void> {
    let closed = false;
    return async () => {
        if (closed) return;
        closed = true;
        await new Promise<void>((res, rej) => {
            srv.close((e) => (e ? rej(e) : res()));
        });
        await closePool();
    };
}

export async function startServer(
    port = Number(process.env.PORT ?? PORT),
    host = process.env.LISTEN_HOST ?? '0.0.0.0',
): Promise<RunningServer> {
    await bootDb();
    const dispatch = createDispatcher(routes);
    return new Promise<RunningServer>((resolve, reject) => {
        const srv: Server = createServer(dispatch);
        let resolved = false;
        srv.on('error', (err) => {
            if (!resolved) reject(err);
            else console.error('radio-api server error:', err);
        });
        srv.listen(port, host, () => {
            resolved = true;
            const assignedPort = (srv.address() as {port: number}).port;
            resolve({port: assignedPort, close: makeShutdown(srv)});
        });
    });
}
