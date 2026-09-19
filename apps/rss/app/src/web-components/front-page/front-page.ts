import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {fetchLibrary, frontPageKey, libraryKey, queryClient, QueryController} from '../../query';
import {fetchFrontPage} from '../../services/api';
import {articleImage, safeHttpUrl} from '../../services/parser';
import {markArticleRead, toggleStar} from '../../mutations';
import {
    buildFrontPageSections,
    DEFAULT_FRONT_PAGE_OPTIONS,
    FRONT_PAGE_PER_FOLDER_OPTIONS,
    FRONT_PAGE_SINCE_HOURS_OPTIONS,
    loadFrontPageOptions,
    saveFrontPageOptions,
    type FrontPageOptions,
    type FrontPageSection,
} from '../../services/front-page';
import type {Article, Feed, Folder} from '../../types';
import {domainOf, formatDate} from '../../util';
import '../lazy-img/lazy-img';
import styles from './front-page.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

const PAGE_LIMIT = 500;

function editionDate(now: number): string {
    return new Date(now).toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});
}

@customElement('front-page')
export class FrontPage extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private options: FrontPageOptions = loadFrontPageOptions();
    @state() private optionsOpen = false;
    @state() private now = Date.now();

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    private articles = new QueryController<Article[]>(this, () => ({
        queryKey: frontPageKey({since: this.sinceCutoff(), unreadOnly: this.options.unreadOnly, limit: PAGE_LIMIT}),
        queryFn: async () => {
            const res = await fetchFrontPage({since: this.sinceCutoff(), unreadOnly: this.options.unreadOnly, limit: PAGE_LIMIT});
            return res.articles;
        },
    }));

    private sinceCutoff(): number {
        return this.options.sinceHours > 0 ? this.now - this.options.sinceHours * 3_600_000 : 0;
    }

    override connectedCallback() {
        super.connectedCallback();
        window.addEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.addEventListener('article-read', this.onArticleRead);
        window.addEventListener('article-starred', this.onArticleStarred);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.removeEventListener('article-read', this.onArticleRead);
        window.removeEventListener('article-starred', this.onArticleStarred);
    }

    private onFeedsRefreshed = () => {
        this.now = Date.now();
        void queryClient.invalidateQueries({queryKey: ['front-page']});
    };

    private onArticleRead = () => {
        void queryClient.invalidateQueries({queryKey: ['front-page']});
    };

    private onArticleStarred = () => {
        void queryClient.invalidateQueries({queryKey: ['front-page']});
    };

    private getViewData(): { folders: Folder[]; feeds: Feed[]; sections: FrontPageSection[]; count: number } {
        const folders = this.library.data?.folders ?? [];
        const feeds = this.library.data?.feeds ?? [];
        const articles = this.articles.data ?? [];
        const sections = buildFrontPageSections(articles, feeds, folders, [], this.options, this.now);
        const seen = new Set<string>();
        let count = 0;
        for (const s of sections) {
            for (const a of s.articles) {
                if (!seen.has(a.id)) {
                    seen.add(a.id);
                    count += 1;
                }
            }
        }
        return {folders, feeds, sections, count};
    }

    /** Every article on screen in display order, deduped so j/k navigation visits each once. */
    private visibleArticles(sections: FrontPageSection[]): Article[] {
        const seen = new Set<string>();
        return sections.flatMap((s) => s.articles).filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    }

    override render() {
        const {folders, feeds, sections, count} = this.getViewData();
        return html`
      <header class="masthead">
        <div class="nameplate">Front Page</div>
        <div class="edition"><span>${editionDate(this.now)}</span><span aria-hidden="true"> · </span><span>${count === 1 ? '1 story' : `${count} stories`}</span>
          <button class="options-btn" @click=${() => (this.optionsOpen = !this.optionsOpen)} aria-expanded=${this.optionsOpen}>Options</button>
        </div>
        ${this.optionsOpen ? this.renderOptionsForm() : ''}
      </header>
      <div class="body">${this.renderBody(folders, feeds, sections)}</div>`;
    }

    private renderOptionsForm() {
        const o = this.options;
        return html`
      <form class="options" @change=${this.onOptionsChange}>
        <label>Per section
          <select name="perFolder" .value=${String(o.perFolder)}>
            ${FRONT_PAGE_PER_FOLDER_OPTIONS.map((n) => html`<option value=${n}>${n}</option>`)}
          </select>
        </label>
        <label>Since
          <select name="sinceHours" .value=${String(o.sinceHours)}>
            ${FRONT_PAGE_SINCE_HOURS_OPTIONS.map((n) => html`<option value=${n}>Last ${n}h</option>`)}
          </select>
        </label>
        <label>Min worthy
          <input name="minWorthy" type="number" min="0" step="1" .value=${String(o.minWorthy)} />
        </label>
        <label class="check"><input name="unreadOnly" type="checkbox" .checked=${o.unreadOnly} /> Unread only</label>
        <label class="check"><input name="showTopStory" type="checkbox" .checked=${o.showTopStory} /> Top story</label>
        <label class="check"><input name="showBreaking" type="checkbox" .checked=${o.showBreaking} /> Breaking</label>
        <label class="check"><input name="showDeepReads" type="checkbox" .checked=${o.showDeepReads} /> Deep reads</label>
        <label class="check"><input name="showByFolder" type="checkbox" .checked=${o.showByFolder} /> By folder</label>
      </form>`;
    }

    private onOptionsChange(e: Event) {
        const form = (e.currentTarget as HTMLElement).querySelectorAll('select, input');
        const next: FrontPageOptions = {...this.options};
        for (const el of form) {
            const field = (el as HTMLSelectElement | HTMLInputElement).name as keyof FrontPageOptions;
            if (field === 'perFolder' || field === 'sinceHours' || field === 'minWorthy') {
                const n = Number((el as HTMLSelectElement | HTMLInputElement).value);
                if (Number.isFinite(n)) (next[field] as number) = n;
            } else if (field in next) {
                (next[field] as boolean) = (el as HTMLInputElement).checked;
            }
        }
        if (next.perFolder !== this.options.perFolder) {
            next.perFolder = (FRONT_PAGE_PER_FOLDER_OPTIONS as readonly number[]).includes(next.perFolder)
                ? next.perFolder
                : DEFAULT_FRONT_PAGE_OPTIONS.perFolder;
        }
        if (next.sinceHours !== this.options.sinceHours) {
            next.sinceHours = (FRONT_PAGE_SINCE_HOURS_OPTIONS as readonly number[]).includes(next.sinceHours)
                ? next.sinceHours
                : DEFAULT_FRONT_PAGE_OPTIONS.sinceHours;
        }
        this.options = next;
        saveFrontPageOptions(next);
    }

    private renderBody(folders: Folder[], feeds: Feed[], sections: FrontPageSection[]) {
        if (this.articles.error) return html`<div class="empty" style="color: var(--danger)">Could not load the front page.</div>`;
        if (!folders.length && !this.library.error) return html`<div class="empty">No folders yet. Import an OPML file to create some.</div>`;
        if (this.library.error && !folders.length) return html`<div class="empty">Could not load feeds.</div>`;
        if (!sections.length) {
            return html`<div class="empty">${this.options.unreadOnly ? 'Nothing unread in this window.' : 'Nothing in this window yet. Hit Refresh to sync.'}</div>`;
        }
        const [first, ...rest] = sections;
        if (!first) return html`<div class="empty">Nothing in this window yet.</div>`;
        if (first.id === 'top-story') {
            const hero = first.articles[0];
            if (!hero) return html`<div class="empty">Nothing in this window yet.</div>`;
            return html`${this.renderHero(hero, feeds)}${rest.map((s) => this.renderSection(s, feeds))}`;
        }
        return html`${sections.map((s) => this.renderSection(s, feeds))}`;
    }

    private renderHero(article: Article, feeds: Feed[]) {
        const feedTitle = feeds.find((f) => f.id === article.feedId)?.title;
        const link = safeHttpUrl(article.link);
        const image = articleImage(article);
        return html`
      <article class="hero ${article.read ? 'read' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)} @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}>
        ${image ? html`<lazy-img class="hero-img" .src=${image}></lazy-img>` : ''}
        <div class="hero-body">
          <div class="kicker">Top Story${feedTitle ? html` · ${feedTitle}` : ''}</div>
          ${link
                ? html`<a class="hero-title" href=${link} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${article.title}</a>`
                : html`<span class="hero-title">${article.title}</span>`}
          ${article.summary ? html`<p class="hero-summary">${article.summary}</p>` : ''}
          <div class="meta"><span>${domainOf(article.link)}</span><span>${formatDate(article.published)}</span>${article.author ? html`<span>by ${article.author}</span>` : ''}${this.renderStarBtn(article)}</div>
        </div>
      </article>`;
    }

    private renderSection(section: FrontPageSection, feeds: Feed[]) {
        return html`
      <section class="fp-section">
        <h2 class="section-head">${section.title}</h2>
        <div class="headlines">${section.articles.map((a) => this.renderHeadline(a, feeds))}</div>
      </section>`;
    }

    private renderHeadline(article: Article, feeds: Feed[]) {
        const feedTitle = feeds.find((f) => f.id === article.feedId)?.title;
        const link = safeHttpUrl(article.link);
        return html`
      <div class="row headline ${article.read ? 'read' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)} @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}>
        <div class="row-top">${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}${feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}${link
            ? html`<a class="title title-link" href=${link} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${article.title}</a>`
            : html`<span class="title">${article.title}</span>`}<span class="headline-date">${formatDate(article.published)}</span>${this.renderStarBtn(article)}</div>
      </div>`;
    }

    private renderStarBtn(article: Article) {
        return html`<button class="star" title="Star" aria-label="Star" @click=${(e: Event) => this.onStar(e, article)}>${article.starred ? '★' : '☆'}</button>`;
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
        void toggleStar(article.id, starred).then(() =>
            queryClient.invalidateQueries({queryKey: ['front-page']}),
        );
        window.dispatchEvent(
            new CustomEvent('article-starred', {detail: {id: article.id, starred}}),
        );
    }

    private openArticle(article: Article) {
        if (article.read === 0) {
            void markArticleRead(article.id).then(() =>
                queryClient.invalidateQueries({queryKey: ['front-page']}),
            );
        }
        const items = this.visibleArticles(this.getViewData().sections);
        const index = items.findIndex((a) => a.id === article.id);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: {article, index, items},
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
