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

    @property({type: String, attribute: 'last-play'}) lastPlay = '';

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
        const vm = this.buildViewModel();
        return html`
            <div class="scoreboard-led">
                ${this.renderHeader(vm)} ${this.renderTeamRows(vm)} ${this.renderCountRow(vm)}
                <div class="last-play-display" data-testid="last-play">${vm.lastPlay}</div>
                ${this.renderDiamond(vm)} ${this.renderRunnerNames(vm)}
            </div>
        `;
    }

    private buildViewModel() {
        const g = this.gameData;
        const bs = this.boxScoreData;
        const runners = this.resolveRunners(g);
        return {
            awayName: this.resolveAwayName(g),
            homeName: this.resolveHomeName(g),
            awayScore: this.resolveAwayScore(g),
            homeScore: this.resolveHomeScore(g),
            awayHits: this.resolveAwayHits(bs),
            homeHits: this.resolveHomeHits(bs),
            awayErrors: this.resolveAwayErrors(bs),
            homeErrors: this.resolveHomeErrors(bs),
            inning: this.resolveInning(g),
            half: this.resolveHalf(g),
            balls: this.resolveBalls(g),
            strikes: this.resolveStrikes(g),
            outs: this.resolveOuts(g),
            lastPlay: this.resolveLastPlay(g),
            ...runners,
            inningSymbol: this.resolveInningSymbol(g),
            outsStr: this.formatOuts(this.resolveOuts(g)),
        };
    }

    private resolveRunners(g: any) {
        const runnerFirst = this.resolveRunnerFirst(g);
        const runnerSecond = this.resolveRunnerSecond(g);
        const runnerThird = this.resolveRunnerThird(g);
        return {
            runnerFirst,
            runnerSecond,
            runnerThird,
            runnerFirstName: this.resolveRunnerName(g?.gameState?.runnerFirstName, this.runnerFirstName, runnerFirst, 'Runner on 1B'),
            runnerSecondName: this.resolveRunnerName(g?.gameState?.runnerSecondName, this.runnerSecondName, runnerSecond, 'Runner on 2B'),
            runnerThirdName: this.resolveRunnerName(g?.gameState?.runnerThirdName, this.runnerThirdName, runnerThird, 'Runner on 3B'),
        };
    }

    private resolveRunnerFirst(g: any): boolean { return g ? !!g.gameState?.runnerFirstId : this.runnerFirst; }
    private resolveRunnerSecond(g: any): boolean { return g ? !!g.gameState?.runnerSecondId : this.runnerSecond; }
    private resolveRunnerThird(g: any): boolean { return g ? !!g.gameState?.runnerThirdId : this.runnerThird; }

    private resolveAwayName(g: any) { return g?.awayTeam?.name ?? this.awayName; }
    private resolveHomeName(g: any) { return g?.homeTeam?.name ?? this.homeName; }
    private resolveAwayScore(g: any) { return g?.awayScore ?? this.awayScore; }
    private resolveHomeScore(g: any) { return g?.homeScore ?? this.homeScore; }
    private resolveAwayHits(bs: any) { return bs?.lineScore?.awayHits ?? this.awayHits; }
    private resolveHomeHits(bs: any) { return bs?.lineScore?.homeHits ?? this.homeHits; }
    private resolveAwayErrors(bs: any) { return bs?.lineScore?.awayErrors ?? this.awayErrors; }
    private resolveHomeErrors(bs: any) { return bs?.lineScore?.homeErrors ?? this.homeErrors; }
    private resolveInning(g: any) { return g?.gameState?.inning ?? this.inning; }
    private resolveHalf(g: any) { return g?.gameState?.half ?? this.half; }
    private resolveBalls(g: any) { return g?.gameState?.balls ?? this.balls; }
    private resolveStrikes(g: any) { return g?.gameState?.strikes ?? this.strikes; }
    private resolveOuts(g: any) { return g?.gameState?.outs ?? this.outs; }
    private resolveLastPlay(g: any) { return g?.gameState?.lastPlay ?? this.lastPlay; }
    private resolveInningSymbol(g: any) { return (g?.gameState?.half ?? this.half) === 'TOP' ? '▲' : '▼'; }

    private resolveRunnerName(gameName: string | undefined, propName: string, hasRunner: boolean, fallback: string): string {
        if (gameName) return gameName;
        if (propName) return propName;
        return hasRunner ? fallback : '';
    }

    private formatOuts(outs: number): string {
        if (outs === 0) return 'No Outs';
        if (outs === 1) return '1 Out';
        if (outs === 2) return '2 Outs';
        return '3 Outs';
    }

    private renderHeader(vm: ReturnType<BaseballScoreboard['buildViewModel']>) {
        return html`
          <div class="scoreboard-header">
            <span class="inning-display">${vm.inningSymbol} Inning ${vm.inning}</span>
            <span class="outs-indicator">${vm.outsStr}</span>
          </div>
        `;
    }

    private renderTeamRows(vm: ReturnType<BaseballScoreboard['buildViewModel']>) {
        return html`
          <div class="scoreboard-row"><span class="team-led-name">${vm.awayName}</span><span class="team-led-score">${vm.awayScore}</span></div>
          <div class="scoreboard-row"><span class="team-led-name">${vm.homeName}</span><span class="team-led-score">${vm.homeScore}</span></div>
        `;
    }

    private renderCountRow(vm: ReturnType<BaseballScoreboard['buildViewModel']>) {
        return html`
          <div class="scoreboard-row margin-top-md">
            <span class="count-display">Count: ${vm.balls} - ${vm.strikes}</span>
            <span class="text-muted font-small">R-H-E: ${vm.awayScore}-${vm.awayHits}-${vm.awayErrors} vs ${vm.homeScore}-${vm.homeHits}-${vm.homeErrors}</span>
          </div>
        `;
    }

    private renderDiamond(vm: ReturnType<BaseballScoreboard['buildViewModel']>) {
        return html`
          <div class="diamond-container">
            <div class="base-diamond">
              <div class="base base-first ${vm.runnerFirst ? 'occupied' : ''}"><div class="base-label">1st</div></div>
              <div class="base base-second ${vm.runnerSecond ? 'occupied' : ''}"><div class="base-label">2nd</div></div>
              <div class="base base-third ${vm.runnerThird ? 'occupied' : ''}"><div class="base-label">3rd</div></div>
              <div class="base base-home"></div>
            </div>
          </div>
        `;
    }

    private renderRunnerNames(vm: ReturnType<BaseballScoreboard['buildViewModel']>) {
        return html`
          <div class="text-muted font-small margin-top-md border-top-dark padding-top-sm">
            ${vm.runnerFirstName && vm.runnerFirst ? html`<div>1B: ${vm.runnerFirstName}</div>` : ''}
            ${vm.runnerSecondName && vm.runnerSecond ? html`<div>2B: ${vm.runnerSecondName}</div>` : ''}
            ${vm.runnerThirdName && vm.runnerThird ? html`<div>3B: ${vm.runnerThirdName}</div>` : ''}
          </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-scoreboard': BaseballScoreboard;
    }
}
