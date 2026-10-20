import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { View } from '../../types';
import '../dashboard-view/dashboard-view';
import '../import-view/import-view';
import '../lifts-view/lifts-view';
import '../measure-view/measure-view';
import '../chart-view/chart-view';
import styles from './app-shell.css?inline';

const NAV: View[] = ['dashboard', 'import', 'lifts', 'measure'];

function parseHash(): { view: View; metric: string } {
    const raw = location.hash.replace(/^#\/?/, '');
    if (raw.startsWith('charts/')) return { view: 'chart', metric: decodeURIComponent(raw.slice(7)) };
    if (NAV.includes(raw as View)) return { view: raw as View, metric: '' };
    return { view: 'dashboard', metric: '' };
}

@customElement('ft-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private view: View = 'dashboard';
    @state() private metric = '';

    private onHash = (): void => {
        const parsed = parseHash();
        this.view = parsed.view;
        this.metric = parsed.metric;
    };

    override connectedCallback(): void {
        super.connectedCallback();
        this.onHash();
        window.addEventListener('hashchange', this.onHash);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener('hashchange', this.onHash);
    }

    private go(view: View): void {
        location.hash = `#/${view}`;
    }

    private renderView(view: View): TemplateResult {
        if (view === 'dashboard') return html`<ft-dashboard-view></ft-dashboard-view>`;
        if (view === 'import') return html`<ft-import-view></ft-import-view>`;
        if (view === 'lifts') return html`<ft-lifts-view></ft-lifts-view>`;
        if (view === 'chart') return html`<ft-chart-view metric=${this.metric}></ft-chart-view>`;
        return html`<ft-measure-view></ft-measure-view>`;
    }

    override render(): TemplateResult {
        const view = this.view;
        return html`
            <nav class="nav">
                <strong class="brand">Fitness</strong>
                ${NAV.map(
                    (v) => html`<button
                        class="nav-btn ${view === v ? 'active' : ''}"
                        @click=${() => this.go(v)}
                    >${v}</button>`,
                )}
            </nav>
            <main>${this.renderView(view)}</main>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-app-shell': AppShell;
    }
}
