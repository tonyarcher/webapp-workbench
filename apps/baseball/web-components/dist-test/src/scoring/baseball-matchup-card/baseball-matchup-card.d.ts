import { LitElement } from 'lit';
export declare class BaseballMatchupCard extends LitElement {
    static styles: CSSStyleSheet;
    batterName: string;
    batterStats: string;
    pitcherName: string;
    pitcherStats: string;
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-matchup-card': BaseballMatchupCard;
    }
}
