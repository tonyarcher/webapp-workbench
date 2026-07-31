var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import leagueCardCssText from './baseball-league-card.css?inline';
const leagueCardSheet = new CSSStyleSheet();
leagueCardSheet.replaceSync(leagueCardCssText);
let BaseballLeagueCard = class BaseballLeagueCard extends LitElement {
    constructor() {
        super(...arguments);
        this.leagueName = '';
        this.leagueDetails = '';
    }
    static { this.styles = leagueCardSheet; }
    render() {
        return html `
            <div class="card">
                <div>
                    <h2>${this.leagueName}</h2>
                    <div class="text-muted font-small margin-top-xs">${this.leagueDetails}</div>
                </div>
                <button class="btn">Manage League</button>
            </div>
        `;
    }
};
__decorate([
    property({ type: String, attribute: 'league-name' })
], BaseballLeagueCard.prototype, "leagueName", void 0);
__decorate([
    property({ type: String, attribute: 'league-details' })
], BaseballLeagueCard.prototype, "leagueDetails", void 0);
BaseballLeagueCard = __decorate([
    customElement('baseball-league-card')
], BaseballLeagueCard);
export { BaseballLeagueCard };
