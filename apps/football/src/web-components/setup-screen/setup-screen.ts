import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement} from 'lit/decorators.js';
import {RULEBOOKS} from 'football-core';
import type {RulebookId, TeamId} from 'football-core';
import type {LocalGameSetup} from '../../local-game/game-types';
import {DEFAULT_GAME_SETUP} from '../../local-game/game-types';
import styles from './setup-screen.css?inline';

@customElement('fb-setup-screen')
export class SetupScreen extends LitElement {
    static override styles = unsafeCSS(styles);

    private emitStart = (event: SubmitEvent): void => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!(form instanceof HTMLFormElement)) return;
        const data = new FormData(form);
        const setup: LocalGameSetup = {
            homeName: String(data.get('homeName') || DEFAULT_GAME_SETUP.homeName),
            awayName: String(data.get('awayName') || DEFAULT_GAME_SETUP.awayName),
            rulebookId: (data.get('rulebookId') as RulebookId) || DEFAULT_GAME_SETUP.rulebookId,
            receivingTeam: (data.get('receivingTeam') as TeamId) || DEFAULT_GAME_SETUP.receivingTeam,
        };
        this.dispatchEvent(new CustomEvent('start-game', {detail: setup, bubbles: true, composed: true}));
    };

    override render(): TemplateResult {
        return html`
            <h1>Football Tracker</h1>
            <p class="lead">Live play-by-play scorekeeping. 11-on-11, pluggable rulebooks.</p>
            <form @submit=${this.emitStart}>
                <label>Away
                    <input name="awayName" value=${DEFAULT_GAME_SETUP.awayName} required/>
                </label>
                <label>Home
                    <input name="homeName" value=${DEFAULT_GAME_SETUP.homeName} required/>
                </label>
                <label>Rulebook
                    <select name="rulebookId">
                        ${Object.values(RULEBOOKS).map(
                            (book) => html`<option value=${book.id} ?selected=${book.id === DEFAULT_GAME_SETUP.rulebookId}>
                                ${book.label}
                            </option>`,
                        )}
                    </select>
                </label>
                <label>Receives opening kickoff
                    <select name="receivingTeam">
                        <option value="away" selected>Away</option>
                        <option value="home">Home</option>
                    </select>
                </label>
                <button type="submit">Start game</button>
            </form>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'fb-setup-screen': SetupScreen;
    }
}
