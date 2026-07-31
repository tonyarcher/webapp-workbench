import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import leaguesTabCssText from './baseball-leagues-tab.css?inline';

const leaguesTabSheet = new CSSStyleSheet();
leaguesTabSheet.replaceSync(leaguesTabCssText);

interface LeagueDto {
    id: number;
    name: string;
}

@customElement('baseball-leagues-tab')
export class BaseballLeaguesTab extends LitElement {
    static styles = leaguesTabSheet;

    @property({
        type: Array,
        attribute: 'leagues-json',
        converter: {
            fromAttribute: (val: string | null): LeagueDto[] => {
                if (!val) return [];
                try { return JSON.parse(val); } catch { return []; }
            }
        }
    }) leagues: LeagueDto[] = [];

    render() {
        const leagues = this.leagues ?? [];
        return html`
            <h1>League Directory</h1>
            ${leagues.length === 0
                    ? html`<p class="empty-state">No leagues available.</p>`
                    : html`
                        <div class="leagues-grid">
                            ${leagues.map(league => html`
                                <baseball-league-card
                                        league-id="${league.id}"
                                        league-name="${league.name}"
                                        league-details="${'Official League #' + league.id}"
                                ></baseball-league-card>
                            `)}
                        </div>
                    `}
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-leagues-tab': BaseballLeaguesTab;
    }
}
