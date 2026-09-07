import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import type {View} from '../../types';
import '../dashboard-view/dashboard-view';
import '../import-view/import-view';
import '../lifts-view/lifts-view';
import '../measure-view/measure-view';
import styles from './app-shell.css?inline';

const VIEWS: View[] = ['dashboard', 'import', 'lifts', 'measure'];

function viewFromHash(): View {
    const raw = location.hash.replace(/^#\/?/, '');
    return VIEWS.includes(raw as View) ? (raw as View) : 'dashboard';
}

@customElement('ft-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private view: View = 'dashboard';

    private onHash = (): void => {
        this.view = viewFromHash();
    };

    override connectedCallback(): void {
        super.connectedCallback();
        this.view = viewFromHash();
        window.addEventListener('hashchange', this.onHash);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener('hashchange', this.onHash);
    }

    private go(view: View): void {
        location.hash = `#/${view}`;
    }

    override render(): TemplateResult {
        const view = this.view;
        return html`
            <nav class="nav">
                <strong class="brand">Fitness</strong>
                ${VIEWS.map(
                    (v) => html`<button
                        class="nav-btn ${view === v ? 'active' : ''}"
                        @click=${() => this.go(v)}
                    >${v}</button>`,
                )}
            </nav>
            ${view === 'dashboard'
                ? html`<ft-dashboard-view></ft-dashboard-view>`
                : view === 'import'
                    ? html`<ft-import-view></ft-import-view>`
                    : view === 'lifts'
                        ? html`<ft-lifts-view></ft-lifts-view>`
                        : html`<ft-measure-view></ft-measure-view>`}
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-app-shell': AppShell;
    }
}
