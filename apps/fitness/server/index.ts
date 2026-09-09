import {startServer} from './app.js';
import {formatErr, log} from './log.js';

process.title = 'fitness-api';

startServer()
    .then((srv) => {
        log('fitness-api', {level: 'info', msg: 'listening', port: srv.port});
        const shutdown = () => {
            void srv.close().then(() => process.exit(0));
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    .catch((err) => {
        log('fitness-api', {level: 'error', msg: 'startup failed', err: formatErr(err)});
        process.exit(1);
    });
