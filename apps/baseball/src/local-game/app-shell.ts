import { LitElement, html } from 'lit';
import { createBrowserHistory } from '@tanstack/history';
import type { RouterHistory } from '@tanstack/history';
import { GameStore } from './game-store';
import type { GameQueryResult } from './game-store';
import type { LocalGameSetup } from './game-types';
import './setup-screen';
import './game-shell';

export class BaseballApp extends LitElement {
  createRenderRoot() {
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

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribeStore = this.store.subscribe((game) => {
      this.game = game;
      this.syncRoute();
      this.requestUpdate();
    });
    this.unsubscribeHistory = this.history.subscribe(() => {
      this.requestUpdate();
    });
    void this.store.hydrate();
  }

  disconnectedCallback() {
    this.unsubscribeStore?.();
    this.unsubscribeHistory?.();
    this.history.destroy();
    super.disconnectedCallback();
  }

  private syncRoute() {
    if (this.game) {
      if (this.history.location.pathname !== '/game') {
        this.history.replace('/game');
      }
    } else if (this.history.location.pathname !== '/') {
      this.history.replace('/');
    }
  }

  private handleStartGame = (event: CustomEvent<LocalGameSetup>) => {
    this.store.startGame(event.detail);
  };

  render() {
    const screen = this.game
      ? html`<baseball-game-shell .game=${this.game} .store=${this.store}></baseball-game-shell>`
      : html`<baseball-setup-screen @start-game=${this.handleStartGame}></baseball-setup-screen>`;

    return html`
      ${screen}
      ${import.meta.env.DEV
        ? html`
            <div class="build-badge" data-testid="build-badge" title=${`build ${__BUILD_TIME__}`}>
              DEV · v${__APP_VERSION__} · ${new Date(__BUILD_TIME__).toLocaleString()}
            </div>
          `
        : ''}
    `;
  }
}

customElements.define('baseball-app', BaseballApp);
