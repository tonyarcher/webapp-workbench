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
            return html`<p class="empty-state">No active game scoring session.</p>`;
        }

        return html`
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
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-scorer-tab': BaseballScorerTab;
    }
}
