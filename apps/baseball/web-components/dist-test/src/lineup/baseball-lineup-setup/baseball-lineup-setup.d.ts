import { LitElement } from 'lit';
export interface PlayerInfo {
    id: number;
    name: string;
    jerseyNumber: number;
    position: string;
}
export declare class BaseballLineupSetup extends LitElement {
    static styles: CSSStyleSheet;
    homeTeamName: string;
    awayTeamName: string;
    homeLineup: PlayerInfo[];
    awayLineup: PlayerInfo[];
    homeBench: PlayerInfo[];
    awayBench: PlayerInfo[];
    render(): import("lit-html").TemplateResult<1>;
    private onClose;
    private onSave;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-lineup-setup': BaseballLineupSetup;
    }
}
