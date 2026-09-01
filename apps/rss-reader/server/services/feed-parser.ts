import {DOMParser, parseHTML} from 'linkedom';
import type {ParsedFeed} from '../types.js';

// ---- safe URL helper ----

export function safeHttpUrl(url: string | undefined | null): string | undefined {
    if (!url) return undefined;
    try {
        const u = new URL(url.trim());
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
    } catch {
        return undefined;
    }
}

// ---- element helpers (linkedom DOM) ----

function el(root: Document, name: string): Element | null {
    return root.getElementsByTagName(name)[0] ?? null;
}

function childText(node: Element, name: string): string {
    const c = node.getElementsByTagName(name)[0];
    return c?.textContent?.trim() ?? '';
}

function parseDate(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const t = Date.parse(value);
    return Number.isNaN(t) ? fallback : t;
}

/**
 * Find element by local name, trying common RSS/Atom namespace prefixes.
 * linkedom's getElementsByTagNameNS('*', localName) doesn't work for XML,
 * so we fall back to trying well-known prefixes.
 */
function findByLocalName(element: Element, localName: string): Element | null {
    const nsResult = element.getElementsByTagNameNS('*', localName)[0];
    if (nsResult) return nsResult;
    const prefixes = ['dc:', 'content:', 'slash:', 'thr:', 'media:', 'itunes:', ''];
    for (const prefix of prefixes) {
        const el = element.getElementsByTagName(`${prefix}${localName}`)[0];
        if (el) return el;
    }
    return null;
}

function parseCommentCount(item: Element): number | undefined {
    const node = findByLocalName(item, 'comments')
        ?? findByLocalName(item, 'total')
        ?? findByLocalName(item, 'comment_count')
        ?? findByLocalName(item, 'comment-count');
    const candidate = node?.textContent?.trim();
    if (!candidate) return undefined;
    const n = Number(candidate);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

function isImageType(type: string | null): boolean {
    return type === null || /^image\//.test(type);
}

function enclosureMedia(item: Element): string | undefined {
    const enc = item.getElementsByTagName('enclosure')[0];
    const url = enc?.getAttribute('url');
    if (url && isImageType(enc.getAttribute('type'))) return safeHttpUrl(url);
    return undefined;
}

function mediaContentUrl(node: Element): string | undefined {
    const url = node.getAttribute('url');
    if (!url) return undefined;
    if (node.getAttribute('medium') === 'image' || isImageType(node.getAttribute('type'))) return safeHttpUrl(url);
    return undefined;
}

function thumbFrom(nodes: Element[]): string | undefined {
    for (const node of nodes) {
        const url = node.getAttribute('url');
        if (url) return safeHttpUrl(url);
    }
    return undefined;
}

function mediaFromTags(item: Element, tag: string): string | undefined {
    for (const node of Array.from(item.getElementsByTagName(tag))) {
        const m = mediaContentUrl(node);
        if (m) return m;
    }
    return undefined;
}

function mediaFromNs(item: Element, local: string): string | undefined {
    for (const node of Array.from(item.getElementsByTagNameNS('*', local))) {
        const m = mediaContentUrl(node);
        if (m) return m;
    }
    return undefined;
}

function parseMedia(item: Element): string | undefined {
    const enc = enclosureMedia(item);
    if (enc) return enc;
    const mc = mediaFromTags(item, 'media:content');
    if (mc) return mc;
    const cnt = mediaFromNs(item, 'content');
    if (cnt) return cnt;
    const thumb1 = thumbFrom(Array.from(item.getElementsByTagName('media:thumbnail')));
    if (thumb1) return thumb1;
    return thumbFrom(Array.from(item.getElementsByTagNameNS('*', 'thumbnail')));
}

function isEnclosureLink(link: Element): string | undefined {
    if (link.getAttribute('rel') !== 'enclosure') return undefined;
    if (!isImageType(link.getAttribute('type'))) return undefined;
    const href = link.getAttribute('href');
    if (!href) return undefined;
    return safeHttpUrl(href);
}

function parseAtomMedia(entry: Element): string | undefined {
    for (const link of Array.from(entry.getElementsByTagName('link'))) {
        const m = isEnclosureLink(link);
        if (m) return m;
    }
    return undefined;
}

const FEED_ROOTS = new Set(['rss', 'feed', 'rdf']);

/** Parse RSS/Atom XML into a ParsedFeed. Throws on invalid XML or non-feed documents. */
export function parseFeedXml(xml: string, fallbackPublished: number): ParsedFeed {
    const parser = new DOMParser();
    // linkedom returns XMLDocument; cast to Document for standard DOM API usage
    const doc = parser.parseFromString(xml, 'text/xml') as unknown as Document;

    const root = doc.documentElement;
    const tag = root?.tagName?.toLowerCase() ?? '';
    const base = tag.split(':').pop() ?? '';
    if (!FEED_ROOTS.has(base)) {
        throw new Error('Not a valid RSS/Atom feed (HTML or other document)');
    }

    if (base === 'feed') {
        return parseAtom(doc, fallbackPublished);
    }
    return parseRss(doc, fallbackPublished);
}

function rssPubDate(item: Element, fallbackPublished: number): number {
    const dcDate = findByLocalName(item, 'date')?.textContent?.trim();
    const pubDate = childText(item, 'pubDate') || dcDate;
    return parseDate(pubDate, fallbackPublished);
}

function rssAuthor(item: Element): string | undefined {
    const dcCreator = findByLocalName(item, 'creator')?.textContent?.trim();
    return childText(item, 'author') || dcCreator || undefined;
}

function rssContent(item: Element): string | undefined {
    const description = childText(item, 'description');
    const encoded = findByLocalName(item, 'encoded')?.textContent?.trim() ?? '';
    return encoded || description || undefined;
}

function rssGuid(item: Element, published: number, feedTitle: string): string {
    const g = childText(item, 'guid') || childText(item, 'link') || '';
    return g || `${published}-${feedTitle}`;
}

function rssTitle(item: Element): string {
    return childText(item, 'title') || '(untitled)';
}

function rssSummary(desc: string): string | undefined {
    return stripHtml(desc).slice(0, 500) || undefined;
}

function rssItem(item: Element, fallbackPublished: number, feedTitle: string) {
    const published = rssPubDate(item, fallbackPublished);
    const description = childText(item, 'description');
    const content = rssContent(item);
    return {
        guid: rssGuid(item, published, feedTitle),
        title: rssTitle(item),
        link: safeHttpUrl(childText(item, 'link')),
        author: rssAuthor(item),
        summary: rssSummary(description),
        content,
        media: parseMedia(item) ?? firstImageUrl(content),
        comments: parseCommentCount(item),
        published,
    };
}

function parseRss(doc: Document, fallbackPublished: number): ParsedFeed {
    const channel = el(doc, 'channel') ?? doc.documentElement;
    const title = childText(channel, 'title') || 'Untitled feed';
    const siteUrl = childText(channel, 'link') || undefined;
    const items = Array.from(doc.getElementsByTagName('item')).map((it) => rssItem(it, fallbackPublished, title));
    return {title, siteUrl, items};
}

function atomSiteUrl(feedEl: Element): string | undefined {
    let siteUrl: string | undefined;
    for (const link of Array.from(feedEl.getElementsByTagName('link'))) {
        const href = safeHttpUrl(link.getAttribute('href'));
        if (href && (!siteUrl || link.getAttribute('rel') === 'alternate')) siteUrl = href;
    }
    return siteUrl;
}

function atomLink(entry: Element): string | undefined {
    let link: string | undefined;
    for (const l of Array.from(entry.getElementsByTagName('link'))) {
        const href = safeHttpUrl(l.getAttribute('href'));
        if (href && (!link || l.getAttribute('rel') === 'alternate')) link = href;
    }
    return link;
}

function atomPublished(entry: Element, fallbackPublished: number): number {
    return parseDate(childText(entry, 'published'), 0) || parseDate(childText(entry, 'updated'), 0) || fallbackPublished;
}

function atomGuid(entry: Element, link: string | undefined, published: number, feedTitle: string): string {
    return childText(entry, 'id') || link || `${published}-${feedTitle}`;
}

function atomSummary(s: string): string | undefined {
    return stripHtml(s).slice(0, 500) || undefined;
}

function atomEntry(entry: Element, fallbackPublished: number, feedTitle: string) {
    const link = atomLink(entry);
    const published = atomPublished(entry, fallbackPublished);
    const summary = childText(entry, 'summary');
    const content = childText(entry, 'content');
    return {
        guid: atomGuid(entry, link, published, feedTitle),
        title: childText(entry, 'title') || '(untitled)',
        link,
        author: childText(entry, 'name') || undefined,
        summary: atomSummary(summary),
        content: content || summary || undefined,
        media: parseAtomMedia(entry) ?? firstImageUrl(content || summary || undefined),
        comments: parseCommentCount(entry),
        published,
    };
}

function parseAtom(doc: Document, fallbackPublished: number): ParsedFeed {
    const feedEl = doc.documentElement;
    const title = childText(feedEl, 'title') || 'Untitled feed';
    const siteUrl = atomSiteUrl(feedEl);
    const items = Array.from(doc.getElementsByTagName('entry')).map((e) => atomEntry(e, fallbackPublished, title));
    return {title, siteUrl, items};
}

// ---- stripHtml ----

export function stripHtml(html: string | undefined): string {
    if (!html) return '';
    let text: string;
    try {
        const {document} = parseHTML('<div>' + html + '</div>');
        // linkedom puts content on documentElement, not body
        text = document.documentElement?.textContent ?? '';
    } catch {
        text = html.replace(/<[^>]*>/g, ' ');
    }
    return text.replace(/\s+/g, ' ').trim();
}

/** First image URL inside an HTML string, if any (http(s) only). Mirrors
 *  src/services/parser.ts so client and server agree on thumbnails. */
export function firstImageUrl(html: string | undefined): string | undefined {
    if (!html) return undefined;
    // Lazy-loading sites often defer the real URL to data-* attributes.
    const lazy = /<img[^>]+(?:data-src|data-lazy-src|data-original)=["']([^"']+)["']/i.exec(html);
    if (lazy) return safeHttpUrl(lazy[1]);
    const src = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
    if (src) return safeHttpUrl(src[1]);
    const srcset = /<img[^>]+srcset=["']([^"']+)["']/i.exec(html);
    if (srcset) {
        const first = srcset[1].split(',')[0]?.trim().split(' ')[0];
        if (first) return safeHttpUrl(first);
    }
    return undefined;
}
