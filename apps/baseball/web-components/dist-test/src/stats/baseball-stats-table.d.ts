import { LitElement } from 'lit';
export interface StatRow {
    playerName: string;
    teamName: string;
    games: number;
    stat1: string;
    stat2: string;
    stat3: string;
}
export declare class BaseballStatsTable extends LitElement {
    static styles: import("lit").CSSResult;
    title: string;
    col1Name: string;
    col2Name: string;
    col3Name: string;
    rows: StatRow[];
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-stats-table': BaseballStatsTable;
    }
}
