import { html, css, LitElement } from 'lit';
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
  static styles = css`
    :host {
      display: block;
      width: 100%;
      font-family: 'Outfit', sans-serif;
    }

    .card {
      background: var(--bg-card, rgba(30, 36, 50, 0.45));
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color, rgba(229, 30, 43, 0.15));
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      color: var(--text-primary, #f5f7fa);
    }

    h2 {
      margin-top: 0;
      margin-bottom: 1rem;
      font-weight: 700;
    }

    .table-container {
      width: 100%;
      overflow-x: auto;
      margin-top: 1rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      padding: 0.75rem 1rem;
      color: var(--text-secondary, #8e9cae);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-color, rgba(229, 30, 43, 0.15));
    }

    td {
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      font-size: 0.95rem;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .font-bold {
      font-weight: bold;
    }
  `;

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

declare global {
  interface HTMLElementTagNameMap {
    'baseball-standings-table': BaseballStandingsTable;
  }
}
