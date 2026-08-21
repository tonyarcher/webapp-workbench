import {createServer} from 'node:http';
import {PORT} from './env.js';
import {migrate} from './db.js';
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

const dispatch = createDispatcher(routes, ensureUser);

// ---- bootstrap ----

process.title = 'rss-api';

void migrate()
    .then(() => {
        startPoller();

        const server = createServer(dispatch);
        server.listen(PORT, () => {
            console.log(`rss-api listening on :${PORT}`);
        });

        const shutdown = () => {
            stopPoller();
            server.close(() => {
                void import('./db.js').then((m) => m.getPool().end());
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    // Fatal on purpose: compose restarts us once Postgres is reachable,
    // and a half-started listener-less process would be worse.
    .catch((err) => {
        console.error('rss-api failed to migrate:', err);
        process.exit(1);
    });
