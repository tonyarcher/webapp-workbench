import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import leagueCardCssText from './baseball-league-card.css?inline';

const leagueCardSheet = new CSSStyleSheet();
leagueCardSheet.replaceSync(leagueCardCssText);

@customElement('baseball-league-card')
export class BaseballLeagueCard extends LitElement {
    static styles = leagueCardSheet;

    @property({type: Number, attribute: 'league-id'}) leagueId = 0;
    @property({type: String, attribute: 'league-name'}) leagueName = '';
    @property({type: String, attribute: 'league-details'}) leagueDetails = '';

    render() {
        return html`
            <div class="card">
                <div>
                    <h2>${this.leagueName}</h2>
                    <div class="text-muted font-small margin-top-xs">${this.leagueDetails}</div>
                </div>
                <button class="btn" @click=${this.onClick}>Manage League</button>
            </div>
        `;
    }

    private onClick() {
        this.dispatchEvent(
            new CustomEvent('league-click', {
                detail: {leagueId: this.leagueId, leagueName: this.leagueName},
                bubbles: true,
                composed: true,
            })
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-league-card': BaseballLeagueCard;
    }
}
