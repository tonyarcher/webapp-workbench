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

    // Active state — live game situation
    @property({type: Number, attribute: 'balls'}) balls = 0;
    @property({type: Number, attribute: 'strikes'}) strikes = 0;
    @property({type: Number, attribute: 'outs'}) outs = 0;
    @property({type: String, attribute: 'live-inning-text'}) liveInningText = '';

    // Active state — action panel mode ('action-grid' | 'step2')
    @property({type: String, attribute: 'current-pitch-type'}) currentPitchType = '';
    @property({type: String, attribute: 'panel-mode'}) panelMode: 'action-grid' | 'step2' = 'action-grid';
    @property({type: String, attribute: 'step2-label'}) step2Label = '';
    @property({type: Boolean, attribute: 'step2-is-hit'}) step2IsHit = false;
    @property({type: Boolean, attribute: 'step2-double-play-available'}) step2DoublePlayAvailable = false;

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
                ${this.renderLiveSituation()}
                <baseball-matchup-card
                    batter-name="${this.batterName}"
                    batter-stats="${this.batterStats}"
                    pitcher-name="${this.pitcherName}"
                    pitcher-stats="${this.pitcherStats}"
                ></baseball-matchup-card>
                ${this.renderPanel()}
            </div>
        `;
    }

    private renderLiveSituation() {
        return html`
          <div class="live-situation" aria-live="polite">
            <span class="live-situation-inning">${this.liveInningText || 'Live'}</span>
            <span class="live-situation-count">${this.balls} balls · ${this.strikes} strikes · ${this.outs} outs</span>
            <span class="live-situation-score">
              <span class="team-score">${this.awayName || 'AWY'} ${this.awayScore}</span>
              <span class="team-score">${this.homeName || 'HOM'} ${this.homeScore}</span>
            </span>
          </div>
        `;
    }

    private renderPanel() {
        if (this.panelMode === 'step2') return this.renderStep2Panel();
        return this.renderActionGrid();
    }

    private renderStep2Panel() {
        return html`
          <baseball-step2-panel
              base-label=${this.step2Label}
              ?is-hit=${this.step2IsHit}
              ?double-play-available=${this.step2DoublePlayAvailable}
          ></baseball-step2-panel>
        `;
    }

    private renderActionGrid() {
        return html`
          <baseball-action-grid current-pitch-type=${this.currentPitchType}></baseball-action-grid>
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
