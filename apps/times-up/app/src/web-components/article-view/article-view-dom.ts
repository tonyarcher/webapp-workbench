/** Small DOM builders shared by the article-view renderer modules. */

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

export function appendAll(parent: Node, nodes: Node[]): void {
    for (const node of nodes) parent.appendChild(node);
}

export interface IconButtonOptions {
    className?: string;
    label: string;
    title: string;
    pressed?: boolean;
    disabled?: boolean;
    onClick: (e: Event) => void;
}

export function iconButton(icon: SVGElement, options: IconButtonOptions): HTMLButtonElement {
    const btn = el('button', `btn icon-btn${options.className ? ` ${options.className}` : ''}`);
    btn.setAttribute('aria-label', options.label);
    btn.title = options.title;
    if (options.pressed !== undefined) btn.setAttribute('aria-pressed', String(options.pressed));
    if (options.disabled) btn.disabled = true;
    btn.appendChild(icon);
    btn.addEventListener('click', options.onClick);
    return btn;
}
