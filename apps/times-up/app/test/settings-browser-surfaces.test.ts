// S7: the browser-surface section exposes install guidance, the count-only
// app-icon badge toggle, and the existing notification controls.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/settings-general/settings-general';
import type { SettingsGeneral } from '../src/web-components/settings-general/settings-general';
import { badgeEnabled, saveBadgeEnabled } from '../src/services/app-badge';
import { captureInstallPrompt } from '../src/services/pwa-install';

captureInstallPrompt();

function section(el: SettingsGeneral): HTMLElement {
    const root = el.shadowRoot?.querySelector<HTMLElement>('[data-setting="notifications"]');
    if (!root) throw new Error('Browser surfaces section missing');
    return root;
}

function badgeToggle(el: SettingsGeneral): HTMLInputElement {
    const input = [...section(el).querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((candidate) =>
        candidate.parentElement?.textContent?.includes('app icon'),
    );
    if (!input) throw new Error('Badge toggle missing');
    return input;
}

async function mount(): Promise<SettingsGeneral> {
    const el = document.createElement('settings-general') as SettingsGeneral;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('settings browser surfaces', () => {
    let el: SettingsGeneral | undefined;

    beforeEach(() => {
        saveBadgeEnabled(true);
    });

    afterEach(() => {
        el?.remove();
        el = undefined;
        saveBadgeEnabled(true);
    });

    it('shows install guidance and a count-only badge toggle', async () => {
        el = await mount();
        expect(section(el).textContent).to.include('Browser surfaces');
        expect(section(el).textContent).to.include('Install from your browser menu');
        expect(section(el).textContent).to.include('Count only');
        expect(badgeToggle(el).checked).to.equal(true);
    });

    it('turning the badge off persists and clears it', async () => {
        el = await mount();
        badgeToggle(el).click();
        await el.updateComplete;
        expect(badgeEnabled()).to.equal(false);
        expect(badgeToggle(el).checked).to.equal(false);
    });

    it('turning the badge back on persists', async () => {
        saveBadgeEnabled(false);
        el = await mount();
        badgeToggle(el).click();
        await el.updateComplete;
        expect(badgeEnabled()).to.equal(true);
        expect(badgeToggle(el).checked).to.equal(true);
    });

    it('accepting install repaints the installed state', async () => {
        const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
            prompt: () => Promise<void>;
            userChoice: Promise<{ outcome: 'accepted' }>;
        };
        event.prompt = async () => {};
        event.userChoice = Promise.resolve({ outcome: 'accepted' });
        window.dispatchEvent(event);
        el = await mount();
        const install = [...section(el).querySelectorAll<HTMLButtonElement>('button')].find((button) =>
            button.textContent?.includes('Install Times Up'),
        );
        if (!install) throw new Error('Install action missing');
        install.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await el.updateComplete;
        expect(section(el).textContent).to.include('Times Up installed.');
        expect(section(el).textContent).to.include('Times Up is installed as an app.');
        const labels = [...section(el).querySelectorAll<HTMLButtonElement>('button')].map(
            (button) => button.textContent,
        );
        expect(labels.some((label) => label?.includes('Install Times Up'))).to.equal(false);
    });
});
