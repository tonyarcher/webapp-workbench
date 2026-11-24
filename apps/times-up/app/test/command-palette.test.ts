// The command palette dialog in a real DOM: open, filter, run, close.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/command-palette/command-palette';
import type { CommandPalette } from '../src/web-components/command-palette/command-palette';
import type { Command } from '../src/services/commands';

const makeCommands = (runs: string[]): Command[] => [
    { id: 'all', title: 'All articles', group: 'go', hint: 'Go', run: () => runs.push('all') },
    { id: 'star', title: 'Star current article', group: 'act', hint: 'Act', run: () => runs.push('star') },
    { id: 'cards', title: 'Cards view', group: 'act', hint: 'Act', run: () => runs.push('cards') },
];

function input(el: CommandPalette): HTMLInputElement {
    return el.shadowRoot!.querySelector('input')!;
}

function options(el: CommandPalette): HTMLElement[] {
    return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]'));
}

async function mount(runs: string[]): Promise<CommandPalette> {
    const el = document.createElement('command-palette') as CommandPalette;
    el.commands = makeCommands(runs);
    el.open = true;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('command-palette', () => {
    let el: CommandPalette | undefined;

    afterEach(async () => {
        if (el) {
            el.open = false;
            await el.updateComplete;
            el.remove();
            el = undefined;
        }
    });

    it('opens a labelled dialog and focuses the query', async () => {
        el = await mount([]);
        const dialog = el.shadowRoot!.querySelector('dialog')!;
        expect(dialog.open).to.equal(true);
        expect(dialog.getAttribute('aria-label')).to.equal('Command palette');
        expect(el.shadowRoot!.activeElement).to.equal(input(el));
        expect(options(el).length).to.equal(3);
    });

    it('filters by fuzzy query and runs the active option', async () => {
        const runs: string[] = [];
        el = await mount(runs);
        // The shell owns execution; mirror its handler so the chosen command runs.
        el.addEventListener('run', (e) => (e as CustomEvent<Command>).detail.run());
        const field = input(el);
        field.value = 'star';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await el.updateComplete;
        const matches = options(el);
        expect(matches.length).to.equal(1);
        expect(matches[0]!.textContent).to.contain('Star current article');
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect(runs).to.deep.equal(['star']);
    });

    it('moves the active option with the arrow keys', async () => {
        el = await mount([]);
        const field = input(el);
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect(options(el)[1]!.getAttribute('aria-selected')).to.equal('true');
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect(options(el)[0]!.getAttribute('aria-selected')).to.equal('true');
    });

    it('closes on Escape', async () => {
        el = await mount([]);
        let closed = false;
        el.addEventListener('close', () => (closed = true));
        input(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect(closed).to.equal(true);
    });

    it('closes when clicking outside the dialog content', async () => {
        el = await mount([]);
        let closed = false;
        el.addEventListener('close', () => (closed = true));
        const dialog = el.shadowRoot!.querySelector('dialog')!;
        dialog.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;
        expect(closed).to.equal(true);
    });

    it('does not close when a drag that started inside ends on the dialog', async () => {
        el = await mount([]);
        let closed = false;
        el.addEventListener('close', () => (closed = true));
        const dialog = el.shadowRoot!.querySelector('dialog')!;
        const field = input(el);
        field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;
        expect(closed).to.equal(false);
    });
});
