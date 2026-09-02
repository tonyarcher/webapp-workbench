import {startServer} from './app.js';

process.title = 'radio-api';

startServer()
    .then((srv) => {
        console.log(`radio-api listening on :${srv.port}`);
        const shutdown = () => {
            void srv.close().then(() => process.exit(0));
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    .catch((err) => {
        console.error('radio-api failed to start:', err);
        process.exit(1);
    });
