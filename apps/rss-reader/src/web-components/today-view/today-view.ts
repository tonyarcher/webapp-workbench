import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {libraryKey, queryClient, QueryController} from '../../query';
import {getLibrary, fetchArticlesPage} from '../../services/api';
import {markArticleRead, markShownRead, toggleStar} from '../../mutations';
import {articleImage, safeHttpUrl} from '../../services/parser';
import {
    loadTodaySettings,
    pruneTodaySettings,
    saveTodaySettings,
    type TodayListView,
    type TodaySettings,
} from '../../services/today-settings';
import {buildTodaySections} from '../../services/today';
import type {Article, Feed, Folder} from '../../types';
import {domainOf, formatDate} from '../../util';
import '../lazy-img/lazy-img';
import styles from './today-view.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

@customElement('today-view')
export class TodayView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private startOfToday = startOfToday();
    @state() private settings: TodaySettings = loadTodaySettings();

    private midnightTimer: number | null = null;

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => getLibrary(),
        refetchInterval: 60_000,
    }));

    private articles = new QueryController<Article[]>(this, () => ({
        queryKey: ['today', this.startOfToday.toDateString()],
        queryFn: async () => {
            const res = await fetchArticlesPage({since: this.startOfToday.getTime(), sort: 'newest', limit: 10_000});
            return res.items;
        },
    }));

    override connectedCallback() {
        super.connectedCallback();
        this.scheduleMidnightRollover();
        window.addEventListener('today-settings-changed', this.onSettingsChanged);
        window.addEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.addEventListener('article-read', this.onArticleRead);
        window.addEventListener('article-starred', this.onArticleStarred);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        if (this.midnightTimer !== null) clearTimeout(this.midnightTimer);
        this.midnightTimer = null;
        window.removeEventListener('today-settings-changed', this.onSettingsChanged);
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.removeEventListener('article-read', this.onArticleRead);
        window.removeEventListener('article-starred', this.onArticleStarred);
    }

    override updated(_changed: Map<string, unknown>) {
        // Timers are throttled in background tabs; re-check the day on any
        // update so a wake re-rolls the cutoff immediately.
        const today = startOfToday();
        if (today.getTime() !== this.startOfToday.getTime()) {
            this.startOfToday = today;
        }
    }

    private onSettingsChanged = () => {
        this.settings = pruneTodaySettings(loadTodaySettings(), this.library.data?.folders.map((f) => f.id) ?? []);
    };

    private onFeedsRefreshed = () => {
        void queryClient.invalidateQueries({queryKey: ['today']});
    };

    private onArticleRead = () => {
        void queryClient.invalidateQueries({queryKey: ['today']});
    };

    private onArticleStarred = () => {
        void queryClient.invalidateQueries({queryKey: ['today']});
    };

    private scheduleMidnightRollover() {
        if (this.midnightTimer !== null) clearTimeout(this.midnightTimer);
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 1, 0);
        this.midnightTimer = window.setTimeout(() => {
            this.midnightTimer = null;
            const today = startOfToday();
            if (today.getTime() !== this.startOfToday.getTime()) {
                this.startOfToday = today;
            }
            this.scheduleMidnightRollover();
        }, nextMidnight.getTime() - now.getTime());
    }

    private getViewData() {
        const folders = this.library.data?.folders ?? [];
        const feeds = this.library.data?.feeds ?? [];
        const articles = this.articles.data ?? [];
        const settings = pruneTodaySettings(this.settings, folders.map((f) => f.id));
        const sections = buildTodaySections(articles, feeds, folders, settings.excludedFolderIds, settings.perFolder, settings.unreadOnly);
        const todayLabel = this.startOfToday.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'});
        return {folders, feeds, articles, settings, sections, todayLabel};
    }

    override render() {
        const {folders, feeds, articles, settings, sections, todayLabel} = this.getViewData();
        return html`
      <div class="toolbar">${this.renderToolbar(todayLabel, settings)}</div>
      <div class="body ${settings.listView}">${this.renderBody(folders, feeds, articles, settings, sections)}</div>`;
    }

    private renderToolbar(todayLabel: string, settings: TodaySettings) {
        return html`
        <h2>Today</h2><span class="date">${todayLabel}</span>
        <label class="unread-toggle">
          <input type="checkbox" .checked=${settings.unreadOnly}
            @change=${(e: Event) => this.setUnreadOnly((e.target as HTMLInputElement).checked)} /> Unread only
        </label>
        <label class="view-mode">
          <select .value=${settings.listView}
            @change=${(e: Event) => this.setListView((e.target as HTMLSelectElement).value as TodayListView)}>
            <option value="detailed">Detailed List</option>
            <option value="headline">Headline View</option>
            <option value="cards">Cards</option>
          </select>
        </label>
        <button class="btn" @click=${this.onMarkShownRead}>Mark shown as read</button>`;
    }

    private renderBody(folders: Folder[], feeds: Feed[], articles: Article[], settings: TodaySettings, sections: ReturnType<typeof buildTodaySections>) {
        return html`
        ${this.renderBodyContent(folders, settings, sections, feeds)}
        ${this.renderMarkEnd(sections, articles, feeds, folders, settings)}`;
    }

    private renderBodyContent(folders: Folder[], settings: TodaySettings, sections: ReturnType<typeof buildTodaySections>, feeds: Feed[]) {
        if (this.articles.error) return html`<div class="empty" style="color: var(--danger)">Could not load today's articles.</div>`;
        if (!folders.length) return html`<div class="empty">No folders yet. Import an OPML file to create some.</div>`;
        if (settings.excludedFolderIds.length === folders.length) return html`<div class="empty">All folders are hidden. Tick some back on in Today's ⋯ menu in the sidebar.</div>`;
        if (sections.length) return html`${sections.map((s) => this.renderSection(s, feeds, settings.listView))}`;
        return html`<div class="empty">${settings.unreadOnly ? 'Nothing unread today in these folders.' : 'Nothing published today in these folders yet. Hit Refresh to sync.'}</div>`;
    }

    private renderSection(section: ReturnType<typeof buildTodaySections>[number], feeds: Feed[], view: TodayListView) {
        return html`
                          <section class="today-section">
                            <h3 class="section-head">${section.folder.title}</h3>
                            <div class="section-articles ${view}">${section.articles.map((a) => this.renderItem(a, feeds, view))}</div>
                          </section>`;
    }

    private renderMarkEnd(sections: ReturnType<typeof buildTodaySections>, articles: Article[], feeds: Feed[], folders: Folder[], settings: TodaySettings) {
        if (!sections.length) return '';
        const disabled = !this.visibleArticles(articles, feeds, folders, settings).some((a) => a.read === 0);
        return html`<div class="mark-end"><button class="mark-end-btn" ?disabled=${disabled} @click=${this.onMarkShownRead}>Mark shown as read</button></div>`;
    }

    private persist(next: TodaySettings) {
        this.settings = next;
        saveTodaySettings(next);
        window.dispatchEvent(new CustomEvent('today-settings-changed'));
    }

    private setUnreadOnly(unreadOnly: boolean) {
        this.persist({...this.settings, unreadOnly});
    }

    private setListView(listView: TodayListView) {
        this.persist({...this.settings, listView});
    }

    private renderItem(article: Article, feeds: Feed[], listView: TodayListView) {
        if (listView === 'cards') return this.renderCard(article, feeds);
        if (listView === 'headline') return this.renderHeadline(article, feeds);
        return this.renderDetailed(article, feeds);
    }

    private renderUnread(article: Article) {
        return article.read === 0 ? html`<span class="unread-dot"></span>` : '';
    }

    private renderStarBtn(article: Article) {
        return html`<button class="star" title="Star" aria-label="Star" @click=${(e: Event) => this.onStar(e, article)}>${article.starred ? '★' : '☆'}</button>`;
    }

    private renderTitleLink(article: Article, link: string | undefined, cls: string) {
        if (link) return html`<a class=${cls} href=${link} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${article.title}</a>`;
        return html`<span class=${cls}>${article.title}</span>`;
    }

    private renderMeta(feedTitle: string | undefined, article: Article) {
        return html`
              ${feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
              <span>${domainOf(article.link)}</span>
              <span>${formatDate(article.published)}</span>
              ${article.author ? html`<span>by ${article.author}</span>` : ''}`;
    }

    private renderDetailed(article: Article, feeds: Feed[]) {
        const feedTitle = feeds.find((f) => f.id === article.feedId)?.title;
        const link = safeHttpUrl(article.link);
        const image = articleImage(article);
        return html`
      <div class="row ${article.read ? 'read' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)} @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}>
        <div class="detail-body">
          ${image ? html`<img class="detail-img" src=${image} alt="" loading="lazy" />` : ''}
          <div class="detail-text">
            <div class="row-top">${this.renderUnread(article)}${this.renderTitleLink(article, link, 'title title-link')}${this.renderStarBtn(article)}</div>
            <div class="meta">${this.renderMeta(feedTitle, article)}</div>
            ${article.summary ? html`<div class="summary">${article.summary}</div>` : ''}
          </div>
        </div>
      </div>`;
    }

    private renderHeadline(article: Article, feeds: Feed[]) {
        const feedTitle = feeds.find((f) => f.id === article.feedId)?.title;
        const link = safeHttpUrl(article.link);
        return html`
      <div class="row headline ${article.read ? 'read' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)} @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}>
        <div class="row-top">${this.renderUnread(article)}${feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}${this.renderTitleLink(article, link, 'title title-link')}<span class="headline-date">${formatDate(article.published)}</span>${this.renderStarBtn(article)}</div>
      </div>`;
    }

    private renderCard(article: Article, feeds: Feed[]) {
        const feedTitle = feeds.find((f) => f.id === article.feedId)?.title;
        const link = safeHttpUrl(article.link);
        const image = articleImage(article);
        return html`
      <div class="grid-card ${article.read ? 'read' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)} @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}>
        ${image ? html`<lazy-img class="grid-card-img" .src=${image}></lazy-img>` : html`<div class="grid-card-img grid-card-img-empty"></div>`}
        <div class="grid-card-body">
          <div class="grid-card-title-row">${this.renderUnread(article)}${this.renderTitleLink(article, link, 'grid-card-title')}${this.renderStarBtn(article)}</div>
          ${article.summary ? html`<div class="grid-card-summary">${article.summary}</div>` : ''}
          <div class="meta">${this.renderMeta(feedTitle, article)}</div>
        </div>
      </div>`;
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
        // Chain the refetch after the write so it can't win the race and
        // re-show the old star state.
        void toggleStar(article.id, starred).then(() =>
            queryClient.invalidateQueries({queryKey: ['today']}),
        );
        window.dispatchEvent(
            new CustomEvent('article-starred', {detail: {id: article.id, starred}}),
        );
    }

    /** The articles actually on screen after exclusions, per-folder caps,
     *  and unread-only — same set in j/k order. A feed in two folders lands
     *  in both sections; dedupe so each article counts once. */
    private visibleArticles(
        articles = this.articles.data ?? [],
        feeds = this.library.data?.feeds ?? [],
        folders = this.library.data?.folders ?? [],
        settings = pruneTodaySettings(this.settings, folders.map((f) => f.id)),
    ): Article[] {
        const sections = buildTodaySections(
            articles,
            feeds,
            folders,
            settings.excludedFolderIds,
            settings.perFolder,
            settings.unreadOnly,
        );
        const seen = new Set<string>();
        return sections.flatMap((s) => s.articles).filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    }

    private async onMarkShownRead() {
        const ids = this.visibleArticles().filter((a) => a.read === 0).map((a) => a.id);
        if (!ids.length) return;
        await markShownRead(ids);
        await queryClient.invalidateQueries({queryKey: ['today']});
    }

    private openArticle(article: Article) {
        if (article.read === 0) {
            // Chain the query refresh after the write so a refetch can't win
            // the race and re-show the article as unread.
            void markArticleRead(article.id).then(() =>
                queryClient.invalidateQueries({queryKey: ['today']}),
            );
        }
        const items = this.visibleArticles();
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
        'today-view': TodayView;
    }
}
