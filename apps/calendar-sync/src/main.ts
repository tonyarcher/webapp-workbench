import './web-components/app-shell/app-shell';
import './styles/global.css';
import { finishLoginFromCallback } from './services/auth';
import { parseAppConfig, setAppConfig } from './services/config';

// The runtime config must be in place before anything resolves an API or
// identity URL — including the OAuth callback below. The entry point owns this
// DOM read so `src/services/` stays free of DOM.
setAppConfig(parseAppConfig(document.getElementById('app-config')?.textContent ?? ''));

const root = document.getElementById('app');
if (root) {
    root.appendChild(document.createElement('cal-app-shell'));
}

// An OAuth callback (?code&state) must become tokens before anything reads
// auth state, so the exchange runs after the shell boots and both outcomes
// are delivered as events it listens for: success re-reads the session,
// failure shows the reason.
const loggedIn = await finishLoginFromCallback().catch((err: unknown) => {
    const message = err instanceof Error && err.message ? err.message : 'Sign-in failed';
    window.dispatchEvent(new CustomEvent('cal-auth-error', { detail: message }));
    return false;
});
if (loggedIn) window.dispatchEvent(new CustomEvent('cal-auth-changed'));

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    });
}
