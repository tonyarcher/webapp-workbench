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

        return html`
      <div class="toolbar">
        <button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close', {
            bubbles: true,
            composed: true
        }))}>
          ← Back
        </button>
        <button class="btn" @click=${this.onStar}>${a.starred ? '★ Unstar' : '☆ Star'}</button>
        <button class="btn" @click=${this.onSummarize} ?disabled=${this.summarizing}>
          ${this.summarizing ? 'Summarizing…' : this.aiSummary ? '✓ Summarized' : '✨ Summarize'}
        </button>
        <div class="spacer"></div>
        ${link
            ? html`<a class="btn primary" href=${link} target="_blank" rel="noopener noreferrer">View original ↗</a>`
            : ''}
      </div>
      <div class="body">
        <h1>${a.title}</h1>
        <div class="meta">
          <span>${domainOf(a.link) || 'unknown source'}</span>
          <span>${formatDate(a.published)}</span>
          ${a.author ? html`<span>by ${a.author}</span>` : ''}
        </div>

        ${this.aiError
            ? html`<div class="ai-card"><div class="head">✨ AI Summary</div><div class="ai-text" style="color: var(--danger)">${this.aiError}</div></div>`
            : this.summarizing
                ? html`<div class="ai-card"><div class="head">✨ AI Summary</div><div class="spinner"><span class="spin"></span> Summarizing…</div></div>`
                : this.aiSummary
                    ? html`<div class="ai-card"><div class="head">✨ AI Summary</div><div class="ai-text">${this.aiSummary}</div></div>`
                    : ''}

        ${body
            ? html`<div class="content">${unsafeHTML(body)}</div>`
            : a.summary
                ? html`<div class="content">${a.summary}</div>`
                : html`<p class="content">No content available for this article.</p>`}
      </div>
    `;
    }

    private onStar() {
        if (!this.article) return;
        const next = !this.article.starred;
        this.article = {...this.article, starred: next};
        void toggleStar(this.article.id);
        window.dispatchEvent(
            new CustomEvent('article-starred', {detail: {id: this.article.id, starred: next}}),
        );
    }

    private async onSummarize() {
        const a = this.article;
        if (!a || this.summarizing) return;
        if (this.aiSummary) return;

        const cached = summaryCache.get(a.id);
        if (cached) {
            this.aiSummary = cached;
            return;
        }

        this.summarizing = true;
        this.aiError = '';
        try {
            const availability = await aiAvailability();
            if (availability !== 'readily') {
                this.aiError = aiStatusMessage(availability);
                return;
            }
            const text = stripHtml(a.content ?? '') || a.summary || '';
            if (!text.trim()) {
                this.aiError = 'This article has no content to summarize.';
                return;
            }
            const summary = await summarizeArticle(a.title, text.slice(0, MAX_SUMMARY_CHARS));
            // Discard results that land after the user navigated to another article.
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
