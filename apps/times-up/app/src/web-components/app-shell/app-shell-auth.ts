import { clearClientDb } from '../../db/db';
import { bustCounts, queryClient } from '../../query';
import { currentUsername, hasSession, logout, startLogin } from '../../services/auth';
import { clearToasts, type ToastNotice } from '../../services/toast';
import { startForegroundSync, stopForegroundSync } from '../../services/foreground-sync';
import { startInterestingCountsRefresh, stopInterestingCountsRefresh } from '../../services/interesting-counts-refresh';
import { startAppBadge, stopAppBadge, clearAppBadge } from '../../services/app-badge';
import {
    startAlertNotifications,
    stopAlertNotifications,
    clearAlertSnapshot,
} from '../../services/alert-notifications';
import { invalidateStarredTitles } from '../../services/interesting-starred';
import { forgetLearning } from '../../services/interesting-settings';

export interface AppShellAuthHost {
    authed: boolean;
    username: string | null;
    authError: string;
    localDataClearFailed: boolean;
    toasts: ToastNotice[];
    toastTimers: Map<number, ReturnType<typeof setTimeout>>;
    autoSyncFeedIds: () => string[] | undefined;
}

const LOCAL_CLEAR_FAILED_KEY = 'times-up.local-data-clear-failed';

export function hasPersistentLocalClearFailure(): boolean {
    try {
        return localStorage.getItem(LOCAL_CLEAR_FAILED_KEY) === '1';
    } catch {
        return false;
    }
}

function writeLocalClearFailure(failed: boolean): void {
    try {
        if (failed) localStorage.setItem(LOCAL_CLEAR_FAILED_KEY, '1');
        else localStorage.removeItem(LOCAL_CLEAR_FAILED_KEY);
    } catch {
        // The in-memory flag still blocks sign-in for this page.
    }
}

export function onAuthError(host: AppShellAuthHost, e: Event): void {
    const detail = (e as CustomEvent<unknown>).detail;
    host.authError = typeof detail === 'string' && detail ? detail : 'Sign-in failed';
}

export function onAuthChanged(host: AppShellAuthHost): void {
    host.authed = hasSession();
    host.username = currentUsername();
    clearToasts();
    if (host.authed) {
        startInterestingCountsRefresh();
        startAppBadge();
        startAlertNotifications();
        startForegroundSync(host.autoSyncFeedIds);
    } else {
        stopInterestingCountsRefresh();
        stopAppBadge();
        stopAlertNotifications();
        stopForegroundSync();
    }
}

export function signIn(host: AppShellAuthHost): void {
    if (host.localDataClearFailed) {
        host.authError = 'Close other Times Up tabs and reload before signing in again.';
        return;
    }
    host.authError = '';
    startLogin().catch((err: unknown) => {
        host.authError = err instanceof Error ? err.message : 'Sign-in failed';
    });
}

export function signOut(host: AppShellAuthHost): void {
    stopInterestingCountsRefresh();
    stopAppBadge();
    stopAlertNotifications();
    clearAlertSnapshot();
    void clearAppBadge();
    stopForegroundSync();
    void resetAccount(host).catch(() => {
        host.authError = 'Signed out on this device, but some local data could not be cleared.';
        writeLocalClearFailure(true);
        host.localDataClearFailed = true;
        host.authed = false;
        host.username = null;
    });
}

export async function recoverLocalDataClear(host: AppShellAuthHost): Promise<void> {
    if (!hasPersistentLocalClearFailure()) return;
    try {
        await clearClientDb();
        writeLocalClearFailure(false);
        host.localDataClearFailed = false;
        host.authError = '';
    } catch {
        host.localDataClearFailed = true;
        host.authError = 'Close other Times Up tabs and reload before signing in again.';
    }
}

async function resetAccount(host: AppShellAuthHost): Promise<void> {
    const ended = await logout();
    bustCounts();
    queryClient.clear();
    // The seeded likes list is in memory, not storage: drop it here or the
    // next sign-in would rank with the previous account's likes.
    invalidateStarredTitles();
    // Every learned signal is account-scoped, including the ledger, deranks,
    // and the decay clock. The stars themselves live on the server.
    forgetLearning();
    await clearClientDb();
    writeLocalClearFailure(false);
    host.authed = false;
    host.username = null;
    host.localDataClearFailed = false;
    document.title = 'Times Up';
    void clearAppBadge();
    clearToasts();
    host.authError = ended
        ? ''
        : 'Signed out on this device, but the identity service did not confirm it. Reload before signing in again.';
}

export function syncToastTimers(host: AppShellAuthHost, dismissToast: (id: number) => void): void {
    for (const [id, timer] of host.toastTimers) {
        if (!host.toasts.some((notice) => notice.id === id)) {
            clearTimeout(timer);
            host.toastTimers.delete(id);
        }
    }
    for (const notice of host.toasts) {
        if (host.toastTimers.has(notice.id)) continue;
        const id = notice.id;
        host.toastTimers.set(
            id,
            setTimeout(() => {
                host.toastTimers.delete(id);
                dismissToast(id);
            }, 6000),
        );
    }
}
