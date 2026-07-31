import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import matchupCssText from './baseball-matchup-card.css?inline';

const matchupSheet = new CSSStyleSheet();
matchupSheet.replaceSync(matchupCssText);

@customElement('baseball-matchup-card')
export class BaseballMatchupCard extends LitElement {
  static styles = matchupSheet;

  @property({type: String, attribute: 'batter-name'}) batterName = 'Batter Name';
  @property({type: Number, attribute: 'batter-number'}) batterNumber = 0;
  @property({type: String, attribute: 'batter-hand'}) batterHand = 'R';
  @property({type: String, attribute: 'batter-avg'}) batterAvg = '.000';

  @property({type: String, attribute: 'pitcher-name'}) pitcherName = 'Pitcher Name';
  @property({type: Number, attribute: 'pitcher-number'}) pitcherNumber = 0;
  @property({type: String, attribute: 'pitcher-hand'}) pitcherHand = 'R';
  @property({type: String, attribute: 'pitcher-era'}) pitcherEra = '0.00';

  render() {
    return html`
      <div class="card matchup-card">
        <div class="matchup-header">
          <span class="matchup-title">CURRENT PLATE MATCHUP</span>
        </div>

        <div class="matchup-grid">
          <div class="player-box batter-box">
            <div class="role-label">BATTER</div>
            <div class="player-name">#${this.batterNumber} ${this.batterName}</div>
            <div class="player-sub">
              <span>Bats: ${this.batterHand}</span>
              <span class="stat-badge">AVG: ${this.batterAvg}</span>
            </div>
          </div>

          <div class="vs-badge">VS</div>

          <div class="player-box pitcher-box">
            <div class="role-label">PITCHER</div>
            <div class="player-name">#${this.pitcherNumber} ${this.pitcherName}</div>
            <div class="player-sub">
              <span>Throws: ${this.pitcherHand}</span>
              <span class="stat-badge">ERA: ${this.pitcherEra}</span>
            </div>
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
