import {parseHTML} from 'linkedom';

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

const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math']);

function safeHttpUrl(url: string | undefined | null): string | undefined {
    if (!url) return undefined;
    try {
        const u = new URL(url.trim());
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
    } catch {
        return undefined;
    }
}

function safeUrlValue(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.startsWith('//')) {
        return safeHttpUrl('https:' + trimmed) ?? null;
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

function handleAllowedAttr(node: Element, name: string, value: string): void {
    if (name === 'href' || name === 'src') {
        const safe = safeUrlValue(value);
        if (safe) (node as Element).setAttribute(name, safe);
        else (node as Element).removeAttribute(name);
        return;
    }
    if (name === 'srcset') {
        const safe = safeSrcset(value);
        if (safe) (node as Element).setAttribute(name, safe);
        else (node as Element).removeAttribute(name);
    }
}

function sanitizeNodeAttrs(node: Element, tag: string): void {
    const allowed = ATTR_ALLOWLIST[tag] ?? new Set<string>();
    for (const attr of Array.from((node as Element).attributes)) {
        const name = attr.name.toLowerCase();
        if (!allowed.has(name)) {
            (node as Element).removeAttribute(attr.name);
            continue;
        }
        handleAllowedAttr(node as Element, name, attr.value);
    }
}

function unwrapNode(node: Element): void {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
}

function sanitizeRoot(root: Element): void {
    for (const node of Array.from(root.querySelectorAll('*'))) {
        const tag = (node as Element).tagName.toLowerCase();
        if (DROP_TAGS.has(tag)) {
            node.parentNode?.removeChild(node);
            continue;
        }
        sanitizeNodeAttrs(node as Element, tag);
        if (!SAFE_TAGS.has(tag)) unwrapNode(node as Element);
    }
}

export function sanitizeHtml(html: string | undefined): string {
    if (!html) return '';
    let document: ReturnType<typeof parseHTML>['document'];
    try {
        ({document} = parseHTML('<div>' + html + '</div>'));
    } catch {
        return stripHtml(html);
    }
    const root = document.documentElement as unknown as Element;
    sanitizeRoot(root);
    return (root as unknown as {innerHTML?: string}).innerHTML ?? '';
}
