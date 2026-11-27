// S2 smoke: notification permission states, gesture-only requests, and the
// generic test payload. The service reads the Notification API lazily, so the
// module is imported after the environment is set up.
import { assert } from './smoke-assert';

type Permission = 'default' | 'denied' | 'granted';

class FakeNotification {
    static permission: Permission = 'default';
    static next: Permission = 'granted';
    static requests = 0;
    static shown: Array<{ title: string; options: NotificationOptions | undefined }> = [];

    static requestPermission(): Promise<Permission> {
        FakeNotification.requests += 1;
        FakeNotification.permission = FakeNotification.next;
        return Promise.resolve(FakeNotification.next);
    }

    constructor(title: string, options?: NotificationOptions) {
        FakeNotification.shown.push({ title, options });
    }
}

const globals = globalThis as Record<string, unknown>;
/** Read through a call: an `assert` on the property would narrow its type. */
const requestCount = (): number => FakeNotification.requests;
const prior = Object.getOwnPropertyDescriptor(globalThis, 'Notification');
Object.defineProperty(globalThis, 'Notification', { value: undefined, configurable: true, writable: true });

const notifications = await import('../src/services/notifications.js');

// ---- no API: degrade instead of throwing ----
assert(notifications.notificationsSupported() === false, 'notifications are unsupported without the API');
assert(notifications.notificationState() === 'unsupported', 'a missing API reports unsupported');
assert((await notifications.requestNotificationPermission()) === 'unsupported', 'asking without the API is a no-op');
assert((await notifications.showTestNotification()) === false, 'a test notification needs the API');

// ---- the three permission states ----
Object.defineProperty(globalThis, 'Notification', { value: FakeNotification, configurable: true, writable: true });
assert(requestCount() === 0, 'importing the service never asks for permission');
assert(notifications.notificationState() === 'default', 'default permission is reported');
assert(requestCount() === 0, 'reading the state does not prompt');

assert((await notifications.requestNotificationPermission()) === 'granted', 'a request returns the browser answer');
assert(requestCount() === 1, 'the request reaches the browser exactly once');

FakeNotification.permission = 'denied';
assert((await notifications.requestNotificationPermission()) === 'denied', 'a denial is reported');
assert(requestCount() === 1, 'a denied site is not prompted again');

FakeNotification.permission = 'granted';
assert((await notifications.requestNotificationPermission()) === 'granted', 'a grant is reported');
assert(requestCount() === 1, 'a granted site is not prompted again');

FakeNotification.permission = 'default';
FakeNotification.next = 'default';
assert(
    (await notifications.requestNotificationPermission()) === 'default',
    'a dismissed prompt leaves the default state',
);

// ---- the test notification payload ----
FakeNotification.permission = 'default';
assert((await notifications.showTestNotification()) === false, 'no test notification without permission');

FakeNotification.permission = 'granted';
assert((await notifications.showTestNotification()) === true, 'a granted site can show a test notification');
assert(FakeNotification.shown.length === 1, 'one test notification is shown');
const shown = FakeNotification.shown[0]!;
assert(shown.title === 'Times Up', 'the test notification uses the app name');
assert(shown.options?.body?.includes('Test notification') === true, 'the body says it is a test');
const payload = JSON.stringify(shown.options).toLowerCase();
for (const forbidden of ['http', 'article', 'token', 'user']) {
    assert(!payload.includes(forbidden), `the payload carries no ${forbidden} data`);
}

// ---- restore the environment for later phases ----
if (prior) Object.defineProperty(globalThis, 'Notification', prior);
else delete globals['Notification'];
