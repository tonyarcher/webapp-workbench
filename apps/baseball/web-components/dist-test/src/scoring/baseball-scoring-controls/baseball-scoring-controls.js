var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import controlsCssText from './baseball-scoring-controls.css?inline';
const controlsSheet = new CSSStyleSheet();
controlsSheet.replaceSync(controlsCssText);
let BaseballScoringControls = class BaseballScoringControls extends LitElement {
    constructor() {
        super(...arguments);
        // Which top-level mode to show
        this.gameStatus = 'active';
        // Completed state data
        this.awayName = '';
        this.homeName = '';
        this.awayScore = '0';
        this.homeScore = '0';
        // Active state — matchup card data
        this.batterName = '';
        this.batterStats = '';
        this.pitcherName = '';
        this.pitcherStats = '';
        // Active state — action panel mode ('action-grid' | 'step2')
        this.currentPitchType = '';
        this.panelMode = 'action-grid';
        this.step2Label = '';
        this.step2IsHit = false;
    }
    static { this.styles = controlsSheet; }
    render() {
        return this.gameStatus === 'completed'
            ? this.renderCompleted()
            : this.renderActive();
    }
    renderCompleted() {
        return html `
            <div class="completed-state">
                <div class="completed-title">🏁 GAME COMPLETED</div>
                <div class="completed-score">
                    Final: ${this.awayName} ${this.awayScore}, ${this.homeName} ${this.homeScore}
                </div>
                <button class="btn" @click=${() => this.emit('view-boxscore', {})}>
                    View Final Box Score
                </button>
            </div>
        `;
    }
    renderActive() {
        return html `
            <div class="active-controls">
                <h2>Plate Matchup</h2>
                <baseball-matchup-card
                    batter-name=${this.batterName}
                    batter-stats=${this.batterStats}
                    pitcher-name=${this.pitcherName}
                    pitcher-stats=${this.pitcherStats}
                ></baseball-matchup-card>

                ${this.panelMode === 'step2'
            ? html `
                        <baseball-step2-panel
                            base-label=${this.step2Label}
                            ?is-hit=${this.step2IsHit}
                            @location-selected=${(e) => this.emit('location-selected', e.detail)}
                            @cancel-step2=${() => this.emit('cancel-step2', {})}
                        ></baseball-step2-panel>
                    `
            : html `
                        <baseball-action-grid
                            current-pitch-type=${this.currentPitchType}
                            @pitch-type-selected=${(e) => this.emit('pitch-type-selected', e.detail)}
                            @trigger-scoring-event=${(e) => this.emit('trigger-scoring-event', e.detail)}
                            @render-step2=${(e) => this.emit('render-step2', e.detail)}
                        ></baseball-action-grid>
                    `}
            </div>
        `;
    }
    emit(eventName, detail) {
        this.dispatchEvent(new CustomEvent(eventName, {
            detail,
            bubbles: true,
            composed: true,
        }));
    }
};
__decorate([
    property({ type: String, attribute: 'game-status' })
], BaseballScoringControls.prototype, "gameStatus", void 0);
__decorate([
    property({ type: String, attribute: 'away-name' })
], BaseballScoringControls.prototype, "awayName", void 0);
__decorate([
    property({ type: String, attribute: 'home-name' })
], BaseballScoringControls.prototype, "homeName", void 0);
__decorate([
    property({ type: String, attribute: 'away-score' })
], BaseballScoringControls.prototype, "awayScore", void 0);
__decorate([
    property({ type: String, attribute: 'home-score' })
], BaseballScoringControls.prototype, "homeScore", void 0);
__decorate([
    property({ type: String, attribute: 'batter-name' })
], BaseballScoringControls.prototype, "batterName", void 0);
__decorate([
    property({ type: String, attribute: 'batter-stats' })
], BaseballScoringControls.prototype, "batterStats", void 0);
__decorate([
    property({ type: String, attribute: 'pitcher-name' })
], BaseballScoringControls.prototype, "pitcherName", void 0);
__decorate([
    property({ type: String, attribute: 'pitcher-stats' })
], BaseballScoringControls.prototype, "pitcherStats", void 0);
__decorate([
    property({ type: String, attribute: 'current-pitch-type' })
], BaseballScoringControls.prototype, "currentPitchType", void 0);
__decorate([
    property({ type: String, attribute: 'panel-mode' })
], BaseballScoringControls.prototype, "panelMode", void 0);
__decorate([
    property({ type: String, attribute: 'step2-label' })
], BaseballScoringControls.prototype, "step2Label", void 0);
__decorate([
    property({ type: Boolean, attribute: 'step2-is-hit' })
], BaseballScoringControls.prototype, "step2IsHit", void 0);
BaseballScoringControls = __decorate([
    customElement('baseball-scoring-controls')
], BaseballScoringControls);
export { BaseballScoringControls };
