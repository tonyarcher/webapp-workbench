import {createServer, type Server} from 'node:http';
import {PORT} from './env.js';
import {migrate, closePool} from './db.js';
import {route, createDispatcher} from './http.js';
import {ensureUser} from './users.js';
import {startPoller, drainPoller} from './services/poller.js';

// ---- routes ----

import {healthHandler} from './routes/health.js';
import {getLibraryHandler, createFolderHandler, deleteFolderHandler, reorderFoldersHandler} from './routes/library.js';
import {createFeedHandler, deleteFeedHandler, updateFeedFoldersHandler} from './routes/feeds.js';
import {
    getArticlesHandler,
    updateArticleStateHandler,
    readBeforeHandler,
    readAllHandler,
    affinityHandler,
} from './routes/articles.js';
import {syncHandler} from './routes/sync.js';
import {exportOpmlHandler, importOpmlHandler} from './routes/opml.js';
import {migrateLibraryHandler} from './routes/migrate.js';

const routes = [
    route('GET', '/healthz', healthHandler, {public: true}),
    route('GET', '/library', getLibraryHandler),
    route('POST', '/folders', createFolderHandler),
    route('DELETE', '/folders/:id', deleteFolderHandler),
    route('POST', '/folders/reorder', reorderFoldersHandler),
    route('POST', '/feeds', createFeedHandler),
    route('DELETE', '/feeds/:id', deleteFeedHandler),
    route('PUT', '/feeds/:id/folders', updateFeedFoldersHandler),
    route('GET', '/articles', getArticlesHandler),
    route('POST', '/articles/state', updateArticleStateHandler),
    route('POST', '/articles/read-before', readBeforeHandler),
    route('POST', '/articles/read-all', readAllHandler),
    route('POST', '/affinity', affinityHandler),
    route('POST', '/sync', syncHandler),
    route('GET', '/opml', exportOpmlHandler),
    route('POST', '/opml', importOpmlHandler),
    route('POST', '/migrate/library', migrateLibraryHandler),
];

// ---- startServer ----

export interface RunningServer {
    port: number;
    close(): Promise<void>;
}

function makeShutdown(srv: Server): () => Promise<void> {
    let closed = false;
    return async () => {
        if (closed) return;
        closed = true;
        await drainPoller();
        await new Promise<void>((res, rej) => { srv.close((e) => (e ? rej(e) : res())); });
        await closePool();
    };
}

export async function startServer(
    port = Number(process.env.PORT ?? PORT),
    host = process.env.LISTEN_HOST ?? '0.0.0.0',
): Promise<RunningServer> {
    await migrate();
    const dispatch = createDispatcher(routes, ensureUser);
    return new Promise<RunningServer>((resolve, reject) => {
        const srv: Server = createServer(dispatch);
        let resolved = false;
        srv.on('error', (err) => {
            if (!resolved) reject(err);
            else console.error('rss-api server error:', err);
        });
        srv.listen(port, host, () => {
            resolved = true;
            startPoller();
            const assignedPort = (srv.address() as {port: number}).port;
            resolve({port: assignedPort, close: makeShutdown(srv)});
        });
    });
}
