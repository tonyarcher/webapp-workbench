// S2: notification permission onboarding. The panel explains first, and only
// the button asks. These tests pin the gesture-only rule and each state's
// action, because the failure mode (a prompt on load) is invisible until the
// reader has already denied the site for good.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/settings-general/settings-general';
import type { SettingsGeneral } from '../src/web-components/settings-general/settings-general';

class FakeNotification {
    static permission: NotificationPermission = 'default';
    static next: NotificationPermission = 'granted';
    static requests = 0;
    static shown: string[] = [];

    static requestPermission(): Promise<NotificationPermission> {
        FakeNotification.requests += 1;
        FakeNotification.permission = FakeNotification.next;
        return Promise.resolve(FakeNotification.next);
    }

    constructor(title: string) {
        FakeNotification.shown.push(title);
    }
}

function notificationsSection(el: SettingsGeneral): HTMLElement {
    const section = el.shadowRoot?.querySelector<HTMLElement>('[data-setting="notifications"]');
    if (!section) throw new Error('Notifications section missing');
    return section;
}

function action(el: SettingsGeneral): HTMLButtonElement {
    const button = notificationsSection(el).querySelector<HTMLButtonElement>('button');
    if (!button) throw new Error('Notifications action missing');
    return button;
}

async function mount(): Promise<SettingsGeneral> {
    const el = document.createElement('settings-general') as SettingsGeneral;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

async function settle(el: SettingsGeneral): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
}

describe('settings-general notifications section', () => {
    let el: SettingsGeneral | undefined;
    let prior: PropertyDescriptor | undefined;

    beforeEach(() => {
        prior = Object.getOwnPropertyDescriptor(globalThis, 'Notification');
        FakeNotification.permission = 'default';
        FakeNotification.next = 'granted';
        FakeNotification.requests = 0;
        FakeNotification.shown = [];
        Object.defineProperty(globalThis, 'Notification', {
            value: FakeNotification,
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        el?.remove();
        el = undefined;
        if (prior) Object.defineProperty(globalThis, 'Notification', prior);
        else delete (globalThis as Record<string, unknown>)['Notification'];
    });

    it('never asks for permission when the panel mounts', async () => {
        el = await mount();
        expect(notificationsSection(el).textContent).to.include('Enable notifications');
        expect(FakeNotification.requests).to.equal(0);
    });

    it('asks once from the button and switches to the granted action', async () => {
        el = await mount();
        action(el).click();
        await settle(el);
        expect(FakeNotification.requests).to.equal(1);
        expect(notificationsSection(el).textContent).to.include('Send test notification');
    });

    it('sends one generic test notification when granted', async () => {
        FakeNotification.permission = 'granted';
        el = await mount();
        action(el).click();
        await settle(el);
        expect(FakeNotification.shown).to.deep.equal(['Times Up']);
        expect(notificationsSection(el).textContent).to.include('Test notification sent.');
    });

    it('rechecks a denied permission without prompting again', async () => {
        FakeNotification.permission = 'denied';
        el = await mount();
        action(el).click();
        await settle(el);
        expect(FakeNotification.requests).to.equal(0);
        expect(notificationsSection(el).textContent).to.include('Still blocked');
    });

    it('offers no action when the browser has no Notification API', async () => {
        delete (globalThis as Record<string, unknown>)['Notification'];
        el = await mount();
        expect(notificationsSection(el).textContent).to.include('does not support notifications');
        expect(notificationsSection(el).querySelector('button')).to.equal(null);
    });
});
