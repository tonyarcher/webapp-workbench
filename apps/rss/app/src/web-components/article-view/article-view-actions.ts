import {
    addToBoard,
    createBoard as createBoardMutation,
    markArticleRead,
    markArticleUnread,
    noteDerank,
    noteShare,
    removeFromBoard,
    saveForLater,
    toggleStar,
    unsaveForLater,
} from '../../mutations';
import { fetchSavedArticlesList } from '../../query';
import { fetchBoards, fetchBoardEntries } from '../../services/api';
import type { ArticleKeyword } from '../../services/keywords';
import type { Article, Board, RowHighlight } from '../../types';
import { stripTags } from '../../util';
import { recordUsage } from '../../services/usage';
import { enqueue } from '../../services/listen-queue';
import { toastError, toastInfo } from '../../services/toast';
import { navigate } from '../../router';
import { loadRowHighlights, setHighlightsEnabled } from '../../services/highlights';
import { articleKeywords } from './article-view-helpers';
import { persistReadingProgress } from './article-view-progress';

/**
 * State and methods the action helpers read and update on the component. The
 * component passes itself (`this as never`, matching the article-list modules).
 */
export interface ArticleViewActionsHost {
    article: Article | null;
    deranked: boolean;
    prevDeranked: boolean;
    prevStarred: boolean;
    savedForLater: boolean;
    savedStateGen: number;
    boardPickerOpen: boolean;
    boards: Board[];
    boardMembership: Set<string>;
    newBoardTitle: string;
    keyLines: RowHighlight | null;
    keyLinesLoading: boolean;
    /** True while a stored body or extraction is in flight for the open article. */
    bodyLoading: boolean;
    highlightsOn: boolean;
    sanitizedBody: { id: string; source: string | undefined; html: string } | null;
    keywords: ArticleKeyword[];
    /** Stored body fetched for a list row; survives parent object churn. */
    fetchedBody: { id: string; html: string } | null;
    dispatchEvent(e: Event): boolean;
    paint(): void;
    refreshSavedState(): Promise<void>;
    refreshKeyLines(): Promise<void>;
    ensureRichContent(a: Article): Promise<void>;
}

export async function onStar(host: ArticleViewActionsHost): Promise<void> {
    const started = host.article;
    if (!started) return;
    const next = !started.starred;
    if (next) {
        host.prevDeranked = host.deranked;
        noteDerank(started.id, started.title, false);
        host.deranked = false;
    } else if (host.prevDeranked) {
        noteDerank(started.id, started.title, true);
        host.deranked = true;
        host.prevDeranked = false;
    }
    host.article = { ...started, starred: next };
    if (await toggleStar(started.id, next)) {
        window.dispatchEvent(new CustomEvent('article-starred', { detail: { id: started.id, starred: next } }));
    } else if (host.article?.id === started.id) {
        host.article = { ...host.article, starred: started.starred };
        window.dispatchEvent(
            new CustomEvent('article-starred', { detail: { id: started.id, starred: started.starred } }),
        );
    }
}

export async function onToggleRead(host: ArticleViewActionsHost): Promise<void> {
    const started = host.article;
    if (!started) return;
    const nextRead: 0 | 1 = started.read ? 0 : 1;
    host.article = { ...started, read: nextRead };
    const ok = nextRead === 1 ? await markArticleRead(started.id) : await markArticleUnread(started.id);
    if (!ok) {
        if (host.article?.id === started.id) host.article = { ...host.article, read: started.read };
        window.dispatchEvent(new CustomEvent('article-read', { detail: { id: started.id, read: started.read } }));
        return;
    }
    window.dispatchEvent(new CustomEvent('article-read', { detail: { id: started.id, read: nextRead } }));
}

export async function refreshSavedState(host: ArticleViewActionsHost): Promise<void> {
    const a = host.article;
    if (!a) {
        host.savedForLater = false;
        host.paint();
        return;
    }
    const gen = ++host.savedStateGen;
    try {
        const items = await fetchSavedArticlesList();
        if (host.article?.id !== a.id || host.savedStateGen !== gen) return;
        host.savedForLater = items.some((s) => s.articleId === a.id);
        host.paint();
    } catch {
        // keep previous state on transient failures
    }
}

export function enqueueListen(host: ArticleViewActionsHost): void {
    const a = host.article;
    if (!a) return;
    const text = stripTags(a.content ?? a.summary ?? '');
    try {
        enqueue({ id: a.id, title: a.title, text });
        window.dispatchEvent(new CustomEvent('listen-queue-changed'));
        toastInfo('Added to listen queue');
        navigate({ kind: 'listen' });
    } catch {
        toastError('Could not add to listen queue (storage full).');
    }
}

export async function openBoardPicker(host: ArticleViewActionsHost): Promise<void> {
    const a = host.article;
    if (!a) return;
    host.boardPickerOpen = true;
    host.newBoardTitle = '';
    host.paint();
    try {
        const boards = await fetchBoards();
        host.boards = boards;
        const membership = new Set<string>();
        await Promise.all(
            boards.map(async (b) => {
                try {
                    const entries = await fetchBoardEntries(b.id);
                    if (entries.some((e) => e.articleId === a.id)) membership.add(b.id);
                } catch {
                    /* ignore */
                }
            }),
        );
        host.boardMembership = membership;
        host.paint();
    } catch {
        host.boards = [];
        host.paint();
    }
}

export async function toggleBoardMembership(
    host: ArticleViewActionsHost,
    board: Board,
    articleId: string,
): Promise<void> {
    if (host.boardMembership.has(board.id)) {
        if (await removeFromBoard(board.id, articleId)) {
            const next = new Set(host.boardMembership);
            next.delete(board.id);
            host.boardMembership = next;
            host.paint();
        }
    } else {
        if (await addToBoard(board.id, articleId)) {
            const next = new Set(host.boardMembership);
            next.add(board.id);
            host.boardMembership = next;
            host.paint();
        }
    }
}

export async function createBoardFromPicker(host: ArticleViewActionsHost): Promise<void> {
    const title = host.newBoardTitle.trim();
    if (!title || !host.article) return;
    const board = await createBoardMutation(title);
    if (!board) return;
    host.newBoardTitle = '';
    host.boards = [...host.boards, board];
    await addToBoard(board.id, host.article.id);
    const next = new Set(host.boardMembership);
    next.add(board.id);
    host.boardMembership = next;
    host.paint();
}

export async function onToggleSaved(host: ArticleViewActionsHost): Promise<void> {
    const a = host.article;
    if (!a) return;
    const next = !host.savedForLater;
    // Invalidate any in-flight refresh so it cannot overwrite optimistic intent.
    host.savedStateGen++;
    host.savedForLater = next;
    host.paint();
    const ok = next ? await saveForLater(a.id) : await unsaveForLater(a.id);
    if (!ok) {
        if (host.article?.id === a.id) {
            host.savedForLater = !next;
            host.paint();
        }
        void host.refreshSavedState();
        return;
    }
    void host.refreshSavedState();
}

export function onDerank(host: ArticleViewActionsHost): void {
    const a = host.article;
    if (!a) return;
    const next = !host.deranked;
    if (next) {
        host.prevStarred = a.starred;
        noteDerank(a.id, a.title, true);
        host.deranked = true;
        if (a.starred) {
            host.article = { ...a, starred: false };
            void toggleStar(a.id, false);
        }
    } else {
        noteDerank(a.id, a.title, false);
        host.deranked = false;
        if (host.prevStarred) {
            host.article = { ...a, starred: true };
            void toggleStar(a.id, true);
            host.prevStarred = false;
        }
    }
    host.paint();
}

export async function nativeShare(a: Article, link: string): Promise<void> {
    try {
        await navigator.share({ title: a.title, url: link });
        noteShare(a.id, a.title);
    } catch {
        // dismissed or unsupported mid-flight; nothing to report
    }
}

export function emitClose(host: ArticleViewActionsHost): void {
    persistReadingProgress(host as never);
    host.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
}

/**
 * Fetch the decision model's selected excerpts. They are verbatim slices of
 * this article, so the panel cites the open row and never adds prose.
 * When stored content is thin, try dynamic full-text extraction first.
 */
export async function refreshKeyLines(host: ArticleViewActionsHost): Promise<void> {
    const a = host.article;
    if (!a || !host.highlightsOn) return;
    host.keyLinesLoading = true;
    host.paint();
    await host.ensureRichContent(a);
    const current = host.article;
    if (!current || current.id !== a.id || !host.highlightsOn) {
        host.keyLinesLoading = false;
        host.paint();
        return;
    }
    const result = await loadRowHighlights(current.id);
    if (host.article?.id !== a.id) return;
    host.keyLines = result;
    host.keyLinesLoading = false;
    host.paint();
}

/** Load the stored body for list rows that omitted content, then extract if thin. */
export async function ensureRichContent(host: ArticleViewActionsHost, a: Article): Promise<void> {
    const open = (): Article | null => (host.article?.id === a.id ? host.article : null);
    host.bodyLoading = true;
    host.paint();
    try {
        const { extractArticle, fetchArticleBody } = await import('../../services/api');
        if (!a.content) {
            const body = await fetchArticleBody(a.id);
            if (!body) {
                // No stored body: fall through to on-demand extraction below.
            } else {
                const still = open();
                if (!still) return;
                const next = { ...still, content: body };
                recordUsage('body_loaded');
                host.fetchedBody = { id: next.id, html: body };
                host.article = next;
                host.sanitizedBody = null;
                host.keywords = articleKeywords(next);
                host.paint();
                return;
            }
        }
        const current = open();
        if (!current) return;
        const text = stripTags(current.content ?? current.summary ?? '');
        if (text.length >= 1200 || !current.link) return;
        const res = await extractArticle(current.id);
        if (!res.extracted || !open()) return;
        // The extract response intentionally omits the body. Read the stored
        // text through the narrow gzip route so the full article replaces the
        // short RSS description.
        const body = await fetchArticleBody(current.id);
        const still = open();
        if (!still || !body) return;
        const next = {
            ...still,
            content: body,
            summary: res.article.summary ?? still.summary,
        };
        recordUsage('body_loaded');
        // Keep local read/starred and other user state; extraction only enriches content.
        host.article = next;
        host.sanitizedBody = null;
        host.keywords = articleKeywords(next);
        host.paint();
    } catch {
        // body/extraction is best-effort; keep showing stored content
    } finally {
        // After every await, recheck the owner: a switched article must not
        // inherit this load's state or paint over the newer selection.
        if (host.article?.id === a.id) {
            host.bodyLoading = false;
            host.paint();
        }
    }
}

export function onToggleKeyLines(host: ArticleViewActionsHost): void {
    host.highlightsOn = !host.highlightsOn;
    setHighlightsEnabled(host.highlightsOn);
    if (!host.highlightsOn) {
        host.keyLines = null;
        host.keyLinesLoading = false;
        host.paint();
        return;
    }
    host.paint();
    void host.refreshKeyLines();
}
