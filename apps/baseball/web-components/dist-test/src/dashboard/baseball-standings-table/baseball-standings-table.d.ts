import { LitElement } from 'lit';
export interface StandingsRow {
    teamName: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    winPercentage: number;
    runsScored: number;
    runsAllowed: number;
}
export declare class BaseballStandingsTable extends LitElement {
    static styles: CSSStyleSheet;
    standings: StandingsRow[];
    render(): import("lit-html").TemplateResult<1>;
    private formatPct;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-standings-table': BaseballStandingsTable;
    }
}
