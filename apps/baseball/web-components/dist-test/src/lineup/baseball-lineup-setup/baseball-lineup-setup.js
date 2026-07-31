var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import lineupSetupCssText from './baseball-lineup-setup.css?inline';
const lineupSetupSheet = new CSSStyleSheet();
lineupSetupSheet.replaceSync(lineupSetupCssText);
let BaseballLineupSetup = class BaseballLineupSetup extends LitElement {
    constructor() {
        super(...arguments);
        this.homeTeamName = 'Home Team';
        this.awayTeamName = 'Away Team';
        this.homeLineup = [];
        this.awayLineup = [];
        this.homeBench = [];
        this.awayBench = [];
    }
    static { this.styles = lineupSetupSheet; }
    render() {
        return html `
            <div class="overlay-backdrop">
                <div class="dialog-card">
                    <div class="dialog-header">
                        <h2>Lineup & Bench Setup</h2>
                        <button class="close-btn" @click=${this.onClose}>&times;</button>
                    </div>

                    <div class="team-grid">
                        <div class="team-column">
                            <h3>${this.awayTeamName} (Away)</h3>
                            <div class="lineup-list">
                                ${this.awayLineup.map((p, i) => html `
                                            <div class="lineup-slot">
                                                <span class="slot-idx">${i + 1}.</span>
                                                <span class="player-name">#${p.jerseyNumber} ${p.name}</span>
                                                <span class="pos-badge">${p.position}</span>
                                            </div>
                                        `)}
                            </div>
                        </div>

                        <div class="team-column">
                            <h3>${this.homeTeamName} (Home)</h3>
                            <div class="lineup-list">
                                ${this.homeLineup.map((p, i) => html `
                                            <div class="lineup-slot">
                                                <span class="slot-idx">${i + 1}.</span>
                                                <span class="player-name">#${p.jerseyNumber} ${p.name}</span>
                                                <span class="pos-badge">${p.position}</span>
                                            </div>
                                        `)}
                            </div>
                        </div>
                    </div>

                    <div class="dialog-footer margin-top-lg">
                        <button class="btn btn-secondary" @click=${this.onClose}>Cancel</button>
                        <button class="btn btn-primary" @click=${this.onSave}>Confirm & Save Lineups</button>
                    </div>
                </div>
            </div>
        `;
    }
    onClose() {
        this.dispatchEvent(new CustomEvent('close-lineup-setup', { bubbles: true }));
    }
    onSave() {
        this.dispatchEvent(new CustomEvent('save-lineup-setup', {
            detail: {
                homeLineup: this.homeLineup,
                awayLineup: this.awayLineup,
                homeBench: this.homeBench,
                awayBench: this.awayBench,
            },
            bubbles: true,
        }));
    }
};
__decorate([
    property({ type: String, attribute: 'home-team-name' })
], BaseballLineupSetup.prototype, "homeTeamName", void 0);
__decorate([
    property({ type: String, attribute: 'away-team-name' })
], BaseballLineupSetup.prototype, "awayTeamName", void 0);
__decorate([
    property({ type: Array })
], BaseballLineupSetup.prototype, "homeLineup", void 0);
__decorate([
    property({ type: Array })
], BaseballLineupSetup.prototype, "awayLineup", void 0);
__decorate([
    property({ type: Array })
], BaseballLineupSetup.prototype, "homeBench", void 0);
__decorate([
    property({ type: Array })
], BaseballLineupSetup.prototype, "awayBench", void 0);
BaseballLineupSetup = __decorate([
    customElement('baseball-lineup-setup')
], BaseballLineupSetup);
export { BaseballLineupSetup };
