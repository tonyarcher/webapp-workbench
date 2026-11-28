// S4: app icon badge. Stubs the browser badge API and the favicon link so the
// service can be exercised in a real browser without an installed PWA.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import {
    APP_BADGE_CAP,
    applyAppBadge,
    badgeLabel,
    badgeValue,
    totalUnreadFromLibrary,
} from '../src/services/app-badge';

describe('app-badge service', () => {
    let calls: Array<{ method: string; value?: number | undefined }>;
    let originalSet: unknown;
    let originalClear: unknown;

    beforeEach(() => {
        calls = [];
        const nav = navigator as unknown as {
            setAppBadge?: (n?: number) => Promise<void>;
            clearAppBadge?: () => Promise<void>;
        };
        originalSet = nav.setAppBadge;
        originalClear = nav.clearAppBadge;
        nav.setAppBadge = async (n?: number) => {
            calls.push({ method: 'set', value: n });
        };
        nav.clearAppBadge = async () => {
            calls.push({ method: 'clear' });
        };
    });

    afterEach(() => {
        const nav = navigator as unknown as { setAppBadge?: unknown; clearAppBadge?: unknown };
        nav.setAppBadge = originalSet;
        nav.clearAppBadge = originalClear;
    });

    it('sums feed unread counts', () => {
        expect(totalUnreadFromLibrary({ feeds: [{ unread: 2 }, { unread: 3 }] })).to.equal(5);
        expect(totalUnreadFromLibrary(null)).to.equal(0);
    });

    it('caps the badge value at 99', () => {
        expect(badgeValue(150)).to.equal(APP_BADGE_CAP);
        expect(badgeLabel(150)).to.equal('99+');
    });

    it('calls setAppBadge with the capped count', async () => {
        await applyAppBadge(42);
        expect(calls).to.deep.equal([{ method: 'set', value: 42 }]);
    });

    it('clears the badge when the total is zero', async () => {
        await applyAppBadge(0);
        expect(calls).to.deep.equal([{ method: 'clear' }]);
    });

    it('caps a large total before calling setAppBadge', async () => {
        await applyAppBadge(200);
        expect(calls).to.deep.equal([{ method: 'set', value: APP_BADGE_CAP }]);
    });
});

describe('app-badge favicon fallback', () => {
    // A 1x1 PNG. Real Chromium decodes it, so the canvas path runs for real.
    const ICON =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    let link: HTMLLinkElement;
    let originalSet: unknown;
    let originalClear: unknown;

    beforeEach(() => {
        const nav = navigator as unknown as { setAppBadge?: unknown; clearAppBadge?: unknown };
        originalSet = nav.setAppBadge;
        originalClear = nav.clearAppBadge;
        nav.setAppBadge = undefined;
        nav.clearAppBadge = undefined;
        link = document.createElement('link');
        link.rel = 'icon';
        link.href = ICON;
        document.head.append(link);
    });

    afterEach(() => {
        const nav = navigator as unknown as { setAppBadge?: unknown; clearAppBadge?: unknown };
        nav.setAppBadge = originalSet;
        nav.clearAppBadge = originalClear;
        link.remove();
    });

    async function waitForDrawnIcon(): Promise<string> {
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
            if (link.href !== ICON) return link.href;
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error('the canvas fallback never replaced the favicon');
    }

    it('restores the shipped icon when the count clears', async () => {
        await applyAppBadge(5);
        const badged = await waitForDrawnIcon();
        expect(badged.startsWith('data:image/png')).to.equal(true);
        await applyAppBadge(0);
        expect(link.href).to.equal(ICON);
    });

    it('redraws each count from the shipped icon instead of stacking', async () => {
        await applyAppBadge(5);
        const first = await waitForDrawnIcon();
        await applyAppBadge(7);
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline && link.href === first) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(link.href).to.not.equal(first);
        await applyAppBadge(0);
        expect(link.href).to.equal(ICON);
    });
});
