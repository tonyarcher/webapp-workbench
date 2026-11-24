// The sidebar splitter's DOM half, which the mock-based smoke suite cannot reach.
//
// The splitting and clamping are pinned in smoke-sidebar.ts. What is left, and what
// only a real DOM can show, is that the handle exists, carries the separator role,
// and that aria-valuenow actually tracks the width. The last one is not academic: a
// review found the attribute was written through an element reference that only
// exists between pointerdown and pointerup, so for a keyboard-only user the write
// was a silent no-op and the sidebar moved while the announced width stayed put.
// Imported first on purpose: it supplies a browser global that query-core reads
// while source-list.ts is being imported, and ESM evaluates imports in order.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import {
    MIN_SIDEBAR_WIDTH,
    MAX_SIDEBAR_WIDTH,
    SIDEBAR_KEY_STEP,
} from '../src/web-components/source-list/source-list-settings';
import '../src/web-components/source-list/source-list';
import type { SourceList } from '../src/web-components/source-list/source-list';

function mount(): SourceList {
    const element = document.createElement('source-list') as SourceList;
    document.body.append(element);
    return element;
}

function handle(element: SourceList): HTMLElement {
    return element.shadowRoot!.querySelector<HTMLElement>('.resize-handle')!;
}

function value(element: SourceList): number {
    return Number(handle(element).getAttribute('aria-valuenow'));
}

async function press(element: SourceList, key: string, shiftKey = false): Promise<void> {
    handle(element).dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
    await element.updateComplete;
}

describe('source-list sidebar splitter', () => {
    let element: SourceList;

    beforeEach(() => {
        // applySidebarWidth persists the width, so clear it or a previous test's
        // bound would make the next one start somewhere else.
        localStorage.clear();
        element = mount();
    });

    afterEach(() => {
        element.remove();
    });

    it('exposes the handle as a focusable separator', async () => {
        await element.updateComplete;
        const el = handle(element);
        expect(el.getAttribute('role')).to.equal('separator');
        expect(el.getAttribute('aria-orientation')).to.equal('vertical');
        expect(el.getAttribute('tabindex')).to.equal('0');
        expect(el.getAttribute('aria-label')).to.equal('Resize sidebar');
        expect(el.getAttribute('aria-valuemin')).to.equal(String(MIN_SIDEBAR_WIDTH));
        expect(el.getAttribute('aria-valuemax')).to.equal(String(MAX_SIDEBAR_WIDTH));
        // Not Number.isFinite: Number(null) is 0, which is finite, so that would
        // pass with the attribute missing entirely.
        const raw = handle(element).getAttribute('aria-valuenow');
        expect(raw, 'aria-valuenow must be present, not merely numeric').to.not.equal(null);
        expect(Number(raw)).to.be.at.least(MIN_SIDEBAR_WIDTH);
        expect(Number(raw)).to.be.at.most(MAX_SIDEBAR_WIDTH);
    });

    it('updates aria-valuenow from the keyboard, with no pointer involved', async () => {
        await element.updateComplete;
        const before = value(element);

        // No pointerdown has happened, so the drag-scoped element reference is
        // null. This is the exact case that used to fail silently.
        await press(element, 'ArrowRight');
        expect(value(element)).to.equal(before + SIDEBAR_KEY_STEP);
        expect(element.style.getPropertyValue('--sidebar-width')).to.equal(`${before + SIDEBAR_KEY_STEP}px`);

        await press(element, 'ArrowLeft');
        expect(value(element)).to.equal(before);
    });

    it('clamps to the bounds and moves the declared width with it', async () => {
        await element.updateComplete;
        await press(element, 'Home');
        expect(value(element)).to.equal(MIN_SIDEBAR_WIDTH);
        expect(handle(element).getAttribute('aria-valuenow')).to.equal(String(MIN_SIDEBAR_WIDTH));

        await press(element, 'ArrowLeft');
        expect(value(element)).to.equal(MIN_SIDEBAR_WIDTH);

        await press(element, 'End');
        expect(value(element)).to.equal(MAX_SIDEBAR_WIDTH);

        await press(element, 'ArrowRight');
        expect(value(element)).to.equal(MAX_SIDEBAR_WIDTH);
        expect(element.style.getPropertyValue('--sidebar-width')).to.equal(`${MAX_SIDEBAR_WIDTH}px`);
    });

    it('leaves a key it does not own alone', async () => {
        await element.updateComplete;
        const before = value(element);
        for (const key of ['Enter', ' ', 'Escape', 'ArrowDown', 'ArrowUp']) {
            await press(element, key);
        }
        expect(value(element)).to.equal(before);
    });
});
