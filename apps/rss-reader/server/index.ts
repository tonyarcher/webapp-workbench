import {startServer} from './app.js';
import {formatErr, log} from './log.js';

process.title = 'rss-api';

startServer()
    .then((srv) => {
        log('rss-api', {level: 'info', msg: 'listening', port: srv.port});

        const shutdown = () => {
            void srv.close().then(() => process.exit(0));
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    // Fatal on purpose: compose restarts us once Postgres is reachable,
    // and a half-started listener-less process would be worse.
    .catch((err) => {
        log('rss-api', {level: 'error', msg: 'startup failed', err: formatErr(err)});
        process.exit(1);
    });
