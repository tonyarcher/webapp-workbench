import { LitElement } from 'lit';
export declare class BaseballLeagueCard extends LitElement {
    static styles: CSSStyleSheet;
    leagueName: string;
    leagueDetails: string;
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-league-card': BaseballLeagueCard;
    }
}
