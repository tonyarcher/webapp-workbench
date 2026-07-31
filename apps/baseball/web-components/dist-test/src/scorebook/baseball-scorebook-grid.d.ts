import { LitElement } from 'lit';
export interface ScorebookCellDto {
    notation?: string | null;
    base?: number;
    outNum?: number | null;
    count?: string | null;
    hasEndedInningLine?: boolean;
}
export interface ScorebookSlotDto {
    slotIdx: number;
    batterName: string;
    position: string;
    hasSub?: boolean;
    atBats?: number;
    runs?: number;
    hits?: number;
    rbi?: number;
    innings?: Record<string, ScorebookCellDto>;
}
export declare class BaseballScorebookGrid extends LitElement {
    static styles: CSSStyleSheet;
    teamName: string;
    maxInning: number;
    rows: ScorebookSlotDto[];
    render(): import("lit-html").TemplateResult<1>;
    private renderCell;
}
declare global {
    interface HTMLElementTagNameMap {
        'baseball-scorebook-grid': BaseballScorebookGrid;
    }
}
