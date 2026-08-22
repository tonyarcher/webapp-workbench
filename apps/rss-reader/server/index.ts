import {startServer} from './app.js';

process.title = 'rss-api';

startServer()
    .then((srv) => {
        console.log(`rss-api listening on :${srv.port}`);

        const shutdown = () => {
            void srv.close().then(() => process.exit(0));
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    // Fatal on purpose: compose restarts us once Postgres is reachable,
    // and a half-started listener-less process would be worse.
    .catch((err) => {
        console.error('rss-api failed to start:', err);
        process.exit(1);
    });
