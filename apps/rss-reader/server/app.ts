import {createServer, type Server} from 'node:http';
import {PORT} from './env.js';
import {migrate, getPool} from './db.js';
import {route, createDispatcher} from './http.js';
import {ensureUser} from './users.js';
import {startPoller, stopPoller} from './services/poller.js';

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
    route('GET', '/healthz', healthHandler),
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

export async function startServer(
    port = Number(process.env.PORT ?? PORT),
): Promise<RunningServer> {
    await migrate();
    startPoller();

    const dispatch = createDispatcher(routes, ensureUser);

    return new Promise<RunningServer>((resolve, reject) => {
        const srv: Server = createServer(dispatch);
        srv.listen(port, () => {
            const assignedPort = (srv.address() as {port: number}).port;
            const shutdown = async () => {
                stopPoller();
                await new Promise<void>((res) => srv.close(() => res()));
                await getPool().end();
            };
            resolve({port: assignedPort, close: shutdown});
        });
        srv.on('error', reject);
    });
}
