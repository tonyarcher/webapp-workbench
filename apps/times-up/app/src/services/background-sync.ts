// Browser background refresh (S6). The service worker wakes open tabs; the tab
// runs the existing foreground sync. No fetch, auth token, or account state
// crosses the worker boundary.

const SYNC_TAG = 'times-up-sync';
const PERIODIC_TAG = 'times-up-periodic';
const WAKE_MESSAGE = 'times-up:background-sync';
const PERIODIC_INTERVAL_MS = 12 * 60 * 60 * 1000;

interface SyncManager {
    register(tag: string): Promise<void>;
    unregister(tag: string): Promise<boolean>;
}

interface PeriodicSyncManager {
    register(tag: string, options: { minInterval: number }): Promise<void>;
    unregister(tag: string): Promise<boolean>;
}

type SyncRegistration = ServiceWorkerRegistration & {
    sync?: SyncManager;
    periodicSync?: PeriodicSyncManager;
};

let wake: (() => void) | null = null;
/** Serialize lifecycle changes so sign-out always unregisters after an in-flight start. */
let lifecycle: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
    lifecycle = lifecycle.then(task, task);
    return lifecycle;
}

function onMessage(event: MessageEvent): void {
    if (event.data?.type === WAKE_MESSAGE) wake?.();
}

async function registration(): Promise<SyncRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    return (await navigator.serviceWorker.getRegistration().catch(() => null)) ?? null;
}

async function register(reg: SyncRegistration): Promise<void> {
    await reg.sync?.register(SYNC_TAG).catch(() => {});
    await reg.periodicSync?.register(PERIODIC_TAG, { minInterval: PERIODIC_INTERVAL_MS }).catch(() => {});
}

async function unregister(reg: SyncRegistration): Promise<void> {
    await reg.sync?.unregister(SYNC_TAG).catch(() => false);
    await reg.periodicSync?.unregister(PERIODIC_TAG).catch(() => false);
}

/** Register when supported, and forward worker wakes to the tab's sync loop. */
export function startBackgroundSync(onWake: () => void): Promise<void> {
    return enqueue(async () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || wake) return;
        wake = onWake;
        navigator.serviceWorker.addEventListener('message', onMessage);
        const reg = await registration();
        if (reg) await register(reg);
    });
}

/** Sign-out: stop waking tabs and remove every browser registration. */
export function stopBackgroundSync(): Promise<void> {
    return enqueue(async () => {
        wake = null;
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.removeEventListener('message', onMessage);
        const reg = await registration();
        if (reg) await unregister(reg);
    });
}
