var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import scorerTabCssText from './baseball-scorer-tab.css?inline';
const scorerTabSheet = new CSSStyleSheet();
scorerTabSheet.replaceSync(scorerTabCssText);
let BaseballScorerTab = class BaseballScorerTab extends LitElement {
    constructor() {
        super(...arguments);
        this.awayName = '';
        this.homeName = '';
        this.noGame = false;
    }
    static { this.styles = scorerTabSheet; }
    render() {
        if (this.noGame) {
            return html `<p class="empty-state">No active game scoring session.</p>`;
        }
        return html `
            <h1>Live Scoring: ${this.awayName} @ ${this.homeName}</h1>
            <div class="scorer-top-grid">
                <slot name="scoreboard"></slot>
                <slot name="controls"></slot>
            </div>
            <div class="scorebook-section">
                <slot name="scorebook"></slot>
            </div>
        `;
    }
};
__decorate([
    property({ type: String, attribute: 'away-name' })
], BaseballScorerTab.prototype, "awayName", void 0);
__decorate([
    property({ type: String, attribute: 'home-name' })
], BaseballScorerTab.prototype, "homeName", void 0);
__decorate([
    property({ type: Boolean, attribute: 'no-game' })
], BaseballScorerTab.prototype, "noGame", void 0);
BaseballScorerTab = __decorate([
    customElement('baseball-scorer-tab')
], BaseballScorerTab);
export { BaseballScorerTab };
