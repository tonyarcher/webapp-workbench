import { clearClientDb } from '../../db/db';
import { bustCounts, queryClient } from '../../query';
import { currentUsername, hasSession, logout, startLogin } from '../../services/auth';
import { clearToasts, type ToastNotice } from '../../services/toast';
import { startForegroundSync, stopForegroundSync } from '../../services/foreground-sync';
import { startInterestingCountsRefresh, stopInterestingCountsRefresh } from '../../services/interesting-counts-refresh';
import { invalidateStarredTitles } from '../../services/interesting-starred';
import { forgetLearning } from '../../services/interesting-settings';

export interface AppShellAuthHost {
    authed: boolean;
    username: string | null;
    authError: string;
    toasts: ToastNotice[];
    toastTimers: Map<number, ReturnType<typeof setTimeout>>;
    autoSyncFeedIds: () => string[] | undefined;
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
        startForegroundSync(host.autoSyncFeedIds);
    } else {
        stopInterestingCountsRefresh();
        stopForegroundSync();
    }
}

export function signIn(host: AppShellAuthHost): void {
    host.authError = '';
    startLogin().catch((err: unknown) => {
        host.authError = err instanceof Error ? err.message : 'Sign-in failed';
    });
}

export function signOut(host: AppShellAuthHost): void {
    stopInterestingCountsRefresh();
    stopForegroundSync();
    void resetAccount(host).catch(() => {
        host.authError = 'Signed out on this device, but some local data could not be cleared.';
        host.authed = false;
        host.username = null;
    });
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
    host.authed = false;
    host.username = null;
    document.title = 'Times Up';
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
