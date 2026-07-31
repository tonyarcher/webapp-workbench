import type { OpmlFolder, OpmlNode, OpmlSource, ParsedFeed } from '../types';

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

export function parseFeedXml(xml: string, fallbackPublished: number): ParsedFeed {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Could not parse feed XML');
  }

  const root = doc.documentElement;
  const tag = root?.tagName?.toLowerCase() ?? '';

  if (tag === 'feed') {
    return parseAtom(doc, fallbackPublished);
  }
  return parseRss(doc, fallbackPublished);
}

function parseRss(doc: Document, fallbackPublished: number): ParsedFeed {
  const channel = el(doc, 'channel') ?? doc.documentElement;
  const title = childText(channel, 'title') || 'Untitled feed';
  const siteUrl = childText(channel, 'link') || undefined;

  const items = Array.from(doc.getElementsByTagName('item')).map((item) => {
    const guid = childText(item, 'guid') || childText(item, 'link') || '';
    const link = childText(item, 'link') || undefined;
    const dcDate = item.getElementsByTagNameNS('*', 'date')[0]?.textContent?.trim();
    const dcCreator = item.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim();
    const pubDate = childText(item, 'pubDate') || dcDate;
    const author = childText(item, 'author') || dcCreator || undefined;
    const description = childText(item, 'description');
    const encoded = item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent?.trim() ?? '';
    const content = encoded || description || undefined;
    const published = parseDate(pubDate, fallbackPublished);

    return {
      guid: guid || `${published}-${title}`,
      title: childText(item, 'title') || '(untitled)',
      link,
      author,
      summary: stripHtml(description).slice(0, 500) || undefined,
      content,
      comments: parseCommentCount(item),
      published,
    };
  });

  return { title, siteUrl, items };
}

function parseAtom(doc: Document, fallbackPublished: number): ParsedFeed {
  const feedEl = doc.documentElement;
  const title = childText(feedEl, 'title') || 'Untitled feed';

  let siteUrl: string | undefined;
  for (const link of Array.from(feedEl.getElementsByTagName('link'))) {
    if (!siteUrl || link.getAttribute('rel') === 'alternate') {
      siteUrl = link.getAttribute('href') || undefined;
    }
  }

  const items = Array.from(doc.getElementsByTagName('entry')).map((entry) => {
    let link: string | undefined;
    for (const l of Array.from(entry.getElementsByTagName('link'))) {
      if (!link || l.getAttribute('rel') === 'alternate') {
        link = l.getAttribute('href') || undefined;
      }
    }
    const published =
      parseDate(childText(entry, 'published'), 0) ||
      parseDate(childText(entry, 'updated'), 0) ||
      fallbackPublished;
    const author = childText(entry, 'name') || undefined;
    const summary = childText(entry, 'summary');
    const content = childText(entry, 'content');

    return {
      guid: childText(entry, 'id') || link || `${published}-${title}`,
      title: childText(entry, 'title') || '(untitled)',
      link,
      author,
      summary: stripHtml(summary).slice(0, 500) || undefined,
      content: content || summary || undefined,
      comments: parseCommentCount(entry),
      published,
    };
  });

  return { title, siteUrl, items };
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

export function sanitizeHtml(html: string | undefined): string {
  if (!html) return '';
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return stripHtml(html);
  }
  const root = (doc as Document & { body?: HTMLElement }).body ?? doc.documentElement;
  for (const node of Array.from(root.getElementsByTagName('*'))) {
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed'].includes(tag)) {
      node.parentNode?.removeChild(node);
      continue;
    }
    for (const attr of Array.from(node.attributes)) {
      if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
    }
  }
  return (doc as Document & { body?: HTMLElement }).body?.innerHTML ?? '';
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
