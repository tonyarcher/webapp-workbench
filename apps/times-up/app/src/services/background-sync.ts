// Browser background refresh (S6). The service worker wakes open tabs; the tab
// runs the existing foreground sync. No fetch, auth token, or account state
// crosses the worker boundary.

const SYNC_TAG = 'times-up-sync';
const PERIODIC_TAG = 'times-up-periodic';
const WAKE_MESSAGE = 'times-up:background-sync';
const PERIODIC_INTERVAL_MS = 12 * 60 * 60 * 1000;

type SyncRegistration = ServiceWorkerRegistration & {
    sync?: unknown;
    periodicSync?: unknown;
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
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    const worker = navigator.serviceWorker;
    if (!worker || typeof worker.getRegistration !== 'function') return null;
    return (await worker.getRegistration().catch(() => null)) ?? null;
}

/** Browsers expose partial Sync APIs; ignore missing or non-function methods. */
async function invoke(manager: unknown, method: 'register' | 'unregister', ...args: unknown[]): Promise<void> {
    if (!manager || typeof manager !== 'object') return;
    const fn = (manager as Record<string, unknown>)[method];
    if (typeof fn !== 'function') return;
    try {
        await (fn as (...values: unknown[]) => Promise<unknown>).apply(manager, args);
    } catch {
        // Unsupported or rejected browser registration; foreground sync remains.
    }
}

async function register(reg: SyncRegistration): Promise<void> {
    await invoke(reg.sync, 'register', SYNC_TAG);
    await invoke(reg.periodicSync, 'register', PERIODIC_TAG, { minInterval: PERIODIC_INTERVAL_MS });
}

async function unregister(reg: SyncRegistration): Promise<void> {
    await invoke(reg.sync, 'unregister', SYNC_TAG);
    await invoke(reg.periodicSync, 'unregister', PERIODIC_TAG);
}

/** Register when supported, and forward worker wakes to the tab's sync loop. */
export function startBackgroundSync(onWake: () => void): Promise<void> {
    return enqueue(async () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        const worker = navigator.serviceWorker;
        if (!worker || typeof worker.addEventListener !== 'function' || wake) return;
        wake = onWake;
        worker.addEventListener('message', onMessage);
        const reg = await registration();
        if (reg) await register(reg);
    });
}

/** Sign-out: stop waking tabs and remove every browser registration. */
export function stopBackgroundSync(): Promise<void> {
    return enqueue(async () => {
        wake = null;
        if (typeof navigator === 'undefined') return;
        const worker = navigator.serviceWorker;
        if (!worker || typeof worker.removeEventListener !== 'function') return;
        worker.removeEventListener('message', onMessage);
        const reg = await registration();
        if (reg) await unregister(reg);
    });
}
