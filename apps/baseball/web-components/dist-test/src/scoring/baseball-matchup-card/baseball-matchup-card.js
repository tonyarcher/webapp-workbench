var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import matchupCssText from './baseball-matchup-card.css?inline';
const matchupSheet = new CSSStyleSheet();
matchupSheet.replaceSync(matchupCssText);
let BaseballMatchupCard = class BaseballMatchupCard extends LitElement {
    constructor() {
        super(...arguments);
        this.batterName = 'Current Batter';
        this.batterStats = '';
        this.pitcherName = 'Current Pitcher';
        this.pitcherStats = '';
    }
    static { this.styles = matchupSheet; }
    render() {
        return html `
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
};
__decorate([
    property({ type: String, attribute: 'batter-name' })
], BaseballMatchupCard.prototype, "batterName", void 0);
__decorate([
    property({ type: String, attribute: 'batter-stats' })
], BaseballMatchupCard.prototype, "batterStats", void 0);
__decorate([
    property({ type: String, attribute: 'pitcher-name' })
], BaseballMatchupCard.prototype, "pitcherName", void 0);
__decorate([
    property({ type: String, attribute: 'pitcher-stats' })
], BaseballMatchupCard.prototype, "pitcherStats", void 0);
BaseballMatchupCard = __decorate([
    customElement('baseball-matchup-card')
], BaseballMatchupCard);
export { BaseballMatchupCard };
