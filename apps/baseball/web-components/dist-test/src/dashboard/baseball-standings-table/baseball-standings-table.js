var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import standingsCssText from './baseball-standings-table.css?inline';
const standingsSheet = new CSSStyleSheet();
standingsSheet.replaceSync(standingsCssText);
let BaseballStandingsTable = class BaseballStandingsTable extends LitElement {
    constructor() {
        super(...arguments);
        this.standings = [];
    }
    static { this.styles = standingsSheet; }
    render() {
        return html `
      <div class="card">
        <h2>League Standings</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>GP</th>
                <th>W</th>
                <th>L</th>
                <th>PCT</th>
                <th>RS</th>
                <th>RA</th>
              </tr>
            </thead>
            <tbody>
            ${(this.standings ?? []).map((s) => html `
                  <tr>
                    <td class="font-bold">${s.teamName}</td>
                    <td>${s.gamesPlayed}</td>
                    <td>${s.wins}</td>
                    <td>${s.losses}</td>
                    <td>${this.formatPct(s.winPercentage)}</td>
                    <td>${s.runsScored}</td>
                    <td>${s.runsAllowed}</td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
    }
    formatPct(pct) {
        return (pct || 0).toFixed(3).replace(/^0+/, '');
    }
};
__decorate([
    property({
        type: Array,
        attribute: 'standings-json',
        converter: {
            fromAttribute: (val) => {
                if (!val)
                    return [];
                try {
                    return JSON.parse(val);
                }
                catch {
                    return [];
                }
            }
        }
    })
], BaseballStandingsTable.prototype, "standings", void 0);
BaseballStandingsTable = __decorate([
    customElement('baseball-standings-table')
], BaseballStandingsTable);
export { BaseballStandingsTable };
