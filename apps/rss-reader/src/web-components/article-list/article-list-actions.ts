import {libraryKey, queryClient} from '../../query';
import {markAllRead, markArticleRead, markReadBefore, markShownRead, refreshFeed, refreshFolder, syncAllFeeds, toggleStar} from '../../mutations';
import type {Article, Feed, View} from '../../types';

interface OpenHost {
    items: Article[];
    cursor: number;
    dispatchEvent(e: Event): boolean;
    library: { data?: { feeds: Feed[]; folders: unknown } };
}

export async function openArticleAction(host: OpenHost, article: Article) {
    if (article.read === 0) {
        host.items = host.items.map((a) => (a.id === article.id ? {...a, read: 1} : a));
        await markArticleRead(article.id);
        void queryClient.invalidateQueries({queryKey: libraryKey});
    }
    const index = host.items.findIndex((a) => a.id === article.id);
    host.cursor = index;
    host.dispatchEvent(new CustomEvent('open-article', {detail: {article, index, items: host.items}, bubbles: true, composed: true}));
}

export async function toggleStarAction(host: { items: Article[] }, article: Article) {
    const starred = !article.starred;
    host.items = host.items.map((a) => (a.id === article.id ? {...a, starred} : a));
    await toggleStar(article.id, starred);
}

export async function markShownReadAction(host: { items: Article[]; hideRead: boolean; reset(): Promise<void> }) {
    const ids = host.items.filter((a) => a.read === 0).map((a) => a.id);
    if (!ids.length) return;
    await markShownRead(ids);
    host.hideRead = true;
    await host.reset();
}

export async function markBeforeAction(
    host: { view: View; hideRead: boolean; reset(): Promise<void>; folderFeeds(): Feed[] },
    cutoff: number | null,
) {
    if (cutoff === null) {
        if (host.view.kind === 'feed') await markAllRead(host.view.id);
        else if (host.view.kind === 'folder') for (const feed of host.folderFeeds()) await markAllRead(feed.id);
        else await markAllRead();
    } else {
        const feedIds =
            host.view.kind === 'feed' ? [host.view.id] : host.view.kind === 'folder' ? host.folderFeeds().map((f) => f.id) : undefined;
        await markReadBefore(feedIds, cutoff);
    }
    host.hideRead = true;
    await host.reset();
}

export async function runRefreshAction(
    view: View,
    host: { reset(): Promise<void> },
    setRefreshing: (v: boolean) => void,
    refreshGenRef: { value: number },
) {
    const mine = ++refreshGenRef.value;
    setRefreshing(true);
    try {
        if (view.kind === 'feed') await refreshFeed(view.id);
        else if (view.kind === 'folder') await refreshFolder(view.id);
        else await syncAllFeeds();
    } catch {
        // surfaced elsewhere
    } finally {
        try {
            await host.reset();
        } finally {
            if (mine === refreshGenRef.value) setRefreshing(false);
        }
    }
}
