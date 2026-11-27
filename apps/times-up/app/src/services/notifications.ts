// Notification permission onboarding (S2).
//
// The browser only lets a page ask for notification permission from a user
// gesture, and a denial is sticky. So nothing in this module runs on import:
// the settings panel reads the current state, and the reader presses a button
// to ask. The panel around that button is the explanation the prompt needs.
//
// Notifications never carry article text, titles, URLs, tokens, or user ids.
// This module shows one generic test notification; the alert and briefing
// payloads stay with the slices that select them.

export type NotificationState = 'unsupported' | 'default' | 'granted' | 'denied';

/** The slice of the Notification API this module uses, so tests can stand in. */
interface NotificationApi {
    permission: NotificationPermission;
    requestPermission(): Promise<NotificationPermission>;
    new (title: string, options?: NotificationOptions): unknown;
}

function notificationApi(): NotificationApi | null {
    const api = (globalThis as unknown as { Notification?: NotificationApi }).Notification;
    return typeof api === 'function' ? api : null;
}

export function notificationsSupported(): boolean {
    return notificationApi() !== null;
}

/** The live browser state. `unsupported` is ours; the rest are the API's. */
export function notificationState(): NotificationState {
    const api = notificationApi();
    return api ? api.permission : 'unsupported';
}

/**
 * Ask the browser. Call this only from a click handler: a request without a
 * gesture is ignored or auto-denied, and the denial is permanent for the site.
 * An existing grant or denial returns without a second prompt.
 */
export async function requestNotificationPermission(): Promise<NotificationState> {
    const api = notificationApi();
    if (!api) return 'unsupported';
    if (api.permission === 'granted' || api.permission === 'denied') return api.permission;
    try {
        return await api.requestPermission();
    } catch {
        return notificationState();
    }
}

/** Prefer the service worker when one is registered; some mobile browsers
 *  reject the page constructor outright. Falls back to the page API. */
async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;
    try {
        return (await navigator.serviceWorker.getRegistration()) ?? null;
    } catch {
        return null;
    }
}

/**
 * Show one generic test notification. Returns false when the browser has not
 * granted permission or refused to display it; callers report that plainly.
 */
export async function showTestNotification(): Promise<boolean> {
    const api = notificationApi();
    if (!api || api.permission !== 'granted') return false;
    const title = 'Times Up';
    const options: NotificationOptions = {
        body: 'Test notification. Notifications are working.',
        tag: 'times-up-test',
    };
    const registration = await serviceWorkerRegistration();
    if (registration) {
        try {
            await registration.showNotification(title, options);
            return true;
        } catch {
            // Fall through to the page constructor.
        }
    }
    try {
        new api(title, options);
        return true;
    } catch {
        return false;
    }
}
