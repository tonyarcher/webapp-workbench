import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { RULEBOOKS, generateRoster } from 'basketball-core';
import type { Player, RulebookId, TeamId } from 'basketball-core';
import type { LocalGameMode, LocalGameSetup } from '../../local-game/game-types';
import { DEFAULT_GAME_SETUP } from '../../local-game/game-types';
import { generateMatchup } from '../../sim/generate-roster';
import { mulberry32 } from '../../sim/rng';
import type { SimRatings } from '../../sim/types';
import styles from './setup-screen.css?inline';

@customElement('bball-setup-screen')
export class SetupScreen extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private homeName = DEFAULT_GAME_SETUP.homeName;
    @state() private awayName = DEFAULT_GAME_SETUP.awayName;
    @state() private rulebookId: RulebookId = DEFAULT_GAME_SETUP.rulebookId;
    @state() private openingPossession: TeamId = DEFAULT_GAME_SETUP.openingPossession;
    @state() private homeRoster = generateRoster('home');
    @state() private awayRoster = generateRoster('away');
    @state() private simRatings: Record<string, SimRatings> = {};

    private emitStart(mode: LocalGameMode): void {
        const setup: LocalGameSetup = {
            homeName: this.homeName,
            awayName: this.awayName,
            rulebookId: this.rulebookId,
            openingPossession: this.openingPossession,
            homeRoster: this.homeRoster,
            awayRoster: this.awayRoster,
            mode,
        };
        if (Object.keys(this.simRatings).length) setup.simRatings = this.simRatings;
        if (mode === 'watch') setup.simSeed = Date.now();
        this.dispatchEvent(new CustomEvent('start-game', { detail: setup, bubbles: true, composed: true }));
    }

    private onSubmit = (event: SubmitEvent): void => {
        event.preventDefault();
        this.emitStart('score');
    };

    private onWatch = (): void => {
        this.emitStart('watch');
    };

    private onGenerate = (): void => {
        const matchup = generateMatchup(mulberry32(Date.now()));
        this.awayName = matchup.away.teamName;
        this.homeName = matchup.home.teamName;
        this.awayRoster = matchup.away.roster;
        this.homeRoster = matchup.home.roster;
        this.simRatings = { ...matchup.away.ratings, ...matchup.home.ratings };
    };

    private onName = (team: TeamId, event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        if (team === 'home') this.homeName = target.value;
        else this.awayName = target.value;
    };

    private onBook = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        this.rulebookId = target.value as RulebookId;
    };

    private onTip = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        this.openingPossession = target.value as TeamId;
    };

    private onPlayer = (team: TeamId, index: number, field: 'name' | 'jersey', event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        const roster = team === 'home' ? [...this.homeRoster] : [...this.awayRoster];
        const current = roster[index];
        if (!current) return;
        const next: Player =
            field === 'name'
                ? { ...current, name: target.value }
                : { ...current, jersey: Number(target.value) || current.jersey };
        roster[index] = next;
        if (team === 'home') this.homeRoster = roster;
        else this.awayRoster = roster;
    };

    override render(): TemplateResult {
        return html`
            <h1>Basketball</h1>
            <p class="lead">Broadcast scorebug, shot chart, and a full sim. HS / College / NBA / WNBA.</p>
            <form @submit=${this.onSubmit}>
                ${this.teamFields()}
                ${this.ruleFields()}
                <div class="rosters">
                    ${this.rosterEditor('away', this.awayRoster)}
                    ${this.rosterEditor('home', this.homeRoster)}
                </div>
                <div class="actions">
                    <button type="submit">Score a game</button>
                    <button type="button" class="secondary" @click=${this.onWatch}>Watch simulated game</button>
                    <button type="button" class="ghost" @click=${this.onGenerate}>Generate rosters</button>
                </div>
            </form>
        `;
    }

    private teamFields(): TemplateResult {
        return html`
            <div class="row">
                <label>Away
                    <input .value=${this.awayName} @input=${(e: Event) => this.onName('away', e)} required/>
                </label>
                <label>Home
                    <input .value=${this.homeName} @input=${(e: Event) => this.onName('home', e)} required/>
                </label>
            </div>
        `;
    }

    private ruleFields(): TemplateResult {
        return html`
            <div class="row">
                <label>Level
                    <select @change=${this.onBook}>
                        ${Object.values(RULEBOOKS).map(
                            (book) => html`
                            <option value=${book.id} ?selected=${book.id === this.rulebookId}>${book.label}</option>
                        `,
                        )}
                    </select>
                </label>
                <label>Opens with the ball
                    <select @change=${this.onTip}>
                        <option value="away" ?selected=${this.openingPossession === 'away'}>Away</option>
                        <option value="home" ?selected=${this.openingPossession === 'home'}>Home</option>
                    </select>
                </label>
            </div>
        `;
    }

    private rosterEditor(team: TeamId, roster: Player[]): TemplateResult {
        return html`
            <section class="roster">
                <h2>${team === 'home' ? 'Home roster' : 'Away roster'}</h2>
                ${roster.map(
                    (player, index) => html`
                    <div class="player">
                        <input
                            inputmode="numeric"
                            .value=${String(player.jersey)}
                            @input=${(e: Event) => this.onPlayer(team, index, 'jersey', e)}
                            aria-label="Jersey"
                        />
                        <input
                            .value=${player.name}
                            @input=${(e: Event) => this.onPlayer(team, index, 'name', e)}
                            aria-label="Name"
                        />
                        <input .value=${player.position} disabled aria-label="Position"/>
                    </div>
                `,
                )}
            </section>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'bball-setup-screen': SetupScreen;
    }
}
