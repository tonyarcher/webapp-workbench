// S3: the quiet-hours control lives in the Notifications section and writes the
// shared preference the alert check reads.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/settings-general/settings-general';
import type { SettingsGeneral } from '../src/web-components/settings-general/settings-general';
import { QUIET_HOURS_KEY, loadQuietHours } from '../src/services/quiet-hours';

function notificationsSection(el: SettingsGeneral): HTMLElement {
    const section = el.shadowRoot?.querySelector<HTMLElement>('[data-setting="notifications"]');
    if (!section) throw new Error('Notifications section missing');
    return section;
}

function quietToggle(el: SettingsGeneral): HTMLInputElement {
    const input = notificationsSection(el).querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!input) throw new Error('Quiet hours toggle missing');
    return input;
}

function timeInputs(el: SettingsGeneral): HTMLInputElement[] {
    return [...notificationsSection(el).querySelectorAll<HTMLInputElement>('input[type="time"]')];
}

async function mount(): Promise<SettingsGeneral> {
    const el = document.createElement('settings-general') as SettingsGeneral;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

async function change(input: HTMLInputElement): Promise<void> {
    input.dispatchEvent(new Event('change'));
}

describe('settings quiet hours', () => {
    let el: SettingsGeneral | undefined;

    beforeEach(() => {
        localStorage.removeItem(QUIET_HOURS_KEY);
    });

    afterEach(() => {
        el?.remove();
        el = undefined;
        localStorage.removeItem(QUIET_HOURS_KEY);
    });

    it('starts off and hides the window', async () => {
        el = await mount();
        expect(quietToggle(el).checked).to.equal(false);
        expect(timeInputs(el).length).to.equal(0);
    });

    it('enabling shows the default window and persists it', async () => {
        el = await mount();
        quietToggle(el).click();
        await el.updateComplete;
        const times = timeInputs(el);
        expect(times.length).to.equal(2);
        expect(times[0]!.value).to.equal('22:00');
        expect(times[1]!.value).to.equal('07:00');
        expect(loadQuietHours().enabled).to.equal(true);
    });

    it('a changed start time is saved', async () => {
        el = await mount();
        quietToggle(el).click();
        await el.updateComplete;
        const from = timeInputs(el)[0]!;
        from.value = '21:30';
        await change(from);
        await el.updateComplete;
        expect(loadQuietHours().startMinute).to.equal(21 * 60 + 30);
    });

    it('a changed end time is saved', async () => {
        el = await mount();
        quietToggle(el).click();
        await el.updateComplete;
        const to = timeInputs(el)[1]!;
        to.value = '06:15';
        await change(to);
        await el.updateComplete;
        expect(loadQuietHours().endMinute).to.equal(6 * 60 + 15);
    });

    it('an empty time input leaves the saved window alone', async () => {
        el = await mount();
        quietToggle(el).click();
        await el.updateComplete;
        const from = timeInputs(el)[0]!;
        from.value = '';
        await change(from);
        await el.updateComplete;
        expect(loadQuietHours().startMinute).to.equal(22 * 60);
    });

    it('disabling keeps the times but stops the window applying', async () => {
        el = await mount();
        quietToggle(el).click();
        await el.updateComplete;
        quietToggle(el).click();
        await el.updateComplete;
        expect(timeInputs(el).length).to.equal(0);
        expect(loadQuietHours().enabled).to.equal(false);
        expect(loadQuietHours().startMinute).to.equal(22 * 60);
    });
});
