import type { Virtualizer } from '@tanstack/virtual-core';
import type { Article, ArticleSort, ListViewType, View } from '../../types';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import type { HighlightHost } from './article-list-render-highlights';

/**
 * State and handlers the vanilla renderers read. The component passes itself
 * (`this as never`, matching article-list-actions.ts).
 */
export interface ArticleListRenderHost extends HighlightHost {
    rowExcerpt(articleId: string): string | null | undefined;
    view: View;
    items: Article[];
    cursor: number;
    cols: number;
    loading: boolean;
    refreshing: boolean;
    unreadOnly: boolean;
    hideRead: boolean;
    markOnScroll: boolean;
    priorityOnly: boolean;
    priorityHidden: number;
    sort: ArticleSort;
    listView: ListViewType;
    slideshowIndex: number;
    maxCardCols: number;
    pageSize: number;
    interestingStrictness: number;
    interestingActive(): boolean;
    loadError: string | null;
    selectedIds: string[];
    savedArticleIds: Set<string>;
    mutedHidden: number;
    canUndoMute(): boolean;
    onUndoMute(): void;
    onRowClick(e: MouseEvent, index: number): void;
    clearSelection(): void;
    onBulkMarkRead(): void;
    onBulkStar(): void;
    onSaveArticle(article: Article): Promise<void>;
    onBulkDerank(): void;
    showShortcuts(): void;
    onRetryArticles(): void;
    freshnessLabel(): string;
    advancedOpen: boolean;
    marking: boolean;
    advancedAnchor: MenuAnchor | null;
    scrollElRef: { value: HTMLDivElement | null };
    virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
    library: { error: Error | undefined };
    viewTitle(): string;
    scopeLabel(): string;
    feedTitle(feedId: string): string | undefined;
    feedIcon(feedId: string): string | undefined;
    updateCols(): void;
    saveViewSettings(): void;
    openArticle(article: Article): Promise<void>;
    onStar(e: Event, article: Article): Promise<void>;
    onMarkShownRead(): Promise<void>;
    catchUpBudget: number;
    reset(): Promise<void>;
    onToggleAdvanced(e: Event): void;
    onSearchQuery(q: string): void;
    onSearchScope(scope: string): void;
    searchScope: string;
    onRefresh(): Promise<void>;
    onAdvancedUnread(e: Event): void;
    onAdvancedMarkScroll(e: Event): void;
    onApplyAllViews(): void;
    onMarkBefore(e: Event): Promise<void>;
    onRetryLibrary(): void;
    onScroll(): void;
    onInterestingStrictness(e: Event): void;
}

export { detailRowTemplate, headlineRowTemplate, cardRowTemplate } from './article-list-render-rows';
export {
    renderToolbar,
    renderInterestingHint,
    renderAdvancedMenu,
    renderLoadError,
    renderScroll,
    renderSelectionBar,
    emptyTextFor,
} from './article-list-render-chrome';
