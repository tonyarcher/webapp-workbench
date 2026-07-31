import { LitElement } from 'lit';
export declare class BaseballStep2Panel extends LitElement {
    static styles: CSSStyleSheet;
    baseLabel: string;
    isHit: boolean;
    private get locations();
    render(): import("lit-html").TemplateResult<1>;
    private selectLocation;
    private cancelStep2;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-step2-panel': BaseballStep2Panel;
    }
}
