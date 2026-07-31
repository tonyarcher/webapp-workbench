import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import scoreboardCssText from './baseball-scoreboard.css?inline';

const scoreboardStyleSheet = new CSSStyleSheet();
scoreboardStyleSheet.replaceSync(scoreboardCssText);

@customElement('baseball-scoreboard')
export class BaseballScoreboard extends LitElement {
    static styles = scoreboardStyleSheet;

    @property({type: String, attribute: 'away-name'}) awayName = 'AWAY';
    @property({type: String, attribute: 'home-name'}) homeName = 'HOME';
    @property({type: Number, attribute: 'away-score'}) awayScore = 0;
    @property({type: Number, attribute: 'home-score'}) homeScore = 0;
    @property({type: Number, attribute: 'away-hits'}) awayHits = 0;
    @property({type: Number, attribute: 'home-hits'}) homeHits = 0;
    @property({type: Number, attribute: 'away-errors'}) awayErrors = 0;
    @property({type: Number, attribute: 'home-errors'}) homeErrors = 0;

    @property({type: Number}) inning = 1;
    @property({type: String}) half = 'TOP';
    @property({type: Number}) balls = 0;
    @property({type: Number}) strikes = 0;
    @property({type: Number}) outs = 0;

    @property({type: Boolean, attribute: 'runner-first'}) runnerFirst = false;
    @property({type: Boolean, attribute: 'runner-second'}) runnerSecond = false;
    @property({type: Boolean, attribute: 'runner-third'}) runnerThird = false;

    @property({type: String, attribute: 'runner-first-name'}) runnerFirstName = '';
    @property({type: String, attribute: 'runner-second-name'}) runnerSecondName = '';
    @property({type: String, attribute: 'runner-third-name'}) runnerThirdName = '';

    @property({
        type: String,
        attribute: 'game-json',
        converter: (val) => {
            if (!val) return null;
            try { return JSON.parse(val); } catch { return null; }
        }
    })
    gameData: any = null;

    @property({
        type: String,
        attribute: 'box-score-json',
        converter: (val) => {
            if (!val) return null;
            try { return JSON.parse(val); } catch { return null; }
        }
    })
    boxScoreData: any = null;

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

        const runnerFirstName = g?.gameState?.runnerFirstName ?? (this.runnerFirstName || (runnerFirst ? "Runner on 1B" : ""));
        const runnerSecondName = g?.gameState?.runnerSecondName ?? (this.runnerSecondName || (runnerSecond ? "Runner on 2B" : ""));
        const runnerThirdName = g?.gameState?.runnerThirdName ?? (this.runnerThirdName || (runnerThird ? "Runner on 3B" : ""));

        const inningSymbol = half === 'TOP' ? '▲' : '▼';
        const outsStr = outs === 0 ? 'No Outs' : outs === 1 ? '1 Out' : outs === 2 ? '2 Outs' : '3 Outs';

        return html`
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
            R-H-E: ${awayScore}-${awayHits}-${awayErrors} vs ${homeScore}-${homeHits}-${homeErrors}
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
                    ${runnerFirstName && runnerFirst ? html`
                        <div>1B: ${runnerFirstName}</div>` : ''}
                    ${runnerSecondName && runnerSecond ? html`
                        <div>2B: ${runnerSecondName}</div>` : ''}
                    ${runnerThirdName && runnerThird ? html`
                        <div>3B: ${runnerThirdName}</div>` : ''}
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-scoreboard': BaseballScoreboard;
    }
}
