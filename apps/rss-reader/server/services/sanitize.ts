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

/**
 * Allowlist-based HTML sanitizer for feed article bodies. Keeps formatting,
 * links, images, and tables; strips every other tag, attribute, and URL
 * scheme. Unknown tags are unwrapped (children kept) so text survives.
 */
export function sanitizeHtml(html: string | undefined): string {
    if (!html) return '';
    let document: ReturnType<typeof parseHTML>['document'];
    try {
        ({document} = parseHTML('<div>' + html + '</div>'));
    } catch {
        return stripHtml(html);
    }
    // linkedom puts content on documentElement, not body
    const root = document.documentElement;
    for (const node of Array.from(root.querySelectorAll('*'))) {
        const tag = node.tagName.toLowerCase();
        if (DROP_TAGS.has(tag)) {
            node.parentNode?.removeChild(node);
            continue;
        }
        const allowedAttrs = ATTR_ALLOWLIST[tag] ?? new Set<string>();
        for (const attr of Array.from(node.attributes)) {
            const name = attr.name.toLowerCase();
            if (!allowedAttrs.has(name)) {
                node.removeAttribute(attr.name);
                continue;
            }
            if (name === 'href' || name === 'src') {
                const safe = safeUrlValue(attr.value);
                if (safe) {
                    node.setAttribute(name, safe);
                } else {
                    node.removeAttribute(name);
                }
            } else if (name === 'srcset') {
                const safe = safeSrcset(attr.value);
                if (safe) {
                    node.setAttribute(name, safe);
                } else {
                    node.removeAttribute(name);
                }
            }
        }
        if (!SAFE_TAGS.has(tag)) {
            const parent = node.parentNode;
            if (parent) {
                while (node.firstChild) parent.insertBefore(node.firstChild, node);
                parent.removeChild(node);
            }
        }
    }
    // root IS the wrapper div; innerHTML gives us the sanitized content
    return root.innerHTML ?? '';
}
