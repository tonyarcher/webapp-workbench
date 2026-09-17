import {moveFeed, reorderFolders} from '../../mutations';
import type {Feed} from '../../types';

interface DragHost {
    dragging: { kind: 'folder' | 'feed'; id: string } | null;
    dragTargetEl: HTMLElement | null;
    collapsed: Record<string, boolean>;
    shadowRoot: ShadowRoot | null;
    libraryData: { feeds: Feed[]; folders: { id: string }[] };
    toggleFolder(id: string): void;
    clearDragOver(): void;
}

export function handleDragStart(host: DragHost, e: DragEvent, kind: 'folder' | 'feed', id: string) {
    host.dragging = {kind, id};
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({kind, id}));
    }
    (e.target as HTMLElement).closest('.item, .feed-row')?.classList.add('dragging');
    if (kind === 'feed') host.shadowRoot?.querySelector('[data-no-folder]')?.classList.add('visible');
}

export function handleDragOver(host: DragHost & { shadowRoot: ShadowRoot | null }, e: DragEvent) {
    if (!host.dragging) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const selector = host.dragging.kind === 'feed' ? '[data-folder-id], [data-feed-id], [data-no-folder]' : '[data-folder-id]';
    const target = (e.target as HTMLElement).closest<HTMLElement>(selector) ?? (host.shadowRoot?.querySelector('.nav') as HTMLElement | null);
    if (host.dragTargetEl !== target) {
        host.dragTargetEl?.classList.remove('drag-over');
        host.dragTargetEl = target;
        host.dragTargetEl?.classList.add('drag-over');
    }
}

export function handleDragLeave(host: DragHost & { shadowRoot: ShadowRoot | null; dragTargetEl: HTMLElement | null }, e: DragEvent) {
    const nav = host.shadowRoot?.querySelector('.nav');
    const related = e.relatedTarget as Node | null;
    if (!nav || !nav.contains(related)) {
        host.dragTargetEl?.classList.remove('drag-over');
        host.dragTargetEl = null;
    }
}

export function handleClearDragOver(host: DragHost) {
    host.dragTargetEl?.classList.remove('drag-over');
    host.dragTargetEl = null;
}

export function handleEndDrag(host: DragHost) {
    host.dragging = null;
    host.shadowRoot?.querySelector('.dragging')?.classList.remove('dragging');
    host.shadowRoot?.querySelector('[data-no-folder]')?.classList.remove('visible');
    handleClearDragOver(host);
}

export async function handleFolderReorder(host: DragHost & { libraryData: { folders: { id: string }[] } }, folderId: string, target: { folderId: string | null }) {
    const ids = host.libraryData.folders.map((f) => f.id);
    const from = ids.indexOf(folderId);
    if (from < 0) return;
    ids.splice(from, 1);
    const targetId = target.folderId;
    if (targetId && targetId !== folderId) {
        const to = ids.indexOf(targetId);
        ids.splice(to < 0 ? ids.length : to, 0, folderId);
    } else {
        ids.push(folderId);
    }
    await reorderFolders(ids);
}

export async function handleFeedMove(host: DragHost & { libraryData: { feeds: Feed[] }; collapsed: Record<string, boolean>; toggleFolder(id: string): void }, feedId: string, target: { folderId: string | null }) {
    const feed = host.libraryData.feeds.find((f) => f.id === feedId);
    if (!feed) return;
    const next = target.folderId ? [target.folderId] : [];
    const same = feed.folderIds.length === next.length && feed.folderIds.every((id, i) => id === next[i]);
    if (same) return;
    await moveFeed(feedId, target.folderId);
    if (target.folderId && host.collapsed[target.folderId]) host.toggleFolder(target.folderId);
}
