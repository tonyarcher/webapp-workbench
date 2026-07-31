import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('baseball-matchup-card')
export class BaseballMatchupCard extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @property({ type: String, attribute: 'batter-name' }) batterName = 'None';
  @property({ type: String, attribute: 'batter-stats' }) batterStats = '';
  @property({ type: String, attribute: 'pitcher-name' }) pitcherName = 'None';
  @property({ type: String, attribute: 'pitcher-stats' }) pitcherStats = '';

  render() {
    return html`
      <div class="card matchup-container">
        <div class="flex-between text-center" style="width: 100%;">
          <div class="flex-grow">
            <div class="text-accent-green font-bold font-small">CURRENT BATTER</div>
            <div class="matchup-player-name font-large font-bold text-primary margin-top-xs">${this.batterName}</div>
            <div class="matchup-player-stats font-small text-muted margin-top-xs">${this.batterStats}</div>
          </div>

          <div class="text-accent-red font-bold font-large flex-center" style="margin: 0 1.5rem; background: rgba(255, 42, 59, 0.15); border: 1px solid var(--accent-red); border-radius: 50%; width: 44px; height: 44px;">
            VS
          </div>

          <div class="flex-grow">
            <div class="text-accent-green font-bold font-small">CURRENT PITCHER</div>
            <div class="matchup-player-name font-large font-bold text-primary margin-top-xs">${this.pitcherName}</div>
            <div class="matchup-player-stats font-small text-muted margin-top-xs">${this.pitcherStats}</div>
          </div>
        </div>
      </div>
    `;
  }
}
