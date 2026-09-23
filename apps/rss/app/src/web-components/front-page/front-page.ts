import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
    editionKey,
    editionsKey,
    fetchLibrary,
    frontPageKey,
    invalidateEdition,
    libraryKey,
    queryClient,
    QueryController,
} from '../../query';
import {
    buildEdition,
    fetchEdition,
    fetchEditions,
    fetchFrontPage,
    fetchLatestEdition,
    QuotaError,
} from '../../services/api';
import { markArticleRead, toggleStar } from '../../mutations';
import {
    applyWeights,
    EDITION_WINDOW_HOURS_OPTIONS,
    loadEditionOptions,
    pruneEditionOptions,
    saveEditionOptions,
    type EditionOptions,
} from '../../services/edition-options';
import type { Article, Edition, EditionMeta, EditionSection, Feed, Folder } from '../../types';
import { domainOf, formatDate } from '../../util';
import styles from './front-page.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

const HISTORY_LIMIT = 10;
const MEMBER_LIMIT = 500;
const POLL_MS = 15_000;
const POLL_WINDOW_MS = 5 * 60_000;

function editionDate(ts: number): string {
    return new Date(ts).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** Server summaries are plain text; blank lines mark paragraph breaks. */
function splitParagraphs(summary: string | undefined): string[] {
    if (!summary) return [];
    return summary
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
}

/** Unique member story count across every section. */
function storyCount(sections: EditionSection[]): number {
    const seen = new Set<string>();
    for (const s of sections) {
        for (const id of s.articleIds) seen.add(id);
    }
    return seen.size;
}

@customElement('front-page')
export class FrontPage extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private options: EditionOptions = loadEditionOptions();
    @state() private optionsOpen = false;
    @state() private expandedIds: string[] = [];
    @state() private selectedId: string | null = null;
    @state() private building = false;
    @state() private buildError = '';
    @state() private buildStartedAt = 0;
    @state() private now = Date.now();

    private pollTimer: number | null = null;

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    private history = new QueryController<EditionMeta[]>(this, () => ({
        queryKey: editionsKey({ limit: HISTORY_LIMIT }),
        queryFn: () => fetchEditions(HISTORY_LIMIT),
    }));

    private edition = new QueryController<Edition | null>(this, () => ({
        queryKey: editionKey({ id: this.selectedId ?? 'latest' }),
        queryFn: () => (this.selectedId ? fetchEdition(this.selectedId) : fetchLatestEdition()),
    }));

    private members = new QueryController<Article[]>(this, () => ({
        queryKey: frontPageKey({
            since: this.membersCutoff(),
            limit: MEMBER_LIMIT,
            edition: this.edition.data?.id ?? 'latest',
        }),
        queryFn: async () => {
            const res = await fetchFrontPage({ since: this.membersCutoff(), limit: MEMBER_LIMIT });
            return res.articles;
        },
    }));

    /** Member lookup window anchored on the edition itself so older editions still resolve. */
    private membersCutoff(): number {
        const edition = this.edition.data;
        const hours = edition?.windowHours ?? this.options.windowHours;
        const anchor = edition ? edition.generatedAt : this.now;
        return hours > 0 ? anchor - hours * 3_600_000 : 0;
    }

    override connectedCallback() {
        super.connectedCallback();
        this.now = Date.now();
        window.addEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.addEventListener('article-read', this.onArticleEvent);
        window.addEventListener('article-starred', this.onArticleEvent);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.removeEventListener('article-read', this.onArticleEvent);
        window.removeEventListener('article-starred', this.onArticleEvent);
        this.clearPollTimer();
    }

    override updated() {
        this.syncPoll();
    }

    private onFeedsRefreshed = () => {
        this.now = Date.now();
        void queryClient.invalidateQueries({ queryKey: ['front-page'] });
    };

    private onArticleEvent = () => {
        void queryClient.invalidateQueries({ queryKey: ['front-page'] });
    };

    /** Poll the selected edition while it is building, up to 5 minutes. */
    private syncPoll(): void {
        const building = this.edition.data?.status === 'building';
        const anchor = this.buildStartedAt > 0 ? this.buildStartedAt : (this.edition.data?.generatedAt ?? Date.now());
        const fresh = Date.now() - anchor < POLL_WINDOW_MS;
        if (building && fresh && this.pollTimer === null) {
            this.pollTimer = window.setTimeout(this.onPollTick, POLL_MS);
        } else if ((!building || !fresh) && this.pollTimer !== null) {
            this.clearPollTimer();
        }
    }

    private clearPollTimer(): void {
        if (this.pollTimer !== null) {
            window.clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private onPollTick = () => {
        this.pollTimer = null;
        this.now = Date.now();
        void invalidateEdition();
    };

    private articleById(): Map<string, Article> {
        return new Map((this.members.data ?? []).map((a) => [a.id, a]));
    }

    /** Resolved member articles in display order, deduped for j/k navigation. */
    private visibleItems(sections: EditionSection[]): Article[] {
        const byId = this.articleById();
        const seen = new Set<string>();
        const out: Article[] = [];
        for (const s of sections) {
            for (const id of s.articleIds) {
                if (seen.has(id)) continue;
                seen.add(id);
                const article = byId.get(id);
                if (article) out.push(article);
            }
        }
        return out;
    }

    override render() {
        const edition = this.edition.data ?? null;
        const sections = edition
            ? applyWeights(edition.sections, this.options).slice(0, this.options.sectionCount)
            : [];
        return html`
      <header class="masthead">
        <div class="nameplate">Front Page</div>
        <div class="edition">${this.renderEditionLine(edition, storyCount(sections))}</div>
        <div class="masthead-actions">
          <button class="options-btn" @click=${() => (this.optionsOpen = !this.optionsOpen)} aria-expanded=${this.optionsOpen}>Options</button>
          <button class="options-btn" @click=${this.onRefresh} ?disabled=${this.building}>Refresh</button>
          <button class="build-btn" @click=${this.onBuild} ?disabled=${this.building}>${this.building ? 'Building…' : 'Build edition'}</button>
        </div>
        ${this.renderHistory(edition)}
        ${this.optionsOpen ? this.renderOptionsForm() : ''}
        ${this.buildError ? html`<p class="error">${this.buildError}</p>` : ''}
      </header>
      <div class="body">${this.renderBody(edition, sections)}</div>`;
    }

    private renderEditionLine(edition: Edition | null, displayed: number) {
        if (!edition) return html`<span>No edition yet</span>`;
        return html`<span>${editionDate(edition.generatedAt)}</span><span aria-hidden="true"> · </span><span>${displayed === 1 ? '1 story' : `${displayed} stories`}</span>${edition.model ? html`<span aria-hidden="true"> · </span><span>${edition.model}</span>` : ''}<span aria-hidden="true"> · </span><span>${edition.status}</span>`;
    }

    private renderHistory(edition: Edition | null) {
        const metas = this.history.data ?? [];
        if (!metas.length && !this.selectedId) return '';
        // The just-built edition may not be in history yet; show it anyway.
        const shown: EditionMeta[] =
            this.selectedId && edition && !metas.some((m) => m.id === this.selectedId)
                ? [
                      {
                          id: this.selectedId,
                          generatedAt: edition.generatedAt,
                          windowHours: edition.windowHours,
                          status: edition.status,
                      },
                      ...metas,
                  ]
                : metas;
        if (!shown.length) return '';
        const value = this.selectedId ?? 'latest';
        return html`
      <label class="history">Edition
        <select .value=${value} @change=${this.onHistoryChange}>
          <option value="latest">Latest${edition && !this.selectedId ? ` — ${editionDate(edition.generatedAt)}` : ''}</option>
          ${shown.map((m) => html`<option value=${m.id}>${editionDate(m.generatedAt)} — ${m.status}</option>`)}
        </select>
      </label>`;
    }

    private onHistoryChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value;
        this.selectedId = value === 'latest' ? null : value;
        this.expandedIds = [];
    }

    private renderOptionsForm() {
        const o = this.options;
        return html`
      <form class="options" @change=${this.onOptionsChange}>
        <label>Window
          <select name="windowHours" .value=${String(o.windowHours)}>
            ${EDITION_WINDOW_HOURS_OPTIONS.map((n) => html`<option value=${n}>Last ${n}h</option>`)}
          </select>
        </label>
        <label>Sections
          <input name="sectionCount" type="number" min="1" max="12" step="1" .value=${String(o.sectionCount)} />
        </label>
        <label>General
          <input name="weightGeneral" type="number" min="0" max="1" step="0.05" .value=${String(o.weightGeneral)} />
        </label>
        <label>Personal
          <input name="weightPersonal" type="number" min="0" max="1" step="0.05" .value=${String(o.weightPersonal)} />
        </label>
        <label>Newness
          <input name="weightNewness" type="number" min="0" max="1" step="0.05" .value=${String(o.weightNewness)} />
        </label>
        <label>Popularity
          <input name="weightPopularity" type="number" min="0" max="1" step="0.05" .value=${String(o.weightPopularity)} />
        </label>
        <label class="check"><input name="showOpinion" type="checkbox" .checked=${o.showOpinion} /> Opinion</label>
        <label class="check"><input name="showFactCheck" type="checkbox" .checked=${o.showFactCheck} /> Fact-check</label>
      </form>
      <p class="options-note">Weights re-sort instantly. Window and section count apply to the next build.</p>`;
    }

    private onOptionsChange(e: Event) {
        const form = (e.currentTarget as HTMLElement).querySelectorAll('select, input');
        const next: EditionOptions = { ...this.options };
        for (const el of form) {
            const field = (el as HTMLSelectElement | HTMLInputElement).name as keyof EditionOptions;
            if (
                field === 'windowHours' ||
                field === 'sectionCount' ||
                field === 'weightGeneral' ||
                field === 'weightPersonal' ||
                field === 'weightNewness' ||
                field === 'weightPopularity'
            ) {
                const n = Number((el as HTMLSelectElement | HTMLInputElement).value);
                if (Number.isFinite(n)) (next[field] as number) = n;
            } else if (field === 'showOpinion' || field === 'showFactCheck') {
                (next[field] as boolean) = (el as HTMLInputElement).checked;
            }
        }
        this.options = pruneEditionOptions(next);
        saveEditionOptions(this.options);
    }

    private onRefresh() {
        this.now = Date.now();
        void invalidateEdition();
        void queryClient.invalidateQueries({ queryKey: ['front-page'] });
    }

    private async onBuild() {
        if (this.building) return;
        this.building = true;
        this.buildError = '';
        try {
            const res = await buildEdition(this.options.windowHours, this.options.sectionCount);
            this.buildStartedAt = Date.now();
            this.now = Date.now();
            this.selectedId = res.id ? res.id : null;
            this.expandedIds = [];
            await invalidateEdition();
        } catch (err) {
            this.buildError =
                err instanceof QuotaError || err instanceof Error ? err.message : 'Could not build the edition.';
        } finally {
            this.building = false;
        }
    }

    private renderBody(edition: Edition | null, sections: EditionSection[]) {
        if (this.edition.error) {
            return html`<div class="empty" style="color: var(--danger)">Could not load the edition. <button class="options-btn" @click=${this.onRefresh}>Retry</button></div>`;
        }
        if (this.edition.result.isPending) return html`<div class="empty">Loading the paper…</div>`;
        if (!edition) {
            return html`<div class="empty">
          <p><strong>The Front Page is a generated newspaper</strong>, not a headline list: one long-form edition with an editorial, merged multi-source sections, and fact-check badges.</p>
          <p>No edition exists yet. Build the first one from the last ${this.options.windowHours} hours of your feeds.</p>
          <button class="build-btn" @click=${this.onBuild} ?disabled=${this.building}>${this.building ? 'Building…' : 'Build edition'}</button>
        </div>`;
        }
        if (edition.status === 'building' && !sections.length) {
            return html`<div class="empty">Edition building… this page refreshes automatically.</div>`;
        }
        if (edition.status === 'failed' && !sections.length) {
            return html`<div class="empty">
          <p>The last build failed. Try again with a wider window or more subscribed feeds.</p>
          <button class="build-btn" @click=${this.onBuild} ?disabled=${this.building}>${this.building ? 'Building…' : 'Build edition'}</button>
        </div>`;
        }
        const feeds = this.library.data?.feeds ?? [];
        return html`${edition.status === 'building' ? html`<p class="building-note">Edition still building — showing the latest draft.</p>` : ''}
      ${this.options.showOpinion && edition.opinion ? this.renderEditorial(edition.opinion) : ''}
      ${sections.map((s) => this.renderSection(s, feeds))}`;
    }

    private renderEditorial(opinion: string) {
        return html`
      <article class="editorial">
        <div class="opinion-label">Opinion</div>
        ${splitParagraphs(opinion).map((p) => html`<p>${p}</p>`)}
      </article>`;
    }

    private renderSection(section: EditionSection, feeds: Feed[]) {
        const expanded = this.expandedIds.includes(section.id);
        const count = section.articleIds.length;
        return html`
      <article class="story">
        ${section.topic ? html`<div class="kicker">${section.topic}</div>` : ''}
        <h2 class="story-title">${section.title}</h2>
        ${this.options.showFactCheck ? this.renderBadge(section.verified) : ''}
        ${splitParagraphs(section.summary).map((p) => html`<p class="story-body">${p}</p>`)}
        ${section.opinion ? html`<p class="section-opinion">${section.opinion}</p>` : ''}
        <div class="sources-line">
          <span>${count === 1 ? '1 source' : `${count} sources`}</span>
          ${count > 0 ? html`<button class="more-btn" @click=${() => this.toggleExpanded(section.id)} aria-expanded=${expanded}>${expanded ? 'Fewer' : 'More'}</button>` : ''}
        </div>
        ${expanded ? html`<div class="members">${section.articleIds.map((id) => this.renderMember(id, feeds))}</div>` : ''}
      </article>`;
    }

    private renderBadge(verified: boolean | undefined) {
        if (!verified) return '';
        return html`<span class="badge ok">✓ Verified</span>`;
    }

    private renderMember(id: string, feeds: Feed[]) {
        const article = this.articleById().get(id);
        if (!article) return html`<div class="member-row missing"><span class="title">Story unavailable</span></div>`;
        const feedTitle = feeds.find((f) => f.id === article.feedId)?.title;
        return html`
      <div class="member-row ${article.read ? 'read' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)} @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}>
        <div class="row-top">${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}${feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}<span class="title">${article.title}</span><span class="member-date">${formatDate(article.published)}</span>${this.renderStarBtn(article)}</div>
        <div class="meta"><span>${domainOf(article.link)}</span>${article.author ? html`<span>by ${article.author}</span>` : ''}</div>
      </div>`;
    }

    private renderStarBtn(article: Article) {
        return html`<button class="star" title="Star" aria-label="Star" @click=${(e: Event) => this.onStar(e, article)}>${article.starred ? '★' : '☆'}</button>`;
    }

    private toggleExpanded(id: string) {
        this.expandedIds = this.expandedIds.includes(id)
            ? this.expandedIds.filter((x) => x !== id)
            : [...this.expandedIds, id];
    }

    private onRowKey(e: KeyboardEvent, article: Article) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        this.openArticle(article);
    }

    private onStar(e: Event, article: Article) {
        e.stopPropagation();
        const starred = !article.starred;
        void toggleStar(article.id, starred).then(() => queryClient.invalidateQueries({ queryKey: ['front-page'] }));
        window.dispatchEvent(new CustomEvent('article-starred', { detail: { id: article.id, starred } }));
    }

    private openArticle(article: Article) {
        if (article.read === 0) {
            void markArticleRead(article.id).then(() => queryClient.invalidateQueries({ queryKey: ['front-page'] }));
        }
        const edition = this.edition.data;
        const sections = edition
            ? applyWeights(edition.sections, this.options).slice(0, this.options.sectionCount)
            : [];
        const items = this.visibleItems(sections);
        const index = items.findIndex((a) => a.id === article.id);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: { article, index, items },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'front-page': FrontPage;
    }
}
