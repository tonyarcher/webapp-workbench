var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import scheduleCssText from './baseball-schedule-list.css?inline';
const scheduleSheet = new CSSStyleSheet();
scheduleSheet.replaceSync(scheduleCssText);
let BaseballScheduleList = class BaseballScheduleList extends LitElement {
    constructor() {
        super(...arguments);
        this.games = [];
    }
    static { this.styles = scheduleSheet; }
    render() {
        return html `
      <div class="card">
        <h3>Games Schedule (${(this.games ?? []).length})</h3>
        ${(this.games ?? []).length === 0
            ? html `<p class="text-muted">No games scheduled yet.</p>`
            : html `
              <div class="schedule-list">
                ${(this.games ?? []).map((g) => html `
                    <div class="game-card">
                      <div>
                        <div class="font-bold">${g.awayTeam} @ ${g.homeTeam}</div>
                        <div class="text-muted font-small margin-top-xs">Date: ${g.date} | Status: ${g.status}</div>
                      </div>
                      <div class="flex-center flex-gap-sm">
                        ${g.status === 'COMPLETED'
                ? html `
                              <span class="font-bold margin-right-md">${g.awayScore} - ${g.homeScore}</span>
                              <button class="btn btn-secondary" @click=${() => this.onBoxScore(g.id)}>Box Score</button>
                            `
                : html `
                              <button class="btn" @click=${() => this.onScoreGame(g.id)}>Score Game</button>
                            `}
                      </div>
                    </div>
                  `)}
              </div>
            `}
      </div>
    `;
    }
    onScoreGame(gameId) {
        this.dispatchEvent(new CustomEvent('score-game-click', { detail: { gameId }, bubbles: true }));
    }
    onBoxScore(gameId) {
        this.dispatchEvent(new CustomEvent('box-score-click', { detail: { gameId }, bubbles: true }));
    }
};
__decorate([
    property({
        type: Array,
        attribute: 'games-json',
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
], BaseballScheduleList.prototype, "games", void 0);
BaseballScheduleList = __decorate([
    customElement('baseball-schedule-list')
], BaseballScheduleList);
export { BaseballScheduleList };
