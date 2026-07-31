import { LitElement } from 'lit';
export declare class BaseballScorerTab extends LitElement {
    static styles: CSSStyleSheet;
    awayName: string;
    homeName: string;
    noGame: boolean;
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-scorer-tab': BaseballScorerTab;
    }
}
