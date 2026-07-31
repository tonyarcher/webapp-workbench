import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

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
  protected createRenderRoot() {
    return this;
  }

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
