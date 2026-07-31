import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

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
      <div class="matchup-container card">
        <div class="flex-between text-center">
          <div class="flex-grow">
            <div class="text-accent-green font-bold">CURRENT BATTER</div>
            <div class="matchup-player-name">${this.batterName}</div>
            <div class="matchup-player-stats">${this.batterStats}</div>
          </div>

          <div class="text-accent-yellow font-bold margin-left-right-md" style="margin: 0 1rem;">
            VS
          </div>

          <div class="flex-grow">
            <div class="text-accent-green font-bold">CURRENT PITCHER</div>
            <div class="matchup-player-name">${this.pitcherName}</div>
            <div class="matchup-player-stats">${this.pitcherStats}</div>
          </div>
        </div>
      </div>
    `;
  }
}
