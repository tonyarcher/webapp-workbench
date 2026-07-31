import { LitElement } from 'lit';
export interface RosterPlayer {
    id: number;
    name: string;
    position: string;
    jerseyNumber: number;
    battingHand: string;
    throwingHand: string;
}
export declare class BaseballRosterTable extends LitElement {
    static styles: CSSStyleSheet;
    teamName: string;
    players: RosterPlayer[];
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-roster-table': BaseballRosterTable;
    }
}
