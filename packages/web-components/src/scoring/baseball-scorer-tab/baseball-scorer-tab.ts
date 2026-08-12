import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import scorerTabCssText from './baseball-scorer-tab.css?inline';

const scorerTabSheet = new CSSStyleSheet();
scorerTabSheet.replaceSync(scorerTabCssText);

@customElement('baseball-scorer-tab')
export class BaseballScorerTab extends LitElement {
    static styles = scorerTabSheet;

    @property({type: String, attribute: 'away-name'}) awayName = '';
    @property({type: String, attribute: 'home-name'}) homeName = '';
    @property({type: Boolean, attribute: 'no-game'}) noGame = false;

    render() {
        if (this.noGame) {
            return html`
                <div class="empty-state-container">
                    <p class="empty-state">No active game scoring session.</p>
                    <button class="btn btn-primary" @click=${this.onStartNewGame}>Start Local Game Session</button>
                </div>
            `;
        }

        return html`
            <div class="header-row">
                <h1>Live Scoring: ${this.awayName} @ ${this.homeName}</h1>
                <button class="btn btn-secondary" @click=${this.onOpenLineupSetup}>Setup Lineups</button>
            </div>
            <div class="scorer-top-grid">
                <slot name="scoreboard"></slot>
                <slot name="controls"></slot>
            </div>
            <div class="scorebook-section">
                <slot name="scorebook"></slot>
            </div>
        `;
    }

    private onStartNewGame() {
        this.dispatchEvent(new CustomEvent('start-new-game-click', {bubbles: true, composed: true}));
    }

    private onOpenLineupSetup() {
        this.dispatchEvent(new CustomEvent('open-lineup-setup-click', {bubbles: true, composed: true}));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-scorer-tab': BaseballScorerTab;
    }
}
