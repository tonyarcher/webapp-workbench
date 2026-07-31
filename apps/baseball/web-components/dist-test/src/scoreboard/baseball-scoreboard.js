var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import scoreboardCssText from './baseball-scoreboard.css?inline';
const scoreboardStyleSheet = new CSSStyleSheet();
scoreboardStyleSheet.replaceSync(scoreboardCssText);
let BaseballScoreboard = class BaseballScoreboard extends LitElement {
    constructor() {
        super(...arguments);
        this.awayName = 'AWAY';
        this.homeName = 'HOME';
        this.awayScore = 0;
        this.homeScore = 0;
        this.awayHits = 0;
        this.homeHits = 0;
        this.awayErrors = 0;
        this.homeErrors = 0;
        this.inning = 1;
        this.half = 'TOP';
        this.balls = 0;
        this.strikes = 0;
        this.outs = 0;
        this.runnerFirst = false;
        this.runnerSecond = false;
        this.runnerThird = false;
        this.runnerFirstName = '';
        this.runnerSecondName = '';
        this.runnerThirdName = '';
        this.gameData = null;
        this.boxScoreData = null;
    }
    static { this.styles = scoreboardStyleSheet; }
    render() {
        const g = this.gameData;
        const bs = this.boxScoreData;
        const awayName = g?.awayTeam?.name ?? this.awayName;
        const homeName = g?.homeTeam?.name ?? this.homeName;
        const awayScore = g?.awayScore ?? this.awayScore;
        const homeScore = g?.homeScore ?? this.homeScore;
        const awayHits = bs?.lineScore?.awayHits ?? this.awayHits;
        const homeHits = bs?.lineScore?.homeHits ?? this.homeHits;
        const awayErrors = bs?.lineScore?.awayErrors ?? this.awayErrors;
        const homeErrors = bs?.lineScore?.homeErrors ?? this.homeErrors;
        const inning = g?.gameState?.inning ?? this.inning;
        const half = g?.gameState?.half ?? this.half;
        const balls = g?.gameState?.balls ?? this.balls;
        const strikes = g?.gameState?.strikes ?? this.strikes;
        const outs = g?.gameState?.outs ?? this.outs;
        const runnerFirst = g ? !!g.gameState?.runnerFirstId : this.runnerFirst;
        const runnerSecond = g ? !!g.gameState?.runnerSecondId : this.runnerSecond;
        const runnerThird = g ? !!g.gameState?.runnerThirdId : this.runnerThird;
        const runnerFirstName = g?.gameState?.runnerFirstName ?? (runnerFirst ? "Runner on 1B" : this.runnerFirstName);
        const runnerSecondName = g?.gameState?.runnerSecondName ?? (runnerSecond ? "Runner on 2B" : this.runnerSecondName);
        const runnerThirdName = g?.gameState?.runnerThirdName ?? (runnerThird ? "Runner on 3B" : this.runnerThirdName);
        const inningSymbol = half === 'TOP' ? '▲' : '▼';
        const outsStr = outs === 0 ? 'No Outs' : outs === 1 ? '1 Out' : outs === 2 ? '2 Outs' : '3 Outs';
        return html `
            <div class="scoreboard-led">
                <div class="scoreboard-header">
                    <span class="inning-display">${inningSymbol} Inning ${inning}</span>
                    <span class="outs-indicator">${outsStr}</span>
                </div>

                <div class="scoreboard-row">
                    <span class="team-led-name">${awayName}</span>
                    <span class="team-led-score">${awayScore}</span>
                </div>

                <div class="scoreboard-row">
                    <span class="team-led-name">${homeName}</span>
                    <span class="team-led-score">${homeScore}</span>
                </div>

                <div class="scoreboard-row margin-top-md">
                    <span class="count-display">Count: ${balls} - ${strikes}</span>
                    <span class="text-muted font-small">
            R-H-E: ${awayScore}-${awayHits}-${awayErrors} vs ${homeScore}-${homeHits}
                        -${homeErrors}
          </span>
                </div>

                <div class="diamond-container">
                    <div class="base-diamond">
                        <div class="base base-first ${runnerFirst ? 'occupied' : ''}">
                            <div class="base-label">1st</div>
                        </div>
                        <div class="base base-second ${runnerSecond ? 'occupied' : ''}">
                            <div class="base-label">2nd</div>
                        </div>
                        <div class="base base-third ${runnerThird ? 'occupied' : ''}">
                            <div class="base-label">3rd</div>
                        </div>
                        <div class="base base-home"></div>
                    </div>
                </div>

                <div class="text-muted font-small margin-top-md border-top-dark padding-top-sm">
                    ${runnerFirstName && runnerFirst ? html `
                        <div>1B: ${runnerFirstName}</div>` : ''}
                    ${runnerSecondName && runnerSecond ? html `
                        <div>2B: ${runnerSecondName}</div>` : ''}
                    ${runnerThirdName && runnerThird ? html `
                        <div>3B: ${runnerThirdName}</div>` : ''}
                </div>
            </div>
        `;
    }
};
__decorate([
    property({ type: String, attribute: 'away-name' })
], BaseballScoreboard.prototype, "awayName", void 0);
__decorate([
    property({ type: String, attribute: 'home-name' })
], BaseballScoreboard.prototype, "homeName", void 0);
__decorate([
    property({ type: Number, attribute: 'away-score' })
], BaseballScoreboard.prototype, "awayScore", void 0);
__decorate([
    property({ type: Number, attribute: 'home-score' })
], BaseballScoreboard.prototype, "homeScore", void 0);
__decorate([
    property({ type: Number, attribute: 'away-hits' })
], BaseballScoreboard.prototype, "awayHits", void 0);
__decorate([
    property({ type: Number, attribute: 'home-hits' })
], BaseballScoreboard.prototype, "homeHits", void 0);
__decorate([
    property({ type: Number, attribute: 'away-errors' })
], BaseballScoreboard.prototype, "awayErrors", void 0);
__decorate([
    property({ type: Number, attribute: 'home-errors' })
], BaseballScoreboard.prototype, "homeErrors", void 0);
__decorate([
    property({ type: Number })
], BaseballScoreboard.prototype, "inning", void 0);
__decorate([
    property({ type: String })
], BaseballScoreboard.prototype, "half", void 0);
__decorate([
    property({ type: Number })
], BaseballScoreboard.prototype, "balls", void 0);
__decorate([
    property({ type: Number })
], BaseballScoreboard.prototype, "strikes", void 0);
__decorate([
    property({ type: Number })
], BaseballScoreboard.prototype, "outs", void 0);
__decorate([
    property({ type: Boolean, attribute: 'runner-first' })
], BaseballScoreboard.prototype, "runnerFirst", void 0);
__decorate([
    property({ type: Boolean, attribute: 'runner-second' })
], BaseballScoreboard.prototype, "runnerSecond", void 0);
__decorate([
    property({ type: Boolean, attribute: 'runner-third' })
], BaseballScoreboard.prototype, "runnerThird", void 0);
__decorate([
    property({ type: String, attribute: 'runner-first-name' })
], BaseballScoreboard.prototype, "runnerFirstName", void 0);
__decorate([
    property({ type: String, attribute: 'runner-second-name' })
], BaseballScoreboard.prototype, "runnerSecondName", void 0);
__decorate([
    property({ type: String, attribute: 'runner-third-name' })
], BaseballScoreboard.prototype, "runnerThirdName", void 0);
__decorate([
    property({
        type: String,
        attribute: 'game-json',
        converter: (val) => {
            if (!val)
                return null;
            try {
                return JSON.parse(val);
            }
            catch {
                return null;
            }
        }
    })
], BaseballScoreboard.prototype, "gameData", void 0);
__decorate([
    property({
        type: String,
        attribute: 'box-score-json',
        converter: (val) => {
            if (!val)
                return null;
            try {
                return JSON.parse(val);
            }
            catch {
                return null;
            }
        }
    })
], BaseballScoreboard.prototype, "boxScoreData", void 0);
BaseballScoreboard = __decorate([
    customElement('baseball-scoreboard')
], BaseballScoreboard);
export { BaseballScoreboard };
