import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { invalidateLibrary, libraryKey, queryClient, QueryController, fetchLibrary } from '../../query';
import { addFolder } from '../../services/api';
import { deleteFeed, deleteFolder, moveFeed } from '../../mutations';
import type { Feed, Folder, SavedSearch } from '../../types';
import styles from './organize-view.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
    savedSearches: SavedSearch[];
}

@customElement('organize-view')
export class OrganizeView extends LitElement {
    static override styles = unsafeCSS(styles);

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    private get libraryData(): Library {
        return this.library.data ?? { folders: [], feeds: [], savedSearches: [] };
    }

    override render() {
        const { folders, feeds } = this.libraryData;
        const uncategorized = feeds.filter((f) => f.folderIds.length === 0);
        return html`
            <div class="organize">
                <div class="toolbar">
                    <h2>Organize</h2>
                    <div class="actions">
                        <button class="btn" @click=${this.onCreateFolder}>New folder</button>
                    </div>
                </div>
                <div class="body" tabindex="0">
                    ${
                        this.library.error
                            ? html`<div class="error">Could not load feeds. <button class="link" @click=${this.onRetry}>Retry</button></div>`
                            : ''
                    }
                    <p class="intro">Manage your folders and subscriptions. Move feeds between folders, unfollow feeds you no longer read, and keep your library tidy.</p>
                    ${this.renderFolderSection(null, 'Uncategorized', uncategorized, folders)}
                    ${folders.map((folder) => this.renderFolderSection(folder.id, folder.title, this.feedsFor(folder.id), folders, folder))}
                    ${!feeds.length && !folders.length ? html`<div class="empty">No feeds yet. Add a feed from Settings to get started.</div>` : ''}
                </div>
            </div>
        `;
    }

    private feedsFor(folderId: string): Feed[] {
        return this.libraryData.feeds.filter((f) => f.folderIds.includes(folderId));
    }

    private renderFolderSection(
        folderId: string | null,
        title: string,
        feeds: Feed[],
        folders: Folder[],
        folder?: Folder,
    ) {
        return html`
            <section class="group" aria-label=${title}>
                <div class="group-head">
                    <h3>${title}</h3>
                    <span class="count">${feeds.length} feed${feeds.length === 1 ? '' : 's'}</span>
                    ${folder ? html`<button class="btn danger subtle" @click=${() => this.onDeleteFolder(folder)}>Delete folder</button>` : ''}
                </div>
                ${
                    feeds.length
                        ? html`<ul class="feed-list">${feeds.map((feed) => this.renderFeed(feed, folders, folderId))}</ul>`
                        : html`<div class="empty-group">${folderId ? 'No feeds in this folder.' : 'No uncategorized feeds.'}</div>`
                }
            </section>
        `;
    }

    private renderFeed(feed: Feed, folders: Folder[], currentFolderId: string | null) {
        const current = currentFolderId ?? '';
        return html`
            <li class="feed-row">
                <div class="feed-main">
                    <div class="feed-title" title=${feed.title}>${feed.title || feed.url}</div>
                    <div class="feed-meta">
                        ${feed.url ? html`<span class="url" title=${feed.url}>${feed.url}</span>` : ''}
                        ${feed.unread > 0 ? html`<span class="badge">${feed.unread} unread</span>` : ''}
                        ${feed.lastError ? html`<span class="error-text" title=${feed.lastError}>Error: ${feed.lastError}</span>` : ''}
                    </div>
                </div>
                <div class="feed-actions">
                    <label class="move">
                        <span>Folder</span>
                        <select .value=${current} @change=${(e: Event) => this.onMoveFeed(feed, e)}>
                            <option value="">Uncategorized</option>
                            ${folders.map((f) => html`<option value=${f.id}>${f.title}</option>`)}
                        </select>
                    </label>
                    <button class="btn danger" @click=${() => this.onDeleteFeed(feed)}>Unfollow</button>
                </div>
            </li>
        `;
    }

    private onRetry = () => {
        void queryClient.invalidateQueries({ queryKey: libraryKey });
    };

    private async onCreateFolder() {
        const title = window.prompt('Folder name')?.trim();
        if (!title) return;
        try {
            await addFolder(title);
            await invalidateLibrary();
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Could not create folder');
        }
    }

    private async onDeleteFolder(folder: Folder) {
        if (!window.confirm(`Delete folder "${folder.title}"? Feeds in it will become uncategorized.`)) return;
        try {
            await deleteFolder(folder.id);
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Could not delete folder');
        }
    }

    private async onDeleteFeed(feed: Feed) {
        if (!window.confirm(`Unfollow "${feed.title || feed.url}"?`)) return;
        try {
            await deleteFeed(feed.id);
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Could not unfollow feed');
        }
    }

    private async onMoveFeed(feed: Feed, e: Event) {
        const value = (e.target as HTMLSelectElement).value;
        const folderId = value || null;
        try {
            await moveFeed(feed.id, folderId);
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Could not move feed');
            await invalidateLibrary();
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'organize-view': OrganizeView;
    }
}
