import { el } from './article-view-dom';

const ALL_HIGHLIGHT = 'times-up-article-find';
const CURRENT_HIGHLIGHT = 'times-up-article-find-current';

/** Collect non-overlapping, case-insensitive matches without mutating article markup. */
export function findRanges(content: ParentNode, query: string): Range[] {
    const needle = query.toLowerCase();
    if (!needle) return [];
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
        const text = node.textContent ?? '';
        const lower = text.toLowerCase();
        let from = 0;
        let at = lower.indexOf(needle, from);
        while (at >= 0) {
            const range = document.createRange();
            range.setStart(node, at);
            range.setEnd(node, at + needle.length);
            ranges.push(range);
            from = at + needle.length;
            at = lower.indexOf(needle, from);
        }
        node = walker.nextNode();
    }
    return ranges;
}

export function stepFindIndex(index: number, count: number, delta: number): number {
    if (count <= 0) return 0;
    return (index + delta + count) % count;
}

/** In-article find state. The article element owns this controller's lifetime. */
export class ArticleFind {
    readonly bar: HTMLDivElement;
    open = false;
    private content: ParentNode | null = null;
    private ranges: Range[] = [];
    private index = 0;
    private readonly input: HTMLInputElement;
    private readonly count: HTMLSpanElement;
    private readonly scrollHost: HTMLElement;
    private readonly repaint: () => void;

    constructor(scrollHost: HTMLElement, repaint: () => void) {
        this.scrollHost = scrollHost;
        this.repaint = repaint;
        this.bar = el('div', 'find-bar');
        this.bar.setAttribute('role', 'search');
        this.input = el('input', 'find-input');
        this.input.type = 'search';
        this.input.placeholder = 'Find in article';
        this.input.setAttribute('aria-label', 'Find in article');
        this.input.addEventListener('input', () => this.setQuery(this.input.value));
        this.count = el('span', 'find-count');
        this.count.setAttribute('role', 'status');
        this.count.setAttribute('aria-live', 'polite');
        const previous = el('button', 'btn icon-btn', '↑');
        previous.type = 'button';
        previous.title = 'Previous match';
        previous.setAttribute('aria-label', 'Previous match');
        previous.addEventListener('click', () => this.step(-1));
        const next = el('button', 'btn icon-btn', '↓');
        next.type = 'button';
        next.title = 'Next match';
        next.setAttribute('aria-label', 'Next match');
        next.addEventListener('click', () => this.step(1));
        const close = el('button', 'btn icon-btn', '×');
        close.type = 'button';
        close.title = 'Close find';
        close.setAttribute('aria-label', 'Close find');
        close.addEventListener('click', () => this.close());
        this.bar.append(this.input, this.count, previous, next, close);
        this.bar.addEventListener('keydown', this.onBarKey);
        this.updateCount();
    }

    private onBarKey = (event: KeyboardEvent): void => {
        this.handleKeyDown(event);
    };

    get matchCount(): number {
        return this.ranges.length;
    }

    get currentIndex(): number {
        return this.index;
    }

    get focused(): boolean {
        const root = this.input.getRootNode();
        return root instanceof ShadowRoot && root.activeElement === this.input;
    }

    focusInput(select = true): void {
        this.input.focus();
        if (select) this.input.select();
    }

    private focusTrigger(): void {
        const trigger = this.scrollHost.shadowRoot?.querySelector<HTMLButtonElement>(
            '.toolbar .icon-btn[aria-label="Find in article"]',
        );
        (trigger ?? this.scrollHost).focus();
    }

    toggle(): void {
        if (this.open) this.close();
        else this.openFind();
    }

    handleKeyDown(event: KeyboardEvent): void {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            event.stopPropagation();
            this.openFind();
            return;
        }
        if (!this.open) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.close();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            this.step(event.shiftKey ? -1 : 1);
        }
    }

    /** Rebuild ranges after the article DOM has been replaced. */
    refresh(content: ParentNode | null): void {
        this.content = content;
        if (!this.open) return;
        this.ranges = content ? findRanges(content, this.input.value) : [];
        this.index = Math.min(this.index, Math.max(0, this.ranges.length - 1));
        this.applyHighlights();
        this.updateCount();
    }

    close(repaint = true): void {
        this.open = false;
        this.input.value = '';
        this.content = null;
        this.ranges = [];
        this.index = 0;
        this.clearHighlights();
        this.updateCount();
        if (repaint) {
            this.repaint();
            this.focusTrigger();
        }
    }

    private openFind(): void {
        if (this.open) {
            this.focusInput();
            return;
        }
        this.open = true;
        this.repaint();
        this.focusInput();
    }

    private setQuery(query: string): void {
        this.ranges = this.content ? findRanges(this.content, query) : [];
        this.index = 0;
        this.applyHighlights();
        this.updateCount();
        this.scrollToCurrent();
    }

    private step(delta: number): void {
        if (!this.ranges.length) return;
        this.index = stepFindIndex(this.index, this.ranges.length, delta);
        this.applyHighlights();
        this.updateCount();
        this.scrollToCurrent();
    }

    private applyHighlights(): void {
        this.clearHighlights();
        if (!('highlights' in CSS)) return;
        if (this.ranges.length) CSS.highlights.set(ALL_HIGHLIGHT, new Highlight(...this.ranges));
        const current = this.ranges[this.index];
        if (current) CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(current));
    }

    private clearHighlights(): void {
        if (!('highlights' in CSS)) return;
        CSS.highlights.delete(ALL_HIGHLIGHT);
        CSS.highlights.delete(CURRENT_HIGHLIGHT);
    }

    private updateCount(): void {
        this.count.textContent = this.ranges.length ? `${this.index + 1}/${this.ranges.length}` : '0/0';
    }

    private scrollToCurrent(): void {
        const range = this.ranges[this.index];
        if (!range) return;
        const rect = range.getBoundingClientRect();
        const hostRect = this.scrollHost.getBoundingClientRect();
        const top = this.scrollHost.scrollTop + rect.top - hostRect.top - this.scrollHost.clientHeight / 2;
        this.scrollHost.scrollTo({ top, behavior: 'auto' });
    }
}
