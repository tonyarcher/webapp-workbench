import {html, LitElement, unsafeCSS} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {customElement, property, state} from 'lit/decorators.js';
import {sanitizeHtml, safeHttpUrl, stripHtml} from '../../services/parser';
import {aiAvailability, aiStatusMessage, summarizeArticle} from '../../ai';
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
        if (this.aiError) return html`<div class="ai-card"><div class="head">✨ AI Summary</div><div class="ai-text" style="color: var(--danger)">${this.aiError}</div></div>`;
        if (this.summarizing) return html`<div class="ai-card"><div class="head">✨ AI Summary</div><div class="spinner"><span class="spin"></span> Summarizing…</div></div>`;
        if (this.aiSummary) return html`<div class="ai-card"><div class="head">✨ AI Summary</div><div class="ai-text">${this.aiSummary}</div></div>`;
        return '';
    }

    private renderBody(body: string, a: Article) {
        if (body) return html`<div class="content">${unsafeHTML(body)}</div>`;
        if (a.summary) return html`<div class="content">${a.summary}</div>`;
        return html`<p class="content">No content available for this article.</p>`;
    }

    private onStar() {
        if (!this.article) return;
        const next = !this.article.starred;
        this.article = {...this.article, starred: next};
        void toggleStar(this.article.id, next);
        window.dispatchEvent(
            new CustomEvent('article-starred', {detail: {id: this.article.id, starred: next}}),
        );
    }

    private shouldSkipSummarize(a: Article | null): boolean {
        if (!a || this.summarizing) return true;
        if (this.aiSummary) return true;
        return false;
    }

    private tryCached(a: Article): boolean {
        const cached = summaryCache.get(a.id);
        if (!cached) return false;
        this.aiSummary = cached;
        return true;
    }

    private async ensureAiReady(): Promise<boolean> {
        const availability = await aiAvailability();
        if (availability === 'readily') return true;
        this.aiError = aiStatusMessage(availability);
        return false;
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
            if (!(await this.ensureAiReady())) return;
            const text = this.getSummarizeText(a);
            if (!text) return;
            const summary = await summarizeArticle(a.title, text.slice(0, MAX_SUMMARY_CHARS));
            if (this.article?.id !== a.id) return;
            summaryCache.set(a.id, summary);
            this.aiSummary = summary;
        } catch (err) {
            this.aiError = err instanceof Error ? err.message : 'Could not summarize this article';
        } finally {
            this.summarizing = false;
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'article-view': ArticleView;
    }
}
