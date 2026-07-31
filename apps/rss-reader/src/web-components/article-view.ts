import { LitElement, html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property } from 'lit/decorators.js';
import { sanitizeHtml } from '../services/parser';
import { toggleStar } from '../mutations';
import type { Article } from '../types';
import { domainOf, formatDate } from '../util';

@customElement('article-view')
export class ArticleView extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--panel-bg);
      overflow-y: auto;
      box-sizing: border-box;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--panel-bg);
      z-index: 1;
    }
    .btn {
      font: inherit;
      font-size: 13px;
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      cursor: pointer;
    }
    .btn:hover {
      background: var(--hover);
    }
    .btn.primary {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
      text-decoration: none;
    }
    .btn .spacer {
      flex: 1;
    }
    .body {
      padding: 24px 40px 60px;
      max-width: 760px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    h1 {
      font-size: 26px;
      line-height: 1.3;
      margin: 0 0 12px;
      color: var(--text);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .meta a {
      color: var(--accent);
      text-decoration: none;
    }
    .content {
      font-size: 16px;
      line-height: 1.7;
      color: var(--text);
      word-break: break-word;
    }
    .content :is(h1, h2, h3) {
      line-height: 1.3;
    }
    .content a {
      color: var(--accent);
    }
    .content img {
      max-width: 100%;
      height: auto;
    }
    .content pre {
      overflow-x: auto;
      background: var(--hover);
      padding: 12px;
      border-radius: 6px;
    }
    .content blockquote {
      border-left: 3px solid var(--border);
      margin-left: 0;
      padding-left: 14px;
      color: var(--text-muted);
    }
    .content figure {
      margin: 0;
    }
    .content iframe {
      max-width: 100%;
    }
  `;

  @property({ attribute: false }) article: Article | null = null;

  private onStar() {
    if (!this.article) return;
    const next = !this.article.starred;
    this.article = { ...this.article, starred: next };
    void toggleStar(this.article.id);
  }

  override render() {
    const a = this.article;
    if (!a) return html``;
    const body = a.content ? sanitizeHtml(a.content) : '';

    return html`
      <div class="toolbar">
        <button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>
          ← Back
        </button>
        <button class="btn" @click=${this.onStar}>${a.starred ? '★ Unstar' : '☆ Star'}</button>
        <div class="spacer"></div>
        ${a.link
          ? html`<a class="btn primary" href=${a.link} target="_blank" rel="noopener noreferrer">View original ↗</a>`
          : ''}
      </div>
      <div class="body">
        <h1>${a.title}</h1>
        <div class="meta">
          <span>${domainOf(a.link) || 'unknown source'}</span>
          <span>${formatDate(a.published)}</span>
          ${a.author ? html`<span>by ${a.author}</span>` : ''}
        </div>
        ${body
          ? html`<div class="content">${unsafeHTML(body)}</div>`
          : a.summary
            ? html`<div class="content">${a.summary}</div>`
            : html`<p class="content">No content available for this article.</p>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'article-view': ArticleView;
  }
}
