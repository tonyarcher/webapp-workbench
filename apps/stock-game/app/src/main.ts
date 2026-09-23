import { finishLoginFromCallback } from './lib/auth';
import './components/index';
import './styles.css';

async function boot(): Promise<void> {
    const loggedIn = await finishLoginFromCallback().catch((err: unknown) => {
        try {
            sessionStorage.setItem('sg.auth.error', err instanceof Error ? err.message : 'Sign-in failed');
        } catch {
            // ignore storage failures; the sign-in card still renders
        }
        return false;
    });
    if (loggedIn) window.dispatchEvent(new CustomEvent('sg-auth-changed'));
    const root = document.getElementById('root');
    if (!root) throw new Error('Missing #root element');
    root.innerHTML = '<sg-app-shell></sg-app-shell>';
}

void boot();
