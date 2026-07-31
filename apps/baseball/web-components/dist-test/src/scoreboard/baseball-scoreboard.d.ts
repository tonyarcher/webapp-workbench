import { LitElement } from 'lit';
export declare class BaseballScoreboard extends LitElement {
    static styles: CSSStyleSheet;
    awayName: string;
    homeName: string;
    awayScore: number;
    homeScore: number;
    awayHits: number;
    homeHits: number;
    awayErrors: number;
    homeErrors: number;
    inning: number;
    half: string;
    balls: number;
    strikes: number;
    outs: number;
    runnerFirst: boolean;
    runnerSecond: boolean;
    runnerThird: boolean;
    runnerFirstName: string;
    runnerSecondName: string;
    runnerThirdName: string;
    gameData: any;
    boxScoreData: any;
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-scoreboard': BaseballScoreboard;
    }
}
