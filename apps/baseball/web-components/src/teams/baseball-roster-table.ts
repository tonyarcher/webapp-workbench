import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  jerseyNumber: number;
  battingHand: string;
  throwingHand: string;
}

@customElement('baseball-roster-table')
export class BaseballRosterTable extends LitElement {
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

    .text-secondary {
      color: var(--text-secondary, #8e9cae);
    }

    .text-accent-yellow {
      color: var(--accent-yellow, #ffcc00);
    }
  `;

  @property({ type: String, attribute: 'team-name' }) teamName = 'Team Roster';
  @property({ type: Array }) players: RosterPlayer[] = [];

  @property({
    type: String,
    attribute: 'players-json',
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
  set playersJson(val: RosterPlayer[]) {
    this.players = val;
  }

  render() {
    return html`
      <div class="card">
        <h2>${this.teamName} Roster (${this.players.length})</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>POS</th>
                <th>BATS</th>
                <th>THROWS</th>
              </tr>
            </thead>
            <tbody>
              ${this.players.map(
                (p) => html`
                  <tr>
                    <td class="font-bold text-accent-yellow">#${p.jerseyNumber}</td>
                    <td class="font-bold">${p.name}</td>
                    <td class="text-secondary">${p.position}</td>
                    <td>${p.battingHand}</td>
                    <td>${p.throwingHand}</td>
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
    'baseball-roster-table': BaseballRosterTable;
  }
}
