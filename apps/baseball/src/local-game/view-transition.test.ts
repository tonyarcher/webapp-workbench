// transitionScreen unit tests: the helper, not the animation. The browser
// owns the crossfade; these pin the three escape hatches (no API, reduced
// motion, sync throw) and the passthrough contract the shell relies on.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, transitionScreen } from './view-transition';

const globals = globalThis as Record<string, unknown>;
const realDocument = globals['document'];
const realMatchMedia = globals['matchMedia'];

afterEach(() => {
    if (realDocument === undefined) delete globals['document'];
    else globals['document'] = realDocument;
    if (realMatchMedia === undefined) delete globals['matchMedia'];
    else globals['matchMedia'] = realMatchMedia;
    vi.unstubAllGlobals();
});

function stubMatchMedia(matches: boolean): void {
    globals['matchMedia'] = vi.fn(() => ({ matches }));
}

describe('transitionScreen', () => {
    it('runs the update directly without the API', () => {
        globals['document'] = {};
        stubMatchMedia(false);
        const update = vi.fn();
        transitionScreen(update);
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('runs the update directly under reduced motion', () => {
        const start = vi.fn(() => ({ finished: Promise.resolve() }));
        globals['document'] = { startViewTransition: start };
        stubMatchMedia(true);
        const update = vi.fn();
        transitionScreen(update);
        expect(update).toHaveBeenCalledTimes(1);
        expect(start).not.toHaveBeenCalled();
    });

    it('hands the update to the transition otherwise', () => {
        let captured: (() => unknown) | undefined;
        const start = vi.fn((update: () => unknown) => {
            captured = update;
            return { finished: Promise.resolve() };
        });
        globals['document'] = { startViewTransition: start };
        stubMatchMedia(false);
        const update = vi.fn();
        transitionScreen(update);
        expect(start).toHaveBeenCalledTimes(1);
        expect(update).not.toHaveBeenCalled();
        captured?.();
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('runs the update when starting throws', () => {
        globals['document'] = {
            startViewTransition: () => {
                throw new Error('nope');
            },
        };
        stubMatchMedia(false);
        const update = vi.fn();
        transitionScreen(update);
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('swallows a rejected transition without throwing', async () => {
        globals['document'] = {
            startViewTransition: () => ({ finished: Promise.reject(new Error('aborted')) }),
        };
        stubMatchMedia(false);
        expect(() => transitionScreen(() => {})).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
});

describe('prefersReducedMotion', () => {
    it('is false without matchMedia', () => {
        delete globals['matchMedia'];
        expect(prefersReducedMotion()).toBe(false);
    });
});
