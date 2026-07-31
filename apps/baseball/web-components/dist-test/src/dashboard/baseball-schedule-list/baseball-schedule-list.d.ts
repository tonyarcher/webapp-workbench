import { LitElement } from 'lit';
export interface GameItem {
    id: number;
    awayTeam: string;
    homeTeam: string;
    awayScore: number;
    homeScore: number;
    date: string;
    status: string;
}
export declare class BaseballScheduleList extends LitElement {
    static styles: CSSStyleSheet;
    games: GameItem[];
    render(): import("lit-html").TemplateResult<1>;
    private onScoreGame;
    private onBoxScore;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-schedule-list': BaseballScheduleList;
    }
}
