import { html, css, unsafeCSS, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import matchupCss from './baseball-matchup-card.css?inline';

@customElement('baseball-matchup-card')
export class BaseballMatchupCard extends LitElement {
  static styles = css`${unsafeCSS(matchupCss)}`;

  @property({ type: String, attribute: 'batter-name' }) batterName = 'None';
  @property({ type: String, attribute: 'batter-stats' }) batterStats = '';
  @property({ type: String, attribute: 'pitcher-name' }) pitcherName = 'None';
  @property({ type: String, attribute: 'pitcher-stats' }) pitcherStats = '';

  render() {
    return html`
      <div class="matchup-container">
        <div class="flex-between text-center">
          <div class="flex-grow">
            <div class="text-accent-green">CURRENT BATTER</div>
            <div class="matchup-player-name">${this.batterName}</div>
            <div class="matchup-player-stats">${this.batterStats}</div>
          </div>

          <div class="matchup-vs-badge">
            VS
          </div>

          <div class="flex-grow">
            <div class="text-accent-green">CURRENT PITCHER</div>
            <div class="matchup-player-name">${this.pitcherName}</div>
            <div class="matchup-player-stats">${this.pitcherStats}</div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-matchup-card': BaseballMatchupCard;
  }
}
