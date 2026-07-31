import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import lineupSetupCssText from './baseball-lineup-setup.css?inline';

const lineupSetupSheet = new CSSStyleSheet();
lineupSetupSheet.replaceSync(lineupSetupCssText);

export interface PlayerInfo {
    id: number;
    name: string;
    jerseyNumber: number;
    position: string;
}

@customElement('baseball-lineup-setup')
export class BaseballLineupSetup extends LitElement {
    static styles = lineupSetupSheet;

    @property({type: String, attribute: 'home-team-name'}) homeTeamName = 'Home Team';
    @property({type: String, attribute: 'away-team-name'}) awayTeamName = 'Away Team';
    @property({type: Boolean, attribute: 'is-open'}) isOpen = false;

    @property({
        type: Array,
        attribute: 'home-lineup-json',
        converter: {
            fromAttribute: (val: string | null): PlayerInfo[] => {
                if (!val) return [];
                try { return JSON.parse(val); } catch { return []; }
            }
        }
    })
    homeLineup: PlayerInfo[] = [];

    @property({
        type: Array,
        attribute: 'away-lineup-json',
        converter: {
            fromAttribute: (val: string | null): PlayerInfo[] => {
                if (!val) return [];
                try { return JSON.parse(val); } catch { return []; }
            }
        }
    })
    awayLineup: PlayerInfo[] = [];

    @property({
        type: Array,
        attribute: 'home-bench-json',
        converter: {
            fromAttribute: (val: string | null): PlayerInfo[] => {
                if (!val) return [];
                try { return JSON.parse(val); } catch { return []; }
            }
        }
    })
    homeBench: PlayerInfo[] = [];

    @property({
        type: Array,
        attribute: 'away-bench-json',
        converter: {
            fromAttribute: (val: string | null): PlayerInfo[] => {
                if (!val) return [];
                try { return JSON.parse(val); } catch { return []; }
            }
        }
    })
    awayBench: PlayerInfo[] = [];

    render() {
        if (!this.isOpen) return html``;

        return html`
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
                                ${this.awayLineup.map(
                                        (p, i) => html`
                                            <div class="lineup-slot">
                                                <span class="slot-idx">${i + 1}.</span>
                                                <span class="player-name">#${p.jerseyNumber} ${p.name}</span>
                                                <span class="pos-badge">${p.position}</span>
                                            </div>
                                        `
                                )}
                            </div>
                        </div>

                        <div class="team-column">
                            <h3>${this.homeTeamName} (Home)</h3>
                            <div class="lineup-list">
                                ${this.homeLineup.map(
                                        (p, i) => html`
                                            <div class="lineup-slot">
                                                <span class="slot-idx">${i + 1}.</span>
                                                <span class="player-name">#${p.jerseyNumber} ${p.name}</span>
                                                <span class="pos-badge">${p.position}</span>
                                            </div>
                                        `
                                )}
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

    private onClose() {
        this.isOpen = false;
        this.removeAttribute('is-open');
        this.dispatchEvent(new CustomEvent('close-lineup-setup', {bubbles: true, composed: true}));
    }

    private onSave() {
        this.isOpen = false;
        this.removeAttribute('is-open');
        this.dispatchEvent(
            new CustomEvent('save-lineup-setup', {
                detail: {
                    homeLineup: this.homeLineup,
                    awayLineup: this.awayLineup,
                    homeBench: this.homeBench,
                    awayBench: this.awayBench,
                },
                bubbles: true,
                composed: true,
            })
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-lineup-setup': BaseballLineupSetup;
    }
}
