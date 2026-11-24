import { fetchArticlesPage } from '../../services/api';
import { fetchLibrary } from '../../query';
import { fetchArticleExcerpt } from '../../services/api-excerpts';
import { safeHttpUrl } from '../../services/parser';
import { articleImage, cardPlaceholderStyle } from '../../services/image';
import { articleVideo, watchUrlFor } from '../../services/video';
import { markShownRead, toggleStar } from '../../mutations';
import { domainOf, formatDate, readMinutes } from '../../util';
import {
    loadTodaySettings,
    pruneTodaySettings,
    saveTodaySettings,
    type TodayListView,
    type TodaySettings,
} from '../../services/today-settings';
import { buildTodaySections, type TodaySection } from '../../services/today';
import '../lazy-img/lazy-img';
import '../video-header/video-header';
import type { Article, Feed, Folder } from '../../types';
import { el } from './today-view-dom';
import styles from './today-view.css?inline';

function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Today's Feedly-shaped view: one capped section per folder, newest first. */
export class TodayView extends HTMLElement {
    private articles: Article[] = [];
    private folders: Folder[] = [];
    private feeds: Feed[] = [];
    private settings: TodaySettings = loadTodaySettings();
    private today = startOfToday();
    private loading = true;
    private failed = false;
    private root: HTMLDivElement | null = null;
    private midnightTimer: number | null = null;
    private generation = 0;

    connectedCallback(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = el('div', 'view');
        shadow.appendChild(this.root);
        window.addEventListener('today-settings-changed', this.onSettingsChanged);
        window.addEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.addEventListener('article-read', this.onDataChanged);
        window.addEventListener('article-starred', this.onDataChanged);
        this.scheduleMidnightRollover();
        void this.load();
    }

    disconnectedCallback(): void {
        this.generation++;
        if (this.midnightTimer !== null) window.clearTimeout(this.midnightTimer);
        this.midnightTimer = null;
        window.removeEventListener('today-settings-changed', this.onSettingsChanged);
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.removeEventListener('article-read', this.onDataChanged);
        window.removeEventListener('article-starred', this.onDataChanged);
    }

    private onSettingsChanged = (): void => {
        const stored = loadTodaySettings();
        // Only prune when folders are known; pruning against [] during the
        // first load would drop exclusions the reader just set in the menu.
        this.settings = this.folders.length
            ? pruneTodaySettings(
                  stored,
                  this.folders.map((f) => f.id),
              )
            : stored;
        this.paint();
    };

    private onFeedsRefreshed = (): void => {
        void this.load();
    };

    private onDataChanged = (): void => {
        void this.load();
    };

    private scheduleMidnightRollover(): void {
        if (this.midnightTimer !== null) window.clearTimeout(this.midnightTimer);
        const now = new Date();
        const next = new Date(now);
        next.setHours(24, 0, 1, 0);
        this.midnightTimer = window.setTimeout(() => {
            this.midnightTimer = null;
            const today = startOfToday();
            if (today.getTime() !== this.today.getTime()) {
                this.today = today;
                void this.load();
            }
            if (this.isConnected) this.scheduleMidnightRollover();
        }, next.getTime() - now.getTime());
    }

    private async load(): Promise<void> {
        const gen = ++this.generation;
        this.loading = true;
        this.failed = false;
        this.paint();
        try {
            const [library, page] = await Promise.all([
                fetchLibrary(),
                fetchArticlesPage({ since: this.today.getTime(), sort: 'newest', limit: 10_000 }),
            ]);
            if (gen !== this.generation || !this.isConnected) return;
            this.folders = library.folders;
            this.feeds = library.feeds;
            this.articles = page.items;
            this.settings = pruneTodaySettings(
                loadTodaySettings(),
                this.folders.map((f) => f.id),
            );
        } catch {
            if (gen !== this.generation || !this.isConnected) return;
            this.failed = true;
            this.articles = [];
        }
        this.loading = false;
        this.paint();
    }

    private sections(): TodaySection[] {
        return buildTodaySections(
            this.articles,
            this.feeds,
            this.folders,
            this.settings.excludedFolderIds,
            this.settings.perFolder,
            this.settings.unreadOnly,
        );
    }

    /** Same visible set as j/k navigation: dedupe a feed shared by folders. */
    private visibleArticles(): Article[] {
        const seen = new Set<string>();
        const out: Article[] = [];
        for (const section of this.sections()) {
            for (const article of section.articles) {
                if (seen.has(article.id)) continue;
                seen.add(article.id);
                out.push(article);
            }
        }
        return out;
    }

    private persist(next: TodaySettings): void {
        this.settings = next;
        saveTodaySettings(next);
        window.dispatchEvent(new CustomEvent('today-settings-changed'));
    }

    private openArticle(article: Article): void {
        const items = this.visibleArticles();
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: {
                    article,
                    index: items.findIndex((a) => a.id === article.id),
                    items,
                },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private onStar(e: Event, article: Article): void {
        e.stopPropagation();
        const starred = !article.starred;
        void toggleStar(article.id, starred).then(() => this.load());
        window.dispatchEvent(new CustomEvent('article-starred', { detail: { id: article.id, starred } }));
    }

    private async onMarkShownRead(): Promise<void> {
        const ids = this.visibleArticles()
            .filter((a) => a.read === 0)
            .map((a) => a.id);
        if (!ids.length) return;
        const ok = await markShownRead(ids);
        if (!ok || !this.isConnected) return;
        await this.load();
        this.scrollTo({ top: 0, behavior: 'auto' });
    }

    private paint(): void {
        if (!this.root) return;
        const toolbar = el('div', 'toolbar');
        toolbar.appendChild(el('h2', undefined, 'Today'));
        toolbar.appendChild(
            el('span', 'date', this.today.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })),
        );
        const unreadLabel = el('label', 'unread-toggle');
        const unreadBox = el('input');
        unreadBox.type = 'checkbox';
        unreadBox.checked = this.settings.unreadOnly;
        unreadBox.addEventListener('change', () => this.persist({ ...this.settings, unreadOnly: unreadBox.checked }));
        unreadLabel.appendChild(unreadBox);
        unreadLabel.appendChild(document.createTextNode(' Unread only'));
        toolbar.appendChild(unreadLabel);
        const viewLabel = el('label', 'view-mode');
        const select = el('select');
        for (const entry of [
            { value: 'medium', label: 'Medium' },
            { value: 'detailed', label: 'Detailed List' },
            { value: 'headline', label: 'Headline View' },
            { value: 'cards', label: 'Cards' },
        ]) {
            const option = el('option', undefined, entry.label);
            option.value = entry.value;
            select.appendChild(option);
        }
        select.value = this.settings.listView;
        select.addEventListener('change', () =>
            this.persist({ ...this.settings, listView: select.value as TodayListView }),
        );
        viewLabel.appendChild(select);
        toolbar.appendChild(viewLabel);
        const mark = el('button', 'btn', 'Mark shown as read');
        mark.disabled = this.visibleArticles().every((a) => a.read !== 0);
        mark.addEventListener('click', () => void this.onMarkShownRead());
        toolbar.appendChild(mark);

        const body = el('div', `body ${this.settings.listView}`);
        body.tabIndex = 0;
        const content = this.bodyContent();
        if (content) body.appendChild(content);
        const markEnd = el('div', 'mark-end');
        const endBtn = el('button', 'mark-end-btn', 'Mark shown as read');
        endBtn.disabled = mark.disabled;
        endBtn.addEventListener('click', () => void this.onMarkShownRead());
        markEnd.appendChild(endBtn);
        body.appendChild(markEnd);

        this.root.replaceChildren(toolbar, body);
    }

    private bodyContent(): HTMLElement | null {
        if (this.failed) return el('div', 'empty', "Could not load today's articles.");
        if (this.loading) return el('div', 'empty', 'Loading…');
        if (!this.folders.length) return el('div', 'empty', 'No folders yet. Import an OPML file to create some.');
        if (this.settings.excludedFolderIds.length === this.folders.length) {
            return el('div', 'empty', "All folders are hidden. Tick some back on in Today's ⋯ menu in the sidebar.");
        }
        const sections = this.sections();
        if (!sections.length) {
            return el(
                'div',
                'empty',
                this.settings.unreadOnly
                    ? 'Nothing unread today in these folders.'
                    : 'Nothing published today in these folders yet. Hit Refresh to sync.',
            );
        }
        const wrap = el('div', 'sections');
        for (const section of sections) wrap.appendChild(this.section(section));
        return wrap;
    }

    private section(section: TodaySection): HTMLElement {
        const out = el('section', 'today-section');
        out.appendChild(el('h3', 'section-head', section.folder.title));
        const list = el('div', `section-articles ${this.settings.listView}`);
        for (const article of section.articles) {
            list.appendChild(this.item(article, this.settings.listView));
        }
        out.appendChild(list);
        return out;
    }

    private item(article: Article, view: TodayListView): HTMLElement {
        if (view === 'medium') return this.medium(article);
        if (view === 'cards') return this.card(article);
        if (view === 'headline') return this.headline(article);
        return this.detailed(article);
    }

    private unreadDot(article: Article): HTMLElement | null {
        return article.read === 0 ? el('span', 'unread-dot') : null;
    }

    private titleButton(article: Article, className: string): HTMLElement {
        const button = el('button', `${className} title-open`, article.title);
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openArticle(article);
        });
        return button;
    }

    private starButton(article: Article): HTMLElement {
        const button = el('button', 'star', article.starred ? '★' : '☆');
        button.setAttribute('aria-label', article.starred ? 'Unstar' : 'Star');
        button.addEventListener('click', (e) => this.onStar(e, article));
        return button;
    }

    private meta(article: Article): HTMLElement {
        const row = el('div', 'meta');
        const feed = this.feeds.find((f) => f.id === article.feedId);
        if (feed) row.appendChild(el('span', 'feed-label', feed.title));
        row.appendChild(el('span', undefined, domainOf(article.link)));
        row.appendChild(el('span', undefined, formatDate(article.published)));
        if (article.author) row.appendChild(el('span', undefined, `by ${article.author}`));
        const link = safeHttpUrl(article.link);
        if (link) {
            const a = el('a', 'orig-link', 'original ↗');
            a.href = link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            row.appendChild(a);
        }
        return row;
    }

    /** pointer-only: the row body opens on pointer; the title button is the keyboard path. */
    private medium(article: Article): HTMLElement {
        const row = el('article', `medium-row ${article.read ? 'read' : ''}`);
        row.addEventListener('click', () => this.openArticle(article));
        const copy = el('div', 'medium-copy');
        const eyebrow = el('div', 'medium-eyebrow');
        const dot = this.unreadDot(article);
        if (dot) eyebrow.appendChild(dot);
        const feed = this.feeds.find((f) => f.id === article.feedId);
        if (feed) eyebrow.appendChild(el('span', 'feed-label', feed.title));
        eyebrow.appendChild(el('span', undefined, domainOf(article.link)));
        eyebrow.appendChild(el('span', undefined, formatDate(article.published)));
        const top = el('div', 'medium-top');
        top.appendChild(this.titleButton(article, 'medium-title'));
        copy.appendChild(eyebrow);
        copy.appendChild(top);
        if (article.summary) copy.appendChild(el('p', 'medium-summary', article.summary));
        const footer = el('div', 'medium-footer');
        const minutes = readMinutes(article.content, article.summary);
        if (minutes > 0) footer.appendChild(el('span', 'read-time', `${minutes} min read`));
        const link = safeHttpUrl(article.link);
        if (link) {
            const a = el('a', 'orig-link', 'original ↗');
            a.href = link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.addEventListener('click', (e) => e.stopPropagation());
            footer.appendChild(a);
        }
        footer.appendChild(this.starButton(article));
        copy.appendChild(footer);
        row.appendChild(copy);
        const media = el('div', 'medium-media');
        const image = articleImage(article, feed?.icon);
        if (image) {
            const lazy = document.createElement('lazy-img') as HTMLElement & { src: string };
            lazy.className = 'medium-img';
            lazy.src = image;
            media.appendChild(lazy);
        } else {
            const empty = el('div', 'medium-img medium-img-empty');
            empty.setAttribute('style', cardPlaceholderStyle(article));
            media.appendChild(empty);
        }
        row.appendChild(media);
        if (article.summary || article.content) {
            const expand = el('button', 'expand-handle', '⌄');
            expand.type = 'button';
            expand.setAttribute('aria-label', 'Show more');
            expand.setAttribute('aria-expanded', 'false');
            expand.addEventListener('click', (e) => {
                e.stopPropagation();
                const expanded = row.classList.toggle('expanded');
                expand.textContent = expanded ? '⌃' : '⌄';
                expand.setAttribute('aria-label', expanded ? 'Show less' : 'Show more');
                expand.setAttribute('aria-expanded', String(expanded));
            });
            row.appendChild(expand);
        }
        if (!article.summary) void this.excerptInto(copy, article, 'row-excerpt medium-excerpt');
        return row;
    }

    /** pointer-only: the row body opens on pointer; the title button is the keyboard path. */
    private detailed(article: Article): HTMLElement {
        const row = el('div', `row ${article.read ? 'read' : ''}`);
        row.addEventListener('click', () => this.openArticle(article));
        const body = el('div', 'detail-body');
        const image = articleImage(article);
        if (image) {
            const img = el('img', 'detail-img');
            img.src = image;
            img.alt = '';
            img.loading = 'lazy';
            body.appendChild(img);
        }
        const text = el('div', 'detail-text');
        const top = el('div', 'row-top');
        const dot = this.unreadDot(article);
        if (dot) top.appendChild(dot);
        top.appendChild(this.titleButton(article, 'title'));
        top.appendChild(this.starButton(article));
        text.appendChild(top);
        text.appendChild(this.meta(article));
        if (article.summary) text.appendChild(el('div', 'summary', article.summary));
        body.appendChild(text);
        row.appendChild(body);
        void this.excerptInto(row, article);
        return row;
    }

    /** pointer-only: the row body opens on pointer; the title button is the keyboard path. */
    private headline(article: Article): HTMLElement {
        const row = el('div', `row headline ${article.read ? 'read' : ''}`);
        row.addEventListener('click', () => this.openArticle(article));
        const top = el('div', 'row-top');
        const dot = this.unreadDot(article);
        if (dot) top.appendChild(dot);
        const feed = this.feeds.find((f) => f.id === article.feedId);
        if (feed) top.appendChild(el('span', 'feed-label', feed.title));
        top.appendChild(this.titleButton(article, 'title'));
        top.appendChild(el('span', 'headline-date', formatDate(article.published)));
        top.appendChild(this.starButton(article));
        row.appendChild(top);
        return row;
    }

    /** pointer-only: the card body opens on pointer; the title button is the keyboard path. */
    private card(article: Article): HTMLElement {
        const card = el('div', `grid-card ${article.read ? 'read' : ''}`);
        card.addEventListener('click', () => this.openArticle(article));
        const media = el('div', 'grid-card-media');
        const video = articleVideo(article);
        const link = safeHttpUrl(article.link);
        if (video) {
            const header = document.createElement('video-header') as HTMLElement & {
                video: typeof video;
                videoTitle: string;
                videoLink: string | undefined;
            };
            header.className = 'grid-card-img';
            header.video = video;
            header.videoTitle = article.title;
            header.videoLink = watchUrlFor(video, link);
            media.appendChild(header);
        } else {
            const feed = this.feeds.find((f) => f.id === article.feedId);
            const image = articleImage(article, feed?.icon);
            if (image) {
                const lazy = document.createElement('lazy-img') as HTMLElement & { src: string };
                lazy.className = 'grid-card-img';
                lazy.src = image;
                media.appendChild(lazy);
            } else {
                const empty = el('div', 'grid-card-img grid-card-img-empty');
                empty.setAttribute('style', cardPlaceholderStyle(article));
                media.appendChild(empty);
            }
        }
        card.appendChild(media);
        const body = el('div', 'grid-card-body');
        const titleRow = el('div', 'grid-card-title-row');
        const dot = this.unreadDot(article);
        if (dot) titleRow.appendChild(dot);
        titleRow.appendChild(this.titleButton(article, 'grid-card-title'));
        titleRow.appendChild(this.starButton(article));
        body.appendChild(titleRow);
        if (article.summary) body.appendChild(el('div', 'grid-card-summary', article.summary));
        body.appendChild(this.meta(article));
        card.appendChild(body);
        void this.excerptInto(card, article);
        return card;
    }

    private async excerptInto(host: HTMLElement, article: Article, className = 'row-excerpt'): Promise<void> {
        const gen = this.generation;
        try {
            const text = await fetchArticleExcerpt(article.id);
            if (gen !== this.generation || !this.isConnected || !text) return;
            host.appendChild(el('div', className, text));
        } catch {
            // Excerpt is optional; the row keeps its compact shape.
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'today-view': TodayView;
    }
}

customElements.define('today-view', TodayView);
