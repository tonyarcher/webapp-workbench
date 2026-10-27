import { defineConfig } from 'vite';

/** The metadata query the deployed gateway sends to TikTok's player items API. */
const TIKTOK_ITEMS = '/player/api/v1/items?aid=1284&app_name=tiktok_web&device_platform=web_pc';

export default defineConfig({
    base: './',
    // The gateway proxies this path in deploy (see deploy/nginx/default.conf
    // .template); mirror it in dev so slide metadata renders locally. TikTok
    // still serves the items API to a plain request, only without CORS.
    server: {
        proxy: {
            '/meta/': {
                target: 'https://www.tiktok.com',
                changeOrigin: true,
                headers: { Referer: 'https://www.tiktok.com/' },
                rewrite: (path) => `${TIKTOK_ITEMS}&item_ids=${path.slice('/meta/'.length)}`,
            },
        },
    },
    build: {
        target: 'es2022',
        // No sourcemaps in the published bundle: nothing consumes them, and
        // `true` embeds full source in the object store.
        sourcemap: false,
    },
});
