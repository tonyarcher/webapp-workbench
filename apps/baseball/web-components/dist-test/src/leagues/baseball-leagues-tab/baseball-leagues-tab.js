var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import leaguesTabCssText from './baseball-leagues-tab.css?inline';
const leaguesTabSheet = new CSSStyleSheet();
leaguesTabSheet.replaceSync(leaguesTabCssText);
let BaseballLeaguesTab = class BaseballLeaguesTab extends LitElement {
    constructor() {
        super(...arguments);
        this.leagues = [];
    }
    static { this.styles = leaguesTabSheet; }
    render() {
        const leagues = this.leagues ?? [];
        return html `
            <h1>League Directory</h1>
            ${leagues.length === 0
            ? html `<p class="empty-state">No leagues available.</p>`
            : html `
                        <div class="leagues-grid">
                            ${leagues.map(league => html `
                                <baseball-league-card
                                        league-name=${league.name}
                                        league-details=${'Official League #' + league.id}
                                ></baseball-league-card>
                            `)}
                        </div>
                    `}
        `;
    }
};
__decorate([
    property({
        attribute: 'leagues-json',
        converter: (value) => {
            try {
                return value ? JSON.parse(value) : [];
            }
            catch {
                return [];
            }
        },
    })
], BaseballLeaguesTab.prototype, "leagues", void 0);
BaseballLeaguesTab = __decorate([
    customElement('baseball-leagues-tab')
], BaseballLeaguesTab);
export { BaseballLeaguesTab };
