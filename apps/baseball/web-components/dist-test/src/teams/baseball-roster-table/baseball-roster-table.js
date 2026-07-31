var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import rosterCssText from './baseball-roster-table.css?inline';
const rosterSheet = new CSSStyleSheet();
rosterSheet.replaceSync(rosterCssText);
let BaseballRosterTable = class BaseballRosterTable extends LitElement {
    constructor() {
        super(...arguments);
        this.teamName = 'Team Roster';
        this.players = [];
    }
    static { this.styles = rosterSheet; }
    render() {
        return html `
            <div class="card">
                <h2>${this.teamName} Roster (${this.players.length})</h2>
                <div class="table-container">
                    <table>
                        <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>POS</th>
                            <th>BATS</th>
                            <th>THROWS</th>
                        </tr>
                        </thead>
                        <tbody>
                        ${(this.players ?? []).map((p) => html `
                                    <tr>
                                        <td class="font-bold text-accent-yellow">#${p.jerseyNumber}</td>
                                        <td class="font-bold">${p.name}</td>
                                        <td class="text-secondary">${p.position}</td>
                                        <td>${p.battingHand}</td>
                                        <td>${p.throwingHand}</td>
                                    </tr>
                                `)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};
__decorate([
    property({ type: String, attribute: 'team-name' })
], BaseballRosterTable.prototype, "teamName", void 0);
__decorate([
    property({
        type: Array,
        attribute: 'players-json',
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
], BaseballRosterTable.prototype, "players", void 0);
BaseballRosterTable = __decorate([
    customElement('baseball-roster-table')
], BaseballRosterTable);
export { BaseballRosterTable };
