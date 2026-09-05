import type {OpmlFolder, OpmlNode, OpmlSource, ParsedFeed} from '../types';

/**
 * Returns the URL if it is absolute http(s), else undefined. Blocks
 * javascript:, data:, vbscript:, file: and other active/embedded schemes in
 * feed-supplied hrefs and image sources.
 */
export function safeHttpUrl(url: string | undefined | null): string | undefined {
    if (!url) return undefined;
    try {
        const u = new URL(url.trim());
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
    } catch {
        return undefined;
    }
}

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

function parseCommentCount(item: Element): number | undefined {
    const text = (localName: string): string | undefined => {
        const node = item.getElementsByTagNameNS('*', localName)[0];
        return node?.textContent?.trim();
    };
    const candidate =
        text('comments') ?? text('total') ?? text('comment_count') ?? text('comment-count');
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

function thumbnailMedia(item: Element): string | undefined {
    for (const node of Array.from(item.getElementsByTagNameNS('*', 'thumbnail'))) {
        const url = node.getAttribute('url');
        if (url) return safeHttpUrl(url);
    }
    return undefined;
}

function parseMedia(item: Element): string | undefined {
    const enc = enclosureMedia(item);
    if (enc) return enc;
    for (const node of Array.from(item.getElementsByTagNameNS('*', 'content'))) {
        const m = mediaContentUrl(node);
        if (m) return m;
    }
    return thumbnailMedia(item);
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

export function parseFeedXml(xml: string, fallbackPublished: number): ParsedFeed {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Could not parse feed XML');
    }

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

function rssPublished(item: Element, fallbackPublished: number): number {
    const dcDate = item.getElementsByTagNameNS('*', 'date')[0]?.textContent?.trim();
    const pubDate = childText(item, 'pubDate') || dcDate;
    return parseDate(pubDate, fallbackPublished);
}

function rssAuthor(item: Element): string | undefined {
    const dcCreator = item.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim();
    return childText(item, 'author') || dcCreator || undefined;
}

function rssGuid(item: Element, published: number, feedTitle: string): string {
    const raw = childText(item, 'guid') || childText(item, 'link') || '';
    return raw || `${published}-${feedTitle}`;
}

function rssContentPair(item: Element): { description: string; content: string | undefined } {
    const description = childText(item, 'description');
    const encoded = item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent?.trim() ?? '';
    const content = encoded || description || undefined;
    return {description, content};
}

function rssItem(item: Element, fallbackPublished: number, feedTitle: string) {
    const published = rssPublished(item, fallbackPublished);
    const guid = rssGuid(item, published, feedTitle);
    const link = safeHttpUrl(childText(item, 'link'));
    const {description, content} = rssContentPair(item);
    return {
        guid,
        title: childText(item, 'title') || '(untitled)',
        link,
        author: rssAuthor(item),
        summary: stripHtml(description).slice(0, 500) || undefined,
        content,
        media: parseMedia(item),
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

function atomEntry(entry: Element, fallbackPublished: number, feedTitle: string) {
    const link = atomLink(entry);
    const published = atomPublished(entry, fallbackPublished);
    const summary = childText(entry, 'summary');
    const content = childText(entry, 'content');
    return {
        guid: childText(entry, 'id') || link || `${published}-${feedTitle}`,
        title: childText(entry, 'title') || '(untitled)',
        link,
        author: childText(entry, 'name') || undefined,
        summary: stripHtml(summary).slice(0, 500) || undefined,
        content: content || summary || undefined,
        media: parseAtomMedia(entry),
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

export function stripHtml(html: string | undefined): string {
  if (!html) return '';
  let text: string;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = (doc as Document & { body?: HTMLElement }).body ?? doc.documentElement;
    text = root?.textContent ?? '';
  } catch {
    text = html.replace(/<[^>]*>/g, ' ');
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** First image URL inside an HTML string, if any (http(s) only). */
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

/** Thumbnail for an article card, derived at render time from content. */
export function articleImage(article: { content?: string } & { image?: string }): string | undefined {
    const fromContent = firstImageUrl(article.content);
    if (fromContent) return fromContent;
    return safeHttpUrl((article as { image?: string }).image);
}

const SAFE_TAGS = new Set([
    'p',
    'div',
    'span',
    'br',
    'hr',
    'a',
    'img',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'code',
    'em',
    'strong',
    'b',
    'i',
    'u',
    's',
    'small',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'td',
    'th',
    'caption',
    'figure',
    'figcaption',
]);

const ATTR_ALLOWLIST: Record<string, Set<string>> = {
    a: new Set(['href', 'title']),
    img: new Set(['src', 'srcset', 'alt', 'title', 'width', 'height']),
    td: new Set(['colspan', 'rowspan']),
    th: new Set(['colspan', 'rowspan']),
};

// Tags that get removed wholesale (content included) rather than unwrapped.
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math']);

function safeUrlValue(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.startsWith('//')) {
        return safeHttpUrl(`https:${trimmed}`) ?? null;
    }
    return safeHttpUrl(trimmed) ?? null;
}

function safeSrcset(value: string): string | null {
    const out: string[] = [];
    for (const candidate of value.split(',')) {
        const parts = candidate.trim().split(/\s+/);
        const url = parts[0];
        if (!url) return null;
        const safe = safeUrlValue(url);
        if (!safe) return null;
        out.push([safe, ...parts.slice(1)].join(' '));
    }
    return out.length ? out.join(', ') : null;
}

function handleAllowedAttr(node: Element, name: string, value: string): void {
    if (name === 'href' || name === 'src') {
        const safe = safeUrlValue(value);
        if (safe) node.setAttribute(name, safe);
        else node.removeAttribute(name);
        return;
    }
    if (name === 'srcset') {
        const safe = safeSrcset(value);
        if (safe) node.setAttribute(name, safe);
        else node.removeAttribute(name);
    }
}

function sanitizeNodeAttrs(node: Element, tag: string): void {
    const allowed = ATTR_ALLOWLIST[tag] ?? new Set<string>();
    for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (!allowed.has(name)) {
            node.removeAttribute(attr.name);
            continue;
        }
        handleAllowedAttr(node, name, attr.value);
    }
}

function unwrapNode(node: Element): void {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
}

function sanitizeRoot(root: Element): void {
    for (const node of Array.from(root.getElementsByTagName('*'))) {
        const tag = node.tagName.toLowerCase();
        if (DROP_TAGS.has(tag)) {
            node.parentNode?.removeChild(node);
            continue;
        }
        sanitizeNodeAttrs(node, tag);
        if (!SAFE_TAGS.has(tag)) unwrapNode(node);
    }
}

export function sanitizeHtml(html: string | undefined): string {
    if (!html) return '';
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    } catch {
        return stripHtml(html);
    }
    const root = (doc as Document & { body?: HTMLElement }).body ?? doc.documentElement;
    sanitizeRoot(root);
    const body = (doc as Document & { body?: HTMLElement }).body;
    const serialized = body ? body.innerHTML : new XMLSerializer().serializeToString(root);
    return serialized.replace(/^<div[^>]*>/, '').replace(/<\/div>\s*$/, '');
}

function parseOpmlNode(outline: Element): OpmlNode {
    const xmlUrl = outline.getAttribute('xmlUrl');
    const children = Array.from(outline.children).filter((c) => c.tagName.toLowerCase() === 'outline');

    if (xmlUrl || children.length === 0) {
        return {
            title: outline.getAttribute('title') || outline.getAttribute('text') || 'Untitled',
            xmlUrl: xmlUrl ?? '',
            htmlUrl: outline.getAttribute('htmlUrl') || undefined,
        };
    }

    return {
        title: outline.getAttribute('title') || outline.getAttribute('text') || 'Untitled',
        children: children.map(parseOpmlNode),
    };
}

export function parseOpml(xml: string): OpmlNode[] {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('Could not parse OPML');
    const body = doc.getElementsByTagName('body')[0] ?? doc.documentElement;
    return Array.from(body.children)
        .filter((c) => c.tagName.toLowerCase() === 'outline')
        .map(parseOpmlNode);
}

export function isFolder(node: OpmlNode): node is OpmlFolder {
    return 'children' in node;
}

export function collectSources(nodes: OpmlNode[]): OpmlSource[] {
    const out: OpmlSource[] = [];
    const walk = (n: OpmlNode) => {
        if (isFolder(n)) n.children.forEach(walk);
        else if (n.xmlUrl) out.push(n);
    };
    nodes.forEach(walk);
    return out;
}
