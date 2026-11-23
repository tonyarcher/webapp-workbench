import type { Virtualizer } from '@tanstack/virtual-core';
import { topWords } from '../../services/interesting-words';
import { interestingWordMapOf } from './article-list-interesting';
import type { ArticleSort, ListViewType } from '../../types';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import { append, el } from './article-list-dom';
import type { ArticleListRenderHost } from './article-list-render';
import { renderCardRow, renderHeadlineRow, renderRow } from './article-list-render-rows';

type VirtualItems = ReturnType<Virtualizer<HTMLDivElement, HTMLDivElement>['getVirtualItems']>;

export function renderToolbar(host: ArticleListRenderHost): HTMLElement {
    const toolbar = el('div', 'toolbar');
    toolbar.appendChild(el('h2', undefined, host.viewTitle()));
    const actions = el('div', 'actions');
    const freshness = renderFreshness(host);
    if (freshness) actions.appendChild(freshness);
    actions.appendChild(
        labeledSelect(
            'sort',
            'Sort articles',
            host.sort,
            [
                ['hot', 'Hot'],
                ['newest', 'Newest'],
                ['oldest', 'Oldest'],
            ] as Array<[string, string]>,
            (e) => {
                host.sort = (e.target as HTMLSelectElement).value as ArticleSort;
                host.saveViewSettings();
            },
        ),
    );
    actions.appendChild(
        labeledSelect(
            'view-mode',
            'List view',
            host.listView,
            [
                ['detailed', 'Detailed List'],
                ['headline', 'Headline View'],
                ['cards', 'Cards'],
                ['slideshow', 'Slideshow'],
            ] as Array<[string, string]>,
            (e) => {
                host.listView = (e.target as HTMLSelectElement).value as ListViewType;
                host.saveViewSettings();
            },
        ),
    );
    if (host.listView === 'cards') {
        const select = labeledSelect(
            'view-mode',
            null,
            host.maxCardCols,
            [
                ['2', '2 cols'],
                ['3', '3 cols'],
                ['4', '4 cols'],
                ['5', '5 cols'],
                ['6', '6 cols'],
            ] as Array<[string, string]>,
            (e) => {
                host.maxCardCols = Number((e.target as HTMLSelectElement).value);
                host.saveViewSettings();
                host.updateCols();
            },
        );
        select.title = 'Maximum card columns';
        actions.appendChild(select);
    }
    const pageSize = labeledSelect(
        'page-size',
        null,
        host.pageSize,
        [
            ['5', '5'],
            ['10', '10'],
            ['20', '20'],
            ['50', '50'],
            ['100', '100'],
            ['500', '500'],
        ] as Array<[string, string]>,
        (e) => {
            host.pageSize = Number((e.target as HTMLSelectElement).value);
            host.saveViewSettings();
        },
    );
    pageSize.title = 'Articles shown at a time';
    actions.appendChild(pageSize);
    actions.appendChild(actionButton('btn', 'Mark shown as read', host.onMarkShownRead.bind(host)));
    actions.appendChild(actionButton('btn', 'Catch me up (5 min)', host.onCatchMeUp.bind(host)));
    actions.appendChild(actionButton('btn', 'Advanced', host.onToggleAdvanced.bind(host)));
    const refresh = el('button', 'btn refresh');
    if (host.refreshing) {
        const spinner = el('span', 'spinner');
        spinner.setAttribute('aria-hidden', 'true');
        refresh.appendChild(spinner);
        refresh.appendChild(document.createTextNode('Refreshing…'));
    } else {
        refresh.textContent = 'Refresh';
    }
    refresh.addEventListener('click', host.onRefresh.bind(host));
    actions.appendChild(refresh);
    toolbar.appendChild(actions);
    return toolbar;
}

function actionButton(className: string, text: string, onClick: EventListener): HTMLButtonElement {
    const button = el('button', className, text);
    button.addEventListener('click', onClick);
    return button;
}

function labeledSelect(
    className: string,
    ariaLabel: string | null,
    value: string | number,
    options: Array<[string, string]>,
    onChange: (e: Event) => void,
): HTMLElement {
    const label = el('label', className);
    const select = document.createElement('select');
    if (ariaLabel !== null) select.setAttribute('aria-label', ariaLabel);
    for (const [val, text] of options) {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = text;
        select.appendChild(option);
    }
    select.value = String(value);
    select.addEventListener('change', onChange);
    label.appendChild(select);
    return label;
}

/** "Updated 2m ago" — empty until a feed reports a fetch. */
function renderFreshness(host: ArticleListRenderHost): HTMLElement | null {
    const label = host.freshnessLabel();
    if (!label) return null;
    return el('span', 'freshness', label);
}

export function renderInterestingHint(host: ArticleListRenderHost): HTMLElement | null {
    if (!host.interestingActive()) return null;
    const strictness = host.interestingStrictness ?? 50;
    const words = topWords(interestingWordMapOf(host.items), 3);
    const hint = !words.length
        ? 'Star articles to teach this filter.'
        : `✨ ${words.map((w) => `${w.word} · ${w.score}`).join(', ')} · showing ${host.items.length}`;
    const bar = el('div', 'interesting-bar');
    const label = el('label', 'interesting-selectivity');
    label.appendChild(el('span', undefined, 'Selectivity'));
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '5';
    range.value = String(strictness);
    range.setAttribute('aria-label', 'Interesting selectivity');
    range.title = 'Higher hides more; lower shows more';
    range.addEventListener('change', host.onInterestingStrictness.bind(host));
    label.appendChild(range);
    bar.appendChild(label);
    const text = el('div', 'interesting-hint', hint);
    text.title = 'Top learned words';
    bar.appendChild(text);
    return bar;
}

export function renderAdvancedMenu(host: ArticleListRenderHost, existing?: Node): HTMLElement {
    const menu =
        existing instanceof HTMLElement && existing.localName === 'advanced-menu'
            ? existing
            : document.createElement('advanced-menu');
    (menu as unknown as { open: boolean }).open = host.advancedOpen;
    (menu as unknown as { anchor: MenuAnchor | null }).anchor = host.advancedAnchor;
    // Interesting uses client-side hideRead; server-side unreadOnly starves the batch.
    (menu as unknown as { unreadOnly: boolean }).unreadOnly = host.interestingActive()
        ? host.hideRead
        : host.unreadOnly;
    (menu as unknown as { hideUnread: boolean }).hideUnread = host.interestingActive();
    (menu as unknown as { markOnScroll: boolean }).markOnScroll = host.markOnScroll;
    (menu as unknown as { marking: boolean }).marking = host.marking;
    (menu as unknown as { scopeLabel: string }).scopeLabel = host.scopeLabel();
    if (menu !== existing) {
        menu.addEventListener('unread-change', host.onAdvancedUnread.bind(host));
        menu.addEventListener('mark-scroll-change', host.onAdvancedMarkScroll.bind(host));
        menu.addEventListener('mark-before', host.onMarkBefore.bind(host));
        menu.addEventListener('apply-all', () => host.onApplyAllViews());
        menu.addEventListener('close', () => {
            host.advancedOpen = false;
        });
    }
    return menu;
}

/** Last page-load failure, rendered as a banner rather than an empty list. */
export function renderLoadError(host: ArticleListRenderHost): HTMLElement | null {
    if (!host.loadError) return null;
    const banner = el('div', 'load-error');
    banner.setAttribute('role', 'alert');
    banner.appendChild(document.createTextNode(host.loadError));
    banner.appendChild(document.createTextNode(' '));
    banner.appendChild(actionButton('btn', 'Retry', host.onRetryArticles.bind(host)));
    return banner;
}

/** Fill the stable scroll container. The element itself is created once by the component. */
export function renderScroll(
    host: ArticleListRenderHost,
    virtualItems: VirtualItems,
    showFeed: boolean,
    scrollEl: HTMLDivElement,
): void {
    scrollEl.style.setProperty('--cols', String(host.cols));
    const viewport = el('div', 'viewport');
    viewport.style.height = `${host.virtualizer?.getTotalSize() ?? 0}px`;
    append(viewport, ...renderVirtualRows(host, virtualItems, showFeed));
    scrollEl.replaceChildren(viewport, ...renderScrollFooter(host).filter((n): n is Node => n !== null));
}

function renderVirtualRows(
    host: ArticleListRenderHost,
    virtualItems: VirtualItems,
    showFeed: boolean,
): Array<Node | null> {
    if (host.listView === 'cards') return virtualItems.map((vi) => renderCardVirtualRow(host, vi, showFeed));
    return virtualItems.map((vi) => renderListVirtualRow(host, vi, showFeed));
}

function renderCardVirtualRow(
    host: ArticleListRenderHost,
    vi: { index: number; start: number },
    showFeed: boolean,
): HTMLElement | null {
    const start = vi.index * host.cols;
    const rowItems = host.items.slice(start, start + host.cols);
    if (!rowItems.length) return null;
    const row = el('div', 'row cards');
    row.setAttribute('data-row', String(vi.index));
    // The virtualizer measures rows by data-index; without it every card row
    // falls back to the estimate and taller cards overlap the next row.
    row.setAttribute('data-index', String(vi.index));
    row.style.transform = `translateY(${vi.start}px)`;
    for (let c = 0; c < rowItems.length; c += 1) {
        const article = rowItems[c];
        if (article) row.appendChild(renderCardRow(host, article, showFeed, start + c));
    }
    return row;
}

export function renderSelectionBar(host: ArticleListRenderHost): HTMLElement | null {
    if (!host.selectedIds.length) return null;
    const bar = el('div', 'selection-bar');
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Bulk actions');
    bar.appendChild(el('span', 'selection-count', `${host.selectedIds.length} selected`));
    bar.appendChild(actionButton('btn', 'Mark read', host.onBulkMarkRead.bind(host)));
    bar.appendChild(actionButton('btn', 'Star', host.onBulkStar.bind(host)));
    bar.appendChild(actionButton('btn', 'Not interesting', host.onBulkDerank.bind(host)));
    bar.appendChild(actionButton('btn', 'Clear', host.clearSelection.bind(host)));
    return bar;
}

function renderListVirtualRow(
    host: ArticleListRenderHost,
    vi: { index: number; start: number },
    showFeed: boolean,
): HTMLElement | null {
    const article = host.items[vi.index];
    if (!article) return null;
    const picked = host.selectedIds.includes(article.id);
    // pointer-only: the row body opens the article on pointer; keyboard users open it
    // with the title button. Shift+click selects a range.
    const row = el(
        'div',
        `row ${host.listView === 'headline' ? 'headline' : ''} ${article.read ? 'read' : ''} ${
            vi.index === host.cursor ? 'selected' : ''
        } ${picked ? 'picked' : ''}`,
    );
    row.setAttribute('data-index', String(vi.index));
    row.style.transform = `translateY(${vi.start}px)`;
    row.addEventListener('click', (e: MouseEvent) => host.onRowClick(e, vi.index));
    const content =
        host.listView === 'headline'
            ? renderHeadlineRow(host, article, showFeed, vi.index)
            : renderRow(host, article, showFeed, vi.index);
    append(row, content);
    return row;
}

function renderScrollFooter(host: ArticleListRenderHost): Array<Node | null> {
    const undo = host.mutedHidden > 0 && host.canUndoMute();
    const mutedNote =
        !host.loading && host.mutedHidden > 0
            ? el(
                  'p',
                  'empty-note',
                  `${host.mutedHidden} article${host.mutedHidden === 1 ? '' : 's'} hidden by mute filters.`,
              )
            : null;
    const undoBtn =
        !host.loading && undo
            ? (() => {
                  const p = el('p', 'empty-note');
                  p.appendChild(actionButton('btn', 'Undo mute change', () => host.onUndoMute()));
                  return p;
              })()
            : null;
    const nodes: Array<Node | null> = [];
    if (host.loading) nodes.push(el('div', 'end', 'Loading…'));
    if (!host.loading && host.items.length) {
        const markEnd = el('div', 'mark-end');
        const markBtn = el('button', 'mark-end-btn', 'Mark shown as read');
        markBtn.disabled = !host.items.some((a) => a.read === 0);
        markBtn.addEventListener('click', host.onMarkShownRead.bind(host));
        markEnd.appendChild(markBtn);
        nodes.push(markEnd);
    }
    if (!host.loading && !host.items.length) {
        const empty = el('div', 'empty');
        empty.appendChild(el('p', undefined, emptyText(host)));
        append(empty, mutedNote, undoBtn);
        nodes.push(empty);
    }
    if (host.library.error && host.view.kind !== 'feed') {
        const empty = el('div', 'empty');
        empty.appendChild(document.createTextNode('Could not load your feeds. '));
        empty.appendChild(actionButton('btn', 'Retry', host.onRetryLibrary.bind(host)));
        nodes.push(empty);
    }
    return nodes;
}

function emptyText(host: ArticleListRenderHost): string {
    if (!host.interestingActive())
        return emptyTextFor(host.unreadOnly, host.hideRead, false, false, host.mutedHidden, host.canUndoMute());
    if (host.unreadOnly || host.hideRead)
        return emptyTextFor(host.unreadOnly, host.hideRead, true, false, host.mutedHidden, host.canUndoMute());
    const learned = Object.keys(interestingWordMapOf(host.items)).length > 0;
    return emptyTextFor(false, false, true, learned, host.mutedHidden, host.canUndoMute());
}

/**
 * Pure empty-state copy so the two unread filters cannot be confused: the
 * "just marked as read" case names itself instead of blaming "Unread only".
 */
export function emptyTextFor(
    unreadOnly: boolean,
    hideRead: boolean,
    interesting: boolean,
    hasSignal = false,
    mutedHidden = 0,
    canUndoMute = false,
): string {
    if (mutedHidden > 0 && canUndoMute) {
        return interesting
            ? 'All matching articles are hidden by your latest mute filter.'
            : 'All articles in this view are hidden by your latest mute filter.';
    }
    if (hideRead && !unreadOnly) return 'Nothing unread here — the shown articles were just marked as read.';
    if (unreadOnly || hideRead) return 'Nothing unread here — "Unread only" is filtering this view.';
    if (interesting && hasSignal) return 'Nothing meets this selectivity — lower it to see more.';
    if (interesting) return 'Nothing here yet. Star articles to teach this view what you like.';
    if (mutedHidden > 0) return 'No articles to show here.';
    return 'No articles yet. Hit Refresh to sync this view.';
}
