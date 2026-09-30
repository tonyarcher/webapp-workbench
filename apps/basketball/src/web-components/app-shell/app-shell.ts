import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { GameStore } from '../../local-game/game-store';
import type { LiveLocalGameState } from '../../local-game/game-state';
import type { LocalGameSetup } from '../../local-game/game-types';
import '../setup-screen/setup-screen';
import '../game-shell/game-shell';
import styles from './app-shell.css?inline';

@customElement('bball-app-shell')
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
        void this.store
            .hydrate()
            .then(() => {
                this.ready = true;
            })
            .catch(() => {
                this.ready = true;
            });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.unsubscribe?.();
        this.unsubscribe = null;
        void this.store.flushPersist();
    }

    private onStart = (event: Event): void => {
        const custom = event as CustomEvent<LocalGameSetup>;
        this.store.startGame(custom.detail);
    };

    override render(): TemplateResult {
        if (!this.ready) return html`<p class="loading">Loading…</p>`;
        // One main, and a level-one heading, so the page has a landmark and a
        // heading to navigate by. The audit in e2e/accessibility.spec.ts fails
        // without both.
        if (!this.game) {
            return html`<main>
        <h1 class="visually-hidden">Basketball local game</h1>
        <bball-setup-screen @start-game=${this.onStart}></bball-setup-screen>
      </main>`;
        }
        return html`<main>
        <h1 class="visually-hidden">Basketball scorecard</h1>
        <bball-game-shell .store=${this.store} .game=${this.game}></bball-game-shell>
      </main>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'bball-app-shell': AppShell;
    }
}
