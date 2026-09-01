import {html, svg, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import scorebookCssText from './baseball-scorebook-grid.css?inline';

const scorebookSheet = new CSSStyleSheet();
scorebookSheet.replaceSync(scorebookCssText);

export interface ScorebookCellAdvancementDto {
    from: number;
    to: number;
    scored: boolean;
}

export interface ScorebookCellDto {
    notation?: string | null;
    base?: number;
    outNum?: number | null;
    count?: string | null;
    hasEndedInningLine?: boolean;
    run?: boolean;
    rbiCount?: number;
    advancements?: ScorebookCellAdvancementDto[];
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

@customElement('baseball-scorebook-grid')
export class BaseballScorebookGrid extends LitElement {
    static styles = scorebookSheet;

    @property({type: String, attribute: 'team-name'}) teamName = 'Team Scorecard';
    @property({type: Number, attribute: 'max-inning'}) maxInning = 9;

    @property({
        type: Array,
        attribute: 'slots-json',
        converter: {
            fromAttribute: (val: string | null): ScorebookSlotDto[] => {
                if (!val) return [];
                try {
                    return JSON.parse(val);
                } catch {
                    return [];
                }
            }
        }
    })
    rows: ScorebookSlotDto[] = [];

    render() {
        const inningsArray = Array.from({length: this.maxInning}, (_, i) => i + 1);
        return html`
      <div class="card scorebook-container">
        <h2 class="scorebook-title">${this.teamName} - Scorebook Sheet</h2>
        <div class="table-wrapper">
          <table class="scorebook-table">
            ${this.renderTableHead(inningsArray)} ${this.renderTableBody(inningsArray)}
          </table>
        </div>
      </div>
    `;
    }

    private renderTableHead(inningsArray: number[]) {
        return html`
          <thead>
            <tr>
              <th class="col-slot">#</th>
              <th class="col-name">Batter</th>
              <th class="col-pos">POS</th>
              ${inningsArray.map((inn) => html`<th class="col-inning">${inn}</th>`)}
              <th class="col-stat">AB</th>
              <th class="col-stat">R</th>
              <th class="col-stat">H</th>
              <th class="col-stat">RBI</th>
            </tr>
          </thead>
        `;
    }

    private renderTableBody(inningsArray: number[]) {
        return html` <tbody>${(this.rows ?? []).map((row) => this.renderRow(row, inningsArray))}</tbody> `;
    }

    private renderRow(row: ScorebookSlotDto, inningsArray: number[]) {
        return html`
          <tr>
            <td class="col-slot font-bold">${row.slotIdx}</td>
            <td class="col-name">${row.batterName}</td>
            <td class="col-pos text-secondary">${row.position}</td>
            ${inningsArray.map((inn) => html`<td class="col-inning">${this.renderCell(row.innings?.[inn] ?? null)}</td>`)}
            <td class="col-stat">${row.atBats ?? 0}</td>
            <td class="col-stat">${row.runs ?? 0}</td>
            <td class="col-stat">${row.hits ?? 0}</td>
            <td class="col-stat">${row.rbi ?? 0}</td>
          </tr>
        `;
    }

    private renderCell(cell: ScorebookCellDto | null) {
        return html`
      <div class="diamond ${this.cellBaseClass(cell)} ${this.cellEndClass(cell)} ${this.isScored(cell) ? 'scored' : ''}">
        ${this.renderRunDot(cell)} ${this.renderAdvancements(cell)} ${this.renderNotation(cell)}
        ${this.renderOutNum(cell)} ${this.renderCountBadge(cell)} ${this.renderRbiBadge(cell)}
      </div>
    `;
    }

    private cellBaseClass(cell: ScorebookCellDto | null): string {
        return cell?.base ? `b${cell.base}` : '';
    }

    private cellEndClass(cell: ScorebookCellDto | null): string {
        return cell?.hasEndedInningLine ? 'ended-inning' : '';
    }

    private isScored(cell: ScorebookCellDto | null): boolean {
        if (cell?.run === true) return true;
        return (cell?.advancements ?? []).some((advancement) => advancement.scored);
    }

    private renderRunDot(cell: ScorebookCellDto | null) {
        return cell?.run ? html`<div class="run-dot" data-testid="run-dot"></div>` : '';
    }

    private renderNotation(cell: ScorebookCellDto | null) {
        return cell?.notation ? html`<div class="play-desc">${cell.notation}</div>` : '';
    }

    private renderOutNum(cell: ScorebookCellDto | null) {
        return cell?.outNum ? html`<div class="out-circle">${cell.outNum}</div>` : '';
    }

    private renderCountBadge(cell: ScorebookCellDto | null) {
        return cell?.count ? html`<div class="count-badge">${cell.count}</div>` : '';
    }

    private renderRbiBadge(cell: ScorebookCellDto | null) {
        return cell?.rbiCount ? html`<div class="rbi-badge">RBI ${cell.rbiCount}</div>` : '';
    }

    private renderAdvancements(cell: ScorebookCellDto | null) {
        const advancements = cell?.advancements ?? [];
        if (advancements.length === 0) return '';

        const lines = advancements.map(
            (advancement) => svg`
        <line
          class="advancement-line ${advancement.scored ? 'scored' : ''}"
          x1="${basePointX(advancement.from)}"
          y1="${basePointY(advancement.from)}"
          x2="${basePointX(advancement.to)}"
          y2="${basePointY(advancement.to)}"
        ></line>
      `
        );
        return html`<svg class="advancement-svg" viewBox="0 0 52 52" data-testid="advancement-svg">${lines}</svg>`;
    }
}

function basePointX(base: number): number {
    switch (base) {
        case 1:
            return 46;
        case 2:
            return 26;
        case 3:
            return 6;
        default:
            return 26;
    }
}

function basePointY(base: number): number {
    switch (base) {
        case 1:
            return 26;
        case 2:
            return 6;
        case 3:
            return 26;
        default:
            return 46;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-scorebook-grid': BaseballScorebookGrid;
    }
}
