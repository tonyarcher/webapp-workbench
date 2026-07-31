import { LitElement } from 'lit';
export declare class BaseballScoringControls extends LitElement {
    static styles: CSSStyleSheet;
    gameStatus: 'active' | 'completed';
    awayName: string;
    homeName: string;
    awayScore: string;
    homeScore: string;
    batterName: string;
    batterStats: string;
    pitcherName: string;
    pitcherStats: string;
    currentPitchType: string;
    panelMode: 'action-grid' | 'step2';
    step2Label: string;
    step2IsHit: boolean;
    render(): import("lit-html").TemplateResult<1>;
    private renderCompleted;
    private renderActive;
    private emit;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-scoring-controls': BaseballScoringControls;
    }
}
