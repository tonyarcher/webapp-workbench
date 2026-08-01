import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {libraryKey, QueryController} from '../../query';
import {getFeeds, getFolders, queryRecentArticles} from '../../db/db';
import {
    aiAvailability,
    type AiAvailability,
    aiDiagnostics,
    type AiDiagnostics,
    aiStatusMessage,
    runAiPrompt,
} from '../../ai';
import type {Article, Feed, Folder} from '../../types';
import {domainOf, formatDate} from '../../util';
import styles from './brief-view.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

const MAX_ARTICLES = 40;

@customElement('brief-view')
export class BriefView extends LitElement {
    static override styles = unsafeCSS(styles);

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
            return {folders, feeds};
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
                detail: {article, index, items},
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
}

declare global {
    interface HTMLElementTagNameMap {
        'brief-view': BriefView;
    }
}
