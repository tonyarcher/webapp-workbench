import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface StatRow {
  playerName: string;
  teamName: string;
  games: number;
  stat1: string; // AVG or ERA
  stat2: string; // HR or SO
  stat3: string; // RBI or WHIP
}

@customElement('baseball-stats-table')
export class BaseballStatsTable extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @property({ type: String }) title = 'League Leaders';
  @property({ type: String, attribute: 'col1-name' }) col1Name = 'AVG';
  @property({ type: String, attribute: 'col2-name' }) col2Name = 'HR';
  @property({ type: String, attribute: 'col3-name' }) col3Name = 'RBI';
  @property({ type: Array }) rows: StatRow[] = [];

  @property({
    type: String,
    attribute: 'rows-json',
    converter: {
      fromAttribute: (val: string | null) => {
        if (!val) return [];
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
    }
  })
  set rowsJson(val: StatRow[]) {
    this.rows = val;
  }

  render() {
    return html`
      <div class="card">
        <h2>${this.title}</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Team</th>
                <th>GP</th>
                <th>${this.col1Name}</th>
                <th>${this.col2Name}</th>
                <th>${this.col3Name}</th>
              </tr>
            </thead>
            <tbody>
              ${this.rows.map(
                (r) => html`
                  <tr>
                    <td class="font-bold">${r.playerName}</td>
                    <td class="text-secondary">${r.teamName}</td>
                    <td>${r.games}</td>
                    <td class="font-bold text-accent-yellow">${r.stat1}</td>
                    <td class="font-bold">${r.stat2}</td>
                    <td>${r.stat3}</td>
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
