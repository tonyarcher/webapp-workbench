// @vitest-environment jsdom
import { LitElement } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startRun } from '../../core/game';
import type { Mode, RunState, SpeciesId } from '../../core/types';
import { CwAppShell } from './app-shell';

async function settle(element: CwAppShell): Promise<void> {
    await element.updateComplete;
    for (let pass = 0; pass < 2; pass += 1) {
        const child = element.renderRoot.querySelector('cw-game-screen, cw-start-screen, cw-field-guide');
        if (child instanceof LitElement) await child.updateComplete;
        await Promise.resolve();
    }
}

/** Poll on real timers, for assertions that depend on a child's first paint. */
async function until<T>(get: () => T | null, message: string): Promise<T> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const value = get();
        if (value !== null) return value;
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(message);
}

async function mount(): Promise<CwAppShell> {
    const element = new CwAppShell();
    document.body.appendChild(element);
    await settle(element);
    return element;
}

function start(element: CwAppShell, mode: Mode, speciesId: SpeciesId = 'walleye'): void {
    const menu = element.renderRoot.querySelector('cw-start-screen');
    menu?.dispatchEvent(
        new CustomEvent('start-run', {
            detail: { mode, speciesId },
            bubbles: true,
            composed: true,
        }),
    );
}

function game(element: CwAppShell): ShadowRoot | null {
    return element.renderRoot.querySelector('cw-game-screen')?.shadowRoot ?? null;
}

function guide(element: CwAppShell): ShadowRoot | null {
    return element.renderRoot.querySelector('cw-field-guide')?.shadowRoot ?? null;
}

function menu(element: CwAppShell): ShadowRoot | null {
    return element.renderRoot.querySelector('cw-start-screen')?.shadowRoot ?? null;
}

beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    vi.restoreAllMocks();
});

describe('app shell', () => {
    it('moves from the menu into a practice game', async () => {
        const element = await mount();
        expect(element.renderRoot.querySelector('cw-start-screen')).not.toBeNull();
        start(element, 'practice', 'mackinaw');
        await settle(element);
        expect(element.renderRoot.querySelector('cw-game-screen')).not.toBeNull();
        expect(element.renderRoot.querySelector('cw-start-screen')).toBeNull();
    });

    it('applies an action and shows the outcome', async () => {
        const element = await mount();
        start(element, 'practice');
        await settle(element);
        const action = game(element)?.querySelector<HTMLButtonElement>('.action');
        expect(action).not.toBeNull();
        action?.click();
        await settle(element);
        expect(game(element)?.querySelector('.outcome')).not.toBeNull();
    });

    it('continues to the next turn after an outcome', async () => {
        const element = await mount();
        start(element, 'practice', 'mackinaw');
        await settle(element);
        const ignore = Array.from(game(element)?.querySelectorAll<HTMLButtonElement>('.action') ?? []).find((button) =>
            button.textContent?.includes('Ignore'),
        );
        expect(ignore).not.toBeUndefined();
        ignore?.click();
        await settle(element);
        expect(game(element)?.querySelector('.outcome .primary')?.textContent).toContain('Continue');
        game(element)?.querySelector<HTMLButtonElement>('.outcome .primary')?.click();
        await settle(element);
        const stats = await until(() => {
            const text = game(element)?.textContent ?? '';
            return text.includes('Turn') ? text : null;
        }, 'the next turn never rendered');
        expect(stats).toContain('2');
    });

    it('takes a keyboard move', async () => {
        const element = await mount();
        start(element, 'practice');
        await settle(element);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
        await settle(element);
        expect(game(element)?.querySelector('.outcome')).not.toBeNull();
    });

    it('ignores keys that are not moves or are modified', async () => {
        const element = await mount();
        start(element, 'practice');
        await settle(element);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', altKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', metaKey: true, bubbles: true }));
        await settle(element);
        expect(game(element)?.querySelector('.outcome')).toBeNull();
    });

    it('ignores keys from a text field and when not on the lake', async () => {
        const element = await mount();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
        start(element, 'practice');
        await settle(element);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
        await settle(element);
        expect(game(element)?.querySelector('.outcome')).toBeNull();
    });

    it('ignores a move the current fish does not have', async () => {
        const element = await mount();
        start(element, 'practice', 'mackinaw');
        await settle(element);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
        await settle(element);
        expect(game(element)?.querySelector('.outcome')).toBeNull();
    });

    it('ignores an action after the turn is resolved', async () => {
        const element = await mount();
        start(element, 'practice');
        await settle(element);
        const gameElement = element.renderRoot.querySelector('cw-game-screen');
        gameElement?.dispatchEvent(new CustomEvent('choose-action', { detail: 'eat', bubbles: true, composed: true }));
        await settle(element);
        expect(game(element)?.querySelector('.outcome')).not.toBeNull();
        gameElement?.dispatchEvent(new CustomEvent('choose-action', { detail: 'eat', bubbles: true, composed: true }));
        await settle(element);
        expect(game(element)?.querySelector('.outcome')).not.toBeNull();
    });

    it('restarts to the menu from a game', async () => {
        const element = await mount();
        start(element, 'practice');
        await settle(element);
        element.renderRoot
            .querySelector('cw-game-screen')
            ?.dispatchEvent(new CustomEvent('restart', { bubbles: true, composed: true }));
        await settle(element);
        expect(element.renderRoot.querySelector('cw-start-screen')).not.toBeNull();
    });

    it('keeps the clock owned when the guide opens and closes during a points run', async () => {
        const element = await mount();
        start(element, 'points');
        await settle(element);
        game(element)?.querySelector<HTMLButtonElement>('.guide-link')?.click();
        await settle(element);
        guide(element)?.querySelector<HTMLButtonElement>('.back')?.click();
        await settle(element);
        expect(game(element)?.querySelector('[role="progressbar"]')).not.toBeNull();
        element.remove();
    });

    it('opens the field guide and returns to the lake', async () => {
        const element = await mount();
        start(element, 'practice');
        await settle(element);
        game(element)?.querySelector<HTMLButtonElement>('.guide-link')?.click();
        await settle(element);
        expect(element.renderRoot.querySelector('cw-field-guide')).not.toBeNull();
        guide(element)?.querySelector<HTMLButtonElement>('.back')?.click();
        await settle(element);
        expect(element.renderRoot.querySelector('cw-game-screen')).not.toBeNull();
    });

    it('opens the field guide from the menu', async () => {
        const element = await mount();
        const guideButton = Array.from(menu(element)?.querySelectorAll('button') ?? []).find((item) =>
            item.textContent?.includes('Field guide'),
        );
        guideButton?.click();
        await settle(element);
        expect(element.renderRoot.querySelector('cw-field-guide')).not.toBeNull();
        guide(element)?.querySelector<HTMLButtonElement>('.back')?.click();
        await settle(element);
        expect(element.renderRoot.querySelector('cw-start-screen')).not.toBeNull();
    });

    it('does not save a practice run as the points high score', async () => {
        const element = await mount();
        start(element, 'practice');
        await settle(element);
        const internals = element as unknown as { run: RunState };
        internals.run = { ...startRun('practice', 'walleye', 7), phase: 'dead', score: 42 };
        element.renderRoot
            .querySelector('cw-game-screen')
            ?.dispatchEvent(new CustomEvent('continue-run', { bubbles: true, composed: true }));
        await settle(element);
        expect(window.localStorage.getItem('coldwater:high-score:v1')).toBeNull();
    });

    it('stops its clock when disconnected', async () => {
        const element = await mount();
        const clear = vi.spyOn(globalThis, 'clearInterval');
        start(element, 'points');
        await settle(element);
        element.remove();
        expect(clear).toHaveBeenCalled();
    });

    it('ends a points run when the clock expires', async () => {
        vi.useFakeTimers();
        try {
            const element = await mount();
            start(element, 'points');
            await settle(element);
            vi.advanceTimersByTime(11_000);
            await settle(element);
            expect(game(element)?.querySelector('.outcome')).not.toBeNull();
            element.remove();
        } finally {
            vi.useRealTimers();
        }
    });
});
