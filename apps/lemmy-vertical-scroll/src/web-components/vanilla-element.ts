import type { CSSResult, ReactiveController, ReactiveControllerHost } from 'lit';

export type DOMChild = Node | string | number | false | null | undefined;

/** Create an element without interpreting any value as markup. */
export function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string | null = null,
    text: string | number | null = null,
): HTMLElementTagNameMap[K] {
    const result = document.createElement(tag);
    if (className !== null) result.className = className;
    if (text !== null) result.textContent = String(text);
    return result;
}

export function append(parent: Node, ...children: DOMChild[]): void {
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
}

export function fragment(...children: DOMChild[]): DocumentFragment {
    const result = document.createDocumentFragment();
    append(result, ...children);
    return result;
}

function childNodes(children: DOMChild[]): Node[] {
    const nodes: Node[] = [];
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        if (child instanceof DocumentFragment) {
            nodes.push(...Array.from(child.childNodes));
        } else {
            nodes.push(child instanceof Node ? child : document.createTextNode(String(child)));
        }
    }
    return nodes;
}

/**
 * Minimal custom-element host for the app's existing reactive controllers.
 * Property setters request a batched render; no template or HTML parser is involved.
 */
export abstract class VanillaElement extends HTMLElement implements ReactiveControllerHost {
    static styles: CSSResult | undefined;

    readonly renderRoot: ShadowRoot;
    private readonly controllers = new Set<ReactiveController>();
    private changedProperties = new Map<string, unknown>();
    private updatePending = false;
    private updatePromise: Promise<boolean> = Promise.resolve(true);
    private resolveUpdate: ((value: boolean) => void) | null = null;

    constructor() {
        super();
        this.renderRoot = this.attachShadow({ mode: 'open' });
        const cssText = (this.constructor as typeof VanillaElement).styles?.cssText;
        if (cssText !== undefined) {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(cssText);
            this.renderRoot.adoptedStyleSheets = [sheet];
        }
    }

    connectedCallback(): void {
        for (const controller of this.controllers) controller.hostConnected?.();
        this.requestUpdate();
    }

    disconnectedCallback(): void {
        for (const controller of this.controllers) controller.hostDisconnected?.();
    }

    addController(controller: ReactiveController): void {
        this.controllers.add(controller);
    }

    removeController(controller: ReactiveController): void {
        this.controllers.delete(controller);
    }

    requestUpdate(name?: string, oldValue?: unknown): void {
        if (name !== undefined && !this.changedProperties.has(name)) {
            this.changedProperties.set(name, oldValue);
        }
        if (this.updatePending || !this.isConnected) return;
        this.updatePending = true;
        this.updatePromise = new Promise((resolve) => {
            this.resolveUpdate = resolve;
        });
        queueMicrotask(() => this.performUpdate());
    }

    get updateComplete(): Promise<boolean> {
        return this.updatePromise;
    }

    protected willUpdate(_changed: Map<string, unknown>): void {}

    protected updated(_changed: Map<string, unknown>): void {}

    abstract render(): void;

    /** Replace changed children while retaining nodes deliberately reused by a component. */
    protected setContent(...children: DOMChild[]): void {
        const desired = childNodes(children);
        const desiredSet = new Set(desired);
        let current = this.renderRoot.firstChild;
        for (const node of desired) {
            if (current === node) {
                current = current.nextSibling;
                continue;
            }
            if (node.parentNode === this.renderRoot) {
                this.renderRoot.insertBefore(node, current);
                continue;
            }
            const next = current?.nextSibling ?? null;
            if (current) {
                this.renderRoot.replaceChild(node, current);
                current = next;
            } else {
                this.renderRoot.appendChild(node);
            }
        }
        for (const node of Array.from(this.renderRoot.childNodes)) {
            if (!desiredSet.has(node)) this.renderRoot.removeChild(node);
        }
    }

    private performUpdate(): void {
        if (!this.updatePending) return;
        this.updatePending = false;
        if (!this.isConnected) {
            this.resolveUpdate?.(true);
            this.resolveUpdate = null;
            return;
        }
        const changed = this.changedProperties;
        this.changedProperties = new Map<string, unknown>();
        for (const controller of this.controllers) controller.hostUpdate?.();
        this.willUpdate(changed);
        this.render();
        for (const controller of this.controllers) controller.hostUpdated?.();
        this.updated(changed);
        this.resolveUpdate?.(true);
        this.resolveUpdate = null;
    }
}
