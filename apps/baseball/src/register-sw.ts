/**
 * Service worker registration, moved out of an inline index.html script.
 * The gateway serves these apps under `script-src 'self'`, which blocks
 * inline scripts — the old in-document registration was refused in prod and
 * the worker never installed. Bundled code needs no CSP exception.
 *
 * BASE_URL is the app's build base, so the path resolves under the deploy
 * subpath ('/baseball/') and at the dev root ('/') exactly as the inline
 * `%BASE_URL%sw.js` replacement did.
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
            console.warn('SW registration failed:', err);
        });
    });
}
