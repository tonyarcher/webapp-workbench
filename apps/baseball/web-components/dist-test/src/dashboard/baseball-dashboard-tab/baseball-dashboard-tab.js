var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import dashTabCssText from './baseball-dashboard-tab.css?inline';
const dashTabSheet = new CSSStyleSheet();
dashTabSheet.replaceSync(dashTabCssText);
let BaseballDashboardTab = class BaseballDashboardTab extends LitElement {
    constructor() {
        super(...arguments);
        this.standingsJson = '[]';
        this.scheduleJson = '[]';
        this.errorMessage = '';
        this.noSeason = false;
    }
    static { this.styles = dashTabSheet; }
    render() {
        if (this.errorMessage) {
            return html `<div class="server-error-banner">${this.errorMessage}</div>`;
        }
        if (this.noSeason) {
            return html `
                <div class="tab-header">
                    <h1>Season Dashboard</h1>
                </div>
                <p>No season selected. Please select a season.</p>
            `;
        }
        return html `
            <div class="tab-header">
                <h1>Season Dashboard</h1>
            </div>

            <div class="dashboard-layout">
                <baseball-standings-table standings-json=${this.standingsJson}></baseball-standings-table>
                <baseball-schedule-list games-json=${this.scheduleJson}></baseball-schedule-list>
            </div>
        `;
    }
};
__decorate([
    property({ type: String, attribute: 'standings-json' })
], BaseballDashboardTab.prototype, "standingsJson", void 0);
__decorate([
    property({ type: String, attribute: 'schedule-json' })
], BaseballDashboardTab.prototype, "scheduleJson", void 0);
__decorate([
    property({ type: String, attribute: 'error-message' })
], BaseballDashboardTab.prototype, "errorMessage", void 0);
__decorate([
    property({ type: Boolean, attribute: 'no-season' })
], BaseballDashboardTab.prototype, "noSeason", void 0);
BaseballDashboardTab = __decorate([
    customElement('baseball-dashboard-tab')
], BaseballDashboardTab);
export { BaseballDashboardTab };
