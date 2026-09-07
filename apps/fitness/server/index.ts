import {startServer} from './app.js';

process.title = 'fitness-api';

startServer()
    .then((srv) => {
        console.log(`fitness-api listening on :${srv.port}`);
        const shutdown = () => {
            void srv.close().then(() => process.exit(0));
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    .catch((err) => {
        console.error('fitness-api failed to start:', err);
        process.exit(1);
    });
