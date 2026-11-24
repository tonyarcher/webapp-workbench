import { loadReadingProgress, saveReadingProgress } from '../../services/reading-progress';
import type { Article } from '../../types';

export interface ProgressHost extends HTMLElement {
    article: Article | null;
    progressArticleId: string | null;
    readProgress: number;
    progressRestorePending: boolean;
    progressSaveTimer: number | null;
    progressRestoreUserScrolled: boolean;
    progressApplyingRestore: boolean;
    scrollTop: number;
    readonly scrollHeight: number;
    readonly clientHeight: number;
    updateComplete: Promise<unknown>;
}

export function persistReadingProgress(host: ProgressHost): void {
    if (host.progressRestorePending) return;
    const id = host.progressArticleId;
    if (!id) return;
    saveReadingProgress(id, host.readProgress);
}

export function handleProgressScroll(host: ProgressHost): void {
    const max = host.scrollHeight - host.clientHeight;
    host.readProgress = max > 0 ? Math.min(1, Math.max(0, host.scrollTop / max)) : 0;
    if (host.progressRestorePending) return;
    if (!host.progressApplyingRestore) host.progressRestoreUserScrolled = true;
    if (host.progressSaveTimer !== null) window.clearTimeout(host.progressSaveTimer);
    host.progressSaveTimer = window.setTimeout(() => {
        host.progressSaveTimer = null;
        persistReadingProgress(host);
    }, 400);
}

export function flushProgressOnSwitch(host: ProgressHost): void {
    if (host.progressSaveTimer !== null) {
        window.clearTimeout(host.progressSaveTimer);
        host.progressSaveTimer = null;
    }
    persistReadingProgress(host);
}

export function beginArticleProgress(host: ProgressHost): number | null {
    host.progressRestoreUserScrolled = false;
    const saved = host.article?.id ? loadReadingProgress(host.article.id) : null;
    host.readProgress = saved ?? 0;
    host.progressRestorePending = saved !== null;
    host.scrollTop = 0;
    return saved;
}

export async function restoreReadingProgress(host: ProgressHost, articleId: string, fraction: number): Promise<void> {
    await host.updateComplete;
    if (host.article?.id !== articleId) return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    if (host.article?.id !== articleId) return;
    const apply = () => {
        const max = host.scrollHeight - host.clientHeight;
        if (max <= 0) return false;
        host.progressApplyingRestore = true;
        host.scrollTop = Math.round(fraction * max);
        host.readProgress = Math.min(1, Math.max(0, host.scrollTop / max));
        window.requestAnimationFrame(() => {
            host.progressApplyingRestore = false;
        });
        return true;
    };
    if (!apply()) {
        host.readProgress = 0;
        host.progressRestorePending = false;
        saveReadingProgress(articleId, 0);
        return;
    }
    host.progressRestorePending = false;
    for (const delay of [250, 1000]) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
        if (host.article?.id !== articleId || host.progressRestoreUserScrolled) return;
        apply();
    }
}
