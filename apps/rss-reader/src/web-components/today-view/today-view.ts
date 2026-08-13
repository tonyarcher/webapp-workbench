import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {libraryKey, queryClient, QueryController} from '../../query';
import {getFeeds, getFolders, queryTodayArticles} from '../../db/db';
import {markArticleRead, toggleStar} from '../../mutations';
import {safeHttpUrl} from '../../services/parser';
import {loadTodaySettings, pruneTodaySettings, type TodaySettings} from '../../services/today-settings';
import {buildTodaySections} from '../../services/today';
import type {Article, Feed, Folder} from '../../types';
import {domainOf, formatDate} from '../../util';
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
        queryFn: async () => {
            const [folders, feeds] = await Promise.all([getFolders(), getFeeds()]);
            return {folders, feeds};
        },
    }));

    private articles = new QueryController<Article[]>(this, () => ({
        queryKey: ['today', this.startOfToday.toDateString()],
        queryFn: () => queryTodayArticles(this.startOfToday.getTime()),
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

    override render() {
        const folders = this.library.data?.folders ?? [];
        const feeds = this.library.data?.feeds ?? [];
        const articles = this.articles.data ?? [];
        const settings = pruneTodaySettings(this.settings, folders.map((f) => f.id));
        const sections = buildTodaySections(
            articles,
            feeds,
            folders,
            settings.excludedFolderIds,
            settings.perFolder,
        );
        const todayLabel = this.startOfToday.toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });

        return html`
      <div class="toolbar">
        <h2>Today</h2>
        <span class="date">${todayLabel}</span>
      </div>

      <div class="body">
        ${this.articles.error
            ? html`<div class="empty" style="color: var(--danger)">Could not load today's articles.</div>`
            : !folders.length
                ? html`<div class="empty">No folders yet. Import an OPML file to create some.</div>`
                : settings.excludedFolderIds.length === folders.length
                    ? html`<div class="empty">All folders are hidden. Tick some back on in Today's ⋯ menu in the sidebar.</div>`
                    : sections.length
                        ? sections.map(
                            (section) => html`
                          <section class="today-section">
                            <h3 class="section-head">${section.folder.title}</h3>
                            <div class="section-articles">
                              ${section.articles.map((a) => this.renderRow(a, feeds))}
                            </div>
                          </section>
                        `,
                        )
                        : html`<div class="empty">Nothing published today in these folders yet. Hit Refresh to sync.</div>`}
      </div>
    `;
    }

    private renderRow(article: Article, feeds: Feed[]) {
        const feedTitle = feeds.find((f) => f.id === article.feedId)?.title;
        const link = safeHttpUrl(article.link);
        return html`
      <div
        class="today-row ${article.read ? 'read' : ''}"
        role="button"
        tabindex="0"
        aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)}
        @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}
      >
        ${article.read === 0 ? html`<span class="dot"></span>` : ''}
        ${link
            ? html`<a
                    class="title title-link"
                    href=${link}
                    target="_blank"
                    rel="noopener noreferrer"
                    @click=${(e: Event) => e.stopPropagation()}
                  >${article.title}</a>`
            : html`<span class="title">${article.title}</span>`}
        <span class="meta">
          ${feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
          <span>${domainOf(article.link)}</span>
          <span>${formatDate(article.published)}</span>
        </span>
        <button class="star" title="Star" @click=${(e: Event) => this.onStar(e, article)}>
          ${article.starred ? '★' : '☆'}
        </button>
      </div>
    `;
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
        void toggleStar(article.id).then(() =>
            queryClient.invalidateQueries({queryKey: ['today']}),
        );
        window.dispatchEvent(
            new CustomEvent('article-starred', {detail: {id: article.id, starred}}),
        );
    }

    private openArticle(article: Article) {
        if (article.read === 0) {
            // Chain the query refresh after the write so a refetch can't win
            // the race and re-show the article as unread.
            void markArticleRead(article.id).then(() =>
                queryClient.invalidateQueries({queryKey: ['today']}),
            );
        }
        const settings = pruneTodaySettings(this.settings, this.library.data?.folders.map((f) => f.id) ?? []);
        const sections = buildTodaySections(
            this.articles.data ?? [],
            this.library.data?.feeds ?? [],
            this.library.data?.folders ?? [],
            settings.excludedFolderIds,
            settings.perFolder,
        );
        // A feed in two folders lands in both sections; dedupe so overlay
        // j/k navigation visits each article once.
        const seen = new Set<string>();
        const items = sections.flatMap((s) => s.articles).filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
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
