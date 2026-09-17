import {html, svg} from 'lit';
import type {Feed, Folder} from '../../types';

export function iconTemplate(kind: 'rss' | 'folder' | 'all' | 'refresh' | 'trash') {
    const paths: Record<string, ReturnType<typeof svg>> = {
        rss: svg`<circle cx="6" cy="18" r="2" fill="currentColor"></circle><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path>`,
        folder: svg`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.6"></path>`,
        all: svg`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle>`,
        refresh: svg`<path d="M20 11a8 8 0 1 0-2.3 5.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>`,
        trash: svg`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>`,
    };
    return html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
}

export function pinIconTemplate(autoHide: boolean) {
    const pin = svg`<line x1="12" x2="12" y1="17" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>`;
    const off = svg`<line x1="2" x2="22" y1="2" y2="22"></line>`;
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pin}${autoHide ? off : ''}</svg>`;
}

export function filterIconTemplate() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v5l-4 2v-7L3 4z"></path></svg>`;
}

export function menuIconTemplate() {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 10.2l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function feedRowTemplate(
    feed: Feed,
    active: boolean,
    onSelect: (feed: Feed) => void,
    onKey: (e: KeyboardEvent, feed: Feed) => void,
    onDragStart: (e: DragEvent, feed: Feed) => void,
    actions: unknown,
) {
    return html`
      <div class="feed-row ${active ? 'active' : ''} ${feed.unread > 0 ? 'has-unread' : ''}" data-feed-id="${feed.id}" draggable="true" role="button" tabindex="0" aria-label="Open feed ${feed.title}" @dragstart=${(e: DragEvent) => onDragStart(e, feed)} @click=${() => onSelect(feed)} @keydown=${(e: KeyboardEvent) => onKey(e, feed)}>
        <span class="dot"></span>
        <span class="label" title="${feed.title}${feed.lastError ? ` — ${feed.lastError}` : ''}">${feed.title}</span>
        ${feed.unread > 0 ? html`<span class="badge">${feed.unread}</span>` : ''}
        ${feed.lastError ? html`<span class="feed-error" title="${feed.lastError}">⚠</span>` : ''}
        ${actions}
      </div>
    `;
}

function folderHeaderTemplate(
    folder: Folder,
    active: boolean,
    isCollapsed: boolean,
    unread: number,
    onSelect: (folder: Folder) => void,
    onKey: (e: KeyboardEvent, folder: Folder) => void,
    onDragStart: (e: DragEvent, folder: Folder) => void,
    onToggle: (id: string) => void,
    onOpenMenu: (e: MouseEvent, folder: Folder) => void,
) {
    return html`
      <div class="item ${active ? 'active' : ''}" data-folder-id="${folder.id}" draggable="true" role="button" tabindex="0" aria-label="Open folder ${folder.title}" @dragstart=${(e: DragEvent) => onDragStart(e, folder)} @click=${() => onSelect(folder)} @keydown=${(e: KeyboardEvent) => onKey(e, folder)}>
        <span class="icon" style="cursor:pointer" @click=${(e: Event) => { e.stopPropagation(); onToggle(folder.id); }}>${isCollapsed ? '▸' : '▾'}</span>
        ${iconTemplate('folder')}
        <span class="label" title="${folder.title}">${folder.title}</span>
        ${unread > 0 ? html`<span class="badge">${unread}</span>` : ''}
        <button class="menu-btn" title="Folder options" @click=${(e: MouseEvent) => onOpenMenu(e, folder)}>${menuIconTemplate()}</button>
      </div>
    `;
}

export function folderRowTemplate(
    folder: Folder,
    feeds: Feed[],
    isCollapsed: boolean,
    active: boolean,
    unread: number,
    onSelectFolder: (folder: Folder) => void,
    onKeyFolder: (e: KeyboardEvent, folder: Folder) => void,
    onDragFolder: (e: DragEvent, folder: Folder) => void,
    onToggle: (id: string) => void,
    onOpenMenu: (e: MouseEvent, folder: Folder) => void,
    feedRow: (feed: Feed) => unknown,
) {
    return html`
      <div>
        ${folderHeaderTemplate(folder, active, isCollapsed, unread, onSelectFolder, onKeyFolder, onDragFolder, onToggle, onOpenMenu)}
        ${isCollapsed ? '' : html`<div class="folder-children">${feeds.map((f) => feedRow(f))}</div>`}
      </div>
    `;
}
