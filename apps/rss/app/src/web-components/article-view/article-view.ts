import { html, LitElement, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property, state } from 'lit/decorators.js';
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
import type { Article, Board, RowHighlight } from '../../types';
import { domainOf, formatDate, stripTags } from '../../util';
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
import '../video-header/video-header';
import styles from './article-view.css?inline';
@customElement('article-view')
export class ArticleView extends LitElement {
    static override styles = unsafeCSS(styles);
    @property({ attribute: false }) article: Article | null = null;
    private focused = false;
    @state() private deranked = false;
    @state() private savedForLater = false;
    @state() private boardPickerOpen = false;
    @state() private boards: Board[] = [];
    @state() private boardMembership = new Set<string>();
    @state() private newBoardTitle = '';
    @state() private keywords: ArticleKeyword[] = [];
    /** Prevent async saved-state refresh from clobbering newer intent/results. */
    private savedStateGen = 0;
    /** Decision-model-selected key lines for the open article. */
    @state() private keyLines: RowHighlight | null = null;
    @state() private keyLinesLoading = false;
    @state() private highlightsOn = areHighlightsEnabled();
    /** Article the progress bar belongs to; object identity churns on star. */
    progressArticleId: string | null = null;
    /** 0..1 fraction of the article scrolled, for the progress bar. */
    @state() readProgress = 0;
    /** Prevent saving "0" before a saved position is restored for the open article. */
    progressRestorePending = false;
    progressSaveTimer: number | null = null;
    progressRestoreUserScrolled = false;
    progressApplyingRestore = false;
    override connectedCallback() {
        super.connectedCallback();
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
    }
    override disconnectedCallback() {
        persistArticleReadingProgress(this);
        super.disconnectedCallback();
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
    keyboardStar() {
        void this.onStar();
    }
    keyboardDerank() {
        this.onDerank();
    }
    keyboardOriginal() {
        const a = this.article;
        if (!a) return;
        noteOriginal(a.id, a.title);
        const link = safeHttpUrl(a.link);
        if (link) window.open(link, '_blank', 'noopener,noreferrer');
    }
    /** Re-render when Settings changes which share buttons are shown. */
    private onShareSettingsChanged = () => {
        this.requestUpdate();
    };
    /** Sanitized body keyed by article; render runs on every state change. */
    private sanitizedBody: { id: string; source: string | undefined; html: string } | null = null;
    override updated(changed: Map<string, unknown>) {
        if (changed.has('article')) {
            this.sanitizedBody = null;
            this.deranked = this.article ? isDeranked(this.article.id) : false;
            this.keywords = this.article ? articleKeywords(this.article) : [];
            // A new object identity does not mean a new article: starring
            // replaces the object in place. Only a new id resets progress
            // and scroll, or pressing S mid-article yanks the reader to top.
            if (this.article?.id !== this.progressArticleId) {
                // Flush pending progress for the article being replaced before switching.
                flushProgressOnSwitch(this);
                this.progressArticleId = this.article?.id ?? null;
                this.savedStateGen++;
                this.savedForLater = false;
                this.keyLines = null;
                this.keyLinesLoading = false;
                const saved = beginArticleProgress(this);
                if (saved !== null) void restoreArticleReadingProgress(this, this.article!.id, saved);
                if (this.highlightsOn) void this.refreshKeyLines();
                void this.refreshSavedState();
            }
        }
        const a = this.article;
        if (!a) return;
        this.setAttribute('aria-label', a.title);
        if (this.focused) return;
        this.focused = true;
        this.focus();
    }
    override render() {
        const a = this.article;
        if (!a) return html``;
        let body = '';
        if (a.content) {
            if (this.sanitizedBody?.id !== a.id || this.sanitizedBody.source !== a.content) {
                this.sanitizedBody = { id: a.id, source: a.content, html: sanitizeHtml(a.content) };
            }
            body = this.sanitizedBody.html;
        }
        const link = safeHttpUrl(a.link);
        const video = articleVideo(a);
        return html`<div class="read-progress" aria-hidden="true"><span style="width: ${Math.round(this.readProgress * 100)}%"></span></div>${this.renderToolbar(a, link)}<div class="body">${this.renderTitle(a, link)}${this.renderMeta(a)}${this.renderKeyLines()}${video ? html`<video-header class="expanded-video" .mode=${'embed'} .video=${video} .videoTitle=${a.title}></video-header>` : ''}${this.renderBody(body, a)}</div>${this.renderBoardPicker(a)}`;
    }
    private renderToolbar(a: Article, link: string | undefined) {
        return html`
      <div class="toolbar" role="toolbar" aria-label="Article actions">
        <div class="toolbar-group">
          <button class="btn icon-btn" @click=${this.emitClose} aria-label="Back" title="Back">${actionIcon('back')}</button>
        </div>
        <div class="toolbar-group" aria-label="Article state">
          <button class="btn icon-btn ${a.starred ? 'active' : ''}" @click=${this.onStar} aria-label=${a.starred ? 'Unstar' : 'Star'} aria-pressed=${a.starred} title=${a.starred ? 'Unstar' : 'Star'}>${actionIcon(a.starred ? 'starred' : 'star')}</button>
          <button class="btn icon-btn ${this.deranked ? 'active' : ''}" @click=${this.onDerank} aria-label="Not interesting" aria-pressed=${this.deranked} title=${this.deranked ? 'Marked not interesting' : 'Not interesting'}>${actionIcon(this.deranked ? 'deranked' : 'derank')}</button>
          <button class="btn icon-btn" @click=${this.onToggleRead} aria-label=${a.read ? 'Keep unread' : 'Mark read'} title=${a.read ? 'Keep unread' : 'Mark read'}>${actionIcon(a.read ? 'read' : 'unread')}</button>
          <button class="btn icon-btn ${this.savedForLater ? 'active' : ''}" @click=${this.onToggleSaved} aria-label=${this.savedForLater ? 'Saved for later' : 'Save for later'} aria-pressed=${this.savedForLater} title=${this.savedForLater ? 'Saved for later' : 'Save for later'}>${actionIcon(this.savedForLater ? 'saved' : 'save')}</button>
          <button class="btn icon-btn" @click=${() => void this.openBoardPicker()} aria-label="Add to board" title="Add to board">📋</button>
        </div>
        ${link ? html`<span class="toolbar-divider" aria-hidden="true"></span>${this.renderShareButtons(a, link)}` : ''}
        <div class="spacer"></div>
        ${link ? html`<a class="btn icon-btn primary" href=${link} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original" @click=${() => noteOriginal(a.id, a.title)}>${actionIcon('external')}</a>` : ''}
      </div>`;
    }
    /**
     * Compact share/copy actions: icon-only buttons with accessible labels.
     */
    private renderShareButtons(a: Article, link: string) {
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
        const buttons: Record<ShareTarget, unknown> = {
            facebook: html`<button class="btn icon-btn" @click=${open('facebook')} aria-label=${labels.facebook} title=${labels.facebook}>${shareIcon('facebook')}</button>`,
            x: html`<button class="btn icon-btn" @click=${open('x')} aria-label=${labels.x} title=${labels.x}>${shareIcon('x')}</button>`,
            mastodon: html`<button class="btn icon-btn" @click=${open('mastodon')} aria-label=${labels.mastodon} title=${labels.mastodon}>${shareIcon('mastodon')}</button>`,
            instagram: html`<button class="btn icon-btn" @click=${() => void copyLinkForInstagram(link, a)} aria-label=${labels.instagram} title=${labels.instagram}>${shareIcon('instagram')}</button>`,
        };
        return html`<div class="toolbar-group toolbar-share" aria-label="Share and copy">
          ${loadShareTargets().map((t) => buttons[t])}
          ${canNativeShare() ? html`<button class="btn icon-btn" @click=${() => void this.nativeShare(a, link)} aria-label="Share" title="Share">${actionIcon('share')}</button>` : ''}
          <button class="btn icon-btn" @click=${() => void copyTitleLink(a, link)} aria-label="Copy link" title="Copy link">${actionIcon('copy')}</button>
          <button class="btn icon-btn" @click=${() => void copyMarkdownCitation(a, link)} aria-label="Copy markdown citation" title="Copy markdown citation">${actionIcon('markdown')}</button>
          <button class="btn icon-btn" @click=${() => void copyQuoteCard(a, link)} aria-label="Copy quote card" title="Copy quote card">${actionIcon('quote')}</button>
          <a class="btn icon-btn" href=${mailtoShareUrl(link, a.title)} @click=${() => noteShare(a.id, a.title)} aria-label="Email" title="Email">${actionIcon('mail')}</a>
        </div>`;
    }
    /** OS share sheet where it exists; counts as a share like the rest. */
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
    private renderTitle(a: Article, link: string | undefined) {
        return html`<h1>${link ? html`<a href=${link} target="_blank" rel="noopener noreferrer" @click=${() => noteOriginal(a.id, a.title)}>${a.title}</a>` : a.title}</h1>`;
    }
    private renderMeta(a: Article) {
        const minutes = readMinutes(a.content, a.summary);
        const { verdict, why } = worthMinutesVerdict(a);
        return html`<div class="meta"><span>${domainOf(a.link) || 'unknown source'}</span><span>${formatDate(a.published)}</span>${a.author ? html`<span>by ${a.author}</span>` : ''}${minutes > 0 ? html`<span>${minutes} min read</span>` : ''}<span class="worth-badge" title=${why}>${verdict}</span>${this.renderHighlightsToggle()}</div>${this.renderKeywords()}`;
    }

    private renderKeywords() {
        if (!this.keywords.length) return '';
        return html`<div class="keywords" aria-label="Article keywords"><span class="keywords-label">Keywords</span>${this.keywords.map((k) => html`<span class="keyword">${k.word}</span>`)}</div>`;
    }
    private renderBoardPicker(a: Article) {
        if (!this.boardPickerOpen) return '';
        return html`
            <div class="board-picker-backdrop" @click=${() => (this.boardPickerOpen = false)}></div>
            <div class="board-picker" role="dialog" aria-label="Add to board">
                <div class="board-picker-head"><h3>Boards</h3><button class="btn" @click=${() => (this.boardPickerOpen = false)}>Close</button></div>
                <div class="board-picker-create">
                    <input type="text" placeholder="New board" .value=${this.newBoardTitle} @input=${(e: Event) => (this.newBoardTitle = (e.target as HTMLInputElement).value)} />
                    <button class="btn" @click=${() => void this.createBoardFromPicker()}>Create</button>
                </div>
                <ul class="board-picker-list">${this.boards.map((b) => html`<li><label><input type="checkbox" .checked=${this.boardMembership.has(b.id)} @change=${() => void this.toggleBoardMembership(b, a.id)} />${b.title}</label></li>`)}</ul>
            </div>
        `;
    }
    private renderBody(body: string, a: Article) {
        // sanitized: body is sanitizeHtml(a.content), applied in render().
        if (body) return html`<div class="content">${unsafeHTML(body)}</div>`;
        if (a.summary) return html`<div class="content">${a.summary}</div>`;
        return html`<p class="content">No content available for this article.</p>`;
    }
    private async onStar() {
        const started = this.article;
        if (!started) return;
        const next = !started.starred;
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
            return;
        }
        const gen = ++this.savedStateGen;
        try {
            const items = await fetchSavedArticlesList();
            if (this.article?.id !== a.id || this.savedStateGen !== gen) return;
            this.savedForLater = items.some((s) => s.articleId === a.id);
        } catch {
            // keep previous state on transient failures
        }
    }
    private async openBoardPicker(): Promise<void> {
        const a = this.article;
        if (!a) return;
        this.boardPickerOpen = true;
        this.newBoardTitle = '';
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
        } catch {
            this.boards = [];
        }
    }
    private async toggleBoardMembership(board: Board, articleId: string): Promise<void> {
        if (this.boardMembership.has(board.id)) {
            if (await removeFromBoard(board.id, articleId)) {
                const next = new Set(this.boardMembership);
                next.delete(board.id);
                this.boardMembership = next;
            }
        } else {
            if (await addToBoard(board.id, articleId)) {
                const next = new Set(this.boardMembership);
                next.add(board.id);
                this.boardMembership = next;
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
    }
    private onToggleSaved = async () => {
        const a = this.article;
        if (!a) return;
        const next = !this.savedForLater;
        // Invalidate any in-flight refresh so it can't overwrite optimistic intent.
        this.savedStateGen++;
        this.savedForLater = next;
        const ok = next ? await saveForLater(a.id) : await unsaveForLater(a.id);
        if (!ok) {
            if (this.article?.id === a.id) this.savedForLater = !next;
            void this.refreshSavedState();
            return;
        }
        // Reconcile from source of truth after success/invalidation events.
        void this.refreshSavedState();
    };
    private onDerank() {
        const a = this.article;
        if (!a) return;
        const next = !this.deranked;
        noteDerank(a.id, a.title, next);
        this.deranked = next;
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
        await this.ensureRichContent(a);
        const current = this.article;
        if (!current || current.id !== a.id || !this.highlightsOn) {
            this.keyLinesLoading = false;
            return;
        }
        const result = await loadRowHighlights(current.id);
        if (this.article?.id !== a.id) return;
        this.keyLines = result;
        this.keyLinesLoading = false;
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
            return;
        }
        void this.refreshKeyLines();
    }
    private renderKeyLines() {
        if (!this.highlightsOn) return '';
        const result = this.keyLines;
        const has = !!result && result.available && result.excerpts.length > 0;
        const settledEmpty = !this.keyLinesLoading && !has;
        return html`<section class="key-lines" aria-label="Key lines">
            <div class="key-lines-head">
                <h2>Key lines</h2>
                <button class="key-lines-toggle" @click=${this.onToggleKeyLines} aria-pressed=${this.highlightsOn}>Hide</button>
            </div>
            ${this.keyLinesLoading && !has ? html`<div class="skl"></div><div class="skl skl-short"></div>` : ''}
            ${settledEmpty ? html`<p class="key-why">No key lines found for this article.</p>` : ''}
            ${
                has
                    ? html`<ul>
                      ${repeat(
                          result.excerpts,
                          (e) => e.index,
                          (e) => html`<li><blockquote>${e.text}</blockquote></li>`,
                      )}
                  </ul>
                  <p class="key-why">From this article · ${whyLineFor(result, this.keywords, this.article)}</p>`
                    : ''
            }
        </section>`;
    }
    /** Re-enable affordance while the feature is off. */
    private renderHighlightsToggle() {
        if (this.highlightsOn) return '';
        return html`<button class="key-lines-toggle" @click=${this.onToggleKeyLines} aria-pressed="false">Key lines</button>`;
    }
}
declare global {
    interface HTMLElementTagNameMap {
        'article-view': ArticleView;
    }
}
