// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CwStartScreen } from './start-screen';

interface StartDetail {
    mode: 'practice' | 'points';
    speciesId: string;
}

function button(root: ParentNode, label: string): HTMLButtonElement {
    const match = Array.from(root.querySelectorAll('button')).find((item) => item.textContent?.includes(label));
    if (!match) throw new Error(`No button containing ${label}`);
    return match;
}

async function mount(): Promise<CwStartScreen> {
    const element = new CwStartScreen();
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('start screen', () => {
    it('shows the title and both modes', async () => {
        const element = await mount();
        expect(element.renderRoot.querySelector('h1')?.textContent).toBe('Coldwater');
        const modes = Array.from(element.renderRoot.querySelectorAll('.mode-card'));
        expect(modes.map((mode) => mode.textContent)).toEqual([
            expect.stringContaining('Practice'),
            expect.stringContaining('Play for points'),
        ]);
        expect(button(element.renderRoot, 'Practice').getAttribute('aria-pressed')).toBe('true');
    });

    it('selects a practice fish and emits the run', async () => {
        const element = await mount();
        const events: CustomEvent<StartDetail>[] = [];
        element.addEventListener('start-run', (event) => events.push(event as CustomEvent<StartDetail>));
        button(element.renderRoot, 'Mackinaw').click();
        await element.updateComplete;
        button(element.renderRoot, 'Enter the lake').click();
        expect(events).toHaveLength(1);
        expect(events[0]?.detail).toEqual({ mode: 'practice', speciesId: 'mackinaw' });
    });

    it('switches to points mode and emits the chosen fallback fish', async () => {
        const element = await mount();
        const events: CustomEvent<StartDetail>[] = [];
        element.addEventListener('start-run', (event) => events.push(event as CustomEvent<StartDetail>));
        button(element.renderRoot, 'Play for points').click();
        await element.updateComplete;
        expect(button(element.renderRoot, 'Play for points').getAttribute('aria-pressed')).toBe('true');
        expect(element.renderRoot.querySelector('.species-picker')).toBeNull();
        expect(element.renderRoot.textContent).toContain('Your fish is a mystery');
        button(element.renderRoot, 'Enter the lake').click();
        expect(events[0]?.detail.mode).toBe('points');
    });

    it('opens the field guide', async () => {
        const element = await mount();
        let opened = 0;
        element.addEventListener('open-guide', () => {
            opened += 1;
        });
        button(element.renderRoot, 'Field guide').click();
        expect(opened).toBe(1);
    });

    it('shows a best score when one exists', async () => {
        const element = new CwStartScreen();
        element.highScore = 42;
        document.body.appendChild(element);
        await element.updateComplete;
        expect(element.renderRoot.textContent).toContain('Best score: 42');
    });
});
