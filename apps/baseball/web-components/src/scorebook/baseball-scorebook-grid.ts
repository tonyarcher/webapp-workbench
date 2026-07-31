import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

export interface ScorebookBatterRow {
  slot: number;
  batterName: string;
  position: string;
  innings: string[]; // 9 cells for innings 1..9
  runs: number;
  hits: number;
  rbi: number;
}

@customElement('baseball-scorebook-grid')
export class BaseballScorebookGrid extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @property({ type: String, attribute: 'team-name' }) teamName = 'TEAM';
  @property({ type: Array }) batters: ScorebookBatterRow[] = [];
  @property({ type: Array }) lineScore: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  @property({ type: Number, attribute: 'total-runs' }) totalRuns = 0;
  @property({ type: Number, attribute: 'total-hits' }) totalHits = 0;
  @property({ type: Number, attribute: 'total-errors' }) totalErrors = 0;

  render() {
    const inningsHeader = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return html`
      <div class="card scorebook-grid-card">
        <div class="flex-between margin-bottom-sm">
          <h3 class="text-accent-green font-bold">${this.teamName} LINEUP & SCOREBOOK</h3>
          <div class="text-muted font-small">R: ${this.totalRuns} | H: ${this.totalHits} | E: ${this.totalErrors}</div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>BATTER</th>
                <th>POS</th>
                ${inningsHeader.map((i) => html`<th>${i}</th>`)}
                <th>AB</th>
                <th>R</th>
                <th>H</th>
              </tr>
            </thead>
            <tbody>
              ${this.batters.map(
                (b) => html`
                  <tr>
                    <td class="font-bold text-muted">${b.slot}</td>
                    <td class="font-bold">${b.batterName}</td>
                    <td class="text-secondary">${b.position}</td>
                    ${(b.innings || []).map(
                      (cell) => html`<td class="scorebook-cell ${cell ? 'occupied-cell' : ''}">${cell || ''}</td>`
                    )}
                    <td>${b.runs + b.hits}</td>
                    <td class="font-bold text-accent-yellow">${b.runs}</td>
                    <td class="font-bold">${b.hits}</td>
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
