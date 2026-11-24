/** Small DOM and text helpers for the vanilla Today view. */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

const TRAILING_READ_MORE = /\s*(?:read\s+more|continue\s+reading)(?:\s*[.…])?\s*$/i;

/** Feeds often append a link label to the summary; it is not article text. */
export function cleanSummary(text: string | undefined): string {
    return (text ?? '').replace(TRAILING_READ_MORE, '').trim();
}

export function chevronIcon(direction: 'down' | 'up'): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', direction === 'down' ? 'M4 6.5 8 10.5 12 6.5' : 'M4 9.5 8 5.5 12 9.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
}

/** Enables the bottom handle only when a clamped line actually overflows. */
export function updateExpandHandle(row: HTMLElement, handle: HTMLButtonElement): void {
    requestAnimationFrame(() => {
        if (!row.isConnected) return;
        const overflow = [...row.querySelectorAll<HTMLElement>('.medium-summary, .medium-excerpt')].some(
            (node) => node.scrollHeight > node.clientHeight + 1,
        );
        handle.disabled = !overflow;
    });
}
