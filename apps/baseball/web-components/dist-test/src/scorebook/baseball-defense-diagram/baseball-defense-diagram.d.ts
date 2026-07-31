import { LitElement } from 'lit';
export interface FielderPosition {
    posNum: number;
    posName: string;
    playerName: string;
    jerseyNumber: number;
    topPct: number;
    leftPct: number;
}
export declare class BaseballDefenseDiagram extends LitElement {
    static styles: CSSStyleSheet;
    defendingTeam: string;
    fielders: FielderPosition[];
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-defense-diagram': BaseballDefenseDiagram;
    }
}
