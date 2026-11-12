import { html, LitElement, svg, unsafeCSS } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import { sanitizeHtml, safeHttpUrl, stripHtml } from '../../services/parser';
import { articleVideo } from '../../services/video';
import { canNativeShare, mailtoShareUrl, shareUrl, type ShareTarget } from '../../services/share';
import { loadMastodonHost, loadShareTargets } from '../../services/share-settings';
import { toastError, toastInfo } from '../../services/toast';
import { SUMMARY_LENGTHS, loadSummaryLength, saveSummaryLength, summarizeBest, type SummaryLength } from '../../ai';
import { noteDerank, noteOriginal, noteShare, noteSummary, toggleStar } from '../../mutations';
import { isDeranked } from '../../services/interesting-settings';
import { readMinutes } from '../../util';
import type { Article } from '../../types';
import { domainOf, formatDate } from '../../util';
import '../video-header/video-header';
import styles from './article-view.css?inline';

const summaryCache = new Map<string, string>();

const MAX_SUMMARY_CHARS = 12_000;

@customElement('article-view')
export class ArticleView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) article: Article | null = null;
    private focused = false;

    @state() private summarizing = false;
    @state() private aiSummary: string | null = null;
    @state() private aiError = '';
    @state() private deranked = false;
    /** Article the progress bar belongs to; object identity churns on star. */
    private progressArticleId: string | null = null;
    /** 0..1 fraction of the article scrolled, for the progress bar. */
    @state() private readProgress = 0;
    @state() private summaryLength: SummaryLength = loadSummaryLength();

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
        this.addEventListener('scroll', this.onScroll);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('share-settings-changed', this.onShareSettingsChanged);
        this.removeEventListener('scroll', this.onScroll);
    }

    /** Progress bar: the host itself is the scroller. */
    private onScroll = () => {
        const max = this.scrollHeight - this.clientHeight;
        this.readProgress = max > 0 ? Math.min(1, Math.max(0, this.scrollTop / max)) : 0;
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
            this.aiSummary = null;
            this.aiError = '';
            this.sanitizedBody = null;
            this.deranked = this.article ? isDeranked(this.article.id) : false;
            // A new object identity does not mean a new article: starring
            // replaces the object in place. Only a new id resets progress
            // and scroll, or pressing S mid-article yanks the reader to top.
            if (this.article?.id !== this.progressArticleId) {
                this.progressArticleId = this.article?.id ?? null;
                this.readProgress = 0;
                this.scrollTop = 0;
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
        return html`<div class="read-progress" aria-hidden="true"><span style="width: ${Math.round(this.readProgress * 100)}%"></span></div>${this.renderToolbar(a, link)}<div class="body">${this.renderTitle(a, link)}${this.renderMeta(a)}${video ? html`<video-header class="expanded-video" .mode=${'embed'} .video=${video} .videoTitle=${a.title}></video-header>` : ''}${this.renderAiCard()}${this.renderBody(body, a)}</div>`;
    }

    private renderToolbar(a: Article, link: string | undefined) {
        const label = this.summarizing ? 'Summarizing…' : this.aiSummary ? '✓ Summarized' : '✨ Summarize';
        return html`
      <div class="toolbar" role="toolbar" aria-label="Article actions">
        <button class="btn" @click=${this.emitClose}>← Back</button>
        <button class="btn" @click=${this.onStar}>${a.starred ? '★ Unstar' : '☆ Star'}</button>
        <button class="btn" @click=${this.onDerank} aria-pressed=${this.deranked}>${this.deranked ? '✓ Not interesting' : '⊘ Not interesting'}</button>
        <button class="btn" @click=${this.onSummarize} ?disabled=${this.summarizing}>${label}</button>
        ${link ? this.renderShareButtons(a, link) : ''}
        <div class="spacer"></div>
        ${link ? html`<a class="btn primary" href=${link} target="_blank" rel="noopener noreferrer" @click=${() => noteOriginal(a.id, a.title)}>View original ↗</a>` : ''}
      </div>`;
    }

    /**
     * Share buttons straight in the toolbar, limited to the networks the
     * reader enabled in Settings. Facebook and X open their share intents;
     * Mastodon posts through the configured instance; Instagram publishes
     * no web share endpoint, so its button copies the link for pasting.
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
        const buttons: Record<ShareTarget, unknown> = {
            facebook: html`<button class="btn share-btn" @click=${open('facebook')}>${shareIcon('facebook')}Facebook</button>`,
            x: html`<button class="btn share-btn" @click=${open('x')}>${shareIcon('x')}X</button>`,
            mastodon: html`<button class="btn share-btn" @click=${open('mastodon')}>${shareIcon('mastodon')}Mastodon</button>`,
            instagram: html`<button class="btn share-btn" @click=${() => void this.copyLink(link, a)}>${shareIcon('instagram')}Instagram</button>`,
        };
        return html`${loadShareTargets().map((t) => buttons[t])}${canNativeShare() ? html`<button class="btn share-btn" @click=${() => void this.nativeShare(a, link)}>More…</button>` : ''}<button class="btn share-btn" @click=${() => void this.copyTitleLink(a, link)}>Copy link</button><a class="btn share-btn" href=${mailtoShareUrl(link, a.title)} @click=${() => noteShare(a.id, a.title)}>Email</a>`;
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

    /** Title plus link on the clipboard for pasting anywhere. */
    private async copyTitleLink(a: Article, link: string): Promise<void> {
        if (await this.copyText(`${a.title}\n${link}`)) {
            noteShare(a.id, a.title);
            toastInfo('Link copied');
        } else {
            toastError('Could not copy the link');
        }
    }

    private emitClose = () => {
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    };

    /** Clipboard with the legacy textarea fallback for older WebViews. */
    private async copyText(text: string): Promise<boolean> {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            try {
                const area = document.createElement('textarea');
                area.value = text;
                document.body.appendChild(area);
                area.select();
                const copied = document.execCommand('copy');
                area.remove();
                return copied;
            } catch {
                return false;
            }
        }
    }

    /** Instagram path: no endpoint exists, so copy the link for pasting. */
    private async copyLink(link: string, a: Article) {
        if (await this.copyText(link)) {
            noteShare(a.id, a.title);
            toastInfo('Link copied — paste it in Instagram');
        } else toastError('Could not copy the link');
    }

    private renderTitle(a: Article, link: string | undefined) {
        return html`<h1>${link ? html`<a href=${link} target="_blank" rel="noopener noreferrer" @click=${() => noteOriginal(a.id, a.title)}>${a.title}</a>` : a.title}</h1>`;
    }

    private renderMeta(a: Article) {
        const minutes = readMinutes(a.content, a.summary);
        return html`<div class="meta"><span>${domainOf(a.link) || 'unknown source'}</span><span>${formatDate(a.published)}</span>${a.author ? html`<span>by ${a.author}</span>` : ''}${minutes > 0 ? html`<span>${minutes} min read</span>` : ''}</div>`;
    }

    private renderAiCard() {
        const head = html`<div class="head"><span>✨ AI Summary</span><div class="seg" role="group" aria-label="Summary length">${SUMMARY_LENGTHS.map((l) => html`<button class="seg-btn ${this.summaryLength === l ? 'on' : ''}" ?disabled=${this.summarizing} @click=${() => this.setSummaryLength(l)}>${l === 'brief' ? 'Brief' : l === 'deep' ? 'Deep' : 'Standard'}</button>`)}</div></div>`;
        if (this.aiError)
            return html`<div class="ai-card">${head}<div class="ai-text" style="color: var(--danger)">${this.aiError}</div></div>`;
        if (this.summarizing)
            return html`<div class="ai-card">${head}<div class="spinner"><span class="spin"></span> Summarizing…</div></div>`;
        if (this.aiSummary) return html`<div class="ai-card">${head}<div class="ai-text">${this.aiSummary}</div></div>`;
        return html`<div class="ai-card">${head}<div class="ai-text muted">Pick a length, then <button class="link-btn" @click=${this.onSummarize}>Summarize</button>.</div></div>`;
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
            this.article = { ...started, starred: started.starred };
            window.dispatchEvent(
                new CustomEvent('article-starred', { detail: { id: started.id, starred: started.starred } }),
            );
        }
    }

    private onDerank() {
        const a = this.article;
        if (!a) return;
        const next = !this.deranked;
        noteDerank(a.id, a.title, next);
        this.deranked = next;
    }

    private shouldSkipSummarize(a: Article | null): boolean {
        if (!a || this.summarizing) return true;
        if (this.aiSummary) return true;
        return false;
    }

    private tryCached(a: Article): boolean {
        const cached = summaryCache.get(this.summaryCacheKey(a));
        if (!cached) return false;
        this.aiSummary = cached;
        return true;
    }

    private getSummarizeText(a: Article): string | null {
        const text = stripHtml(a.content ?? '') || a.summary || '';
        if (text.trim()) return text;
        this.aiError = 'This article has no content to summarize.';
        return null;
    }

    private async onSummarize() {
        const a = this.article;
        if (this.shouldSkipSummarize(a)) return;
        if (!a) return;
        if (this.tryCached(a)) return;
        this.summarizing = true;
        this.aiError = '';
        try {
            const text = this.getSummarizeText(a);
            if (!text) return;
            const summary = await summarizeBest(a.title, text.slice(0, MAX_SUMMARY_CHARS), this.summaryLength);
            if (this.article?.id !== a.id) return;
            noteSummary(a.id, a.title);
            summaryCache.set(this.summaryCacheKey(a), summary);
            this.aiSummary = summary;
        } catch (err) {
            this.aiError = err instanceof Error ? err.message : 'Could not summarize this article';
        } finally {
            this.summarizing = false;
        }
    }

    private summaryCacheKey(a: Article): string {
        return `${a.id}:${this.summaryLength}`;
    }

    private setSummaryLength(length: SummaryLength) {
        if (this.summaryLength === length || this.summarizing) return;
        this.summaryLength = length;
        saveSummaryLength(length);
        this.aiSummary = null;
        this.aiError = '';
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'article-view': ArticleView;
    }
}

/**
 * Brand glyphs for the share buttons, drawn as inline SVG so no font or
 * image asset is needed. Decorative: the button text names the target.
 */
function shareIcon(target: ShareTarget) {
    switch (target) {
        case 'facebook':
            return svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21.5v-7.2h2.5l.4-2.8h-2.9V9.7c0-.8.3-1.4 1.5-1.4h1.5V5.8c-.3 0-1.2-.1-2.2-.1-2.1 0-3.6 1.3-3.6 3.7v2.1H8.2v2.8h2.5v7.2h2.8z"/></svg>`;
        case 'x':
            return svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.4 4.8H5.6l11.1 14.3z"/></svg>`;
        case 'mastodon':
            return svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5c-3.9 0-6.8 2.4-6.8 5.8v4.3c0 2.9 1.9 5.2 4.6 5.2.5 0 1-.1 1.4-.2l.8 2.4.8-2.4c.4.1.9.2 1.4.2 2.7 0 4.6-2.3 4.6-5.2V8.3c0-3.4-2.9-5.8-6.8-5.8zM9.3 15.6c-.4-.9-.6-1.9-.6-2.9h1.5c0 .8.2 1.6.5 2.3l-1.4.6zm5.4 0l-1.4-.6c.3-.7.5-1.5.5-2.3h1.5c0 1-.2 2-.6 2.9z"/></svg>`;
        case 'instagram':
            return svg`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>`;
    }
}
