import { AuthError } from './api';

/**
 * Transient user-facing notices for failed API actions. A tiny pub/sub store
 * rather than window events, so it stays DOM-free (like the rest of
 * services/) and unit-testable under plain Node: the app shell subscribes
 * and renders, and timers for auto-dismiss live with the subscriber, never
 * here, so this module arms no timers of its own.
 *
 * Messages are fixed strings chosen by the caller. Raw errors never reach
 * the screen: they can carry URLs, tokens, or status text the user cannot
 * act on.
 */

/** One visible notice. The id lets the renderer dismiss a single notice. */
export interface ToastNotice {
    id: number;
    message: string;
}

type ToastListener = (current: ToastNotice[]) => void;

const MAX_NOTICES = 3;

let nextId = 1;
let notices: ToastNotice[] = [];
const listeners = new Set<ToastListener>();

function publish(): void {
    const snapshot = [...notices];
    for (const listener of [...listeners]) listener(snapshot);
}

/** Show an error notice, unless it is an auth failure: sign-out owns that surface. */
export function toastApiError(err: unknown, message: string): void {
    if (err instanceof AuthError) return;
    toastError(message);
}

/** Show an error notice unconditionally. Prefer toastApiError for API failures. */
export function toastError(message: string): void {
    notices = [...notices, { id: nextId++, message }].slice(-MAX_NOTICES);
    publish();
}

/** Subscribe to the notice list. The returned function unsubscribes. */
export function onToast(listener: ToastListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Remove one notice by id. Unknown ids change nothing and notify nobody. */
export function dismissToast(id: number): void {
    if (!notices.some((notice) => notice.id === id)) return;
    notices = notices.filter((notice) => notice.id !== id);
    publish();
}

/** Remove every notice. Empty already changes nothing and notifies nobody. */
export function clearToasts(): void {
    if (notices.length === 0) return;
    notices = [];
    publish();
}
