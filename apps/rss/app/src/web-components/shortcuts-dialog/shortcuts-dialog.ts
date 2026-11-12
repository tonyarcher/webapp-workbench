import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LIST_SHORTCUTS_HELP, OVERLAY_SHORTCUTS_HELP } from '../../services/shortcuts';
import { modalClosed, modalOpened } from '../../services/modal-guard';
import styles from './shortcuts-dialog.css?inline';

/** Keyboard cheatsheet. One instance lives in the app shell; `?` opens it anywhere. */
@customElement('shortcuts-dialog')
export class ShortcutsDialog extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) open = false;

    private dialogEl: HTMLDialogElement | null = null;

    override firstUpdated() {
        this.dialogEl = this.renderRoot.querySelector('dialog');
    }

    override updated(changed: Map<string, unknown>) {
        if (changed.has('open')) {
            if (this.open) {
                this.dialogEl?.showModal();
                modalOpened();
            } else {
                this.dialogEl?.close();
                modalClosed();
            }
        }
    }

    override render() {
        return html`
            <dialog @close=${this.emitClose} aria-label="Keyboard shortcuts">
                <h2>Keyboard shortcuts</h2>
                ${this.renderSection('Article list', LIST_SHORTCUTS_HELP)}
                ${this.renderSection('Open article', OVERLAY_SHORTCUTS_HELP)}
                <div class="foot"><button class="btn primary" @click=${this.emitClose}>Done</button></div>
            </dialog>
        `;
    }

    private renderSection(title: string, rows: Array<{ keys: string; action: string }>) {
        return html`<div class="section"><h3>${title}</h3>${rows.map((r) => html`<div class="row"><kbd>${r.keys}</kbd><span>${r.action}</span></div>`)}</div>`;
    }

    private emitClose = () => {
        if (this.open) this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    };
}

declare global {
    interface HTMLElementTagNameMap {
        'shortcuts-dialog': ShortcutsDialog;
    }
}
