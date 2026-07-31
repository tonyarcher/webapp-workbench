import { LitElement } from 'lit';
export declare class BaseballAuthCard extends LitElement {
    static styles: CSSStyleSheet;
    isSignUp: boolean;
    loggedInUser: string;
    errorMessage: string;
    private username;
    private password;
    render(): import("lit-html").TemplateResult<1>;
    private handleSubmit;
    private handleLogout;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-auth-card': BaseballAuthCard;
    }
}
