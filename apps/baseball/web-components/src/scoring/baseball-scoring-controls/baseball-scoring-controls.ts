import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import controlsCssText from './baseball-scoring-controls.css?inline';

const controlsSheet = new CSSStyleSheet();
controlsSheet.replaceSync(controlsCssText);

@customElement('baseball-scoring-controls')
export class BaseballScoringControls extends LitElement {
    static styles = controlsSheet;

    // Which top-level mode to show
    @property({type: String, attribute: 'game-status'}) gameStatus: 'active' | 'completed' = 'active';

    // Completed state data
    @property({type: String, attribute: 'away-name'}) awayName = '';
    @property({type: String, attribute: 'home-name'}) homeName = '';
    @property({type: String, attribute: 'away-score'}) awayScore = '0';
    @property({type: String, attribute: 'home-score'}) homeScore = '0';

    // Active state — matchup card data
    @property({type: String, attribute: 'batter-name'}) batterName = '';
    @property({type: String, attribute: 'batter-stats'}) batterStats = '';
    @property({type: String, attribute: 'pitcher-name'}) pitcherName = '';
    @property({type: String, attribute: 'pitcher-stats'}) pitcherStats = '';

    // Active state — action panel mode ('action-grid' | 'step2')
    @property({type: String, attribute: 'current-pitch-type'}) currentPitchType = '';
    @property({type: String, attribute: 'panel-mode'}) panelMode: 'action-grid' | 'step2' = 'action-grid';
    @property({type: String, attribute: 'step2-label'}) step2Label = '';
    @property({type: Boolean, attribute: 'step2-is-hit'}) step2IsHit = false;

    render() {
        return this.gameStatus === 'completed'
            ? this.renderCompleted()
            : this.renderActive();
    }

    private renderCompleted() {
        return html`
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

    private renderActive() {
        return html`
            <div class="active-controls">
                <h2>Plate Matchup</h2>
                <baseball-matchup-card
                    batter-name="${this.batterName}"
                    batter-stats="${this.batterStats}"
                    pitcher-name="${this.pitcherName}"
                    pitcher-stats="${this.pitcherStats}"
                ></baseball-matchup-card>

                ${this.panelMode === 'step2'
            ? html`
                        <baseball-step2-panel
                            base-label=${this.step2Label}
                            ?is-hit=${this.step2IsHit}
                            @location-selected=${(e: CustomEvent) => this.emit('location-selected', e.detail)}
                            @cancel-step2=${() => this.emit('cancel-step2', {})}
                        ></baseball-step2-panel>
                    `
            : html`
                        <baseball-action-grid
                            current-pitch-type=${this.currentPitchType}
                            @pitch-type-selected=${(e: CustomEvent) => this.emit('pitch-type-selected', e.detail)}
                            @trigger-scoring-event=${(e: CustomEvent) => this.emit('trigger-scoring-event', e.detail)}
                            @render-step2=${(e: CustomEvent) => this.emit('render-step2', e.detail)}
                        ></baseball-action-grid>
                    `}
            </div>
        `;
    }

    private emit(eventName: string, detail: Record<string, unknown>) {
        this.dispatchEvent(new CustomEvent(eventName, {
            detail,
            bubbles: true,
            composed: true,
        }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-scoring-controls': BaseballScoringControls;
    }
}
