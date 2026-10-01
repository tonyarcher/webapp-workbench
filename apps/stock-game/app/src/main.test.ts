// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ finishLoginFromCallback: vi.fn() }));

vi.mock('./lib/auth', () => ({
    finishLoginFromCallback: auth.finishLoginFromCallback,
    hasSession: () => false,
    currentUsername: () => null,
    redirectUri: () => 'http://localhost:3000/',
    isTokenFresh: () => false,
    startLogin: vi.fn(),
    refreshTokens: vi.fn(),
    getAccessToken: vi.fn(async () => null),
    logout: vi.fn(),
}));

async function boot(): Promise<void> {
    vi.resetModules();
    await import('./main');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

const store = new Map<string, string>();
let storageThrows = false;

beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    store.clear();
    storageThrows = false;
    auth.finishLoginFromCallback.mockReset();
    vi.stubGlobal('sessionStorage', {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
            if (storageThrows) throw new Error('storage disabled');
            store.set(k, v);
        },
        clear: () => store.clear(),
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.resetModules();
});

describe('boot', () => {
    it('mounts the shell and announces the completed sign-in', async () => {
        auth.finishLoginFromCallback.mockResolvedValue(true);
        const changed = vi.fn();
        window.addEventListener('sg-auth-changed', changed);

        await boot();

        expect(document.getElementById('root')?.innerHTML).toContain('sg-app-shell');
        expect(changed).toHaveBeenCalled();
        window.removeEventListener('sg-auth-changed', changed);
    });

    it('mounts without announcing when no sign-in completed', async () => {
        auth.finishLoginFromCallback.mockResolvedValue(false);
        const changed = vi.fn();
        window.addEventListener('sg-auth-changed', changed);

        await boot();

        expect(document.getElementById('root')?.innerHTML).toContain('sg-app-shell');
        expect(changed).not.toHaveBeenCalled();
        window.removeEventListener('sg-auth-changed', changed);
    });

    it('keeps the error message from a failed sign-in for the sign-in card', async () => {
        auth.finishLoginFromCallback.mockRejectedValue(new Error('state mismatch'));
        const changed = vi.fn();
        window.addEventListener('sg-auth-changed', changed);

        await boot();

        expect(store.get('sg.auth.error')).toBe('state mismatch');
        expect(changed).not.toHaveBeenCalled();
        window.removeEventListener('sg-auth-changed', changed);
    });

    it('falls back to a generic message when the rejection is not an Error', async () => {
        auth.finishLoginFromCallback.mockRejectedValue('a bare string');
        await boot();

        expect(store.get('sg.auth.error')).toBe('Sign-in failed');
    });

    it('still renders the shell when the error cannot be stored', async () => {
        storageThrows = true;
        auth.finishLoginFromCallback.mockRejectedValue(new Error('nope'));

        await boot();

        expect(document.getElementById('root')?.innerHTML).toContain('sg-app-shell');
    });
});
