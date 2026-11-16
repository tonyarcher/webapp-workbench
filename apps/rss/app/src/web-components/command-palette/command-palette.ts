import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { modalClosed, modalOpened } from '../../services/modal-guard';
import { fuzzyScore, type PaletteMatch } from '../../services/palette-match';
import type { Command } from '../../services/commands';
import styles from './command-palette.css?inline';

interface Result {
    command: Command;
    match: PaletteMatch;
}

const PAGE_SIZE = 8;

/**
 * Command palette: a modal listbox of go/filter/act commands. The shell
 * builds the commands and runs the chosen one; this component owns the
 * query, the fuzzy ranking, and the dialog lifecycle.
 */
@customElement('command-palette')
export class CommandPalette extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) open = false;
    @property({ attribute: false }) commands: Command[] = [];

    @state() private query = '';
    @state() private activeIndex = 0;

    private dialogEl: HTMLDialogElement | null = null;
    private inputEl: HTMLInputElement | null = null;
    private returnFocus: HTMLElement | null = null;
    private backdropPress = false;

    override firstUpdated() {
        this.dialogEl = this.renderRoot.querySelector('dialog');
        this.inputEl = this.renderRoot.querySelector('input');
    }

    override updated(changed: Map<string, unknown>) {
        if (changed.has('open')) {
            if (this.open) {
                this.returnFocus = deepActiveElement();
                this.query = '';
                this.activeIndex = 0;
                this.dialogEl?.showModal();
                modalOpened();
                this.inputEl?.focus();
            } else {
                this.dialogEl?.close();
                modalClosed();
                this.returnFocus?.focus();
                this.returnFocus = null;
            }
        }
    }

    private get results(): Result[] {
        const scored: Result[] = [];
        for (const command of this.commands) {
            const match = fuzzyScore(this.query, command.title);
            if (match) scored.push({ command, match });
        }
        scored.sort((a, b) => b.match.score - a.match.score);
        return scored.slice(0, PAGE_SIZE);
    }

    private get active(): number {
        return Math.min(this.activeIndex, Math.max(0, this.results.length - 1));
    }

    private onInput(e: Event) {
        this.query = (e.target as HTMLInputElement).value;
        this.activeIndex = 0;
    }

    private onKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.activeIndex = Math.min(this.activeIndex + 1, this.results.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.activeIndex = Math.max(this.activeIndex - 1, 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const result = this.results[this.active];
            if (result) this.run(result.command);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.emitClose();
        }
    }

    private run(command: Command) {
        this.dispatchEvent(new CustomEvent('run', { detail: command, bubbles: true, composed: true }));
        this.emitClose();
    }

    private emitClose() {
        if (this.open) this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }

    private onDialogPointerDown(e: PointerEvent) {
        this.backdropPress = e.target === this.dialogEl;
    }

    private onDialogClick(e: MouseEvent) {
        const backdropClick = this.backdropPress && e.target === this.dialogEl;
        this.backdropPress = false;
        if (backdropClick) this.emitClose();
    }

    override render() {
        const results = this.results;
        return html`
            <dialog aria-label="Command palette" @close=${this.emitClose} @pointerdown=${this.onDialogPointerDown} @click=${this.onDialogClick}>
                <div class="palette">
                    <h2>Command palette</h2>
                    <input
                        type="text"
                        aria-label="Commands"
                        placeholder="Type a command or search…"
                        autocomplete="off"
                        spellcheck="false"
                        .value=${this.query}
                        @input=${this.onInput}
                        @keydown=${this.onKeydown}
                    />
                    <ul role="listbox" aria-label="Results">
                        ${results.map(
                            (r, i) => html`<li role="presentation">
                                <button
                                    role="option"
                                    aria-selected=${i === this.active}
                                    class="result ${i === this.active ? 'active' : ''}"
                                    @click=${() => this.run(r.command)}
                                    @mousemove=${() => (this.activeIndex = i)}
                                >
                                    <span class="result-title">${this.highlight(r.command.title, r.match.indices)}</span>
                                    <span class="result-hint">${r.command.hint}</span>
                                </button>
                            </li>`,
                        )}
                    </ul>
                    ${results.length === 0 ? html`<p class="empty" aria-live="polite">No matching commands.</p>` : ''}
                </div>
            </dialog>
        `;
    }

    /** Mark the matched characters so the ranking is visible, not magic. */
    private highlight(title: string, indices: number[]) {
        if (!indices.length) return title;
        const matched = new Set(indices);
        return html`${title.split('').map((ch, i) => (matched.has(i) ? html`<mark>${ch}</mark>` : ch))}`;
    }
}

function deepActiveElement(): HTMLElement | null {
    let element: Element | null = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element instanceof HTMLElement ? element : null;
}

declare global {
    interface HTMLElementTagNameMap {
        'command-palette': CommandPalette;
    }
}
