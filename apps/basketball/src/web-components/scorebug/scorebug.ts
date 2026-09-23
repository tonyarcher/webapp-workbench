import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
    bonusKind,
    formatClock,
    formatShotClock,
    getRulebook,
    parseClock,
    parseShotClock,
    periodLabel,
    stepSeconds,
} from 'basketball-core';
import type { ClockStamp, GameState } from 'basketball-core';
import styles from './scorebug.css?inline';

@customElement('bball-scorebug')
export class Scorebug extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) engine!: GameState;
    @property() homeName = 'HOME';
    @property() awayName = 'AWAY';
    @property({ type: Boolean }) editable = false;

    @state() private open = false;
    @state() private clockText = '';
    @state() private shotText = '';

    override willUpdate(): void {
        if (!this.engine) return;
        if (!this.open) {
            this.clockText = formatClock(this.engine.clock.gameClockSeconds);
            this.shotText = formatShotClock(this.engine.clock.shotClockSeconds);
        }
    }

    private emitClock(stamp: ClockStamp, running = this.engine.clock.running): void {
        this.dispatchEvent(
            new CustomEvent('clock-change', {
                detail: { clock: stamp, running },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private currentStamp(): ClockStamp {
        return {
            period: this.engine.clock.period,
            gameClockSeconds: this.engine.clock.gameClockSeconds,
            shotClockSeconds: this.engine.clock.shotClockSeconds,
        };
    }

    private periodMax(): number {
        const rb = getRulebook(this.engine.rulebookId);
        return this.engine.clock.period > rb.regulationPeriods ? rb.otLengthSeconds : rb.periodLengthSeconds;
    }

    private nudge = (delta: number): void => {
        this.emitClock({
            ...this.currentStamp(),
            gameClockSeconds: stepSeconds(this.engine.clock.gameClockSeconds, delta, this.periodMax()),
        });
    };

    private setShot = (seconds: number): void => {
        const rb = getRulebook(this.engine.rulebookId);
        this.emitClock({
            ...this.currentStamp(),
            shotClockSeconds: stepSeconds(seconds, 0, rb.shotClockSeconds),
        });
    };

    private onClockTyped = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        this.clockText = target.value;
        const parsed = parseClock(target.value);
        if (parsed == null) return;
        this.emitClock({ ...this.currentStamp(), gameClockSeconds: stepSeconds(parsed, 0, this.periodMax()) });
    };

    private onShotTyped = (event: Event): void => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        this.shotText = target.value;
        const parsed = parseShotClock(target.value);
        if (parsed == null) return;
        const rb = getRulebook(this.engine.rulebookId);
        this.emitClock({ ...this.currentStamp(), shotClockSeconds: stepSeconds(parsed, 0, rb.shotClockSeconds) });
    };

    private toggle = (): void => {
        if (!this.editable) return;
        this.open = !this.open;
    };

    override render(): TemplateResult {
        const rb = getRulebook(this.engine.rulebookId);
        return html`
            <header class="bug">
                ${this.teamBlock('away')}
                ${this.midBlock(rb.regulationPeriods)}
                ${this.teamBlock('home')}
            </header>
            ${this.open && this.editable ? this.renderEditor(rb.shotClockSeconds, rb.shotClockOrebSeconds) : ''}
        `;
    }

    private teamBlock(team: 'home' | 'away'): TemplateResult {
        const name = team === 'home' ? this.homeName : this.awayName;
        const score = this.engine.score[team];
        return html`
            <div class=${`team ${team}`}>
                ${team === 'away' ? html`<span class="stripe"></span>` : ''}
                <div class="meta">
                    <div class="name">${name}</div>
                    <div class="score">${score}</div>
                </div>
                ${team === 'home' ? html`<span class="stripe"></span>` : ''}
            </div>
        `;
    }

    private midBlock(regulationPeriods: number): TemplateResult {
        const shot = this.engine.clock.shotClockSeconds;
        const rb = getRulebook(this.engine.rulebookId);
        const bonusHome = bonusKind(rb, this.engine.teamFouls.away) !== 'none';
        const bonusAway = bonusKind(rb, this.engine.teamFouls.home) !== 'none';
        return html`
            <div class="mid">
                <div class="period">${periodLabel(this.engine.clock.period, regulationPeriods)}</div>
                <button class="clock-btn" @click=${this.toggle}>${formatClock(this.engine.clock.gameClockSeconds)}</button>
                <div class=${shot <= 5 ? 'shot low' : 'shot'}>${formatShotClock(shot)}</div>
                <div class="bonus">${bonusLabel(bonusAway, bonusHome)}</div>
            </div>
        `;
    }

    private renderEditor(full: number, oreb: number): TemplateResult {
        return html`
            <div class="editor">
                <button @click=${() => this.nudge(-60)}>-1:00</button>
                <button @click=${() => this.nudge(-10)}>-10</button>
                <button @click=${() => this.nudge(-1)}>-1</button>
                <input .value=${this.clockText} @input=${this.onClockTyped} aria-label="Game clock"/>
                <button @click=${() => this.nudge(1)}>+1</button>
                <button @click=${() => this.nudge(10)}>+10</button>
                <button @click=${() => this.nudge(60)}>+1:00</button>
                <input .value=${this.shotText} @input=${this.onShotTyped} aria-label="Shot clock"/>
                <button @click=${() => this.setShot(full)}>Reset ${full}</button>
                <button @click=${() => this.setShot(oreb)}>OREB ${oreb}</button>
            </div>
        `;
    }
}

function bonusLabel(away: boolean, home: boolean): string {
    if (away && home) return 'BONUS BOTH';
    if (away) return 'BONUS AWAY';
    if (home) return 'BONUS HOME';
    return '';
}

declare global {
    interface HTMLElementTagNameMap {
        'bball-scorebug': Scorebug;
    }
}
