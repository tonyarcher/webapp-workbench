import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import matchupCssText from './baseball-matchup-card.css?inline';

const matchupSheet = new CSSStyleSheet();
matchupSheet.replaceSync(matchupCssText);

@customElement('baseball-matchup-card')
export class BaseballMatchupCard extends LitElement {
  static styles = matchupSheet;

  @property({type: String, attribute: 'batter-name'}) batterName = 'Current Batter';
  @property({type: String, attribute: 'batter-stats'}) batterStats = '';

  @property({type: String, attribute: 'pitcher-name'}) pitcherName = 'Current Pitcher';
  @property({type: String, attribute: 'pitcher-stats'}) pitcherStats = '';

  render() {
    return html`
      <div class="card matchup-card">
        <div class="matchup-header">
          <span class="matchup-title">CURRENT PLATE MATCHUP</span>
        </div>

        <div class="matchup-grid">
          <div class="player-box batter-box">
            <div class="role-label">BATTER</div>
            <div class="player-name">${this.batterName}</div>
            <div class="player-sub">${this.batterStats}</div>
          </div>

          <div class="vs-badge">VS</div>

          <div class="player-box pitcher-box">
            <div class="role-label">PITCHER</div>
            <div class="player-name">${this.pitcherName}</div>
            <div class="player-sub">${this.pitcherStats}</div>
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
