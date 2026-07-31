var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
let BaseballStatsTable = class BaseballStatsTable extends LitElement {
    constructor() {
        super(...arguments);
        this.title = 'League Leaders';
        this.col1Name = 'AVG';
        this.col2Name = 'HR';
        this.col3Name = 'RBI';
        this.rows = [];
    }
    static { this.styles = css `
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
  `; }
    render() {
        return html `
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
            ${(this.rows ?? []).map((r) => html `
                  <tr>
                    <td class="font-bold">${r.playerName}</td>
                    <td class="text-secondary">${r.teamName}</td>
                    <td>${r.games}</td>
                    <td class="font-bold text-accent-yellow">${r.stat1}</td>
                    <td class="font-bold">${r.stat2}</td>
                    <td>${r.stat3}</td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
    }
};
__decorate([
    property({ type: String })
], BaseballStatsTable.prototype, "title", void 0);
__decorate([
    property({ type: String, attribute: 'col1-name' })
], BaseballStatsTable.prototype, "col1Name", void 0);
__decorate([
    property({ type: String, attribute: 'col2-name' })
], BaseballStatsTable.prototype, "col2Name", void 0);
__decorate([
    property({ type: String, attribute: 'col3-name' })
], BaseballStatsTable.prototype, "col3Name", void 0);
__decorate([
    property({
        type: Array,
        attribute: 'rows-json',
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
], BaseballStatsTable.prototype, "rows", void 0);
BaseballStatsTable = __decorate([
    customElement('baseball-stats-table')
], BaseballStatsTable);
export { BaseballStatsTable };
