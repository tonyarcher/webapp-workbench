import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { libraryKey, QueryController } from '../query';
import { deleteFeed, deleteFolder, refreshFeed } from '../mutations';
import { getFeeds, getFolders } from '../db/db';
import { navigate } from '../router';
import type { Feed, Folder, View } from '../types';

interface Library {
  folders: Folder[];
  feeds: Feed[];
}

const COLLAPSED_KEY = 'rss-reader:collapsed-folders';

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

@customElement('source-list')
export class SourceList extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      box-sizing: border-box;
    }
    .nav {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text);
      user-select: none;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      font: inherit;
    }
    .item:hover {
      background: var(--hover);
    }
    .item.active {
      background: var(--active-bg);
      color: var(--active-text);
    }
    .item .label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .icon {
      width: 16px;
      height: 16px;
      flex: none;
      opacity: 0.7;
    }
    .badge {
      flex: none;
      font-size: 11px;
      font-weight: 600;
      color: var(--badge-text);
      background: var(--badge-bg);
      border-radius: 10px;
      padding: 1px 7px;
      min-width: 18px;
      text-align: center;
    }
    .folder-children {
      padding-left: 14px;
    }
    .feed-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-muted);
      user-select: none;
    }
    .feed-row:hover {
      background: var(--hover);
      color: var(--text);
    }
    .feed-row.active {
      background: var(--active-bg);
      color: var(--active-text);
    }
    .feed-row .label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .feed-row .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      flex: none;
      opacity: 0;
    }
    .feed-row.has-unread .dot {
      opacity: 1;
    }
    .feed-row .actions {
      display: none;
      gap: 2px;
      flex: none;
    }
    .feed-row:hover .actions {
      display: flex;
    }
    .icon-btn {
      border: none;
      background: none;
      padding: 2px;
      border-radius: 4px;
      cursor: pointer;
      color: var(--text-muted);
      display: inline-flex;
    }
    .icon-btn:hover {
      background: var(--hover);
      color: var(--text);
    }
    .section-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      padding: 10px 8px 4px;
    }
  `;

  @property({ attribute: false }) view: View = { kind: 'all' };

  @state() private collapsed: Record<string, boolean> = loadCollapsed();

  private library = new QueryController<Library>(this, () => ({
    queryKey: libraryKey,
    queryFn: async () => {
      const [folders, feeds] = await Promise.all([getFolders(), getFeeds()]);
      return { folders, feeds };
    },
  }));

  private icon(kind: 'rss' | 'folder' | 'all' | 'refresh' | 'trash') {
    const paths = {
      rss: '<circle cx="6" cy="18" r="2" fill="currentColor"/><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      all: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
      refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    };
    return html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
  }

  private get libraryData(): Library {
    return this.library.data ?? { folders: [], feeds: [] };
  }

  private get totalUnread(): number {
    return this.libraryData.feeds.reduce((sum, f) => sum + f.unread, 0);
  }

  private folderUnread(folderId: string): number {
    return this.libraryData.feeds
      .filter((f) => f.folderId === folderId)
      .reduce((sum, f) => sum + f.unread, 0);
  }

  private select(view: View) {
    navigate(view);
  }

  private isActive(view: View): boolean {
    if (this.view.kind !== view.kind) return false;
    if (this.view.kind === 'all' || this.view.kind === 'brief') return true;
    return (this.view as { id: string }).id === (view as { id: string }).id;
  }

  private toggleFolder(id: string) {
    const next = { ...this.collapsed, [id]: !this.collapsed[id] };
    this.collapsed = next;
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable; collapse state just won't persist
    }
  }

  private feedActions(feed: Feed) {
    return html`
      <span class="actions">
        <button
          class="icon-btn"
          title="Refresh"
          @click=${(e: Event) => {
            e.stopPropagation();
            this.doRefresh(feed);
          }}
        >${this.icon('refresh')}</button>
        <button
          class="icon-btn"
          title="Delete feed"
          @click=${(e: Event) => {
            e.stopPropagation();
            this.doDeleteFeed(feed);
          }}
        >${this.icon('trash')}</button>
      </span>
    `;
  }

  private feedRow(feed: Feed) {
    const active = this.isActive({ kind: 'feed', id: feed.id });
    return html`
      <div
        class="feed-row ${active ? 'active' : ''} ${feed.unread > 0 ? 'has-unread' : ''}"
        @click=${() => this.select({ kind: 'feed', id: feed.id })}
      >
        <span class="dot"></span>
        <span class="label" title="${feed.title}">${feed.title}</span>
        ${feed.unread > 0 ? html`<span class="badge">${feed.unread}</span>` : ''}
        ${this.feedActions(feed)}
      </div>
    `;
  }

  private folderRow(folder: Folder) {
    const feeds = this.libraryData.feeds.filter((f) => f.folderId === folder.id);
    const isCollapsed = this.collapsed[folder.id];
    const active = this.isActive({ kind: 'folder', id: folder.id });
    const unread = this.folderUnread(folder.id);
    return html`
      <div>
        <div class="item ${active ? 'active' : ''}" @click=${() => this.select({ kind: 'folder', id: folder.id })}>
          <span
            class="icon"
            style="cursor:pointer"
            @click=${(e: Event) => {
              e.stopPropagation();
              this.toggleFolder(folder.id);
            }}
          >${isCollapsed ? '▸' : '▾'}</span>
          ${this.icon('folder')}
          <span class="label" title="${folder.title}">${folder.title}</span>
          ${unread > 0 ? html`<span class="badge">${unread}</span>` : ''}
          <button
            class="icon-btn"
            title="Delete folder"
            @click=${(e: Event) => {
              e.stopPropagation();
              this.doDeleteFolder(folder);
            }}
          >${this.icon('trash')}</button>
        </div>
        ${isCollapsed
          ? ''
          : html`<div class="folder-children">${feeds.map((f) => this.feedRow(f))}</div>`}
      </div>
    `;
  }

  private async doRefresh(feed: Feed) {
    try {
      await refreshFeed(feed.id);
    } catch {
      // surfaced on the feed row's next sync attempt
    }
  }

  private async doDeleteFeed(feed: Feed) {
    if (confirm(`Delete ${feed.title}?`)) {
      await deleteFeed(feed.id);
    }
  }

  private async doDeleteFolder(folder: Folder) {
    if (confirm(`Delete folder ${folder.title}? Feeds will move to top level.`)) {
      await deleteFolder(folder.id);
      if (folder.id in this.collapsed) {
        const { [folder.id]: _removed, ...rest } = this.collapsed;
        this.collapsed = rest;
        try {
          localStorage.setItem(COLLAPSED_KEY, JSON.stringify(rest));
        } catch {
          // ignore
        }
      }
    }
  }

  override render() {
    const { folders, feeds } = this.libraryData;
    const uncategorized = feeds.filter((f) => f.folderId === null);
    const allActive = this.isActive({ kind: 'all' });
    const briefActive = this.isActive({ kind: 'brief' });

    return html`
      <nav class="nav">
        <div class="item ${briefActive ? 'active' : ''}" @click=${() => this.select({ kind: 'brief' })}>
          <span class="icon">✨</span>
          <span class="label">Daily Brief</span>
        </div>
        <div class="item ${allActive ? 'active' : ''}" @click=${() => this.select({ kind: 'all' })}>
          ${this.icon('all')}
          <span class="label">All</span>
          ${this.totalUnread > 0 ? html`<span class="badge">${this.totalUnread}</span>` : ''}
        </div>

        ${folders.map((folder) => this.folderRow(folder))}

        ${uncategorized.length
          ? html`
              <div class="section-label">No folder</div>
              ${uncategorized.map((feed) => this.feedRow(feed))}
            `
          : ''}
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'source-list': SourceList;
  }
}
