// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SPECIES_LIST } from '../../core/data';
import { CwFieldGuide } from './field-guide';

async function mount(): Promise<CwFieldGuide> {
    const element = new CwFieldGuide();
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('field guide', () => {
    it('lists every fish with its diet and threats', async () => {
        const element = await mount();
        expect(element.renderRoot.querySelector('h1')?.textContent).toBe('Field guide');
        const cards = Array.from(element.renderRoot.querySelectorAll('.card'));
        expect(cards).toHaveLength(SPECIES_LIST.length);
        const text = element.renderRoot.textContent ?? '';
        expect(text).toContain('Walleye');
        expect(text).toContain('Mackinaw');
        expect(text).toContain('River otter');
        expect(element.renderRoot.querySelectorAll('cw-fish-art')).toHaveLength(SPECIES_LIST.length);
    });

    it('closes back to the lake', async () => {
        const element = await mount();
        let closed = 0;
        element.addEventListener('close', () => {
            closed += 1;
        });
        const back = element.renderRoot.querySelector<HTMLButtonElement>('.back');
        expect(back).not.toBeNull();
        back?.click();
        expect(closed).toBe(1);
    });
});
