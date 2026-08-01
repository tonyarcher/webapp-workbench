import {getDb, getFeed, getMetaMany, putFeed, uid} from '../db/db';
import {firstImageUrl, parseFeedXml} from './parser';
import {fetchFeedText} from './proxy';
import {
    affinityBoostScore,
    contentEngagement,
    hotScore,
    normalizeLink,
    popularityScore,
    velocityBonus,
} from './ranking';
import {domainOf} from '../util';
import type {Article, Feed, ParsedFeed, ParsedItem} from '../types';

function buildArticle(
    feedId: string,
    item: ParsedItem,
    popularity: number,
    engagement: number,
): Article {
    const normLink = item.link ? normalizeLink(item.link) : undefined;
    return {
        id: `${feedId}:${item.guid}`,
        feedId,
        guid: item.guid,
        title: item.title,
        link: item.link,
        author: item.author,
        summary: item.summary,
        content: item.content,
        comments: item.comments,
        published: item.published,
        fetchedAt: Date.now(),
        read: 0,
        starred: false,
        normLink,
        popularity,
        engagement,
        hot: hotScore(popularity, engagement, item.published),
        image: item.media ?? firstImageUrl(item.content),
    };
}

function engagementFor(
    item: { title: string; content?: string; summary?: string; author?: string; link?: string; media?: string },
    feedAffinity: number,
    affMap: Map<string, number>,
    velocity: number,
): number {
    const domain = item.link ? domainOf(item.link) : '';
    const domainAffinity = domain ? (affMap.get(`aff:domain:${domain}`) ?? 0) : 0;
    const authorAffinity = item.author ? (affMap.get(`aff:author:${item.author.toLowerCase()}`) ?? 0) : 0;
    const affinity = affinityBoostScore(feedAffinity + domainAffinity + authorAffinity);
    return contentEngagement(item) + affinity + velocity;
}

/**
 * Upsert a parsed feed into IndexedDB, computing the popularity signals:
 *   - syndication: how many distinct subscribed feeds carry the same canonical link
 *   - comments: comment count reported by the feed itself
 *   - engagement: content/structure proxy + reading affinity + syndication velocity
 * Also bumps the popularity of already-stored copies of the same story from
 * other feeds, since this feed's copy adds to their syndication.
 */
export async function ingestFeed(feed: Feed, parsed: ParsedFeed): Promise<{ inserted: number }> {
    const db = await getDb();

    const hosts = new Set<string>();
    const authors = new Set<string>();
    for (const item of parsed.items) {
        if (item.link) {
            const host = domainOf(item.link);
            if (host) hosts.add(host);
        }
        if (item.author) authors.add(item.author.toLowerCase());
    }
    const metaKeys = [`aff:feed:${feed.id}`];
    for (const host of hosts) metaKeys.push(`aff:domain:${host}`);
    for (const author of authors) metaKeys.push(`aff:author:${author}`);
    const affMap = await getMetaMany(metaKeys);
    const feedAffinity = affMap.get(`aff:feed:${feed.id}`) ?? 0;

    const now = Date.now();
    const tx = db.transaction('articles', 'readwrite');
    const articleStore = tx.objectStore('articles');

    const links = new Set(
        parsed.items.map((item) => (item.link ? normalizeLink(item.link) : undefined)).filter((l): l is string => Boolean(l)),
    );

    const linkInfo = new Map<string, { otherFeeds: number; minPublished: number | undefined }>();
    for (const link of links) {
        const matches = await articleStore.index('byLink').getAll(link);
        const feeds = new Set(matches.map((m) => m.feedId));
        feeds.delete(feed.id);
        let minPublished: number | undefined;
        for (const m of matches) {
            if (m.published < (minPublished ?? Number.POSITIVE_INFINITY)) minPublished = m.published;
        }
        linkInfo.set(link, {otherFeeds: feeds.size, minPublished});
    }

    let inserted = 0;
    for (const item of parsed.items) {
        const normLink = item.link ? normalizeLink(item.link) : undefined;
        const info = normLink ? linkInfo.get(normLink) : undefined;
        const otherFeeds = info?.otherFeeds ?? 0;
        const popularity = popularityScore(otherFeeds + 1, item.comments ?? 0);
        const velocity = normLink
            ? velocityBonus(info?.otherFeeds ?? 0, info?.minPublished !== undefined ? now - info.minPublished : undefined)
            : 0;
        const engagement = engagementFor(item, feedAffinity, affMap, velocity);
        const article = buildArticle(feed.id, item, popularity, engagement);

        const existing = await articleStore.get(article.id);
        if (existing) {
            await articleStore.put({
                ...existing,
                ...article,
                read: existing.read,
                starred: existing.starred,
            });
        } else {
            await articleStore.put(article);
            inserted++;
        }
    }

    for (const link of links) {
        const info = linkInfo.get(link);
        if (!info || info.otherFeeds === 0) continue;
        const velocity = velocityBonus(
            info.otherFeeds,
            info.minPublished !== undefined ? now - info.minPublished : undefined,
        );
        const matches = await articleStore.index('byLink').getAll(link);
        for (const other of matches) {
            if (other.feedId === feed.id) continue;
            other.popularity += 3;
            const otherAffinity = affMap.get(`aff:feed:${other.feedId}`) ?? 0;
            other.engagement = engagementFor(other, otherAffinity, affMap, velocity);
            other.hot = hotScore(other.popularity, other.engagement, other.published);
            other.image ??= firstImageUrl(other.content);
            await articleStore.put(other);
        }
    }

    await tx.done;
    return {inserted};
}

export interface SyncResult {
    inserted: number;
    total: number;
    title: string;
}

export async function syncFeed(feedId: string): Promise<SyncResult> {
    const feed = await getFeed(feedId);
    if (!feed) throw new Error('Feed not found');

    try {
        const xml = await fetchFeedText(feed.url);
        const parsed = parseFeedXml(xml, Date.now());

        const {inserted} = await ingestFeed(feed, parsed);

        const updated: Feed = {
            ...feed,
            title: feed.title === feed.url ? parsed.title : feed.title,
            siteUrl: parsed.siteUrl || feed.siteUrl,
            lastFetchedAt: Date.now(),
            lastError: undefined,
            unread: feed.unread + inserted,
        };
        await putFeed(updated);

        return {inserted, total: parsed.items.length, title: parsed.title};
    } catch (err) {
        await putFeed({
            ...feed,
            lastError: err instanceof Error ? err.message : String(err),
        });
        throw err;
    }
}

export async function addFeedFromUrl(url: string): Promise<Feed> {
    const xml = await fetchFeedText(url);
    const parsed = parseFeedXml(xml, Date.now());

    const feed: Feed = {
        id: uid(),
        title: parsed.title || url,
        url,
        siteUrl: parsed.siteUrl,
        folderIds: [],
        unread: 0,
        addedAt: Date.now(),
    };

    const {inserted} = await ingestFeed(feed, parsed);
    feed.unread = inserted;
    feed.lastFetchedAt = Date.now();
    await putFeed(feed);

    return feed;
}
