import { sanitizeHtml, safeHttpUrl } from '../../services/parser';
import { articleVideo } from '../../services/video';
import {
    beginArticleProgress,
    flushProgressOnSwitch,
    handleProgressScroll,
    persistReadingProgress as persistArticleReadingProgress,
    restoreReadingProgress as restoreArticleReadingProgress,
} from './article-view-progress';
import { noteOriginal } from '../../mutations';
import { isDeranked } from '../../services/interesting-settings';
import type { ArticleKeyword } from '../../services/keywords';
import { areHighlightsEnabled } from '../../services/highlights';
import type { Article, Board, RowHighlight } from '../../types';
import { stripTags } from '../../util';
import { articleKeywords } from './article-view-helpers';
import { recordUsage } from '../../services/usage';
import { VideoHeader } from '../video-header/video-header';
import { renderBoardPicker, renderSpeedReadOverlay } from './article-view-overlays';
import '../speed-read-view/speed-read-view';
import styles from './article-view.css?inline';

import { el, appendAll } from './article-view-dom';
import { buildToolbar as buildToolbarNodes } from './article-view-toolbar';
import {
    buildTitle as buildTitleNodes,
    buildMeta as buildMetaNodes,
    buildKeyLines as buildKeyLinesNodes,
} from './article-view-content';
import {
    onStar as onStarAction,
    onDerank as onDerankAction,
    onToggleRead as onToggleReadAction,
    onToggleSaved as onToggleSavedAction,
    refreshSavedState as refreshSavedStateAction,
    enqueueListen as enqueueListenAction,
    openBoardPicker as openBoardPickerAction,
    toggleBoardMembership as toggleBoardMembershipAction,
    createBoardFromPicker as createBoardFromPickerAction,
    nativeShare as nativeShareAction,
    emitClose as emitCloseAction,
    onToggleKeyLines as onToggleKeyLinesAction,
    refreshKeyLines as refreshKeyLinesAction,
    ensureRichContent as ensureRichContentAction,
} from './article-view-actions';

export class ArticleView extends HTMLElement {
    static styles = { cssText: styles };

    private _article: Article | null = null;
    get article(): Article | null {
        return this._article;
    }
    set article(value: Article | null) {
        if (this._article === value) return;
        this._article = value;
        if (value?.published) {
            const ageMs = Date.now() - new Date(value.published).getTime();
            if (ageMs > 365 * 24 * 60 * 60 * 1000) recordUsage('older_article_opened');
        }
        this.onArticleChanged();
        this.paint();
    }

    private focused = false;
    deranked = false;
    prevDeranked = false;
    prevStarred = false;
    savedForLater = false;
    overflowOpen = false;
    speedReadOpen = false;
    boardPickerOpen = false;
    boards: Board[] = [];
    boardMembership = new Set<string>();
    newBoardTitle = '';
    keywords: ArticleKeyword[] = [];
    /** Stored body fetched for a list row; survives parent object churn. */
    fetchedBody: { id: string; html: string } | null = null;
    /** Prevent async saved-state refresh from clobbering newer intent/results. */
    savedStateGen = 0;
    /** Decision-model-selected key lines for the open article. */
    keyLines: RowHighlight | null = null;
    keyLinesLoading = false;
    highlightsOn = areHighlightsEnabled();
    /** Article the progress bar belongs to; object identity churns on star. */
    progressArticleId: string | null = null;
    private _readProgress = 0;
    /** 0..1 fraction of the article scrolled, for the progress bar. */
    get readProgress(): number {
        return this._readProgress;
    }
    set readProgress(value: number) {
        this._readProgress = value;
        this.updateProgressBar();
    }
    /** Prevent saving "0" before a saved position is restored for the open article. */
    progressRestorePending = false;
    progressSaveTimer: number | null = null;
    progressRestoreUserScrolled = false;
    progressApplyingRestore = false;

    /** Sanitized body keyed by article; rebuilt on paint. */
    sanitizedBody: { id: string; source: string | undefined; html: string } | null = null;
    private root: ShadowRoot | null = null;
    private styleEl: HTMLStyleElement | null = null;

    /** paint() is synchronous, so consumers can await a resolved promise. */
    get updateComplete(): Promise<void> {
        return Promise.resolve();
    }

    connectedCallback(): void {
        if (!this.root) {
            const shadow = this.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = ArticleView.styles.cssText;
            shadow.appendChild(style);
            this.root = shadow;
            this.styleEl = style;
        }
        // This element is only created while an article is open, so
        // connectedCallback is exactly "the dialog opened". The host is the
        // modal container, so the dialog semantics go on it rather than on a
        // wrapper, which would have meant restructuring the toolbar and body.
        this.setAttribute('role', 'dialog');
        this.setAttribute('aria-modal', 'true');
        this.setAttribute('tabindex', '-1');
        window.addEventListener('share-settings-changed', this.onShareSettingsChanged);
        window.addEventListener('saved-articles-changed', this.onSavedArticlesChanged);
        this.addEventListener('scroll', this.onScroll);
        this.paint();
    }

    disconnectedCallback(): void {
        persistArticleReadingProgress(this);
        window.removeEventListener('share-settings-changed', this.onShareSettingsChanged);
        window.removeEventListener('saved-articles-changed', this.onSavedArticlesChanged);
        this.removeEventListener('scroll', this.onScroll);
        if (this.progressSaveTimer !== null) window.clearTimeout(this.progressSaveTimer);
    }

    private onSavedArticlesChanged = () => {
        void this.refreshSavedState();
    };
    /** Progress bar: the host itself is the scroller. */
    private onScroll = () => {
        handleProgressScroll(this);
    };
    /** Keyboard entry points, called by the shell which owns global keys. */
    keyboardStar(): void {
        void this.onStar();
    }
    keyboardDerank(): void {
        this.onDerank();
    }
    keyboardOriginal(): void {
        const a = this.article;
        if (!a) return;
        noteOriginal(a.id, a.title);
        const link = safeHttpUrl(a.link);
        if (link) window.open(link, '_blank', 'noopener,noreferrer');
    }
    /** Re-paint when Settings changes which share buttons are shown. */
    private onShareSettingsChanged = () => {
        this.paint();
    };

    /** Bookkeeping formerly in updated(), run when the article identity changes. */
    private onArticleChanged(): void {
        // A star/read toggle hands the element a new object built from the list
        // row, which has no body. Reapply the body already fetched for it.
        const incoming = this.article;
        if (incoming && !incoming.content && this.fetchedBody?.id === incoming.id) {
            this._article = { ...incoming, content: this.fetchedBody.html };
        }
        if (this.fetchedBody && this.fetchedBody.id !== this.article?.id) this.fetchedBody = null;
        this.sanitizedBody = null;
        this.deranked = this.article ? isDeranked(this.article.id) : false;
        this.keywords = this.article ? articleKeywords(this.article) : [];
        if (this.article?.id !== this.progressArticleId) {
            flushProgressOnSwitch(this);
            this.progressArticleId = this.article?.id ?? null;
            this.savedStateGen++;
            this.savedForLater = false;
            this.keyLines = null;
            this.keyLinesLoading = false;
            this.prevDeranked = false;
            this.prevStarred = false;
            const saved = beginArticleProgress(this);
            if (saved !== null && this.article) {
                void restoreArticleReadingProgress(this, this.article.id, saved);
            }
            const current = this.article;
            if (this.highlightsOn) {
                void this.refreshKeyLines();
            } else if (current && !current.content) {
                void this.ensureRichContent(current);
            }
            void this.refreshSavedState();
        }
    }

    /** Rebuild the whole view from current state. */
    private paint(): void {
        const root = this.root;
        if (!root) return;
        const a = this.article;
        if (!a) {
            root.replaceChildren(...(this.styleEl ? [this.styleEl] : []));
            return;
        }
        let body = '';
        if (a.content) {
            if (this.sanitizedBody?.id !== a.id || this.sanitizedBody.source !== a.content) {
                this.sanitizedBody = { id: a.id, source: a.content, html: sanitizeHtml(a.content) };
            }
            body = this.sanitizedBody.html;
        }
        const link = safeHttpUrl(a.link);
        const video = articleVideo(a);

        const nodes: Node[] = [];
        const progress = el('div', 'read-progress');
        progress.setAttribute('aria-hidden', 'true');
        const progressSpan = el('span');
        progressSpan.style.width = `${Math.round(this.readProgress * 100)}%`;
        progress.appendChild(progressSpan);
        nodes.push(progress);
        nodes.push(...this.buildToolbar(a, link));

        const bodyDiv = el('div', 'body');
        appendAll(bodyDiv, this.buildTitle(a, link));
        appendAll(bodyDiv, this.buildMeta(a));
        appendAll(bodyDiv, this.buildKeyLines());
        if (video) {
            const header = document.createElement('video-header') as VideoHeader;
            header.className = 'expanded-video';
            header.mode = 'embed';
            header.video = video;
            header.videoTitle = a.title;
            bodyDiv.appendChild(header);
        }
        if (body) {
            const content = el('div', 'content');
            // sanitized: body is sanitizeHtml(a.content), computed above.
            content.innerHTML = body;
            bodyDiv.appendChild(content);
        } else if (a.summary) {
            bodyDiv.appendChild(el('div', 'content', a.summary));
        } else {
            bodyDiv.appendChild(el('p', 'content', 'No content available for this article.'));
        }
        nodes.push(bodyDiv);

        nodes.push(
            ...renderBoardPicker(
                {
                    boardPickerOpen: this.boardPickerOpen,
                    boards: this.boards,
                    boardMembership: this.boardMembership,
                    newBoardTitle: this.newBoardTitle,
                    setNewBoardTitle: (value) => (this.newBoardTitle = value),
                    close: () => {
                        this.boardPickerOpen = false;
                        this.paint();
                    },
                    createBoard: () => void this.createBoardFromPicker(),
                    toggleMembership: (b, id) => void this.toggleBoardMembership(b, id),
                },
                a,
            ),
        );
        nodes.push(
            ...renderSpeedReadOverlay(this.speedReadOpen, stripTags(a.content ?? a.summary ?? ''), () => {
                this.speedReadOpen = false;
                this.paint();
            }),
        );

        root.replaceChildren(...(this.styleEl ? [this.styleEl] : []), ...nodes);

        this.setAttribute('aria-label', a.title);
        if (this.focused) return;
        this.focused = true;
        this.focus();
    }

    /** Scroll-driven progress uses a targeted update so the DOM is not rebuilt. */
    private updateProgressBar(): void {
        const span = this.root?.querySelector('.read-progress span');
        if (span instanceof HTMLElement) {
            span.style.width = `${Math.round(this.readProgress * 100)}%`;
        }
    }

    // ---- Thin delegators to the extracted renderer/action modules. ----

    private buildToolbar(a: Article, link: string | undefined): Node[] {
        return buildToolbarNodes(this as never, a, link);
    }

    private buildTitle(a: Article, link: string | undefined): Node[] {
        return buildTitleNodes(a, link);
    }

    private buildMeta(a: Article): Node[] {
        return buildMetaNodes(this as never, a);
    }

    private buildKeyLines(): Node[] {
        return buildKeyLinesNodes(this as never);
    }

    private onStar(): Promise<void> {
        return onStarAction(this as never);
    }

    private onDerank(): void {
        onDerankAction(this as never);
    }

    onToggleRead = (): Promise<void> => onToggleReadAction(this as never);

    onToggleSaved = (): Promise<void> => onToggleSavedAction(this as never);

    private refreshSavedState(): Promise<void> {
        return refreshSavedStateAction(this as never);
    }

    enqueueListen(): void {
        enqueueListenAction(this as never);
    }

    openBoardPicker(): Promise<void> {
        return openBoardPickerAction(this as never);
    }

    private toggleBoardMembership(board: Board, articleId: string): Promise<void> {
        return toggleBoardMembershipAction(this as never, board, articleId);
    }

    private createBoardFromPicker(): Promise<void> {
        return createBoardFromPickerAction(this as never);
    }

    nativeShare(a: Article, link: string): Promise<void> {
        return nativeShareAction(a, link);
    }

    emitClose = (): void => emitCloseAction(this as never);

    onToggleKeyLines(): void {
        onToggleKeyLinesAction(this as never);
    }

    private refreshKeyLines(): Promise<void> {
        return refreshKeyLinesAction(this as never);
    }

    ensureRichContent(a: Article): Promise<void> {
        return ensureRichContentAction(this as never, a);
    }
}

customElements.define('article-view', ArticleView);

declare global {
    interface HTMLElementTagNameMap {
        'article-view': ArticleView;
    }
}
