import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface StandingsRow {
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
  runsScored: number;
  runsAllowed: number;
}

@customElement('baseball-standings-table')
export class BaseballStandingsTable extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @property({ type: Array }) standings: StandingsRow[] = [];

  @property({
    type: String,
    attribute: 'standings-json',
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
  set standingsJson(rows: StandingsRow[]) {
    this.standings = rows;
  }

  private formatPct(pct: number): string {
    return (pct || 0).toFixed(3).replace(/^0+/, '');
  }

  render() {
    return html`
      <div class="card">
        <h2>League Standings</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>GP</th>
                <th>W</th>
                <th>L</th>
                <th>PCT</th>
                <th>RS</th>
                <th>RA</th>
              </tr>
            </thead>
            <tbody>
              ${this.standings.map(
                (s) => html`
                  <tr>
                    <td class="font-bold">${s.teamName}</td>
                    <td>${s.gamesPlayed}</td>
                    <td>${s.wins}</td>
                    <td>${s.losses}</td>
                    <td>${this.formatPct(s.winPercentage)}</td>
                    <td>${s.runsScored}</td>
                    <td>${s.runsAllowed}</td>
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
