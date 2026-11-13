import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { invalidateLibrary, libraryKey, queryClient, QueryController, fetchLibrary } from '../../query';
import { addFolder } from '../../services/api';
import { deleteFeed, deleteFolder, setFeedFolderMembership } from '../../mutations';
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

    /** Optimistic folder membership so rapid toggles don't clobber each other. */
    @state() private folderOverrides = new Map<string, string[]>();
    private folderSaveQueue = new Map<string, Promise<void>>();

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    private get libraryData(): Library {
        return this.library.data ?? { folders: [], feeds: [], savedSearches: [] };
    }

    private folderIdsFor(feed: Feed): string[] {
        return this.folderOverrides.get(feed.id) ?? feed.folderIds;
    }

    override render() {
        const { folders, feeds } = this.libraryData;
        const uncategorized = feeds.filter((f) => this.folderIdsFor(f).length === 0);
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
        return this.libraryData.feeds.filter((f) => this.folderIdsFor(f).includes(folderId));
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

    private renderFeed(feed: Feed, folders: Folder[], _currentFolderId: string | null) {
        const folderIds = this.folderIdsFor(feed);
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
                    <div class="folders-picker" role="group" aria-label="Folders for ${feed.title || feed.url}">
                        <span class="picker-label">Folders</span>
                        ${
                            folders.length
                                ? html`<div class="folder-checks">
                                    ${folders.map(
                                        (f) => html`
                                        <label class="folder-check">
                                            <input
                                                type="checkbox"
                                                .checked=${folderIds.includes(f.id)}
                                                @change=${(e: Event) => this.onToggleFeedFolder(feed, f.id, (e.target as HTMLInputElement).checked)}
                                            />
                                            <span>${f.title}</span>
                                        </label>`,
                                    )}
                                  </div>`
                                : html`<span class="empty-hint">No folders yet</span>`
                        }
                    </div>
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

    private async onToggleFeedFolder(feed: Feed, folderId: string, checked: boolean) {
        const base = this.folderIdsFor(feed);
        const nextSet = new Set(base);
        if (checked) nextSet.add(folderId);
        else nextSet.delete(folderId);
        const next = [...nextSet];
        this.folderOverrides = new Map(this.folderOverrides).set(feed.id, next);
        const prev = this.folderSaveQueue.get(feed.id) ?? Promise.resolve();
        const run = prev
            .catch(() => undefined)
            .then(async () => {
                const current = this.folderOverrides.get(feed.id) ?? next;
                await setFeedFolderMembership(feed.id, current);
            });
        this.folderSaveQueue.set(feed.id, run);
        try {
            await run;
        } catch (err) {
            // Only the active tail reports/clears so a newer queued save can still win.
            if (this.folderSaveQueue.get(feed.id) === run) {
                window.alert(err instanceof Error ? err.message : 'Could not update folders');
                const overrides = new Map(this.folderOverrides);
                overrides.delete(feed.id);
                this.folderOverrides = overrides;
                await invalidateLibrary();
            }
            return;
        } finally {
            if (this.folderSaveQueue.get(feed.id) === run) this.folderSaveQueue.delete(feed.id);
        }
        // Clear optimistic state only when no newer toggle is queued/in flight for this feed.
        if (this.folderSaveQueue.get(feed.id) === undefined) {
            await invalidateLibrary();
            const overrides = new Map(this.folderOverrides);
            // Keep any override set after invalidation started by a newer interaction.
            if (this.folderSaveQueue.get(feed.id) === undefined) overrides.delete(feed.id);
            this.folderOverrides = overrides;
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'organize-view': OrganizeView;
    }
}
