// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ArtKey } from '../../core/types';
import { CwFishArt } from './fish-art';

const ART_KEYS: readonly ArtKey[] = [
    'chub',
    'whitefish',
    'rainbow',
    'blueback',
    'dolly',
    'mackinaw',
    'walleye',
    'otter',
    'osprey',
    'bait',
    'fly',
    'algae',
    'plankton',
    'insects',
    'bottom-life',
];

async function mount(art?: ArtKey): Promise<CwFishArt> {
    const element = new CwFishArt();
    if (art) element.art = art;
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

describe('fish art', () => {
    it('renders a decorative svg for every art key', async () => {
        for (const art of ART_KEYS) {
            const element = await mount(art);
            const svg = element.renderRoot.querySelector('svg');
            expect(svg, art).not.toBeNull();
            expect(svg?.getAttribute('aria-hidden')).toBe('true');
            expect(svg?.getAttribute('viewBox')).toBe('0 0 160 90');
            element.remove();
        }
    });

    it('defaults to a chub', async () => {
        const element = await mount();
        expect(element.art).toBe('chub');
        expect(element.renderRoot.querySelectorAll('path').length).toBeGreaterThan(0);
    });
});
