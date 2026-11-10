import { LitElement, html } from 'lit';
import { createBrowserHistory } from '@tanstack/history';
import type { RouterHistory } from '@tanstack/history';
import { GameStore } from './game-store';
import type { GameQueryResult } from './game-store';
import type { LocalGameSetup } from './game-types';
import { addBasePath, stripBasePath } from './base-path';
import { transitionScreen } from './view-transition';
import './setup-screen';
import './game-shell';

export class BaseballApp extends LitElement {
    override createRenderRoot() {
        return this;
    }

    private store = new GameStore();
    private history: RouterHistory;
    private game: GameQueryResult = undefined;
    private unsubscribeStore: (() => void) | null = null;
    private unsubscribeHistory: (() => void) | null = null;

    constructor() {
        super();
        this.history = createBrowserHistory();
    }

    override connectedCallback() {
        super.connectedCallback();
        this.unsubscribeStore = this.store.subscribe((game) => {
            const hadScreen = this.game !== undefined;
            const hasScreen = game !== undefined;
            this.game = game;
            this.syncRoute();
            if (hadScreen === hasScreen) {
                this.requestUpdate();
                return;
            }
            // Screen swap, not a data update: crossfade instead of cutting.
            // State is assigned above; the route sync and the render both run
            // inside the transition so the old snapshot cannot already show
            // the new screen. The requestUpdate promise lets an async render
            // settle inside the transition instead of racing it.
            transitionScreen(() => {
                this.syncRoute();
                return this.requestUpdate();
            });
        });
        this.unsubscribeHistory = this.history.subscribe(() => {
            this.requestUpdate();
        });
        void this.store.hydrate();
    }

    override disconnectedCallback() {
        this.unsubscribeStore?.();
        this.unsubscribeHistory?.();
        this.history.destroy();
        super.disconnectedCallback();
    }

    private syncRoute() {
        const base = import.meta.env.BASE_URL;
        const path = stripBasePath(this.history.location.pathname, base);
        if (this.game) {
            if (path !== '/game') {
                this.history.replace(addBasePath('/game', base));
            }
        } else if (path !== '/') {
            this.history.replace(addBasePath('/', base));
        }
    }

    private handleStartGame = (event: CustomEvent<LocalGameSetup>) => {
        this.store.startGame(event.detail);
    };

    override render() {
        const screen = this.game
            ? html`<baseball-game-shell .game=${this.game} .store=${this.store}></baseball-game-shell>`
            : html`<baseball-setup-screen @start-game=${this.handleStartGame}></baseball-setup-screen>`;

        return html`
      ${screen}
      ${
          import.meta.env.DEV
              ? html`
            <footer>
              <div class="build-badge" data-testid="build-badge" title=${`build ${__BUILD_TIME__}`}>
                DEV · v${__APP_VERSION__} · ${new Date(__BUILD_TIME__).toLocaleString()}
              </div>
            </footer>
          `
              : ''
      }
    `;
    }
}

customElements.define('baseball-app', BaseballApp);
