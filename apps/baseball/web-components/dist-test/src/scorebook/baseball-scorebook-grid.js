var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import scorebookCssText from './baseball-scorebook-grid.css?inline';
const scorebookSheet = new CSSStyleSheet();
scorebookSheet.replaceSync(scorebookCssText);
let BaseballScorebookGrid = class BaseballScorebookGrid extends LitElement {
    constructor() {
        super(...arguments);
        this.teamName = 'Team Scorecard';
        this.maxInning = 9;
        this.rows = [];
    }
    static { this.styles = scorebookSheet; }
    render() {
        const inningsArray = Array.from({ length: this.maxInning }, (_, i) => i + 1);
        return html `
      <div class="card scorebook-container">
        <h2 class="scorebook-title">${this.teamName} - Scorebook Sheet</h2>

        <div class="table-wrapper">
          <table class="scorebook-table">
            <thead>
              <tr>
                <th class="col-slot">#</th>
                <th class="col-name">Batter</th>
                <th class="col-pos">POS</th>
                ${inningsArray.map((inn) => html `<th class="col-inning">${inn}</th>`)}
                <th class="col-stat">AB</th>
                <th class="col-stat">R</th>
                <th class="col-stat">H</th>
                <th class="col-stat">RBI</th>
              </tr>
            </thead>
            <tbody>
            ${(this.rows ?? []).map((row) => html `
                  <tr>
                    <td class="col-slot font-bold">${row.slotIdx}</td>
                    <td class="col-name">${row.batterName}</td>
                    <td class="col-pos text-secondary">${row.position}</td>
                    ${inningsArray.map((inn) => html `
                      <td class="col-inning">
                        ${this.renderCell(row.innings?.[inn] ?? null)}
                      </td>
                    `)}
                    <td class="col-stat">${row.atBats ?? 0}</td>
                    <td class="col-stat">${row.runs ?? 0}</td>
                    <td class="col-stat">${row.hits ?? 0}</td>
                    <td class="col-stat">${row.rbi ?? 0}</td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
    }
    renderCell(cell) {
        const baseClass = cell?.base ? `b${cell.base}` : '';
        const endClass = cell?.hasEndedInningLine ? 'ended-inning' : '';
        return html `
      <div class="diamond ${baseClass} ${endClass}">
        ${cell?.notation ? html `
          <div class="play-desc">${cell.notation}</div>` : ''}
        ${cell?.outNum ? html `
          <div class="out-circle">${cell.outNum}</div>` : ''}
        ${cell?.count ? html `
          <div class="count-badge">${cell.count}</div>` : ''}
      </div>
    `;
    }
};
__decorate([
    property({ type: String, attribute: 'team-name' })
], BaseballScorebookGrid.prototype, "teamName", void 0);
__decorate([
    property({ type: Number, attribute: 'max-inning' })
], BaseballScorebookGrid.prototype, "maxInning", void 0);
__decorate([
    property({
        type: Array,
        attribute: 'slots-json',
        converter: {
            fromAttribute: (val) => {
                if (!val)
                    return [];
                try {
                    return JSON.parse(val);
                }
                catch {
                    return [];
                }
            }
        }
    })
], BaseballScorebookGrid.prototype, "rows", void 0);
BaseballScorebookGrid = __decorate([
    customElement('baseball-scorebook-grid')
], BaseballScorebookGrid);
export { BaseballScorebookGrid };
