import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { describeEvent, findPlayer, stampFromClock, teamSide } from 'basketball-core';
import type { ClockStamp, Player, Point, ScoringEvent, TeamId } from 'basketball-core';
import type { LiveLocalGameState } from '../../local-game/game-state';
import type { GameStore } from '../../local-game/game-store';
import { boxScoreText } from '../../local-game/box-score-view';
import { SPEED_OPTIONS, yieldDelay } from '../../sim/playback';
import { WatchRunner, watchBadge, watchLoopAlive } from '../../sim/watch-runner';
import '../scorebug/scorebug';
import '../court/court';
import styles from './game-shell.css?inline';

@customElement('bball-game-shell')
export class GameShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) game: LiveLocalGameState | null = null;
    @property({ attribute: false }) store: GameStore | null = null;

    @state() private pending: Point | null = null;
    @state() private shooterId = '';
    @state() private assistId = '';
    @state() private actorId = '';
    @state() private shootingFoul = false;
    @state() private boxOpen = false;
    @state() private subOut = '';

    private readonly watch = new WatchRunner();
    private watchAutoStarted = false;

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stopWatch();
    }

    override updated(): void {
        if (!this.isWatch()) {
            if (this.watchAutoStarted || this.watch.playing) this.stopWatch();
            return;
        }
        if (this.watchAutoStarted || this.watch.playing) return;
        if (!this.game || this.game.engine.over || this.game.historyIndex > 0) return;
        this.watchAutoStarted = true;
        void this.runWatchLoop();
    }

    private isWatch(): boolean {
        return this.game?.setup.mode === 'watch';
    }

    private stopWatch(): void {
        this.watchAutoStarted = false;
        this.watch.reset();
    }

    private record(event: ScoringEvent): void {
        if (!this.store || this.isWatch()) return;
        this.store.recordEvent(event);
    }

    private onClock = (event: Event): void => {
        const custom = event as CustomEvent<{ clock: ClockStamp; running: boolean }>;
        this.record({ type: 'set_clock', clock: custom.detail.clock, running: custom.detail.running });
    };

    private onSpot = (event: Event): void => {
        const game = this.game;
        if (!game || this.isWatch()) return;
        const custom = event as CustomEvent<Point>;
        this.pending = custom.detail;
        const onCourt = teamSide(game.engine, game.engine.possession).onCourt;
        this.shooterId = onCourt[0] ?? '';
        this.assistId = '';
    };

    private logShot(made: boolean): void {
        if (!this.game || !this.pending || !this.shooterId) return;
        const event: ScoringEvent = {
            type: 'shot',
            team: this.game.engine.possession,
            shooterId: this.shooterId,
            xFeet: this.pending.x,
            yFeet: this.pending.y,
            made,
            clock: stampFromClock(this.game.engine.clock),
        };
        if (made && this.assistId) event.assistId = this.assistId;
        if (this.shootingFoul) event.shootingFoul = true;
        this.record(event);
        this.pending = null;
        this.assistId = '';
        this.shootingFoul = false;
    }

    private async runWatchLoop(): Promise<void> {
        if (!watchLoopAlive(this.isConnected, this.isWatch(), Boolean(this.game?.engine.over)) || this.watch.playing)
            return;
        await this.watch.clock.play(async () => this.stepWatch());
    }

    private async stepWatch(): Promise<boolean> {
        const game = this.game;
        if (!game || !watchLoopAlive(this.isConnected, this.isWatch(), Boolean(game.engine.over))) return false;
        const event = this.watch.takeEvent(game);
        if (!event) return false;
        this.store?.recordEvent(event);
        await yieldDelay(this.watch.delayMs(event), this.watch.clock.signal);
        return watchLoopAlive(this.isConnected, this.isWatch(), Boolean(this.game?.engine.over));
    }

    override render(): TemplateResult {
        if (!this.game || !this.store) return html``;
        return html`
            ${this.renderBug()}
            ${this.isWatch() ? this.renderWatch() : ''}
            ${this.renderStage()}
            ${this.renderBar()}
            ${this.boxOpen ? this.renderBox() : ''}
        `;
    }

    private renderBug(): TemplateResult {
        const game = this.game;
        if (!game) return html``;
        return html`
            <bball-scorebug
                .engine=${game.engine}
                homeName=${game.setup.homeName}
                awayName=${game.setup.awayName}
                ?editable=${!this.isWatch()}
                @clock-change=${this.onClock}
            ></bball-scorebug>
        `;
    }

    private renderStage(): TemplateResult {
        const game = this.game;
        if (!game) return html``;
        const watch = this.isWatch();
        return html`
            <div class="stage">
                <bball-court
                    rulebookId=${game.setup.rulebookId}
                    .shots=${game.engine.shots}
                    .pending=${this.pending}
                    ?interactive=${!watch && !game.engine.over}
                    @spot-picked=${this.onSpot}
                ></bball-court>
                <aside class="side">
                    ${this.renderOnCourt('away')}
                    ${this.renderOnCourt('home')}
                    ${watch ? '' : this.renderPad()}
                </aside>
            </div>
        `;
    }

    private renderOnCourt(team: TeamId): TemplateResult {
        const game = this.game;
        if (!game) return html``;
        const engine = game.engine;
        const side = teamSide(engine, team);
        const name = team === 'home' ? game.setup.homeName : game.setup.awayName;
        const poss = engine.possession === team;
        return html`
            <section class="card">
                <h2>${name} ${poss ? '● ball' : ''}</h2>
                <div class="five">
                    ${side.onCourt.map((id) => this.chip(team, findPlayer(side.roster, id), true))}
                </div>
                <div class="five">
                    ${side.roster.filter((p) => !side.onCourt.includes(p.id)).map((p) => this.chip(team, p, false))}
                </div>
            </section>
        `;
    }

    private chip(team: TeamId, player: Player | undefined, on: boolean): TemplateResult {
        if (!player) return html``;
        const selected =
            this.shooterId === player.id ||
            this.assistId === player.id ||
            this.actorId === player.id ||
            this.subOut === player.id;
        return html`
            <button
                class="chip"
                data-on=${selected}
                ?disabled=${this.isWatch()}
                @click=${() => this.onChip(team, player.id, on)}
            >#${player.jersey} ${player.name}</button>
        `;
    }

    private onChip(team: TeamId, playerId: string, on: boolean): void {
        if (on) {
            this.actorId = playerId;
            this.subOut = playerId;
            if (this.pending && team === this.game?.engine.possession) {
                if (!this.shooterId || this.shooterId === playerId) this.shooterId = playerId;
                else this.assistId = playerId;
            }
            return;
        }
        if (!this.subOut || this.idTeam(this.subOut) !== team) return;
        this.record({ type: 'substitution', team, outId: this.subOut, inId: playerId });
        this.subOut = '';
    }

    private idTeam(playerId: string): TeamId | null {
        const game = this.game;
        if (!game) return null;
        if (game.engine.home.roster.some((player) => player.id === playerId)) return 'home';
        if (game.engine.away.roster.some((player) => player.id === playerId)) return 'away';
        return null;
    }

    private firstOn(team: TeamId): string {
        const game = this.game;
        if (!game) return '';
        const onCourt = teamSide(game.engine, team).onCourt;
        if (this.actorId && onCourt.includes(this.actorId)) return this.actorId;
        return onCourt[0] ?? '';
    }

    private recordFoul(): void {
        const game = this.game;
        if (!game) return;
        const poss = game.engine.possession;
        const actor = this.actorId || this.firstOn(poss === 'home' ? 'away' : 'home');
        const team = this.idTeam(actor);
        if (!team) return;
        const other = team === 'home' ? 'away' : 'home';
        this.record({
            type: 'foul',
            team,
            playerId: actor,
            fouledId: this.firstOn(other),
            offensive: team === poss,
            clock: stampFromClock(game.engine.clock),
        });
    }

    private renderPad(): TemplateResult {
        const game = this.game;
        if (!game) return html``;
        if (game.engine.pendingFt) return this.renderFtPad(game.engine.pendingFt.shooterId);
        return this.renderShotPad();
    }

    private renderFtPad(shooterId: string): TemplateResult {
        const clock = stampFromClock(
            this.game?.engine.clock ?? { period: 1, gameClockSeconds: 0, shotClockSeconds: 0, running: false },
        );
        return html`
            <section class="card">
                <h2>Free throws</h2>
                <div class="pad">
                    <button class="primary" @click=${() => this.record({ type: 'free_throw', shooterId, made: true, clock })}>Make FT</button>
                    <button @click=${() => this.record({ type: 'free_throw', shooterId, made: false, clock })}>Miss FT</button>
                </div>
            </section>
        `;
    }

    private renderShotPad(): TemplateResult {
        return html`
            <section class="card">
                <h2>${this.pending ? 'Shot' : 'Play'}</h2>
                <div class="pad">${this.shotButtons()}</div>
            </section>
        `;
    }

    private shotButtons(): TemplateResult {
        const game = this.game;
        if (!game) return html``;
        const clock = stampFromClock(game.engine.clock);
        const poss = game.engine.possession;
        const defense = poss === 'home' ? 'away' : 'home';
        return html`
            <button class="primary" ?disabled=${!this.pending} @click=${() => this.logShot(true)}>Make ○</button>
            <button ?disabled=${!this.pending} @click=${() => this.logShot(false)}>Miss ✕</button>
            <button @click=${() => this.record({ type: 'rebound', team: poss, playerId: this.firstOn(poss), offensive: true, clock })}>OREB</button>
            <button @click=${() => this.record({ type: 'rebound', team: defense, playerId: this.firstOn(defense), offensive: false, clock })}>DREB</button>
            <button @click=${() => this.record({ type: 'turnover', team: poss, playerId: this.firstOn(poss), clock })}>Turnover</button>
            <button @click=${() => this.recordFoul()}>Foul</button>
            <button @click=${() => {
                this.shootingFoul = !this.shootingFoul;
            }}>${this.shootingFoul ? 'Shooting foul on' : 'Shooting foul'}</button>
            <button @click=${() => this.record({ type: 'timeout', team: poss })}>Timeout</button>
            <button @click=${() => this.record({ type: 'period_end' })}>Period end</button>
            <button @click=${() => {
                this.pending = null;
            }}>Clear spot</button>
        `;
    }

    private renderBar(): TemplateResult {
        const game = this.game;
        if (!game) return html``;
        const log = [...game.events].reverse().slice(0, 12);
        return html`
            <footer class="bar">
                <button ?disabled=${!this.store?.canUndo || this.isWatch()} @click=${() => this.store?.undo()}>Undo</button>
                <button ?disabled=${!this.store?.canRedo || this.isWatch()} @click=${() => this.store?.redo()}>Redo</button>
                <button @click=${() => {
                    this.boxOpen = true;
                }}>Box score</button>
                <button @click=${() => this.store?.newGame()}>New game</button>
            </footer>
            <ul class="log">
                ${log.map((row) => html`<li>${describeEvent(row.event, game.engine)}</li>`)}
            </ul>
        `;
    }

    private renderWatch(): TemplateResult {
        const game = this.game;
        if (!game) return html``;
        const engine = game.engine;
        return html`
            <div class="sim">
                <span class="badge">${watchBadge(engine.over, this.watch.playing)}</span>
                <span>${this.watch.lastLabel}</span>
                <button ?disabled=${this.watch.playing || engine.over} @click=${() => void this.runWatchLoop()}>Play</button>
                <button ?disabled=${!this.watch.playing} @click=${() => this.watch.pause()}>Pause</button>
                <label>Speed
                    <select @change=${this.onSpeed}>
                        ${SPEED_OPTIONS.map(
                            (opt) => html`
                            <option value=${String(opt.value)} ?selected=${this.watch.speed === opt.value}>${opt.label}</option>
                        `,
                        )}
                    </select>
                </label>
            </div>
        `;
    }

    private readonly onSpeed = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        this.watch.speed = Number(target.value);
        this.requestUpdate();
    };

    private renderBox(): TemplateResult {
        const game = this.game;
        if (!game) return html``;
        const { engine, setup } = game;
        const text = `${boxScoreText(engine, 'away', setup.awayName)}\n\n${boxScoreText(engine, 'home', setup.homeName)}`;
        return html`
            <div class="overlay" @click=${() => {
                this.boxOpen = false;
            }}>
                <pre>${text}</pre>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'bball-game-shell': GameShell;
    }
}
