import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import dashTabCssText from './baseball-dashboard-tab.css?inline';

const dashTabSheet = new CSSStyleSheet();
dashTabSheet.replaceSync(dashTabCssText);

@customElement('baseball-dashboard-tab')
export class BaseballDashboardTab extends LitElement {
    static styles = dashTabSheet;

    @property({type: String, attribute: 'standings-json'}) standingsJson = '[]';
    @property({type: String, attribute: 'schedule-json'}) scheduleJson = '[]';

    render() {
        return html`
            <div class="tab-header">
                <h1>Season Dashboard</h1>
            </div>

            <div class="dashboard-layout">
                <baseball-standings-table standings-json=${this.standingsJson}></baseball-standings-table>
                <baseball-schedule-list games-json=${this.scheduleJson}></baseball-schedule-list>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-dashboard-tab': BaseballDashboardTab;
    }
}
