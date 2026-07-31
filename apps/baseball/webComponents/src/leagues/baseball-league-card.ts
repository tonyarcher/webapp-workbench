import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('baseball-league-card')
export class BaseballLeagueCard extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @property({ type: String, attribute: 'league-name' }) leagueName = '';
  @property({ type: String }) season = '';
  @property({ type: Number, attribute: 'team-count' }) teamCount = 0;

  render() {
    return html`
      <div class="card flex-between">
        <div>
          <h2 class="text-accent-green font-bold">${this.leagueName}</h2>
          <div class="text-muted font-small margin-top-xs">Season: ${this.season} | Teams: ${this.teamCount}</div>
        </div>
        <button class="btn btn-secondary">Manage League</button>
      </div>
    `;
  }
}
