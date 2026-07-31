import { LitElement } from 'lit';
export declare class BaseballNavBar extends LitElement {
    static styles: CSSStyleSheet;
    activeTab: string;
    userName: string;
    render(): import("lit-html").TemplateResult<1>;
    private onSelectTab;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-nav-bar': BaseballNavBar;
    }
}
