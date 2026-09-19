import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {fetchLibrary, interestingKey, libraryKey, queryClient, QueryController} from '../../query';
import {fetchArticlesPage} from '../../services/api';
import {markArticleRead} from '../../mutations';
import {toggleStarAction} from '../article-list/article-list-actions';
import {headlineRowTemplate} from '../article-list/article-list-render';
import {buildWordMap, interestingScore, topWords} from '../../services/interesting-words';
import {isHideReadFolder, loadWordMap, loadWordMapIds} from '../../services/interesting-settings';
import {articleImage} from '../../services/parser';
import type {Article, Feed, Folder} from '../../types';
import '../lazy-img/lazy-img';
import styles from './interesting-view.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

const PAGE_LIMIT = 200;
const TOP_WORDS_SHOWN = 8;

@customElement('interesting-view')
export class InterestingView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) folderId = '';

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    private pages = new QueryController<Article[]>(this, () => ({
        queryKey: interestingKey({folderId: this.folderId, limit: PAGE_LIMIT}),
        queryFn: async () => {
            const res = await fetchArticlesPage({scope: `folder:${this.folderId}`, sort: 'newest', limit: PAGE_LIMIT});
            return res.items;
        },
    }));

    override connectedCallback() {
        super.connectedCallback();
        window.addEventListener('feeds-refreshed', this.onExternalChange);
        window.addEventListener('article-read', this.onExternalChange);
        window.addEventListener('article-starred', this.onExternalChange);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('feeds-refreshed', this.onExternalChange);
        window.removeEventListener('article-read', this.onExternalChange);
        window.removeEventListener('article-starred', this.onExternalChange);
    }

    private onExternalChange = () => {
        void queryClient.invalidateQueries({queryKey: ['interesting']});
    };

    /**
     * Word map for ranking: the cache (every star toggle maintains it) plus
     * fresh weights for page-starred articles the cache has not counted yet
     * (e.g. starred on another device). Counted ids are skipped so a star
     * visible on the page never counts twice.
     */
    private wordMap(): Record<string, number> {
        const cached = loadWordMap();
        const counted = new Set(loadWordMapIds());
        const fresh = (this.pages.data ?? []).filter((a) => a.starred && !counted.has(a.id));
        if (!fresh.length) return cached;
        const extra = buildWordMap(fresh, []);
        const merged: Record<string, number> = {...cached};
        for (const [word, weight] of Object.entries(extra)) merged[word] = (merged[word] ?? 0) + weight;
        return merged;
    }

    private rankedArticles(): Article[] {
        const map = this.wordMap();
        const hideRead = isHideReadFolder(this.folderId);
        return (this.pages.data ?? [])
            .filter((a) => !hideRead || a.read === 0)
            .map((article) => ({article, score: interestingScore(article, map)}))
            .sort((x, y) => y.score - x.score || (x.article.id < y.article.id ? -1 : x.article.id > y.article.id ? 1 : 0))
            .map((entry) => entry.article);
    }

    override render() {
        const folder = this.library.data?.folders.find((f) => f.id === this.folderId);
        const feeds = this.library.data?.feeds ?? [];
        const ranked = this.rankedArticles();
        return html`
      <div class="toolbar">
        <h2>✨ Interesting: ${folder?.title ?? 'Folder'}</h2>
        ${this.renderWords()}
      </div>
      <div class="body">${this.renderBody(ranked, feeds)}</div>`;
    }

    private renderWords() {
        const words = topWords(this.wordMap(), TOP_WORDS_SHOWN);
        if (!words.length) return html`<span class="hint">Star articles to teach this list what you like.</span>`;
        return html`<div class="words" title="Top learned words">${words.map((w) => html`<span class="word">${w.word} · ${w.score}</span>`)}</div>`;
    }

    private renderBody(ranked: Article[], feeds: Feed[]) {
        if (this.pages.error) return html`<div class="empty" style="color: var(--danger)">Could not load interesting articles.</div>`;
        if (this.pages.data === undefined) return html`<div class="empty">Loading…</div>`;
        if (!ranked.length) {
            return html`<div class="empty">${isHideReadFolder(this.folderId) ? 'Nothing unread here — this folder hides read articles.' : 'Nothing here yet. Star a few articles and this list will learn.'}</div>`;
        }
        return html`${ranked.map((a) => this.renderRow(a, feeds))}`;
    }

    private renderRow(article: Article, feeds: Feed[]) {
        const feedTitle = feeds.find((f) => f.id === article.feedId)?.title;
        const image = articleImage(article);
        return html`
      <div class="row ${article.read ? 'read' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)} @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}>
        ${image ? html`<lazy-img class="thumb" .src=${image}></lazy-img>` : ''}
        <div class="row-main">${headlineRowTemplate(article, true, feedTitle, (e, a) => { void this.onStar(e, a); })}</div>
      </div>`;
    }

    private onRowKey(e: KeyboardEvent, article: Article) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        void this.openArticle(article);
    }

    private async onStar(e: Event, article: Article) {
        e.stopPropagation();
        // Write-through host: the shared toggle action paints optimistically
        // into this view's query data (and reverts on failure); the mutation
        // folds the title into the cached word map and refetches after.
        const key = interestingKey({folderId: this.folderId, limit: PAGE_LIMIT});
        const host = {
            get items(): Article[] {
                return (queryClient.getQueryData(key) as Article[] | undefined) ?? [];
            },
            set items(next: Article[]) {
                queryClient.setQueryData(key, next);
            },
        };
        await toggleStarAction(host, article);
    }

    private async openArticle(article: Article) {
        if (article.read === 0) {
            const key = interestingKey({folderId: this.folderId, limit: PAGE_LIMIT});
            const items = ((queryClient.getQueryData(key) as Article[] | undefined) ?? []).map((a) =>
                a.id === article.id ? {...a, read: 1 as const} : a,
            );
            queryClient.setQueryData(key, items);
            if (!(await markArticleRead(article.id))) {
                const reverted = ((queryClient.getQueryData(key) as Article[] | undefined) ?? []).map((a) =>
                    a.id === article.id ? {...a, read: 0 as const} : a,
                );
                queryClient.setQueryData(key, reverted);
            }
        }
        const items = this.rankedArticles();
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
        'interesting-view': InterestingView;
    }
}
