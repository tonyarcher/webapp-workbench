import { LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { fetchSavedArticlesList, savedArticlesKey, QueryController } from '../../query';
import { unsaveForLater } from '../../mutations';
import type { Article, SavedArticleSnapshot } from '../../types';
import { renderSavedView } from './saved-view-render';
import styles from './saved-view.css?inline';

function toArticle(s: SavedArticleSnapshot): Article {
    return {
        id: s.articleId ?? s.id,
        feedId: s.feedId ?? 'saved',
        guid: s.articleId ?? s.id,
        title: s.title,
        link: s.link,
        author: s.author,
        summary: s.summary,
        content: s.content,
        published: s.published ?? s.savedAt,
        fetchedAt: s.savedAt,
        read: 0,
        starred: false,
        popularity: 0,
        hot: 0,
    };
}

@customElement('saved-view')
export class SavedView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private storageEstimate: { usage: number; quota: number } | null = null;

    private saved = new QueryController<SavedArticleSnapshot[]>(this, () => ({
        queryKey: savedArticlesKey,
        queryFn: () => fetchSavedArticlesList(),
        refetchInterval: 60_000,
    }));

    override connectedCallback() {
        super.connectedCallback();
        void this.refreshStorage();
    }

    private async refreshStorage() {
        if (!navigator.storage?.estimate) return;
        const est = await navigator.storage.estimate();
        this.storageEstimate = { usage: est.usage ?? 0, quota: est.quota ?? 0 };
    }

    override render() {
        return renderSavedView({
            items: this.saved.data ?? [],
            error: Boolean(this.saved.error),
            storageEstimate: this.storageEstimate,
            open: (s) => this.open(s),
            remove: (s) => this.removeSaved(s),
            toArticle,
        });
    }

    private open(s: SavedArticleSnapshot) {
        const article = toArticle(s);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: { article, index: 0, items: [article] },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private removeSaved(s: SavedArticleSnapshot) {
        if (!s.articleId) return;
        void unsaveForLater(s.articleId);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'saved-view': SavedView;
    }
}
