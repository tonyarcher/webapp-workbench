/**
 * Minimal DOM builders for the vanilla article-list renderers.
 *
 * Every value that comes from a feed or the API is written with textContent
 * or setAttribute, never parsed as markup. SVG glyphs are built in the SVG
 * namespace from static literals in the caller.
 */
export type DomChild = Node | string | number | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string | number,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className !== undefined) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
}

export function append(parent: Node, ...children: DomChild[]): void {
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build an SVG element from a literal attribute map and literal child shapes. */
export function svgIcon(attrs: Record<string, string>, children: Array<[string, Record<string, string>]>): SVGElement {
    const root = document.createElementNS(SVG_NS, 'svg');
    for (const [name, value] of Object.entries(attrs)) root.setAttribute(name, value);
    for (const [tag, shape] of children) {
        const node = document.createElementNS(SVG_NS, tag);
        for (const [name, value] of Object.entries(shape)) node.setAttribute(name, value);
        root.appendChild(node);
    }
    return root;
}

/**
 * Append already-sanitized article HTML into a DOM node.
 *
 * sanitized: the markup is the return value of services/parser.ts
 * sanitizeHtml(article.content); no raw feed content reaches this function.
 */
export function appendSanitized(parent: HTMLElement, html: string): void {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.body ?? doc.documentElement;
    while (root.firstChild) parent.appendChild(root.firstChild);
}
