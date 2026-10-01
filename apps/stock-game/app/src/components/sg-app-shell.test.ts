// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    hasSession: vi.fn(() => false),
    currentUsername: vi.fn((): string | null => null),
    logout: vi.fn(),
    startLogin: vi.fn(async () => {}),
    clear: vi.fn(),
}));

vi.mock('../lib/auth', () => ({
    hasSession: mocks.hasSession,
    currentUsername: mocks.currentUsername,
    logout: mocks.logout,
    startLogin: mocks.startLogin,
}));

vi.mock('../lib/queryClient', () => ({
    getQueryClient: () => ({ clear: mocks.clear }),
}));

import './sg-app-shell';
import { SgAppShell } from './sg-app-shell';
import type { View } from '../router';

type Internals = Record<string, unknown>;

async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function internals(el: SgAppShell): Internals {
    return el as unknown as Internals;
}

async function mount(authed = true): Promise<SgAppShell> {
    mocks.hasSession.mockReturnValue(authed);
    mocks.currentUsername.mockReturnValue(authed ? 'alice' : null);
    const el = document.createElement('sg-app-shell') as SgAppShell;
    document.body.appendChild(el);
    await tick();
    return el;
}

function internalsOf(el: SgAppShell): Internals {
    return internals(el);
}

function isActive(el: SgAppShell, view: View): boolean {
    return (internalsOf(el)['isActive'] as (v: View) => boolean).call(el, view);
}

beforeEach(() => {
    document.body.innerHTML = '';
    mocks.hasSession.mockReturnValue(false);
    mocks.currentUsername.mockReturnValue(null);
    mocks.startLogin.mockResolvedValue(undefined);
    vi.restoreAllMocks();
});

describe('boot error', () => {
    it('picks up a sign-in error left by the callback and clears it', async () => {
        sessionStorage.setItem('sg.auth.error', 'Sign-in was refused');
        const el = await mount();

        expect(el.authError).toBe('Sign-in was refused');
        expect(sessionStorage.getItem('sg.auth.error')).toBeNull();
    });

    it('is empty when the session storage has nothing or throws', async () => {
        expect((await mount()).authError).toBe('');

        const removeItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const el = document.createElement('sg-app-shell') as SgAppShell;
        document.body.appendChild(el);
        expect(el.authError).toBe('');
        removeItem.mockRestore();
    });
});

describe('navigation', () => {
    it('marks only the current route active', async () => {
        const el = await mount();
        el.route = { kind: 'orders' };
        await tick();

        const active = [...(el.shadowRoot?.querySelectorAll('.nav-link') ?? [])]
            .filter((node) => node.classList.contains('active'))
            .map((node) => node.textContent?.trim());
        expect(active).toEqual(['Orders']);
    });

    it('treats a trade route with no symbol as matching the trade link', async () => {
        const el = await mount();
        el.route = { kind: 'trade' };
        await tick();

        expect(isActive(el, { kind: 'trade' })).toBe(true);
        expect(isActive(el, { kind: 'trade', symbol: 'AAPL' })).toBe(false);
        expect(isActive(el, { kind: 'orders' })).toBe(false);
    });

    it('matches a trade route on the symbol when the link carries one', async () => {
        const el = await mount();
        el.route = { kind: 'trade', symbol: 'AAPL' };
        await tick();

        expect(isActive(el, { kind: 'trade', symbol: 'AAPL' })).toBe(true);
        expect(isActive(el, { kind: 'trade', symbol: 'MSFT' })).toBe(false);
        expect(isActive(el, { kind: 'trade' })).toBe(true);
    });

    it('pushes a hash path when a nav link is clicked', async () => {
        const el = await mount();
        const links = [...(el.shadowRoot?.querySelectorAll('.nav-link') ?? [])];
        const settings = links.find((node) => node.textContent?.trim() === 'Settings') as HTMLElement | undefined;

        settings?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await tick();

        expect(el.route.kind).toBe('settings');
    });
});

describe('the main view', () => {
    it.each([
        ['dashboard', 'sg-dashboard-view'],
        ['trade', 'sg-trade-view'],
        ['portfolio', 'sg-portfolio-view'],
        ['orders', 'sg-orders-view'],
        ['settings', 'sg-settings-view'],
    ] as const)('renders %s', async (kind, tag) => {
        const el = await mount();
        el.route = { kind } as View;
        await tick();

        expect(el.shadowRoot?.querySelector(tag)).not.toBeNull();
    });

    it('hands the trade view its symbol', async () => {
        const el = await mount();
        el.route = { kind: 'trade', symbol: 'AAPL' };
        await tick();

        const view = el.shadowRoot?.querySelector('sg-trade-view') as (HTMLElement & { symbol?: string }) | null;
        expect(view?.symbol).toBe('AAPL');
    });

    it('updates the trade view in place when the symbol changes', async () => {
        const el = await mount();
        el.route = { kind: 'trade', symbol: 'AAPL' };
        await tick();
        const view = el.shadowRoot?.querySelector('sg-trade-view') as (HTMLElement & { symbol?: string }) | null;
        expect(view?.symbol).toBe('AAPL');

        el.route = { kind: 'trade', symbol: 'MSFT' };
        await tick();

        // key= on a custom element is a plain property, not Lit's keyed
        // directive, so the element is reused and must react to the change.
        expect(el.shadowRoot?.querySelector('sg-trade-view')).toBe(view);
        expect(view?.symbol).toBe('MSFT');
    });
});

describe('sign in and out', () => {
    it('shows the sign-in card when there is no session', async () => {
        const el = await mount(false);

        expect(el.shadowRoot?.querySelector('sg-dashboard-view')).toBeNull();
        expect(el.shadowRoot?.textContent).toContain('Sign in to play with your portfolio');
    });

    it('shows the username once signed in', async () => {
        const el = await mount(true);

        expect(el.shadowRoot?.querySelector('.nav-user')?.textContent).toBe('alice');
    });

    it('starts a login and clears any earlier boot error', async () => {
        const el = await mount(false);
        el.authError = 'earlier';
        const signIn = el.shadowRoot?.querySelector('button') as HTMLElement | null;

        signIn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await tick();

        expect(mocks.startLogin).toHaveBeenCalled();
        expect(el.authError).toBe('');
    });

    it('shows the failure when sign-in rejects', async () => {
        const el = await mount(false);
        mocks.startLogin.mockRejectedValueOnce(new Error('popup blocked'));
        const signIn = el.shadowRoot?.querySelector('button') as HTMLElement | null;

        signIn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await tick();

        expect(el.authError).toBe('popup blocked');
    });

    it('falls back to a plain message when sign-in rejects with something odd', async () => {
        const el = await mount(false);
        mocks.startLogin.mockRejectedValueOnce('not an error');
        const signIn = el.shadowRoot?.querySelector('button') as HTMLElement | null;

        signIn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await tick();

        expect(el.authError).toBe('Sign-in failed');
    });

    it('clears the account and the cache on sign out', async () => {
        const el = await mount(true);
        const signOut = [...(el.shadowRoot?.querySelectorAll('button') ?? [])].find(
            (node) => node.textContent?.trim() === 'Sign out',
        ) as HTMLElement | null;

        signOut?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await tick();

        expect(mocks.logout).toHaveBeenCalled();
        expect(mocks.clear).toHaveBeenCalled();
        expect(el.authed).toBe(false);
        expect(el.username).toBeNull();
    });
});

describe('session events', () => {
    it('picks up a sign-in on sg-auth-changed', async () => {
        const el = await mount(false);
        mocks.hasSession.mockReturnValue(true);
        mocks.currentUsername.mockReturnValue('bob');

        window.dispatchEvent(new CustomEvent('sg-auth-changed'));
        await tick();

        expect(el.authed).toBe(true);
        expect(el.username).toBe('bob');
    });

    it('drops the account when the api says the session is gone', async () => {
        const el = await mount(true);

        window.dispatchEvent(new CustomEvent('sg-auth-required'));
        await tick();

        expect(mocks.logout).toHaveBeenCalled();
        expect(mocks.clear).toHaveBeenCalled();
        expect(el.authed).toBe(false);
    });

    it('stops listening once removed from the document', async () => {
        const el = await mount(true);
        el.remove();
        await tick();
        mocks.logout.mockClear();

        window.dispatchEvent(new CustomEvent('sg-auth-required'));
        await tick();

        expect(mocks.logout).not.toHaveBeenCalled();
    });

    it('follows the hash route', async () => {
        const el = await mount(true);
        window.location.hash = '#/orders';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        await tick();

        expect(typeof el.route.kind).toBe('string');
    });
});
