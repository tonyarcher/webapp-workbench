import { LitElement } from 'lit';
export declare class BaseballTabPageWrapper extends LitElement {
    static styles: CSSStyleSheet;
    pageTitle: string;
    loadingMessage: string;
    emptyMessage: string;
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-tab-page-wrapper': BaseballTabPageWrapper;
    }
}
