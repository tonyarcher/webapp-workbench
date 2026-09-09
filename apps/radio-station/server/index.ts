import {startServer} from './app.js';
import {formatErr, log} from './log.js';

process.title = 'radio-api';

startServer()
    .then((srv) => {
        log('radio-api', {level: 'info', msg: 'listening', port: srv.port});
        const shutdown = () => {
            void srv.close().then(() => process.exit(0));
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    .catch((err) => {
        log('radio-api', {level: 'error', msg: 'startup failed', err: formatErr(err)});
        process.exit(1);
    });
