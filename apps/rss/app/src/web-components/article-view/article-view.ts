import { sanitizeHtml, safeHttpUrl } from '../../services/parser';
import { articleVideo } from '../../services/video';
import { canNativeShare, mailtoShareUrl, shareUrl, type ShareTarget } from '../../services/share';
import { loadMastodonHost, loadShareTargets } from '../../services/share-settings';
import {
    beginArticleProgress,
    flushProgressOnSwitch,
    handleProgressScroll,
    persistReadingProgress as persistArticleReadingProgress,
    restoreReadingProgress as restoreArticleReadingProgress,
} from './article-view-progress';
import {
    addToBoard,
    createBoard as createBoardMutation,
    markArticleRead,
    markArticleUnread,
    noteDerank,
    noteOriginal,
    noteShare,
    removeFromBoard,
    saveForLater,
    toggleStar,
    unsaveForLater,
} from '../../mutations';
import { fetchSavedArticlesList } from '../../query';
import { fetchBoards, fetchBoardEntries } from '../../services/api';
import { isDeranked } from '../../services/interesting-settings';
import type { ArticleKeyword } from '../../services/keywords';
import { areHighlightsEnabled, loadRowHighlights, setHighlightsEnabled } from '../../services/highlights';
import { readMinutes } from '../../util';
import { detectLanguage, LANGUAGE_NAMES } from '../../services/language';
import type { Article, Board, RowHighlight } from '../../types';
import { domainOf, formatDate, stripTags } from '../../util';
import { enqueue } from '../../services/listen-queue';
import { toastError, toastInfo } from '../../services/toast';
import { navigate } from '../../router';
import {
    actionIcon,
    articleKeywords,
    copyLinkForInstagram,
    copyMarkdownCitation,
    copyQuoteCard,
    copyTitleLink,
    shareIcon,
    whyLineFor,
    worthMinutesVerdict,
} from './article-view-helpers';
import { VideoHeader } from '../video-header/video-header';
import { renderBoardPicker, renderSpeedReadOverlay } from './article-view-overlays';
import '../speed-read-view/speed-read-view';
import styles from './article-view.css?inline';

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function appendAll(parent: Node, nodes: Node[]): void {
    for (const node of nodes) parent.appendChild(node);
}

interface IconButtonOptions {
    className?: string;
    label: string;
    title: string;
    pressed?: boolean;
    disabled?: boolean;
    onClick: (e: Event) => void;
}

function iconButton(icon: SVGElement, options: IconButtonOptions): HTMLButtonElement {
    const btn = el('button', `btn icon-btn${options.className ? ` ${options.className}` : ''}`);
    btn.setAttribute('aria-label', options.label);
    btn.title = options.title;
    if (options.pressed !== undefined) btn.setAttribute('aria-pressed', String(options.pressed));
    if (options.disabled) btn.disabled = true;
    btn.appendChild(icon);
    btn.addEventListener('click', options.onClick);
    return btn;
}

export class ArticleView extends HTMLElement {
    static styles = { cssText: styles };

    private _article: Article | null = null;
    get article(): Article | null {
        return this._article;
    }
    set article(value: Article | null) {
        if (this._article === value) return;
        this._article = value;
        this.onArticleChanged();
        this.paint();
    }

    private focused = false;
    private deranked = false;
    private prevDeranked = false;
    private prevStarred = false;
    private savedForLater = false;
    private overflowOpen = false;
    private speedReadOpen = false;
    private boardPickerOpen = false;
    private boards: Board[] = [];
    private boardMembership = new Set<string>();
    private newBoardTitle = '';
    private keywords: ArticleKeyword[] = [];
    /** Prevent async saved-state refresh from clobbering newer intent/results. */
    private savedStateGen = 0;
    /** Decision-model-selected key lines for the open article. */
    private keyLines: RowHighlight | null = null;
    private keyLinesLoading = false;
    private highlightsOn = areHighlightsEnabled();
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
    private sanitizedBody: { id: string; source: string | undefined; html: string } | null = null;
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
            if (this.highlightsOn) void this.refreshKeyLines();
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

    private buildToolbar(a: Article, link: string | undefined): Node[] {
        const toolbar = el('div', 'toolbar');
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Article actions');

        const backGroup = el('div', 'toolbar-group');
        backGroup.appendChild(
            iconButton(actionIcon('back'), { label: 'Back', title: 'Back', onClick: this.emitClose }),
        );
        toolbar.appendChild(backGroup);

        appendAll(toolbar, this.buildStateButtons(a));

        if (link) {
            const divider = el('span', 'toolbar-divider');
            divider.setAttribute('aria-hidden', 'true');
            toolbar.appendChild(divider);
            appendAll(toolbar, this.buildShareButtons(a, link));
        }

        toolbar.appendChild(el('div', 'spacer'));
        if (link) toolbar.appendChild(this.buildOpenOriginal(a, link));
        return [toolbar];
    }

    private buildStateButtons(a: Article): Node[] {
        const group = el('div', 'toolbar-group');
        group.setAttribute('aria-label', 'Article state');

        group.appendChild(
            iconButton(actionIcon(a.starred ? 'starred' : 'star'), {
                ...(a.starred ? { className: 'active' } : {}),
                label: a.starred ? 'Unstar' : 'Star',
                title: a.starred ? 'Unstar' : 'Star',
                pressed: a.starred,
                disabled: this.deranked,
                onClick: () => void this.onStar(),
            }),
        );
        group.appendChild(
            iconButton(actionIcon(this.deranked ? 'deranked' : 'derank'), {
                ...(this.deranked ? { className: 'active' } : {}),
                label: 'Not interesting',
                title: this.deranked ? 'Marked not interesting' : 'Not interesting',
                pressed: this.deranked,
                onClick: () => this.onDerank(),
            }),
        );
        group.appendChild(
            iconButton(actionIcon(a.read ? 'read' : 'unread'), {
                label: a.read ? 'Keep unread' : 'Mark read',
                title: a.read ? 'Keep unread' : 'Mark read',
                onClick: () => void this.onToggleRead(),
            }),
        );
        group.appendChild(
            iconButton(actionIcon(this.savedForLater ? 'saved' : 'save'), {
                ...(this.savedForLater ? { className: 'active' } : {}),
                label: this.savedForLater ? 'Saved for later' : 'Save for later',
                title: this.savedForLater ? 'Saved for later' : 'Save for later',
                pressed: this.savedForLater,
                onClick: () => void this.onToggleSaved(),
            }),
        );
        group.appendChild(
            iconButton(actionIcon('more'), {
                label: 'More actions',
                title: 'More actions',
                onClick: () => {
                    this.overflowOpen = !this.overflowOpen;
                    this.paint();
                },
            }),
        );

        if (this.overflowOpen) {
            const backdrop = el('div', 'overflow-backdrop');
            backdrop.addEventListener('click', () => {
                this.overflowOpen = false;
                this.paint();
            });
            group.appendChild(backdrop);

            const menu = el('div', 'overflow-menu');
            const speed = el('button', 'btn', '⚡ Speed read');
            speed.addEventListener('click', () => {
                this.speedReadOpen = true;
                this.overflowOpen = false;
                this.paint();
            });
            menu.appendChild(speed);
            const board = el('button', 'btn', '📋 Add to board');
            board.addEventListener('click', () => {
                void this.openBoardPicker();
                this.overflowOpen = false;
                this.paint();
            });
            menu.appendChild(board);
            const listen = el('button', 'btn', '🎧 Listen');
            listen.addEventListener('click', () => {
                this.enqueueListen();
                this.overflowOpen = false;
                this.paint();
            });
            menu.appendChild(listen);
            group.appendChild(menu);
        }
        return [group];
    }

    private buildOpenOriginal(a: Article, link: string): HTMLElement {
        const anchor = el('a', 'btn icon-btn primary');
        anchor.href = link;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.setAttribute('aria-label', 'Open original');
        anchor.title = 'Open original';
        anchor.appendChild(actionIcon('external'));
        anchor.addEventListener('click', () => noteOriginal(a.id, a.title));
        return anchor;
    }

    /** Compact share/copy actions: icon-only buttons with accessible labels. */
    private buildShareButtons(a: Article, link: string): Node[] {
        const group = el('div', 'toolbar-group toolbar-share');
        group.setAttribute('aria-label', 'Share and copy');
        const open = (target: 'facebook' | 'x' | 'mastodon') => (e: Event) => {
            e.stopPropagation();
            const href = shareUrl(target, link, a.title, loadMastodonHost());
            if (href) {
                noteShare(a.id, a.title);
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        };
        const labels: Record<ShareTarget, string> = {
            facebook: 'Share on Facebook',
            x: 'Share on X',
            mastodon: 'Share on Mastodon',
            instagram: 'Copy link for Instagram',
        };
        const socialButton = (target: ShareTarget): HTMLButtonElement => {
            const handler: (e: Event) => void =
                target === 'instagram' ? () => void copyLinkForInstagram(link, a) : open(target);
            return iconButton(shareIcon(target), { label: labels[target], title: labels[target], onClick: handler });
        };
        for (const target of loadShareTargets()) group.appendChild(socialButton(target));
        if (canNativeShare()) {
            group.appendChild(
                iconButton(actionIcon('share'), {
                    label: 'Share',
                    title: 'Share',
                    onClick: () => void this.nativeShare(a, link),
                }),
            );
        }
        group.appendChild(
            iconButton(actionIcon('copy'), {
                label: 'Copy link',
                title: 'Copy link',
                onClick: () => void copyTitleLink(a, link),
            }),
        );
        group.appendChild(
            iconButton(actionIcon('markdown'), {
                label: 'Copy markdown citation',
                title: 'Copy markdown citation',
                onClick: () => void copyMarkdownCitation(a, link),
            }),
        );
        group.appendChild(
            iconButton(actionIcon('quote'), {
                label: 'Copy quote card',
                title: 'Copy quote card',
                onClick: () => void copyQuoteCard(a, link),
            }),
        );
        const mail = el('a', 'btn icon-btn');
        mail.href = mailtoShareUrl(link, a.title);
        mail.setAttribute('aria-label', 'Email');
        mail.title = 'Email';
        mail.appendChild(actionIcon('mail'));
        mail.addEventListener('click', () => noteShare(a.id, a.title));
        group.appendChild(mail);
        return [group];
    }

    private async nativeShare(a: Article, link: string): Promise<void> {
        try {
            await navigator.share({ title: a.title, url: link });
            noteShare(a.id, a.title);
        } catch {
            // dismissed or unsupported mid-flight; nothing to report
        }
    }

    private emitClose = () => {
        persistArticleReadingProgress(this);
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    };

    private buildTitle(a: Article, link: string | undefined): Node[] {
        const h1 = el('h1');
        if (link) {
            const anchor = el('a', undefined, a.title);
            anchor.href = link;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.addEventListener('click', () => noteOriginal(a.id, a.title));
            h1.appendChild(anchor);
        } else {
            h1.textContent = a.title;
        }
        return [h1];
    }

    private buildMeta(a: Article): Node[] {
        const meta = el('div', 'meta');
        meta.appendChild(el('span', undefined, domainOf(a.link) || 'unknown source'));
        meta.appendChild(el('span', undefined, formatDate(a.published)));
        if (a.author) meta.appendChild(el('span', undefined, `by ${a.author}`));
        const minutes = readMinutes(a.content, a.summary);
        if (minutes > 0) meta.appendChild(el('span', undefined, `${minutes} min read`));
        const { verdict, why } = worthMinutesVerdict(a);
        const worth = el('span', 'worth-badge', verdict);
        worth.title = why;
        meta.appendChild(worth);
        const lang = detectLanguage(a.content ?? a.summary ?? '');
        if (lang !== 'en') {
            const badge = el('span', 'lang-badge', LANGUAGE_NAMES[lang] ?? lang);
            badge.title = 'Original language';
            meta.appendChild(badge);
        }
        appendAll(meta, this.buildHighlightsToggle());
        return [meta, ...this.buildKeywords()];
    }

    private buildKeywords(): Node[] {
        if (!this.keywords.length) return [];
        const box = el('div', 'keywords');
        box.setAttribute('aria-label', 'Article keywords');
        box.appendChild(el('span', 'keywords-label', 'Keywords'));
        for (const k of this.keywords) box.appendChild(el('span', 'keyword', k.word));
        return [box];
    }

    private buildKeyLines(): Node[] {
        if (!this.highlightsOn) return [];
        const result = this.keyLines;
        const has = !!result && result.available && result.excerpts.length > 0;
        const settledEmpty = !this.keyLinesLoading && !has;
        const section = el('section', 'key-lines');
        section.setAttribute('aria-label', 'Key lines');

        const head = el('div', 'key-lines-head');
        head.appendChild(el('h2', undefined, 'Key lines'));
        const hide = el('button', 'key-lines-toggle', 'Hide');
        hide.setAttribute('aria-pressed', String(this.highlightsOn));
        hide.addEventListener('click', () => this.onToggleKeyLines());
        head.appendChild(hide);
        section.appendChild(head);

        if (this.keyLinesLoading && !has) {
            section.appendChild(el('div', 'skl'));
            section.appendChild(el('div', 'skl skl-short'));
        }
        if (settledEmpty) section.appendChild(el('p', 'key-why', 'No key lines found for this article.'));
        if (has && result) {
            const list = el('ul');
            for (const e of result.excerpts) {
                const li = el('li');
                li.appendChild(el('blockquote', undefined, e.text));
                list.appendChild(li);
            }
            section.appendChild(list);
            section.appendChild(
                el('p', 'key-why', `From this article · ${whyLineFor(result, this.keywords, this.article)}`),
            );
        }
        return [section];
    }

    private buildHighlightsToggle(): Node[] {
        if (this.highlightsOn) return [];
        const toggle = el('button', 'key-lines-toggle', 'Key lines');
        toggle.setAttribute('aria-pressed', 'false');
        toggle.addEventListener('click', () => this.onToggleKeyLines());
        return [toggle];
    }

    private async onStar(): Promise<void> {
        const started = this.article;
        if (!started) return;
        const next = !started.starred;
        if (next) {
            this.prevDeranked = this.deranked;
            noteDerank(started.id, started.title, false);
            this.deranked = false;
        } else if (this.prevDeranked) {
            noteDerank(started.id, started.title, true);
            this.deranked = true;
            this.prevDeranked = false;
        }
        this.article = { ...started, starred: next };
        if (await toggleStar(started.id, next)) {
            window.dispatchEvent(new CustomEvent('article-starred', { detail: { id: started.id, starred: next } }));
        } else if (this.article?.id === started.id) {
            this.article = { ...this.article, starred: started.starred };
            window.dispatchEvent(
                new CustomEvent('article-starred', { detail: { id: started.id, starred: started.starred } }),
            );
        }
    }

    private onToggleRead = async () => {
        const started = this.article;
        if (!started) return;
        const nextRead: 0 | 1 = started.read ? 0 : 1;
        this.article = { ...started, read: nextRead };
        const ok = nextRead === 1 ? await markArticleRead(started.id) : await markArticleUnread(started.id);
        if (!ok) {
            if (this.article?.id === started.id) this.article = { ...this.article, read: started.read };
            window.dispatchEvent(new CustomEvent('article-read', { detail: { id: started.id, read: started.read } }));
            return;
        }
        window.dispatchEvent(new CustomEvent('article-read', { detail: { id: started.id, read: nextRead } }));
    };

    private async refreshSavedState(): Promise<void> {
        const a = this.article;
        if (!a) {
            this.savedForLater = false;
            this.paint();
            return;
        }
        const gen = ++this.savedStateGen;
        try {
            const items = await fetchSavedArticlesList();
            if (this.article?.id !== a.id || this.savedStateGen !== gen) return;
            this.savedForLater = items.some((s) => s.articleId === a.id);
            this.paint();
        } catch {
            // keep previous state on transient failures
        }
    }

    private enqueueListen(): void {
        const a = this.article;
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

    private async openBoardPicker(): Promise<void> {
        const a = this.article;
        if (!a) return;
        this.boardPickerOpen = true;
        this.newBoardTitle = '';
        this.paint();
        try {
            const boards = await fetchBoards();
            this.boards = boards;
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
            this.boardMembership = membership;
            this.paint();
        } catch {
            this.boards = [];
            this.paint();
        }
    }

    private async toggleBoardMembership(board: Board, articleId: string): Promise<void> {
        if (this.boardMembership.has(board.id)) {
            if (await removeFromBoard(board.id, articleId)) {
                const next = new Set(this.boardMembership);
                next.delete(board.id);
                this.boardMembership = next;
                this.paint();
            }
        } else {
            if (await addToBoard(board.id, articleId)) {
                const next = new Set(this.boardMembership);
                next.add(board.id);
                this.boardMembership = next;
                this.paint();
            }
        }
    }

    private async createBoardFromPicker(): Promise<void> {
        const title = this.newBoardTitle.trim();
        if (!title || !this.article) return;
        const board = await createBoardMutation(title);
        if (!board) return;
        this.newBoardTitle = '';
        this.boards = [...this.boards, board];
        await addToBoard(board.id, this.article.id);
        const next = new Set(this.boardMembership);
        next.add(board.id);
        this.boardMembership = next;
        this.paint();
    }

    private onToggleSaved = async () => {
        const a = this.article;
        if (!a) return;
        const next = !this.savedForLater;
        // Invalidate any in-flight refresh so it cannot overwrite optimistic intent.
        this.savedStateGen++;
        this.savedForLater = next;
        this.paint();
        const ok = next ? await saveForLater(a.id) : await unsaveForLater(a.id);
        if (!ok) {
            if (this.article?.id === a.id) {
                this.savedForLater = !next;
                this.paint();
            }
            void this.refreshSavedState();
            return;
        }
        void this.refreshSavedState();
    };

    private onDerank(): void {
        const a = this.article;
        if (!a) return;
        const next = !this.deranked;
        if (next) {
            this.prevStarred = a.starred;
            noteDerank(a.id, a.title, true);
            this.deranked = true;
            if (a.starred) {
                this.article = { ...a, starred: false };
                void toggleStar(a.id, false);
            }
        } else {
            noteDerank(a.id, a.title, false);
            this.deranked = false;
            if (this.prevStarred) {
                this.article = { ...a, starred: true };
                void toggleStar(a.id, true);
                this.prevStarred = false;
            }
        }
        this.paint();
    }

    /**
     * Fetch the decision model's selected excerpts. They are verbatim slices of
     * this article, so the panel cites the open row and never adds prose.
     * When stored content is thin, try dynamic full-text extraction first.
     */
    private async refreshKeyLines(): Promise<void> {
        const a = this.article;
        if (!a || !this.highlightsOn) return;
        this.keyLinesLoading = true;
        this.paint();
        await this.ensureRichContent(a);
        const current = this.article;
        if (!current || current.id !== a.id || !this.highlightsOn) {
            this.keyLinesLoading = false;
            this.paint();
            return;
        }
        const result = await loadRowHighlights(current.id);
        if (this.article?.id !== a.id) return;
        this.keyLines = result;
        this.keyLinesLoading = false;
        this.paint();
    }

    /** Dynamically fetch fuller article text for thin content so analysis improves. */
    private async ensureRichContent(a: Article): Promise<void> {
        const text = stripTags(a.content ?? a.summary ?? '');
        if (text.length >= 1200 || !a.link) return;
        try {
            const { extractArticle } = await import('../../services/api');
            const res = await extractArticle(a.id);
            if (this.article?.id !== a.id || !res.extracted) return;
            // Keep local read/starred and other user state; extraction only enriches content.
            this.article = {
                ...this.article,
                content: res.article.content ?? this.article.content,
                summary: res.article.summary ?? this.article.summary,
            };
            this.sanitizedBody = null;
            this.keywords = articleKeywords(this.article);
            this.paint();
        } catch {
            // extraction is best-effort; keep showing stored content
        }
    }

    private onToggleKeyLines(): void {
        this.highlightsOn = !this.highlightsOn;
        setHighlightsEnabled(this.highlightsOn);
        if (!this.highlightsOn) {
            this.keyLines = null;
            this.keyLinesLoading = false;
            this.paint();
            return;
        }
        this.paint();
        void this.refreshKeyLines();
    }
}

customElements.define('article-view', ArticleView);

declare global {
    interface HTMLElementTagNameMap {
        'article-view': ArticleView;
    }
}
