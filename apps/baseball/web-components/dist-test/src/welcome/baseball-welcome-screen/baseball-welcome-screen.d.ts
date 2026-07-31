import { LitElement } from 'lit';
export declare class BaseballWelcomeScreen extends LitElement {
    static styles: CSSStyleSheet;
    serverOnline: boolean;
    render(): import("lit-html").TemplateResult<1>;
    private onSelectMode;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-welcome-screen': BaseballWelcomeScreen;
    }
}
