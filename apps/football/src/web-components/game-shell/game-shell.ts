import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {
    describePlay,
    formatClock,
    formatDownDistance,
    parseClock,
    RULEBOOKS,
} from 'football-core';
import type {PlayFamily, PlayInput, ScoringEvent, Tackler} from 'football-core';
import type {GameStore} from '../../local-game/game-store';
import type {LiveLocalGameState} from '../../local-game/game-state';
import {SPEED_OPTIONS} from '../../sim/playback';
import {highlightLabel, WatchRunner, watchBadge, watchLoopAlive} from '../../sim/watch-runner';
import {yieldDelay} from '../../sim/playback';
import '../field/field';
import styles from './game-shell.css?inline';

type PadButton = {label: string; family: PlayFamily; extra?: Partial<PlayInput>; primary?: boolean};

const TRY_BUTTONS: PadButton[] = [
    {label: 'XP good', family: 'extra_point', extra: {extraPointMade: true}, primary: true},
    {label: 'XP miss', family: 'extra_point', extra: {extraPointMade: false}},
    {label: '2pt good', family: 'two_point', extra: {twoPointMade: true}},
    {label: '2pt miss', family: 'two_point', extra: {twoPointMade: false}},
];

const SCRIMMAGE_BUTTONS: PadButton[] = [
    {label: 'Run', family: 'scrimmage', extra: {concept: 'inside_zone'}, primary: true},
    {label: 'Complete', family: 'scrimmage', extra: {concept: 'dropback'}},
    {label: 'Incomplete', family: 'scrimmage', extra: {incomplete: true, yards: 0}},
    {label: 'Sack', family: 'scrimmage', extra: {sack: true}},
    {label: 'Scramble', family: 'scrimmage', extra: {scramble: true, concept: 'scramble'}},
    {label: 'TD', family: 'scrimmage', extra: {touchdown: true}, primary: true},
    {label: 'INT', family: 'scrimmage', extra: {interception: true}},
    {label: 'Fumble lost', family: 'scrimmage', extra: {fumbleLost: true}},
    {label: 'Fumble own', family: 'scrimmage', extra: {fumbleOwn: true}},
    {label: 'Kneel', family: 'kneel', extra: {yards: -1}},
    {label: 'Spike', family: 'spike', extra: {incomplete: true, yards: 0}},
    {label: 'Punt', family: 'punt'},
    {label: 'FG good', family: 'field_goal', extra: {fieldGoalMade: true}},
    {label: 'FG miss', family: 'field_goal', extra: {fieldGoalMade: false}},
];

@customElement('fb-game-shell')
export class GameShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) store!: GameStore;
    @property({attribute: false}) game!: LiveLocalGameState;

    @state() private yards = 0;
    @state() private snapText = '';
    @state() private deadText = '';
    @state() private tacklerJersey = '';

    private readonly watch = new WatchRunner();
    private watchAutoStarted = false;

    override willUpdate(changed: Map<PropertyKey, unknown>): void {
        if (changed.has('game') && this.game) {
            const clock = formatClock(this.game.engine.clock.gameClockSeconds);
            if (!this.snapText) this.snapText = clock;
            this.deadText = clock;
            if (this.isWatch()) this.maybeStartWatchLoop();
            else if (this.watchAutoStarted || this.watch.playing) this.stopWatchLoop();
        }
    }

    override disconnectedCallback(): void {
        this.stopWatchLoop();
        super.disconnectedCallback();
    }

    private maybeStartWatchLoop(): void {
        const game = this.game;
        if (!this.isWatch() || this.watchAutoStarted || !game || game.engine.over || game.historyIndex > 0) return;
        this.watchAutoStarted = true;
        queueMicrotask(() => {
            void this.runWatchLoop();
        });
    }

    private stopWatchLoop(): void {
        this.watchAutoStarted = false;
        this.watch.reset();
    }

    private readonly onSimPause = (): void => {
        this.watch.pause();
        void this.store.flushPersist();
        this.requestUpdate();
    };

    private async runWatchLoop(): Promise<void> {
        if (!watchLoopAlive(this.isConnected, this.isWatch(), Boolean(this.game?.engine.over)) || this.watch.playing) return;
        await this.watch.clock.play(async () => this.stepWatch());
        if (this.isConnected) {
            void this.store.flushPersist();
            this.requestUpdate();
        }
    }

    private async stepWatch(): Promise<boolean> {
        const game = this.game;
        if (!game || !watchLoopAlive(this.isConnected, this.isWatch(), Boolean(game.engine.over))) return false;
        const event = this.watch.takeEvent(game);
        if (!event) return false;
        this.store.recordEvent(event);
        await yieldDelay(this.watch.delayMs(event), this.watch.clock.signal);
        return watchLoopAlive(this.isConnected, this.isWatch(), Boolean(this.game?.engine.over));
    }

    private isWatch(): boolean {
        return this.game?.setup.mode === 'watch';
    }

    private clockSeconds(text: string, fallback: number): number {
        return parseClock(text) ?? fallback;
    }

    private tacklers(): Tackler[] {
        const jersey = Number(this.tacklerJersey);
        if (!Number.isInteger(jersey) || jersey <= 0) return [];
        const defense = this.game.engine.situation.possession === 'home'
            ? this.game.engine.away.roster
            : this.game.engine.home.roster;
        const player = defense.find((row) => row.jersey === jersey);
        if (!player) return [];
        return [{playerId: player.id, role: 'solo'}];
    }

    private playInput(partial: Omit<PlayInput, 'snapClock' | 'deadClock'>): PlayInput {
        const fallback = this.game.engine.clock.gameClockSeconds;
        return {
            ...partial,
            snapClock: this.clockSeconds(this.snapText, fallback),
            deadClock: this.clockSeconds(this.deadText, fallback),
            yards: partial.yards ?? this.yards,
            tacklers: partial.tacklers ?? this.tacklers(),
        };
    }

    private record(event: ScoringEvent): void {
        if (this.isWatch()) return;
        this.store.recordEvent(event);
        this.snapText = this.deadText;
    }

    private recordPlay(partial: Omit<PlayInput, 'snapClock' | 'deadClock'>): void {
        this.record({type: 'play', input: this.playInput(partial)});
    }

    private onYards = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        this.yards = Number(target.value) || 0;
    };

    private onSnap = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        this.snapText = target.value;
    };

    private onDead = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        this.deadText = target.value;
    };

    private onTackler = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        this.tacklerJersey = target.value;
    };

    private padButtons(): {label: string; family: PlayFamily; extra?: Partial<PlayInput>; primary?: boolean}[] {
        if (this.game.engine.kickoffPending) {
            return [
                {label: 'Kickoff TB', family: 'kickoff', extra: {touchback: true}, primary: true},
                {label: 'Kickoff return', family: 'kickoff', extra: {touchback: false}},
                {label: 'Kickoff OOB', family: 'kickoff', extra: {touchback: false, outOfBounds: true}},
            ];
        }
        if (this.game.engine.pendingTry) return TRY_BUTTONS;
        return SCRIMMAGE_BUTTONS;
    }

    private offenseJerseys(): string {
        const roster = [...this.game.engine.home.roster, ...this.game.engine.away.roster];
        return this.game.engine.personnel.offense
            .map((id) => roster.find((row) => row.id === id)?.jersey)
            .filter((jersey): jersey is number => jersey != null)
            .join(' ');
    }

    private renderBug(): TemplateResult {
        const {engine, setup} = this.game;
        const poss = engine.situation.possession === 'home' ? setup.homeName : setup.awayName;
        const flags = [
            engine.kickoffPending ? 'kickoff' : '',
            engine.pendingTry ? 'try' : '',
            engine.clock.mercyActive ? 'mercy clock' : '',
            engine.clock.running ? 'clock running' : 'clock stopped',
        ].filter(Boolean).join(' · ');
        return html`
            <header class="bug">
                <div class="team">
                    <span class="name">${setup.awayName}</span>
                    <span class="score">${engine.score.away}</span>
                </div>
                <div class="mid">
                    <div class="clock">Q${engine.clock.period} ${formatClock(engine.clock.gameClockSeconds)}</div>
                    <div class="sit">${poss} · ${formatDownDistance(engine.situation, setup.homeName, setup.awayName)}</div>
                    <div class="flags">${RULEBOOKS[setup.rulebookId].label} · TO ${engine.timeouts.away}-${engine.timeouts.home} · ${flags}</div>
                </div>
                <div class="team home">
                    <span class="name">${setup.homeName}</span>
                    <span class="score">${engine.score.home}</span>
                </div>
            </header>
        `;
    }

    private padClass(label: string, primary?: boolean): string {
        const pressed = this.isWatch() && highlightLabel(this.watch.activeEvent) === label;
        return [primary ? 'primary' : '', pressed ? 'sim-press' : ''].filter(Boolean).join(' ');
    }

    private renderPad(): TemplateResult {
        const possession = this.game.engine.situation.possession;
        const watch = this.isWatch();
        return html`
            <div class="pad">
                ${this.padButtons().map(
                    (btn) => html`<button
                        class=${this.padClass(btn.label, btn.primary)}
                        ?disabled=${watch}
                        @click=${() => this.recordPlay({family: btn.family, ...btn.extra})}
                    >${btn.label}</button>`,
                )}
                <button class=${this.padClass('Timeout away')} ?disabled=${watch} @click=${() => this.record({type: 'timeout', team: 'away'})}>Timeout away</button>
                <button class=${this.padClass('Timeout home')} ?disabled=${watch} @click=${() => this.record({type: 'timeout', team: 'home'})}>Timeout home</button>
                <button ?disabled=${watch} @click=${() => this.record({
                    type: 'penalty',
                    team: possession,
                    yards: Math.abs(this.yards) || 5,
                    accepted: true,
                    foul: 'generic',
                })}>Penalty vs offense</button>
                <button class=${this.padClass('Period end')} ?disabled=${watch} @click=${() => this.record({type: 'period_end'})}>Period end</button>
            </div>
        `;
    }

    private renderFields(): TemplateResult {
        return html`
            <div class="fields">
                <label>Snap
                    <input .value=${this.snapText} @input=${this.onSnap} placeholder="15:00"/>
                </label>
                <label>Dead
                    <input .value=${this.deadText} @input=${this.onDead} placeholder="14:52"/>
                </label>
                <label>Yards
                    <input type="number" .value=${String(this.yards)} @input=${this.onYards}/>
                </label>
                <label>Tackler #
                    <input inputmode="numeric" .value=${this.tacklerJersey} @input=${this.onTackler}/>
                </label>
            </div>
        `;
    }

    private readonly onSpeedChange = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        this.watch.speed = Number(target.value);
        this.requestUpdate();
    };

    private readonly onAnimationsChange = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        this.watch.animations = target.checked;
        this.requestUpdate();
    };

    private renderWatch(): TemplateResult | '' {
        if (!this.isWatch()) return '';
        const {setup, engine} = this.game;
        return html`
            <section class="sim-transport">
                <span class="sim-badge">${watchBadge(engine.over, this.watch.playing)}</span>
                <span>Watching: ${setup.awayName} @ ${setup.homeName}</span>
                <span class="sim-last">${this.watch.lastLabel}</span>
                <button ?disabled=${this.watch.playing || engine.over} @click=${() => void this.runWatchLoop()}>Play</button>
                <button ?disabled=${!this.watch.playing} @click=${this.onSimPause}>Pause</button>
                <label>Speed
                    <select @change=${this.onSpeedChange}>
                        ${SPEED_OPTIONS.map(
                            (option) => html`<option value=${String(option.value)} ?selected=${this.watch.speed === option.value}>${option.label}</option>`,
                        )}
                    </select>
                </label>
                <label>
                    <input type="checkbox" .checked=${this.watch.animations} @change=${this.onAnimationsChange}/>
                    Animations
                </label>
            </section>
        `;
    }

    override render(): TemplateResult {
        const {engine, setup} = this.game;
        const watch = this.isWatch();
        return html`
            ${this.renderBug()}
            ${this.renderWatch()}
            <fb-field
                .situation=${engine.situation}
                .lastPlay=${engine.plays.at(-1) ?? null}
                .homeName=${setup.homeName}
                .awayName=${setup.awayName}
                .animations=${this.watch.animations}
            ></fb-field>
            <div class="personnel">On field (offense): ${this.offenseJerseys() || '—'}</div>
            ${watch ? '' : this.renderFields()}
            ${this.renderPad()}
            <div class="toolbar">
                <button ?disabled=${!this.store.canUndo || watch} @click=${() => this.store.undo()}>Undo</button>
                <button ?disabled=${!this.store.canRedo || watch} @click=${() => this.store.redo()}>Redo</button>
                <button @click=${() => this.store.newGame()}>New game</button>
            </div>
            <ol class="log">
                ${[...engine.plays].reverse().map(
                    (play) => html`<li>${describePlay(play, setup.homeName, setup.awayName)}</li>`,
                )}
            </ol>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'fb-game-shell': GameShell;
    }
}
