// Reading controls that belong to a single list (layout, sort, page size,
// unread-only, mark-on-scroll) moved back to the list toolbar. General now
// keeps only article-reader typography. This pins that boundary.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/settings-general/settings-general';
import type { SettingsGeneral } from '../src/web-components/settings-general/settings-general';

function sectionTitles(el: SettingsGeneral): string[] {
    const panel = el.shadowRoot!.querySelector('.panel')!;
    return Array.from(panel.querySelectorAll<HTMLElement>('.section h3')).map((h) => h.textContent ?? '');
}

function readerSection(el: SettingsGeneral): HTMLElement {
    const panel = el.shadowRoot!.querySelector('.panel')!;
    const section = Array.from(panel.querySelectorAll<HTMLElement>('.section')).find(
        (s) => s.querySelector('h3')?.textContent === 'Reader',
    );
    if (!section) throw new Error('Reader section missing');
    return section;
}

async function mount(): Promise<SettingsGeneral> {
    const el = document.createElement('settings-general') as SettingsGeneral;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('settings-general reader section', () => {
    let el: SettingsGeneral | undefined;

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(async () => {
        if (el) {
            await el.updateComplete;
            el.remove();
            el = undefined;
        }
    });

    it('keeps typography but not per-view list controls', async () => {
        el = await mount();
        expect(sectionTitles(el)).to.include('Reader');
        expect(sectionTitles(el)).not.to.include('Reading');
        const selects = Array.from(readerSection(el).querySelectorAll<HTMLSelectElement>('.view-field select'));
        expect(selects.map((s) => s.value)).to.deep.equal(['sans', 'medium', 'normal', 'medium']);
        const labels = readerSection(el).textContent ?? '';
        for (const gone of ['Page size', 'Sort', 'Unread only', 'Mark on scroll', 'Apply to all views']) {
            expect(labels).not.to.include(gone);
        }
    });

    it('persists a changed reader font', async () => {
        el = await mount();
        const font = readerSection(el).querySelector<HTMLSelectElement>('.view-field select')!;
        font.value = 'serif';
        font.dispatchEvent(new Event('change', { bubbles: true }));
        await el.updateComplete;
        const saved = JSON.parse(localStorage.getItem('times-up:reader-mode')!) as { font: string };
        expect(saved.font).to.equal('serif');
    });
});
