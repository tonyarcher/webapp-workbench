import './test-setup';
import { expect } from '@esm-bundle/chai';
import { ShortcutsDialog } from '../src/web-components/shortcuts-dialog/shortcuts-dialog';
import { LIST_SHORTCUTS_HELP } from '../src/services/shortcuts';

describe('help dialog', () => {
    let dialog: ShortcutsDialog | undefined;

    afterEach(() => {
        dialog?.remove();
        dialog = undefined;
    });

    it('renders the views guide and shared shortcut tables', () => {
        dialog = new ShortcutsDialog();
        document.body.append(dialog);
        dialog.open = true;

        const root = dialog.shadowRoot;
        const headings = [...(root?.querySelectorAll('h3') ?? [])].map((h) => h.textContent);
        expect(headings).to.include('Views');
        expect(headings).to.include('Article list');
        expect(headings).to.include('Open article');
        expect(root?.querySelector('kbd')?.textContent).to.equal('All');
        expect(root?.querySelectorAll('.row').length).to.be.greaterThan(LIST_SHORTCUTS_HELP.length);
    });

    it('hides its content when closed', () => {
        dialog = new ShortcutsDialog();
        document.body.append(dialog);
        dialog.open = true;
        dialog.open = false;

        expect(dialog.shadowRoot?.querySelector<HTMLElement>('.dialog')?.style.display).to.equal('none');
    });
});
