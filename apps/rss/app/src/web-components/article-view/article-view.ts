import {html, LitElement, unsafeCSS} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {customElement, property, state} from 'lit/decorators.js';
import {sanitizeHtml, safeHttpUrl, stripHtml} from '../../services/parser';
import {SUMMARY_LENGTHS, loadSummaryLength, saveSummaryLength, summarizeBest, type SummaryLength} from '../../ai';
import {toggleStar} from '../../mutations';
import type {Article} from '../../types';
import {domainOf, formatDate} from '../../util';
import styles from './article-view.css?inline';

const summaryCache = new Map<string, string>();

const MAX_SUMMARY_CHARS = 12_000;

@customElement('article-view')
export class ArticleView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) article: Article | null = null;

    @state() private summarizing = false;
    @state() private aiSummary: string | null = null;
    @state() private aiError = '';
    @state() private summaryLength: SummaryLength = loadSummaryLength();

    override updated(changed: Map<string, unknown>) {
        if (changed.has('article')) {
            this.aiSummary = null;
            this.aiError = '';
        }
    }

    override render() {
        const a = this.article;
        if (!a) return html``;
        const body = a.content ? sanitizeHtml(a.content) : '';
        const link = safeHttpUrl(a.link);
        return html`${this.renderToolbar(a, link)}<div class="body">${this.renderTitle(a, link)}${this.renderMeta(a)}${this.renderAiCard()}${this.renderBody(body, a)}</div>`;
    }

    private renderToolbar(a: Article, link: string | undefined) {
        const label = this.summarizing ? 'Summarizing…' : this.aiSummary ? '✓ Summarized' : '✨ Summarize';
        return html`
      <div class="toolbar">
        <button class="btn" @click=${this.emitClose}>← Back</button>
        <button class="btn" @click=${this.onStar}>${a.starred ? '★ Unstar' : '☆ Star'}</button>
        <button class="btn" @click=${this.onSummarize} ?disabled=${this.summarizing}>${label}</button>
        <div class="spacer"></div>
        ${link ? html`<a class="btn primary" href=${link} target="_blank" rel="noopener noreferrer">View original ↗</a>` : ''}
      </div>`;
    }

    private emitClose = () => {
        this.dispatchEvent(new CustomEvent('close', {bubbles: true, composed: true}));
    };

    private renderTitle(a: Article, link: string | undefined) {
        return html`<h1>${link ? html`<a href=${link} target="_blank" rel="noopener noreferrer">${a.title}</a>` : a.title}</h1>`;
    }

    private renderMeta(a: Article) {
        return html`<div class="meta"><span>${domainOf(a.link) || 'unknown source'}</span><span>${formatDate(a.published)}</span>${a.author ? html`<span>by ${a.author}</span>` : ''}</div>`;
    }

    private renderAiCard() {
        const head = html`<div class="head"><span>✨ AI Summary</span><div class="seg" role="group" aria-label="Summary length">${SUMMARY_LENGTHS.map((l) => html`<button class="seg-btn ${this.summaryLength === l ? 'on' : ''}" ?disabled=${this.summarizing} @click=${() => this.setSummaryLength(l)}>${l === 'brief' ? 'Brief' : l === 'deep' ? 'Deep' : 'Standard'}</button>`)}</div></div>`;
        if (this.aiError) return html`<div class="ai-card">${head}<div class="ai-text" style="color: var(--danger)">${this.aiError}</div></div>`;
        if (this.summarizing) return html`<div class="ai-card">${head}<div class="spinner"><span class="spin"></span> Summarizing…</div></div>`;
        if (this.aiSummary) return html`<div class="ai-card">${head}<div class="ai-text">${this.aiSummary}</div></div>`;
        return html`<div class="ai-card">${head}<div class="ai-text muted">Pick a length, then <button class="link-btn" @click=${this.onSummarize}>Summarize</button>.</div></div>`;
    }

    private renderBody(body: string, a: Article) {
        if (body) return html`<div class="content">${unsafeHTML(body)}</div>`;
        if (a.summary) return html`<div class="content">${a.summary}</div>`;
        return html`<p class="content">No content available for this article.</p>`;
    }

    private async onStar() {
        const started = this.article;
        if (!started) return;
        const next = !started.starred;
        this.article = {...started, starred: next};
        if (await toggleStar(started.id, next)) {
            window.dispatchEvent(
                new CustomEvent('article-starred', {detail: {id: started.id, starred: next}}),
            );
        } else if (this.article?.id === started.id) {
            this.article = {...started, starred: started.starred};
            window.dispatchEvent(
                new CustomEvent('article-starred', {detail: {id: started.id, starred: started.starred}}),
            );
        }
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
