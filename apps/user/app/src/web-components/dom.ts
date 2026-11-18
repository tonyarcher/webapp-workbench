export interface InlineStyles {
    readonly cssText: string;
}

export function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className !== undefined) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function append(parent: ParentNode, ...nodes: Array<Node | null>): void {
    for (const node of nodes) {
        if (node !== null) parent.appendChild(node);
    }
}

export function paint(host: HTMLElement, styles: InlineStyles, ...nodes: Array<Node | null>): void {
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles.cssText;
    root.replaceChildren(style, ...nodes.filter((node): node is Node => node !== null));
}
