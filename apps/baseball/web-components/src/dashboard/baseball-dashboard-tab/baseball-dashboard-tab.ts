import { html, css, unsafeCSS, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import dashTabCss from './baseball-dashboard-tab.css?inline';

@customElement('baseball-dashboard-tab')
export class BaseballDashboardTab extends LitElement {
  static styles = css`${unsafeCSS(dashTabCss)}`;

  @property({ type: String, attribute: 'standings-json' }) standingsJson = '[]';
  @property({ type: String, attribute: 'schedule-json' }) scheduleJson = '[]';

  render() {
    return html`
      <div class="tab-header">
        <h1>Season Dashboard</h1>
      </div>

      <div class="dashboard-layout">
        <baseball-standings-table .standingsJson=${this.standingsJson}></baseball-standings-table>
        <baseball-schedule-list .scheduleJson=${this.scheduleJson}></baseball-schedule-list>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-dashboard-tab': BaseballDashboardTab;
  }
}
