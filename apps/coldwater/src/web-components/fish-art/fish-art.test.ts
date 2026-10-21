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

    it('marks fish parts for motion and leaves other art without them', async () => {
        const fish = await mount('rainbow');
        expect(fish.renderRoot.querySelector('.fish-tail')).not.toBeNull();
        expect(fish.renderRoot.querySelector('.fish-dorsal')).not.toBeNull();
        expect(fish.renderRoot.querySelector('.fish-mouth')).not.toBeNull();
        expect(fish.renderRoot.querySelector('.fish-gulp')).not.toBeNull();
        expect(fish.renderRoot.querySelector('.fish-puff')).not.toBeNull();
        fish.remove();

        const otter = await mount('otter');
        expect(otter.renderRoot.querySelector('.fish-tail')).toBeNull();
        expect(otter.renderRoot.querySelector('.fish-dorsal')).toBeNull();
        expect(otter.renderRoot.querySelector('.fish-mouth')).toBeNull();
        expect(otter.renderRoot.querySelector('.fish-gulp')).toBeNull();
        otter.remove();
    });

    it('reflects motion, mouth, and gulp for CSS state', async () => {
        const element = await mount('chub');
        element.motion = 'swim';
        element.mouth = 'chomp';
        element.gulp = 'big';
        await element.updateComplete;
        expect(element.getAttribute('motion')).toBe('swim');
        expect(element.getAttribute('mouth')).toBe('chomp');
        expect(element.getAttribute('gulp')).toBe('big');
        element.remove();
    });
});
