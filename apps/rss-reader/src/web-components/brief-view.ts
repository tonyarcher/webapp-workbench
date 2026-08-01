import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { QueryController, libraryKey } from '../query';
import { getFeeds, getFolders, queryRecentArticles } from '../db/db';
import {
  aiAvailability,
  aiDiagnostics,
  aiStatusMessage,
  runAiPrompt,
  type AiAvailability,
  type AiDiagnostics,
} from '../ai';
import type { Article, Feed, Folder } from '../types';
import { domainOf, formatDate } from '../util';

interface Library {
  folders: Folder[];
  feeds: Feed[];
}

const MAX_ARTICLES = 40;

@customElement('brief-view')
export class BriefView extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg);
      box-sizing: border-box;
      overflow-y: auto;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      flex: none;
      position: sticky;
      top: 0;
      background: var(--bg);
      z-index: 1;
    }
    .toolbar h2 {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .toolbar .date {
      font-size: 12px;
      color: var(--text-muted);
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
    .btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .body {
      padding: 16px;
      max-width: 820px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .banner {
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--hover);
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .banner code {
      background: var(--input-bg);
      padding: 1px 5px;
      border-radius: 4px;
    }
    .diag summary {
      cursor: pointer;
      font-weight: 600;
    }
    .diag-body {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .diag-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .diag-ok {
      color: var(--text);
    }
    .diag-bad {
      color: var(--danger);
    }
    .summary-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 20px;
      background: var(--panel-bg);
    }
    .summary-card .head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 10px;
    }
    .summary-text {
      font-size: 15px;
      line-height: 1.7;
      color: var(--text);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .spinner {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-muted);
      font-size: 14px;
    }
    .spinner .spin {
      width: 16px;
      height: 16px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .section-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      margin: 0 0 8px;
    }
    .articles {
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: var(--panel-bg);
    }
    .article {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--row-border);
      cursor: pointer;
    }
    .article:last-child {
      border-bottom: none;
    }
    .article:hover {
      background: var(--hover);
    }
    .article .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      flex: none;
      opacity: 0;
    }
    .article.unread .dot {
      opacity: 1;
    }
    .article .title {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .article .src {
      font-size: 12px;
      color: var(--text-muted);
      flex: none;
    }
    .article .date {
      font-size: 12px;
      color: var(--text-muted);
      flex: none;
    }
    .empty {
      padding: 40px 20px;
      text-align: center;
      color: var(--text-muted);
    }
  `;

  @state() private availability: AiAvailability | null = null;
  @state() private diagnostics: AiDiagnostics | null = null;
  @state() private summary = '';
  @state() private generating = false;
  @state() private error = '';

  private startOfToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  private generatedFor = '';

  private library = new QueryController<Library>(this, () => ({
    queryKey: libraryKey,
    queryFn: async () => {
      const [folders, feeds] = await Promise.all([getFolders(), getFeeds()]);
      return { folders, feeds };
    },
  }));

  private articles = new QueryController<Article[]>(this, () => ({
    queryKey: ['brief', this.startOfToday.toDateString()],
    queryFn: () => queryRecentArticles(this.startOfToday.getTime(), MAX_ARTICLES),
  }));

  override firstUpdated() {
    void aiAvailability().then((availability) => {
      this.availability = availability;
    });
    void aiDiagnostics().then((diagnostics) => {
      this.diagnostics = diagnostics;
    });
  }

  override updated(_changed: Map<string, unknown>) {
    if (
      this.availability === 'readily' &&
      this.articles.data?.length &&
      !this.generating &&
      !this.summary &&
      this.generatedFor !== this.startOfToday.toDateString()
    ) {
      void this.generate();
    }
  }

  private feedTitle(feedId: string): string {
    return this.library.data?.feeds.find((f) => f.id === feedId)?.title ?? '';
  }

  private async generate() {
    const articles = this.articles.data ?? [];
    if (!articles.length) return;
    const status = await aiAvailability();
    if (status !== 'readily') {
      this.availability = status;
      return;
    }
    this.generatedFor = this.startOfToday.toDateString();
    this.generating = true;
    this.error = '';
    try {
      const lines = articles.map((a, i) => {
        const feed = this.feedTitle(a.feedId);
        return `${i + 1}. "${a.title}"${feed ? ` — ${feed}` : ''}${a.link ? ` (${a.link})` : ''}`;
      });
      const systemPrompt =
        'You are a news briefing assistant. Turn a reader\'s daily RSS articles into a clear, scannable daily brief. Group related stories, keep it factual and neutral, and never invent details.';
      const prompt = [
        `Here are today's articles from the reader's feeds (newest first):`,
        ``,
        lines.join('\n'),
        ``,
        `Write a concise daily brief covering these stories. Use short markdown bullets. Highlight the most important items first. Do not mention "the user" or "the reader".`,
      ].join('\n');
      this.summary = await runAiPrompt(prompt, systemPrompt);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not generate the brief';
    } finally {
      this.generating = false;
    }
  }

  private openArticle(article: Article) {
    const items = this.articles.data ?? [];
    const index = items.findIndex((a) => a.id === article.id);
    this.dispatchEvent(
      new CustomEvent('open-article', {
        detail: { article, index, items },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private availabilityMessage(): string {
    return this.availability ? aiStatusMessage(this.availability) : '';
  }

  private renderDiagRow(label: string, value: boolean | string) {
    const display =
      typeof value === 'boolean' ? (value ? 'present / yes' : 'absent / no') : value;
    const ok = value === true || (typeof value === 'string' && value !== 'none' && value !== 'no');
    return html`<div class="diag-row"><span>${label}</span><span class="${ok ? 'diag-ok' : 'diag-bad'}">${display}</span></div>`;
  }

  override render() {
    const articles = this.articles.data ?? [];
    const todayLabel = this.startOfToday.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const message = this.availabilityMessage();

    return html`
      <div class="toolbar">
        <h2>✨ Daily Brief</h2>
        <span class="date">${todayLabel}</span>
        <button class="btn" @click=${this.generate} ?disabled=${this.generating || !articles.length}>
          ${this.generating ? 'Writing…' : 'Regenerate'}
        </button>
      </div>

      <div class="body">
        ${message ? html`<div class="banner">${message}</div>` : ''}
        ${this.error ? html`<div class="banner" style="color: var(--danger)">${this.error}</div>` : ''}
        ${this.diagnostics && this.diagnostics.available !== 'readily'
          ? html`
              <details class="banner diag">
                <summary>Why? Browser diagnostics</summary>
                <div class="diag-body">
                  ${this.renderDiagRow('Model API (window.model)', this.diagnostics.hasModelApi)}
                  ${this.renderDiagRow('window.ai object', this.diagnostics.hasAiApi)}
                  ${this.renderDiagRow('languageModel API', this.diagnostics.hasLanguageModelApi)}
                  ${this.renderDiagRow(
                    'Reported capability',
                    this.diagnostics.capabilitiesValue ?? 'none',
                  )}
                  ${this.renderDiagRow('Served from localhost', this.diagnostics.isLocalhost)}
                  ${this.renderDiagRow('Secure context (HTTPS)', this.diagnostics.isSecureContext)}
                </div>
              </details>
            `
          : ''}

        ${articles.length
          ? html`
              <div class="summary-card">
                <div class="head">✨ Daily Brief</div>
                ${this.generating
                  ? html`<div class="spinner"><span class="spin"></span> Summarizing ${articles.length} articles…</div>`
                  : this.summary
                    ? html`<div class="summary-text">${this.summary}</div>`
                    : html`<div class="spinner"><span class="spin"></span> Reading today’s articles…</div>`}
              </div>

              <h3 class="section-label">Covered today (${articles.length})</h3>
              <div class="articles">
                ${articles.map(
                  (a) => html`
                    <div class="article ${a.read === 0 ? 'unread' : ''}" @click=${() => this.openArticle(a)}>
                      <span class="dot"></span>
                      <span class="title">${a.title}</span>
                      <span class="src">${this.feedTitle(a.feedId) || domainOf(a.link)}</span>
                      <span class="date">${formatDate(a.published)}</span>
                    </div>
                  `,
                )}
              </div>
            `
          : html`<div class="empty">No articles published today yet. Sync your feeds and check back.</div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'brief-view': BriefView;
  }
}
