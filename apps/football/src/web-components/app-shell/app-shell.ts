import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {GameStore} from '../../local-game/game-store';
import type {LiveLocalGameState} from '../../local-game/game-state';
import type {LocalGameSetup} from '../../local-game/game-types';
import '../setup-screen/setup-screen';
import '../game-shell/game-shell';
import styles from './app-shell.css?inline';

@customElement('fb-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    private readonly store = new GameStore();

    @state() private game: LiveLocalGameState | null = null;
    @state() private ready = false;

    private unsubscribe: (() => void) | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.unsubscribe = this.store.subscribe((game) => {
            this.game = game;
        });
        void this.store.hydrate().then(() => {
            this.ready = true;
        }).catch(() => {
            this.ready = true;
        });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    private onStart = (event: Event): void => {
        const custom = event as CustomEvent<LocalGameSetup>;
        this.store.startGame(custom.detail);
    };

    override render(): TemplateResult {
        if (!this.ready) return html`<p class="loading">Loading…</p>`;
        if (!this.game) {
            return html`<fb-setup-screen @start-game=${this.onStart}></fb-setup-screen>`;
        }
        return html`<fb-game-shell .store=${this.store} .game=${this.game}></fb-game-shell>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'fb-app-shell': AppShell;
    }
}
