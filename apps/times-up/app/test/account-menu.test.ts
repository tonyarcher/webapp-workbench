import './test-setup';
import { expect } from '@esm-bundle/chai';
import { applyTheme } from '../src/theme';
import type { AccountMenu } from '../src/web-components/account-menu/account-menu';
import '../src/web-components/account-menu/account-menu';

function trigger(menu: AccountMenu): HTMLButtonElement {
    return menu.shadowRoot!.querySelector<HTMLButtonElement>('.chip')!;
}

function wireToggle(menu: AccountMenu): () => number {
    let opens = 0;
    menu.addEventListener('close', () => {
        menu.open = false;
    });
    menu.addEventListener('open-account', (event) => {
        opens += 1;
        menu.anchor = (event as CustomEvent<{ x: number; y: number }>).detail;
        menu.open = !menu.open;
    });
    return () => opens;
}

function themeButton(menu: AccountMenu, label: string): HTMLButtonElement {
    const button = Array.from(menu.shadowRoot!.querySelectorAll<HTMLButtonElement>('.action')).find((node) =>
        node.textContent?.includes(label),
    );
    expect(button, label).not.to.equal(undefined);
    return button!;
}

describe('account menu theme choices', () => {
    let menu: AccountMenu;

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.dataset['theme'] = 'light';
        menu = document.createElement('account-menu') as AccountMenu;
        menu.host = {
            username: 'reader',
            openPalette: () => {},
            onShowShortcuts: () => {},
            onSignOut: () => {},
        };
        document.body.append(menu);
        menu.open = true;
    });

    afterEach(() => {
        menu.remove();
        localStorage.clear();
        document.documentElement.dataset['theme'] = 'light';
    });

    it('anchors to the profile chip instead of the click coordinates', () => {
        menu.open = false;
        const anchors: Array<{ x: number; y: number }> = [];
        menu.addEventListener('open-account', (event) => {
            anchors.push((event as CustomEvent<{ x: number; y: number }>).detail);
            menu.open = true;
        });
        trigger(menu).dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 20 }));
        menu.open = false;
        trigger(menu).dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 400 }));
        expect(anchors).to.have.length(2);
        expect(anchors[0]).to.deep.equal(anchors[1]);
    });

    it('closes when the profile chip is clicked a second time', () => {
        menu.open = false;
        wireToggle(menu);
        trigger(menu).click();
        expect(menu.open).to.equal(true);
        trigger(menu).click();
        expect(menu.open).to.equal(false);
    });

    it('does not reopen when native light-dismiss runs before the second click', async () => {
        menu.open = false;
        const opens = wireToggle(menu);
        trigger(menu).click();
        expect(menu.open).to.equal(true);
        const secondClick = trigger(menu);
        secondClick.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        menu.shadowRoot!.querySelector<HTMLElement>('.menu')!.hidePopover();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        secondClick.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(menu.open).to.equal(false);
        expect(opens()).to.equal(1);
    });

    it('shows Light, Dark, and Lights Out with the current theme selected', () => {
        applyTheme('dark');
        menu.open = false;
        menu.open = true;
        expect(themeButton(menu, 'Light').getAttribute('aria-pressed')).to.equal('false');
        expect(themeButton(menu, 'Dark').getAttribute('aria-pressed')).to.equal('true');
        expect(themeButton(menu, 'Lights Out').getAttribute('aria-pressed')).to.equal('false');
    });

    it('applies and persists each theme from the menu', () => {
        for (const [label, value] of [
            ['Dark', 'dark'],
            ['Lights Out', 'oled'],
            ['Light', 'light'],
        ] as const) {
            themeButton(menu, label).click();
            expect(document.documentElement.dataset['theme']).to.equal(value);
            expect(localStorage.getItem('times-up:theme')).to.equal(value);
            menu.open = false;
            menu.open = true;
            expect(themeButton(menu, label).getAttribute('aria-pressed')).to.equal('true');
        }
    });
});
