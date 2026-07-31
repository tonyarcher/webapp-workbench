import { LitElement } from 'lit';
export declare class BaseballActionGrid extends LitElement {
    static styles: CSSStyleSheet;
    currentPitchType: string;
    render(): import("lit-html").TemplateResult<1>;
    private emitPitchType;
    private emitEvent;
    private emitStep2;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-action-grid': BaseballActionGrid;
    }
}
