import { LitElement } from 'lit';
export declare class BaseballDashboardTab extends LitElement {
    static styles: CSSStyleSheet;
    standingsJson: string;
    scheduleJson: string;
    errorMessage: string;
    noSeason: boolean;
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-dashboard-tab': BaseballDashboardTab;
    }
}
