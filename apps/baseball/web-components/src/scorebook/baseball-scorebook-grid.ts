import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import scorebookCssText from './baseball-scorebook-grid.css?inline';

const scorebookSheet = new CSSStyleSheet();
scorebookSheet.replaceSync(scorebookCssText);

export interface ScorebookCellDto {
    notation?: string | null;
    base?: number;
    outNum?: number | null;
    count?: string | null;
    hasEndedInningLine?: boolean;
    run?: boolean;
    rbiCount?: number;
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
            <tbody>
            ${(this.rows ?? []).map(
            (row) => html`
                  <tr>
                    <td class="col-slot font-bold">${row.slotIdx}</td>
                    <td class="col-name">${row.batterName}</td>
                    <td class="col-pos text-secondary">${row.position}</td>
                    ${inningsArray.map((inn) => html`
                      <td class="col-inning">
                        ${this.renderCell(row.innings?.[inn] ?? null)}
                      </td>
                    `)}
                    <td class="col-stat">${row.atBats ?? 0}</td>
                    <td class="col-stat">${row.runs ?? 0}</td>
                    <td class="col-stat">${row.hits ?? 0}</td>
                    <td class="col-stat">${row.rbi ?? 0}</td>
                  </tr>
                `
        )}
            </tbody>
          </table>
        </div>
      </div>
    `;
    }

    private renderCell(cell: ScorebookCellDto | null) {
        const baseClass = cell?.base ? `b${cell.base}` : '';
        const endClass = cell?.hasEndedInningLine ? 'ended-inning' : '';

        return html`
      <div class="diamond ${baseClass} ${endClass}">
        ${cell?.run ? html`<div class="run-dot" data-testid="run-dot"></div>` : ''}
        ${cell?.notation ? html`
          <div class="play-desc">${cell.notation}</div>` : ''}
        ${cell?.outNum ? html`
          <div class="out-circle">${cell.outNum}</div>` : ''}
        ${cell?.count ? html`
          <div class="count-badge">${cell.count}</div>` : ''}
        ${cell?.rbiCount ? html`
          <div class="rbi-badge">RBI ${cell.rbiCount}</div>` : ''}
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-scorebook-grid': BaseballScorebookGrid;
    }
}
