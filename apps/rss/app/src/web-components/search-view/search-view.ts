import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { libraryKey, queryClient, QueryController, fetchLibrary } from '../../query';
import { history, navigate, parsePath } from '../../router';
import { createSavedSearch } from '../../mutations';
import {
    SEARCH_OPERATOR_CHIPS,
    clearRecentSearches,
    loadRecentSearches,
    saveRecentSearch,
    searchArticles,
    type SearchResult,
} from '../../services/search';
import { safeHttpUrl } from '../../services/parser';
import { domainOf, formatDate } from '../../util';
import type { Article, Feed, Folder, SavedSearch, View } from '../../types';
import styles from './search-view.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
    savedSearches: SavedSearch[];
}

function collectCachedArticles(): Article[] {
    const seen = new Set<string>();
    const out: Article[] = [];
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ['articles'] })) {
        const data = query.state.data as { items?: Article[] } | undefined;
        for (const item of data?.items ?? []) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            out.push(item);
        }
    }
    // front-page/today caches also hold articles
    for (const key of [['front-page'], ['today']] as const) {
        for (const query of queryClient.getQueryCache().findAll({ queryKey: key as unknown as readonly unknown[] })) {
            const data = query.state.data;
            const items = Array.isArray(data)
                ? (data as Article[])
                : ((data as { items?: Article[]; articles?: Article[] } | undefined)?.items ??
                  (data as { articles?: Article[] } | undefined)?.articles ??
                  []);
            for (const item of items) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                out.push(item);
            }
        }
    }
    return out;
}

@customElement('search-view')
export class SearchView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) view: Extract<View, { kind: 'search' }> = { kind: 'search' };

    @state() private query = '';
    @state() private scopeKind: 'all' | 'folder' | 'feed' = 'all';
    @state() private scopeId = '';
    @state() private recent: string[] = loadRecentSearches();
    @state() private results: SearchResult[] = [];
    @state() private corpusSize = 0;

    private inputEl: HTMLInputElement | null = null;
    private debounceTimer: number | null = null;
    private unsubscribe?: () => void;

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    override connectedCallback() {
        super.connectedCallback();
        this.syncFromView();
        this.unsubscribe = history.subscribe(({ location }) => {
            const v = parsePath(location.pathname, location.search);
            if (v.kind === 'search') {
                this.view = v;
                this.syncFromView();
            }
        });
        window.addEventListener('mute-rules-changed', this.onMuteRulesChanged);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.unsubscribe?.();
        window.removeEventListener('mute-rules-changed', this.onMuteRulesChanged);
        if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
    }

    private onMuteRulesChanged = () => {
        this.runSearch();
    };

    private lastLibraryData: unknown = undefined;

    override firstUpdated() {
        this.inputEl = this.renderRoot.querySelector('input[type="search"]');
        this.inputEl?.focus();
        this.runSearch();
    }

    override updated() {
        // Re-run when library (feeds/folders) becomes available so folder/feed
        // scope and name operators can resolve.
        if (this.library.data !== this.lastLibraryData) {
            this.lastLibraryData = this.library.data;
            this.runSearch();
        }
    }

    private syncFromView() {
        this.query = this.view.q ?? '';
        this.scopeKind = this.view.scope ?? 'all';
        this.scopeId = this.view.id ?? '';
        this.runSearch();
    }

    private folderFeedIds(): string[] | undefined {
        if (this.scopeKind === 'all') return undefined;
        if (this.scopeKind === 'feed') return this.scopeId ? [this.scopeId] : [];
        if (this.scopeKind === 'folder') {
            if (!this.scopeId) return [];
            const feeds = this.library.data?.feeds ?? [];
            return feeds.filter((f) => f.folderIds.includes(this.scopeId)).map((f) => f.id);
        }
        return undefined;
    }

    private runSearch() {
        const feeds = this.library.data?.feeds ?? [];
        const folders = this.library.data?.folders ?? [];
        const articles = collectCachedArticles();
        this.corpusSize = articles.length;
        this.results = searchArticles(this.query, { articles, feeds, folders, folderFeedIds: this.folderFeedIds() });
    }

    private updateRoute(q: string, scopeKind = this.scopeKind, scopeId = this.scopeId, replace = true) {
        navigate(
            {
                kind: 'search',
                ...(scopeKind !== 'all' ? { scope: scopeKind } : {}),
                ...(scopeKind !== 'all' && scopeId ? { id: scopeId } : {}),
                ...(q ? { q } : {}),
            },
            replace,
        );
    }

    private onInput = (e: Event) => {
        const q = (e.target as HTMLInputElement).value;
        this.query = q;
        if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
        this.debounceTimer = window.setTimeout(() => {
            this.debounceTimer = null;
            this.runSearch();
            this.updateRoute(q, this.scopeKind, this.scopeId, true);
        }, 120);
    };

    private onSubmit = (e: Event) => {
        e.preventDefault();
        const q = this.query.trim();
        if (q) this.recent = saveRecentSearch(q);
        this.runSearch();
        this.updateRoute(q, this.scopeKind, this.scopeId, false);
    };

    private onScopeKind = (e: Event) => {
        const kind = (e.target as HTMLSelectElement).value as 'all' | 'folder' | 'feed';
        this.scopeKind = kind;
        if (kind === 'all') this.scopeId = '';
        this.runSearch();
        this.updateRoute(this.query.trim(), this.scopeKind, this.scopeId, true);
    };

    private onScopeId = (e: Event) => {
        this.scopeId = (e.target as HTMLSelectElement).value;
        this.runSearch();
        this.updateRoute(this.query.trim(), this.scopeKind, this.scopeId, true);
    };

    private useRecent = (q: string) => {
        this.query = q;
        this.recent = saveRecentSearch(q);
        this.runSearch();
        this.updateRoute(q, this.scopeKind, this.scopeId, false);
        this.inputEl?.focus();
    };

    private clearRecent = () => {
        clearRecentSearches();
        this.recent = [];
    };

    private saveSearch = async () => {
        const q = this.query.trim();
        if (!q) return;
        const title = window.prompt('Save search as', q.slice(0, 40))?.trim();
        if (!title) return;
        try {
            const saved = await createSavedSearch(title, q, this.scopeKind, this.scopeId || undefined);
            navigate(
                {
                    kind: 'search',
                    q,
                    scope: this.scopeKind,
                    ...(this.scopeId ? { id: this.scopeId } : {}),
                    savedId: saved.id,
                },
                true,
            );
        } catch {
            // mutation surfaces toast/error handling elsewhere if needed
        }
    };

    private openResult(result: SearchResult, index: number) {
        if (this.query.trim()) this.recent = saveRecentSearch(this.query.trim());
        const items = this.results.map((r) => r.article);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: { article: result.article, index, items },
                bubbles: true,
                composed: true,
            }),
        );
    }

    override render() {
        const folders = this.library.data?.folders ?? [];
        const feeds = this.library.data?.feeds ?? [];
        return html`
            <div class="toolbar">
                <h2>Search</h2>
                <form class="search-form" @submit=${this.onSubmit}>
                    <input type="search" .value=${this.query} @input=${this.onInput}
                        placeholder="Search titles, content, authors, feeds" aria-label="Search articles" />
                    <label class="scope">
                        <span>Scope</span>
                        <select .value=${this.scopeKind} @change=${this.onScopeKind}>
                            <option value="all">Everything</option>
                            <option value="folder">Folder</option>
                            <option value="feed">Feed</option>
                        </select>
                    </label>
                    ${
                        this.scopeKind === 'folder'
                            ? html`<label class="scope"><span>Folder</span><select .value=${this.scopeId} @change=${this.onScopeId}><option value="">Choose folder</option>${folders.map((f) => html`<option value=${f.id}>${f.title}</option>`)}</select></label>`
                            : ''
                    }
                    ${
                        this.scopeKind === 'feed'
                            ? html`<label class="scope"><span>Feed</span><select .value=${this.scopeId} @change=${this.onScopeId}><option value="">Choose feed</option>${feeds.map((f) => html`<option value=${f.id}>${f.title}</option>`)}</select></label>`
                            : ''
                    }
                </form>
                <button type="button" class="save-btn" @click=${this.saveSearch} ?disabled=${!this.query.trim()}>Save search</button>
                <span class="meta">${this.corpusSize} cached articles indexed</span>
            </div>
            <div class="body">${this.renderBody()}</div>
        `;
    }

    private renderBody() {
        const q = this.query.trim();
        if (!q) return this.renderRecent();
        if (this.results.length === 0) {
            return html`<div class="count">0 results</div>
                <div class="empty">No results for "${q}" in cached articles. Open more views to grow the local index, or try a broader scope.</div>
                ${this.renderCheatSheet()}`;
        }
        return html`<div class="count">${this.results.length} result${this.results.length === 1 ? '' : 's'}</div>
            ${this.renderCheatSheet()}
            <ul class="results">${this.results.map((r, i) => this.renderResult(r, i))}</ul>`;
    }

    private addChip = (insert: string) => {
        const q = this.query;
        const needsSpace = q.length > 0 && !/\s$/.test(q);
        const next = `${q}${needsSpace ? ' ' : ''}${insert}`;
        this.query = next;
        this.runSearch();
        this.updateRoute(this.query, this.scopeKind, this.scopeId, true);
        this.inputEl = this.renderRoot.querySelector('input[type="search"]');
        this.inputEl?.focus();
        // Place cursor inside empty quotes when a chip provides them.
        const quotePos = next.lastIndexOf('""');
        if (quotePos >= 0 && next.endsWith('""')) {
            this.inputEl?.setSelectionRange(quotePos + 1, quotePos + 1);
        } else {
            const len = this.query.length;
            this.inputEl?.setSelectionRange(len, len);
        }
    };

    private renderCheatSheet() {
        return html`<details class="cheatsheet">
            <summary>Search operators</summary>
            <p>Combine free text with operators. Click a chip to add it, then fill in a value if needed.</p>
            <div class="chips">${SEARCH_OPERATOR_CHIPS.map(
                (chip) =>
                    html`<button type="button" class="chip" @click=${() => this.addChip(chip.insert)} title=${chip.value ? `${chip.label}${chip.value}` : chip.label}>${chip.label}${chip.value ? html`<span class="chip-val">${chip.value}</span>` : ''}</button>`,
            )}</div>
            <ul class="op-help">
                <li><code>author:name</code> match article author</li>
                <li><code>feed:name</code> / <code>folder:name</code> match feed or folder name</li>
                <li><code>after:YYYY-MM-DD</code> / <code>before:YYYY-MM-DD</code> date range</li>
                <li><code>has:video</code> articles with video</li>
                <li><code>is:starred</code> / <code>is:unread</code> state filters</li>
                <li><code>min:readtime:5</code> minimum read time in minutes</li>
            </ul>
        </details>`;
    }

    private renderRecent() {
        const recents =
            this.recent.length === 0
                ? html``
                : html`<div class="recent-head"><h3>Recent searches</h3><button class="link-btn" @click=${this.clearRecent}>Clear</button></div>
                      <ul class="recent">${this.recent.map((q) => html`<li><button class="recent-item" @click=${() => this.useRecent(q)}>${q}</button></li>`)}</ul>`;
        return html`<div class="empty">Search across titles, content, authors, and feed names in articles you have loaded. Type to search instantly.</div>
            ${recents}
            ${this.renderCheatSheet()}`;
    }

    private renderResult(result: SearchResult, index: number) {
        const a = result.article;
        const link = safeHttpUrl(a.link);
        const feedTitle = result.feedTitle ?? '';
        return html`<li class="result ${a.read ? 'read' : ''}">
            <button class="result-open" @click=${() => this.openResult(result, index)}>
                <span class="title">${a.title || '(untitled)'}</span>
                <span class="meta-line">${feedTitle ? html`<span class="feed">${feedTitle}</span>` : ''}<span>${domainOf(a.link)}</span><span>${formatDate(a.published)}</span>${a.author ? html`<span>by ${a.author}</span>` : ''}</span>
                ${a.summary ? html`<span class="summary">${a.summary}</span>` : ''}
            </button>
            ${link ? html`<a class="orig" href=${link} target="_blank" rel="noopener noreferrer" title="Open original">↗</a>` : ''}
        </li>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'search-view': SearchView;
    }
}
