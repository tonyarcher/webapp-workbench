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
      <div class="matchup-container">
        <div class="flex-between text-center" style="width: 100%;">
          <div class="flex-grow">
            <div class="text-accent-green font-bold font-small" style="letter-spacing: 1px;">CURRENT BATTER</div>
            <div class="matchup-player-name margin-top-xs">${this.batterName}</div>
            <div class="matchup-player-stats margin-top-xs">${this.batterStats}</div>
          </div>

          <div class="matchup-vs-badge">
            VS
          </div>

          <div class="flex-grow">
            <div class="text-accent-green font-bold font-small" style="letter-spacing: 1px;">CURRENT PITCHER</div>
            <div class="matchup-player-name margin-top-xs">${this.pitcherName}</div>
            <div class="matchup-player-stats margin-top-xs">${this.pitcherStats}</div>
          </div>
        </div>
      </div>
    `;
  }
}
