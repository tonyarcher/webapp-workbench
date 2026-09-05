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

function withMedia(content: string | undefined, media: string | undefined): string | undefined {
    if (media && firstImageUrl(content) !== media) return `<img src="${media}" alt="">` + (content ?? '');
    return content;
}

function buildArticle(
    feedId: string,
    item: ParsedItem,
    popularity: number,
    engagement: number,
): Article {
    const normLink = item.link ? normalizeLink(item.link) : undefined;
    const content = withMedia(item.content, item.media);
    return {
        id: `${feedId}:${item.guid}`,
        feedId,
        guid: item.guid,
        title: item.title,
        link: item.link,
        author: item.author,
        summary: item.summary,
        content,
        comments: item.comments,
        published: item.published,
        fetchedAt: Date.now(),
        read: 0,
        starred: false,
        normLink,
        popularity,
        engagement,
        hot: hotScore(popularity, engagement, item.published),
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
function collectHostsAuthors(items: ParsedItem[]): {hosts: Set<string>; authors: Set<string>} {
    const hosts = new Set<string>();
    const authors = new Set<string>();
    for (const item of items) {
        if (item.link) {
            const host = domainOf(item.link);
            if (host) hosts.add(host);
        }
        if (item.author) authors.add(item.author.toLowerCase());
    }
    return {hosts, authors};
}

function collectLinks(items: ParsedItem[]): Set<string> {
    return new Set(items.map((it) => (it.link ? normalizeLink(it.link) : undefined)).filter((l): l is string => Boolean(l)));
}

async function buildLinkInfo(links: Set<string>, feedId: string): Promise<Map<string, {matches: Article[]; otherFeeds: number; minPublished: number | undefined}>> {
    const m = new Map<string, {matches: Article[]; otherFeeds: number; minPublished: number | undefined}>();
    for (const link of links) {
        const matches = await queryArticlesByLink(link);
        const feeds = new Set(matches.map((x) => x.feedId));
        feeds.delete(feedId);
        let minPublished: number | undefined;
        for (const mm of matches) if (mm.published < (minPublished ?? Number.POSITIVE_INFINITY)) minPublished = mm.published;
        m.set(link, {matches, otherFeeds: feeds.size, minPublished});
    }
    return m;
}

function buildMetaKeys(feed: Feed, hosts: Set<string>, authors: Set<string>, linkInfo: Map<string, {matches: Article[]}>): string[] {
    const keys = [`aff:feed:${feed.id}`];
    for (const h of hosts) keys.push(`aff:domain:${h}`);
    for (const a of authors) keys.push(`aff:author:${a}`);
    for (const info of linkInfo.values()) for (const other of info.matches) {
        keys.push(`aff:feed:${other.feedId}`);
        const host = domainOf(other.link);
        if (host) keys.push(`aff:domain:${host}`);
        if (other.author) keys.push(`aff:author:${other.author.toLowerCase()}`);
    }
    return keys;
}

function bumpsFor(itemInfo: {matches: Article[]; otherFeeds: number; minPublished: number | undefined}, affMap: Map<string, number>, feedId: string): Map<string, BumpSpec> {
    const velocity = velocityBonus(itemInfo.otherFeeds, itemInfo.minPublished !== undefined ? Date.now() - itemInfo.minPublished : undefined);
    const out = new Map<string, BumpSpec>();
    for (const other of itemInfo.matches) {
        if (other.feedId === feedId) continue;
        const otherAffinity = affMap.get(`aff:feed:${other.feedId}`) ?? 0;
        const dAff = other.link ? (affMap.get(`aff:domain:${domainOf(other.link)}`) ?? 0) : 0;
        const aAff = other.author ? (affMap.get(`aff:author:${other.author.toLowerCase()}`) ?? 0) : 0;
        out.set(other.id, {id: other.id, affinityBoost: affinityBoostScore(otherAffinity + dAff + aAff), velocity});
    }
    return out;
}

function itemMetrics(item: ParsedItem, linkInfo: Map<string, {matches: Article[]; otherFeeds: number; minPublished: number | undefined}>, now: number): {normLink: string | undefined; info: {matches: Article[]; otherFeeds: number; minPublished: number | undefined} | undefined; popularity: number; velocity: number} {
    const normLink = item.link ? normalizeLink(item.link) : undefined;
    const info = normLink ? linkInfo.get(normLink) : undefined;
    const otherFeeds = info?.otherFeeds ?? 0;
    const popularity = popularityScore(otherFeeds + 1, item.comments ?? 0);
    const velocity = normLink ? velocityBonus(otherFeeds, info?.minPublished !== undefined ? now - info.minPublished : undefined) : 0;
    return {normLink, info, popularity, velocity};
}

function mergeBumps(bumpsByLink: Map<string, Map<string, BumpSpec>>, normLink: string, specs: Map<string, BumpSpec>): void {
    let existing = bumpsByLink.get(normLink);
    if (!existing) { existing = new Map<string, BumpSpec>(); bumpsByLink.set(normLink, existing); }
    for (const [k, v] of specs) if (!existing.has(k)) existing.set(k, v);
}

function buildItemsAndBumps(parsed: ParsedFeed, feed: Feed, linkInfo: Map<string, {matches: Article[]; otherFeeds: number; minPublished: number | undefined}>, affMap: Map<string, number>, feedAffinity: number, now: number): {items: Article[]; bumpsByLink: Map<string, Map<string, BumpSpec>>} {
    const items: Article[] = [];
    const bumpsByLink = new Map<string, Map<string, BumpSpec>>();
    for (const item of parsed.items) {
        const {normLink, info, popularity, velocity} = itemMetrics(item, linkInfo, now);
        items.push(buildArticle(feed.id, item, popularity, engagementFor(item, feedAffinity, affMap, velocity)));
        if (!normLink || !info || info.otherFeeds === 0) continue;
        mergeBumps(bumpsByLink, normLink, bumpsFor(info, affMap, feed.id));
    }
    return {items, bumpsByLink};
}

export async function ingestFeed(
    feed: Feed,
    parsed: ParsedFeed,
    feedPatch: Feed,
    createIfMissing: boolean,
): Promise<{inserted: number; unread: number}> {
    const {hosts, authors} = collectHostsAuthors(parsed.items);
    const links = collectLinks(parsed.items);
    const linkInfo = await buildLinkInfo(links, feed.id);
    const affMap = await getMetaMany(buildMetaKeys(feed, hosts, authors, linkInfo));
    const feedAffinity = affMap.get(`aff:feed:${feed.id}`) ?? 0;
    const {items, bumpsByLink} = buildItemsAndBumps(parsed, feed, linkInfo, affMap, feedAffinity, Date.now());
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
