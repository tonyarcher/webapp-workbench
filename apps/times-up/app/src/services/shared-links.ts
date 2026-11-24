import type { SavedArticleSnapshot } from '../types';
import { normalizeLink } from './ranking';
import { safeHttpUrl } from './parser';

export interface SharedLink {
    url: string;
    title?: string | undefined;
    text?: string | undefined;
}

export function isSharedSnapshotId(id: string): boolean {
    return id.startsWith('shared:');
}

/** Read the GET share-target parameters without touching the DOM. */
export function sharedLinkFromParams(params: URLSearchParams): SharedLink | null {
    const direct = safeHttpUrl(params.get('url') ?? '');
    const text = params.get('text')?.trim() || undefined;
    const fromText = text?.match(/https?:\/\/[^\s]+/)?.[0]?.replace(/[),.;!?]+$/, '');
    const url = direct ?? safeHttpUrl(fromText ?? '');
    if (!url) return null;
    const title = params.get('title')?.trim() || undefined;
    return { url, ...(title ? { title } : {}), ...(text ? { text } : {}) };
}

export function sharedSnapshot(link: SharedLink, now = Date.now()): SavedArticleSnapshot {
    return {
        id: `shared:${normalizeLink(link.url)}`,
        title: link.title || new URL(link.url).hostname,
        link: link.url,
        ...(link.text ? { summary: link.text } : {}),
        savedAt: now,
    };
}
