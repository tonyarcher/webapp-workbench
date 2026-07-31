import { LitElement } from 'lit';
interface LeagueDto {
    id: number;
    name: string;
}
export declare class BaseballLeaguesTab extends LitElement {
    static styles: CSSStyleSheet;
    leagues: LeagueDto[];
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-leagues-tab': BaseballLeaguesTab;
    }
}
export {};
