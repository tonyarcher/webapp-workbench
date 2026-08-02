import { LitElement, html } from 'lit';
import { DEFAULT_GAME_SETUP } from './game-types';
import type { LocalGameSetup } from './game-types';

export class BaseballSetupScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  private handleSubmit = (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const home = String(formData.get('home-team') ?? '');
    const away = String(formData.get('away-team') ?? '');
    const innings = Number(formData.get('innings') ?? DEFAULT_GAME_SETUP.innings);
    const setup: LocalGameSetup = {
      homeTeamName: home.trim() || DEFAULT_GAME_SETUP.homeTeamName,
      awayTeamName: away.trim() || DEFAULT_GAME_SETUP.awayTeamName,
      innings: Math.min(9, Math.max(1, innings || DEFAULT_GAME_SETUP.innings)),
    };
    this.dispatchEvent(
      new CustomEvent<LocalGameSetup>('start-game', { detail: setup, bubbles: true, composed: true })
    );
  };

  render() {
    return html`
      <main class="local-setup">
        <div class="card">
          <h1>⚾ Grand Slam Baseball — Local Game Setup</h1>
          <p class="text-muted">
            Everything runs entirely in your browser. No server or API required.
          </p>
          <form class="local-setup-form" @submit=${this.handleSubmit}>
            <label for="home-team-input">Home Team</label>
            <input id="home-team-input" data-testid="home-team-input" name="home-team" value="${DEFAULT_GAME_SETUP.homeTeamName}" />
            <label for="away-team-input">Away Team</label>
            <input id="away-team-input" data-testid="away-team-input" name="away-team" value="${DEFAULT_GAME_SETUP.awayTeamName}" />
            <label for="innings-input">Innings</label>
            <input
              id="innings-input"
              data-testid="innings-input"
              name="innings"
              type="number"
              min="1"
              max="9"
              value="${DEFAULT_GAME_SETUP.innings}"
            />
            <button type="submit" class="btn btn-primary" data-testid="start-game-button">
              Start Local Game
            </button>
          </form>
        </div>
      </main>
    `;
  }
}

customElements.define('baseball-setup-screen', BaseballSetupScreen);
