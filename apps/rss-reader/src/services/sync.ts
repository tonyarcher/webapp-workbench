import {type BumpSpec, getFeed, getMetaMany, ingestArticlesTx, queryArticlesByLink, uid, updateFeedErrorIfExists} from '../db/db';
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
 * Existing copies of the same story only get their popularity bumped when this
 * sync actually inserted a new copy (i.e. syndication grew), so repeated
 * refreshes don't inflate scores without bound. All storage happens in a
 * single db-layer transaction (see ingestArticlesTx).
 */
export async function ingestFeed(
    feed: Feed,
    parsed: ParsedFeed,
    feedPatch: Feed,
    createIfMissing: boolean,
): Promise<{ inserted: number; unread: number }> {
    const hosts = new Set<string>();
    const authors = new Set<string>();
    for (const item of parsed.items) {
        if (item.link) {
            const host = domainOf(item.link);
            if (host) hosts.add(host);
        }
        if (item.author) authors.add(item.author.toLowerCase());
    }

    const now = Date.now();

    const links = new Set(
        parsed.items.map((item) => (item.link ? normalizeLink(item.link) : undefined)).filter((l): l is string => Boolean(l)),
    );

    const linkInfo = new Map<string, { matches: Article[]; otherFeeds: number; minPublished: number | undefined }>();
    for (const link of links) {
        const matches = await queryArticlesByLink(link);
        const feeds = new Set(matches.map((m) => m.feedId));
        feeds.delete(feed.id);
        let minPublished: number | undefined;
        for (const m of matches) {
            if (m.published < (minPublished ?? Number.POSITIVE_INFINITY)) minPublished = m.published;
        }
        linkInfo.set(link, {matches, otherFeeds: feeds.size, minPublished});
    }

    // Affinity keys for the incoming feed AND every syndicated copy that might
    // get bumped, so their feed/domain/author affinity isn't silently zero.
    const metaKeys = [`aff:feed:${feed.id}`];
    for (const host of hosts) metaKeys.push(`aff:domain:${host}`);
    for (const author of authors) metaKeys.push(`aff:author:${author}`);
    for (const info of linkInfo.values()) {
        for (const other of info.matches) {
            metaKeys.push(`aff:feed:${other.feedId}`);
            const host = domainOf(other.link);
            if (host) metaKeys.push(`aff:domain:${host}`);
            if (other.author) metaKeys.push(`aff:author:${other.author.toLowerCase()}`);
        }
    }
    const affMap = await getMetaMany(metaKeys);
    const feedAffinity = affMap.get(`aff:feed:${feed.id}`) ?? 0;

    const items: Article[] = [];
    const bumpsByLink = new Map<string, Map<string, BumpSpec>>();
    for (const item of parsed.items) {
        const normLink = item.link ? normalizeLink(item.link) : undefined;
        const info = normLink ? linkInfo.get(normLink) : undefined;
        const otherFeeds = info?.otherFeeds ?? 0;
        const popularity = popularityScore(otherFeeds + 1, item.comments ?? 0);
        const velocity = normLink
            ? velocityBonus(info?.otherFeeds ?? 0, info?.minPublished !== undefined ? now - info.minPublished : undefined)
            : 0;
        const engagement = engagementFor(item, feedAffinity, affMap, velocity);
        items.push(buildArticle(feed.id, item, popularity, engagement));
        if (!normLink || !info || info.otherFeeds === 0) continue;

        // Candidate bumps for this link; ingestArticlesTx applies them only
        // for links this ingest actually inserted, re-reading each copy in
        // the transaction so concurrent changes are never clobbered. Keyed by
        // article id so a feed listing the same story twice bumps once.
        const velocityForBumps = velocityBonus(
            info.otherFeeds,
            info.minPublished !== undefined ? now - info.minPublished : undefined,
        );
        let specsById = bumpsByLink.get(normLink);
        if (!specsById) {
            specsById = new Map<string, BumpSpec>();
            bumpsByLink.set(normLink, specsById);
        }
        for (const other of info.matches) {
            if (other.feedId === feed.id) continue;
            const otherAffinity = affMap.get(`aff:feed:${other.feedId}`) ?? 0;
            const domainAffinity = other.link ? (affMap.get(`aff:domain:${domainOf(other.link)}`) ?? 0) : 0;
            const authorAffinity = other.author ? (affMap.get(`aff:author:${other.author.toLowerCase()}`) ?? 0) : 0;
            specsById.set(other.id, {
                id: other.id,
                affinityBoost: affinityBoostScore(otherAffinity + domainAffinity + authorAffinity),
                velocity: velocityForBumps,
            });
        }
    }

    return ingestArticlesTx(items, bumpsByLink, feedPatch, createIfMissing);
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

        const patch: Feed = {
            ...feed,
            title: feed.title === feed.url ? parsed.title : feed.title,
            siteUrl: parsed.siteUrl || feed.siteUrl,
            lastFetchedAt: Date.now(),
            lastError: undefined,
        };
        // The patch is persisted inside the ingest transaction with the
        // freshly computed unread counter (read in-transaction, not from
        // the caller's snapshot).
        const {inserted} = await ingestFeed(feed, parsed, patch, false);

        return {inserted, total: parsed.items.length, title: parsed.title};
    } catch (err) {
        // If the feed was deleted mid-sync, don't recreate it with an error.
        await updateFeedErrorIfExists(feed.id, err instanceof Error ? err.message : String(err));
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
        lastFetchedAt: Date.now(),
    };

    const {unread} = await ingestFeed(feed, parsed, feed, true);
    feed.unread = unread;

    return feed;
}
