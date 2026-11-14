// The Settings > Reading defaults, in a real DOM. The smoke suite pins the
// storage fallback/override logic; this pins the shadow-root wiring the review
// called out: the page-size select must show the saved value, not the first
// option, and "Apply to all views" must clear the per-view map.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/settings-dialog/settings-dialog';
import type { SettingsDialog } from '../src/web-components/settings-dialog/settings-dialog';

function readingSection(el: SettingsDialog): HTMLElement {
    const dialog = el.shadowRoot!.querySelector('dialog')!;
    const section = Array.from(dialog.querySelectorAll<HTMLElement>('.section')).find(
        (s) => s.querySelector('h3')?.textContent === 'Reading',
    );
    if (!section) throw new Error('Reading section missing');
    return section;
}

function selects(el: SettingsDialog): HTMLSelectElement[] {
    return Array.from(readingSection(el).querySelectorAll<HTMLSelectElement>('.view-field select'));
}

async function mount(): Promise<SettingsDialog> {
    const el = document.createElement('settings-dialog') as SettingsDialog;
    el.open = true;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('settings-dialog reading defaults', () => {
    let el: SettingsDialog | undefined;

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(async () => {
        if (el) {
            el.open = false;
            await el.updateComplete;
            el.remove();
            el = undefined;
        }
    });

    it('shows the built-in defaults, including the page size', async () => {
        el = await mount();
        const [listView, sort, pageSize, columns] = selects(el);
        expect(listView!.value).to.equal('detailed');
        expect(sort!.value).to.equal('hot');
        expect(pageSize!.value).to.equal('50');
        expect(pageSize!.selectedOptions[0]?.textContent).to.equal('50');
        expect(columns!.value).to.equal('4');
    });

    it('saves a changed default and applies it to every view', async () => {
        const perView = {
            all: {
                listView: 'detailed',
                sort: 'hot',
                pageSize: 20,
                maxCardCols: 4,
                unreadOnly: true,
                markOnScroll: false,
            },
        };
        localStorage.setItem('rss-reader:view-settings', JSON.stringify(perView));

        el = await mount();
        const listView = selects(el)[0]!;
        listView.value = 'cards';
        listView.dispatchEvent(new Event('change', { bubbles: true }));
        await el.updateComplete;

        const saved = JSON.parse(localStorage.getItem('rss-reader:default-view-settings')!) as { listView: string };
        expect(saved.listView).to.equal('cards');

        const apply = Array.from(readingSection(el).querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === 'Apply to all views',
        );
        apply!.click();
        await el.updateComplete;

        expect(localStorage.getItem('rss-reader:view-settings')).to.equal(null);
    });
});
